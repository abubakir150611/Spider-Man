#!/usr/bin/env python3
"""AI Content Factory TTS worker.

Reads a JSON job from stdin:
  {"jobs": [{"id", "text", "lang", "chain": [...], "voices": {...}, "rate", "pitch", "out_dir"}], "models_dir": "..."}
Writes JSON to stdout:
  {"results": [{"id", "ok", "provider", "voice", "audio", "words": [{"text","start","end"}] | null, "attempts": [...]}]}

Providers (all free):
  edge   - Microsoft Edge online neural voices via the `edge-tts` package (natural, needs internet)
  piper  - local neural TTS via `piper-tts` (offline after the first model download)
  mms    - Meta MMS-TTS via `transformers` (local, supports Kyrgyz: facebook/mms-tts-kir)
  espeak - espeak-ng CLI (always offline, robotic - last resort)
"""
import asyncio
import json
import os
import shutil
import subprocess
import sys
import time
import traceback
from pathlib import Path


def log(msg):
    print(msg, file=sys.stderr, flush=True)


class ProviderUnavailable(Exception):
    """Provider is not installed / not configured - try the next one."""


# ---------------------------------------------------------------- edge-tts
_DEAD = {}


def synth_edge(job, voice, out_base):
    if "edge" in _DEAD:
        raise ProviderUnavailable(f"edge-tts недоступен в этом запуске: {_DEAD['edge']}")
    try:
        import edge_tts  # noqa: F401
    except ImportError as exc:
        raise ProviderUnavailable("edge-tts не установлен (pip install edge-tts)") from exc
    if not voice:
        raise ProviderUnavailable(f"нет edge-голоса для языка {job['lang']}")

    async def go():
        import edge_tts
        comm = edge_tts.Communicate(
            job["text"], voice, rate=job.get("rate") or "+0%", pitch=job.get("pitch") or "+0Hz", boundary="WordBoundary"
        )
        audio = bytearray()
        words = []
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                audio.extend(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 10_000_000
                end = (chunk["offset"] + chunk["duration"]) / 10_000_000
                words.append({"text": chunk["text"], "start": round(start, 3), "end": round(end, 3)})
        return bytes(audio), words

    last = None
    for attempt in range(3):
        try:
            audio, words = asyncio.run(go())
            if not audio:
                raise RuntimeError("пустой ответ от сервиса")
            out = out_base.with_suffix(".mp3")
            out.write_bytes(audio)
            return str(out), words or None
        except Exception as exc:  # network errors, 403 token refresh, etc.
            last = exc
            if "Cannot connect to host" in str(exc) or "Name or service not known" in str(exc):
                _DEAD["edge"] = "нет соединения с speech.platform.bing.com"
                break
            log(f"edge-tts попытка {attempt + 1}/3: {exc}")
            time.sleep(1.5 * (2**attempt))
    raise RuntimeError(f"edge-tts недоступен: {str(last).split(' ssl:')[0]}")


# ---------------------------------------------------------------- piper
def synth_piper(job, voice, out_base, models_dir):
    try:
        import wave
        from piper import PiperVoice
    except ImportError as exc:
        raise ProviderUnavailable("piper-tts не установлен (pip install piper-tts)") from exc
    if not voice:
        raise ProviderUnavailable(f"нет piper-голоса для языка {job['lang']}")
    piper_dir = Path(models_dir) / "piper"
    piper_dir.mkdir(parents=True, exist_ok=True)
    model = piper_dir / f"{voice}.onnx"
    if not model.exists():
        log(f"piper: скачиваю голос {voice} ...")
        proc = subprocess.run(
            [sys.executable, "-m", "piper.download_voices", "--download-dir", str(piper_dir), voice],
            capture_output=True, text=True, timeout=600,
        )
        if proc.returncode != 0 or not model.exists():
            raise RuntimeError(f"не удалось скачать голос piper {voice}: {proc.stderr.strip()[-400:]}")
    pv = PiperVoice.load(str(model))
    out = out_base.with_suffix(".wav")
    with wave.open(str(out), "wb") as wav:
        if hasattr(pv, "synthesize_wav"):
            pv.synthesize_wav(job["text"], wav)
        else:  # piper-tts < 1.3
            pv.synthesize(job["text"], wav)
    return str(out), None


# ---------------------------------------------------------------- MMS
_MMS_CACHE = {}


def synth_mms(job, voice, out_base, models_dir):
    try:
        import numpy as np
        import torch
        from transformers import AutoTokenizer, VitsModel
    except ImportError as exc:
        raise ProviderUnavailable("transformers/torch не установлены (pip install -r requirements-kyrgyz.txt)") from exc
    if not voice:
        raise ProviderUnavailable(f"нет MMS-модели для языка {job['lang']}")
    cache_dir = str(Path(models_dir) / "hf")
    if voice not in _MMS_CACHE:
        log(f"mms: загружаю модель {voice} ...")
        tok = AutoTokenizer.from_pretrained(voice, cache_dir=cache_dir)
        model = VitsModel.from_pretrained(voice, cache_dir=cache_dir)
        model.eval()
        _MMS_CACHE[voice] = (tok, model)
    tok, model = _MMS_CACHE[voice]
    text = job["text"]
    if getattr(tok, "is_uroman", False):
        try:
            import uroman as ur

            text = ur.Uroman().romanize_string(text)
        except ImportError as exc:
            raise ProviderUnavailable("для этой MMS-модели нужен пакет uroman (pip install uroman)") from exc
    rate = job.get("rate") or "+0%"
    try:
        speed = 1 + int(rate.strip("%")) / 100
    except ValueError:
        speed = 1.0
    model.speaking_rate = max(0.5, min(2.0, speed))
    torch.manual_seed(1234)
    inputs = tok(text, return_tensors="pt")
    with torch.no_grad():
        wave_data = model(**inputs).waveform[0].cpu().numpy()
    import wave

    pcm = (np.clip(wave_data, -1, 1) * 32767).astype("<i2")
    out = out_base.with_suffix(".wav")
    with wave.open(str(out), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(model.config.sampling_rate)
        wav.writeframes(pcm.tobytes())
    return str(out), None


# ---------------------------------------------------------------- espeak-ng
def synth_espeak(job, voice, out_base):
    binary = shutil.which("espeak-ng") or shutil.which("espeak")
    if not binary:
        raise ProviderUnavailable("espeak-ng не установлен")
    rate = job.get("rate") or "+0%"
    try:
        wpm = int(165 * (1 + int(rate.strip("%")) / 100))
    except ValueError:
        wpm = 165
    out = out_base.with_suffix(".wav")
    proc = subprocess.run([binary, "-v", voice or job["lang"], "-s", str(wpm), "-w", str(out), job["text"]], capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip())
    return str(out), None


def run_job(job, models_dir):
    out_dir = Path(job["out_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    out_base = out_dir / job["id"]
    attempts = []
    for provider in job["chain"]:
        voice = job.get("voices", {}).get(provider)
        try:
            if provider == "edge":
                audio, words = synth_edge(job, voice, out_base)
            elif provider == "piper":
                audio, words = synth_piper(job, voice, out_base, models_dir)
            elif provider == "mms":
                audio, words = synth_mms(job, voice, out_base, models_dir)
            elif provider == "espeak":
                audio, words = synth_espeak(job, voice, out_base)
            else:
                raise ProviderUnavailable(f"неизвестный провайдер {provider}")
            attempts.append({"provider": provider, "ok": True})
            return {"id": job["id"], "ok": True, "provider": provider, "voice": voice, "audio": audio, "words": words, "attempts": attempts}
        except ProviderUnavailable as exc:
            attempts.append({"provider": provider, "ok": False, "error": str(exc), "unavailable": True})
        except Exception as exc:  # provider failed, fall through to the next one
            attempts.append({"provider": provider, "ok": False, "error": f"{exc}"})
            log(traceback.format_exc(limit=2))
    return {"id": job["id"], "ok": False, "attempts": attempts}


def probe():
    """Reports which providers are importable/installed (used by `cf doctor`)."""
    status = {}
    for name, mod in (("edge", "edge_tts"), ("piper", "piper"), ("mms", "transformers")):
        try:
            __import__(mod)
            status[name] = True
        except ImportError:
            status[name] = False
    status["espeak"] = bool(shutil.which("espeak-ng") or shutil.which("espeak"))
    return status


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--probe":
        print(json.dumps(probe()))
        return
    payload = json.load(sys.stdin)
    models_dir = payload.get("models_dir") or os.path.join(os.getcwd(), ".models")
    results = [run_job(job, models_dir) for job in payload["jobs"]]
    print(json.dumps({"results": results}, ensure_ascii=False))


if __name__ == "__main__":
    main()
