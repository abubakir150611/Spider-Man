import { useMemo } from "react";

interface Props {
  scrollProgress: number;
  onExploreAgain: () => void;
}

interface SceneDef {
  startT: number;
  endT: number;
  sceneNum: number;
  content: React.ReactNode;
  position?: "center" | "bottom-left" | "top-left" | "center-left";
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const alpha = (t: number, start: number, fadeIn: number, fadeOut: number, end: number) => {
  if (t < start || t > end) return 0;
  if (t < start + fadeIn) return clamp((t - start) / fadeIn, 0, 1);
  if (t > end - fadeOut) return clamp((end - t) / fadeOut, 0, 1);
  return 1;
};

function SceneLabel({ text, small }: { text: string; small?: boolean }) {
  return (
    <div style={{
      fontFamily: "'Space Mono', monospace",
      fontSize: small ? 9 : 10,
      letterSpacing: "0.25em",
      color: "rgba(196,18,48,0.8)",
      marginBottom: small ? 6 : 10,
    }}>
      {text}
    </div>
  );
}

function LargeTitleBlock({ label, title, sub }: { label?: string; title: string; sub?: string }) {
  return (
    <>
      {label && <SceneLabel text={label} />}
      <h2 style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 900,
        fontSize: "clamp(48px, 8vw, 96px)",
        lineHeight: 0.9,
        letterSpacing: "-0.01em",
        color: "white",
        textTransform: "uppercase",
        marginBottom: 16,
      }}>
        {title}
      </h2>
      {sub && (
        <p style={{
          fontFamily: "'Barlow', sans-serif",
          fontSize: "clamp(13px, 1.6vw, 16px)",
          color: "rgba(255,255,255,0.45)",
          fontWeight: 300,
          letterSpacing: "0.05em",
          maxWidth: 420,
        }}>
          {sub}
        </p>
      )}
    </>
  );
}

function TechLabel({ text, value }: { text: string; value?: string }) {
  return (
    <div style={{
      display: "flex",
      gap: 12,
      alignItems: "center",
      marginBottom: 8,
    }}>
      <div style={{ width: 20, height: 1, background: "rgba(196,18,48,0.6)" }} />
      <span style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: 9,
        color: "rgba(255,255,255,0.5)",
        letterSpacing: "0.15em",
      }}>
        {text}
      </span>
      {value && (
        <span style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 9,
          color: "rgba(196,18,48,0.6)",
        }}>
          {value}
        </span>
      )}
    </div>
  );
}

export default function SceneText({ scrollProgress: t, onExploreAgain }: Props) {
  const scenes = useMemo<SceneDef[]>(() => [
    {
      startT: 0, endT: 0.10, sceneNum: 1,
      position: "center",
      content: (
        <div style={{ textAlign: "center" }}>
          <SceneLabel text="// SCENE 01" small />
          <LargeTitleBlock title={"THE\nMASK"} sub="Every detail has a purpose." />
          <div style={{
            marginTop: 40,
            fontFamily: "'Space Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.3em",
            color: "rgba(255,255,255,0.2)",
            animation: "pulse 2.5s ease-in-out infinite",
          }}>
            SCROLL TO EXPLORE
          </div>
          <div style={{
            position: "absolute",
            bottom: -80,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "'Space Mono', monospace",
            fontSize: 10,
            color: "rgba(255,255,255,0.2)",
            letterSpacing: "0.2em",
          }}>
            01 / 15
          </div>
        </div>
      ),
    },
    {
      startT: 0.11, endT: 0.23, sceneNum: 2,
      position: "bottom-left",
      content: (
        <>
          <SceneLabel text="// SCENE 02" small />
          <LargeTitleBlock label="OPTICAL SYSTEM" title="THE EYES" sub="Conceptual multi-layer lens architecture." />
          <div style={{ marginTop: 24 }}>
            {["01 — PROTECTIVE LAYER", "02 — OPTICAL ARRAY", "03 — SENSOR MATRIX", "04 — HUD DISPLAY", "05 — INNER FRAME"].map(l => (
              <TechLabel key={l} text={l} />
            ))}
          </div>
        </>
      ),
    },
    {
      startT: 0.24, endT: 0.36, sceneNum: 3,
      position: "center-left",
      content: (
        <>
          <SceneLabel text="// SCENE 03" small />
          <LargeTitleBlock title="INSIDE THE LENS" sub="Fictional optical analysis pathway." />
          <div style={{ marginTop: 20 }}>
            <TechLabel text="SENSOR ARRAY" value="ACTIVE" />
            <TechLabel text="HUD SYSTEM" value="SYNC" />
            <TechLabel text="OPTIC DEPTH" value="∞" />
          </div>
        </>
      ),
    },
    {
      startT: 0.37, endT: 0.47, sceneNum: 4,
      position: "bottom-left",
      content: (
        <>
          <SceneLabel text="// SCENE 04" small />
          <LargeTitleBlock title="FABRIC" sub="Conceptual suit surface material — a design interpretation." />
          <div style={{ marginTop: 20 }}>
            {["FIBER STRUCTURE", "FLEXIBLE LAYER", "IMPACT ABSORPTION", "THERMAL CONTROL"].map(l => (
              <TechLabel key={l} text={l} />
            ))}
          </div>
        </>
      ),
    },
    {
      startT: 0.47, endT: 0.56, sceneNum: 5,
      position: "bottom-left",
      content: (
        <>
          <SceneLabel text="// SCENE 05" small />
          <LargeTitleBlock title="WEB PATTERN" sub="Three-dimensional raised surface detail." />
          <div style={{ marginTop: 16 }}>
            <TechLabel text="SURFACE DEPTH" value="0.4mm" />
            <TechLabel text="GRID DENSITY" value="HIGH" />
            <TechLabel text="FLEX RATING" value="∞" />
          </div>
        </>
      ),
    },
    {
      startT: 0.57, endT: 0.65, sceneNum: 6,
      position: "top-left",
      content: (
        <>
          <SceneLabel text="// SCENE 06" small />
          <LargeTitleBlock
            title={"THE\nINTELLIGENCE"}
            sub="EVA — Conceptual AI interface. A fictional system created for this experience."
          />
          <div style={{ marginTop: 20 }}>
            {[
              { text: "ENVIRONMENT SENSORS", val: "ACTIVE" },
              { text: "MOTION ANALYSIS", val: "ENABLED" },
              { text: "TARGET DATA", val: "SCANNING" },
              { text: "SUIT STATUS", val: "OPTIMAL" },
            ].map(({ text, val }) => (
              <TechLabel key={text} text={text} value={val} />
            ))}
          </div>
        </>
      ),
    },
    {
      startT: 0.66, endT: 0.72, sceneNum: 7,
      position: "top-left",
      content: (
        <>
          <SceneLabel text="// SCENE 07" small />
          <LargeTitleBlock title="HUD ACTIVE" sub="First-person visual interface — conceptual display system." />
        </>
      ),
    },
    {
      startT: 0.73, endT: 0.79, sceneNum: 8,
      position: "bottom-left",
      content: (
        <>
          <SceneLabel text="// SCENE 08" small />
          <LargeTitleBlock title="THE SYMBOL" sub="From particles to emblem — a cinematic formation." />
          <div style={{ marginTop: 20 }}>
            <TechLabel text="SURFACE STRUCTURE" />
            <TechLabel text="MOUNTING LAYER" />
            <TechLabel text="EMBLEM CORE" />
          </div>
        </>
      ),
    },
    {
      startT: 0.80, endT: 0.86, sceneNum: 9,
      position: "center-left",
      content: (
        <>
          <SceneLabel text="// SCENE 09" small />
          <LargeTitleBlock title="COLOR SYSTEM" sub="Visual design interpretation — identity through contrast." />
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { color: "#c41230", name: "RED", desc: "IDENTITY / ENERGY / VISUAL IMPACT" },
              { color: "#1a3a7a", name: "BLUE", desc: "CONTRAST / DEPTH / TECHNOLOGY" },
            ].map(({ color, name, desc }) => (
              <div key={name} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 3, height: 36, background: color, boxShadow: `0 0 8px ${color}` }} />
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: "white", letterSpacing: "0.1em" }}>{name}</div>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em" }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      startT: 0.87, endT: 0.90, sceneNum: 10,
      position: "top-left",
      content: (
        <>
          <SceneLabel text="// SCENE 10" small />
          <LargeTitleBlock title="SUIT ARCHIVE" sub="Five conceptual suit interpretations." />
        </>
      ),
    },
    {
      startT: 0.91, endT: 0.93, sceneNum: 11,
      position: "bottom-left",
      content: (
        <>
          <SceneLabel text="// SCENE 11" small />
          <LargeTitleBlock title="ADVANCED SUIT" sub="The visual climax. Engineered for precision." />
          <div style={{ marginTop: 16 }}>
            {["MASK", "LENSES", "CHEST EMBLEM", "ARMS", "GLOVES", "BOOTS", "FABRIC"].map(l => (
              <TechLabel key={l} text={`INSPECT — ${l}`} />
            ))}
          </div>
        </>
      ),
    },
    {
      startT: 0.93, endT: 0.95, sceneNum: 12,
      position: "bottom-left",
      content: (
        <>
          <SceneLabel text="// SCENE 12" small />
          <LargeTitleBlock title="IRON SPIDER" sub="Mechanical integration. Red, gold, and titanium — a design concept." />
        </>
      ),
    },
    {
      startT: 0.95, endT: 0.97, sceneNum: 13,
      position: "bottom-left",
      content: (
        <>
          <SceneLabel text="// SCENE 13" small />
          <LargeTitleBlock title="SCARLET SPIDER" sub="Red-dominant. Raw energy. Unfiltered identity." />
        </>
      ),
    },
    {
      startT: 0.97, endT: 0.99, sceneNum: 14,
      position: "center",
      content: (
        <div style={{ textAlign: "center" }}>
          <SceneLabel text="// SCENE 14" small />
          <LargeTitleBlock title="COMPARISON" sub="Five eras. One symbol." />
        </div>
      ),
    },
    {
      startT: 0.995, endT: 1.0, sceneNum: 15,
      position: "center",
      content: (
        <div style={{ textAlign: "center" }}>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: "clamp(28px, 4vw, 48px)",
            fontWeight: 300,
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.7)",
            marginBottom: 12,
            fontStyle: "italic",
          }}>
            EVERY HERO HAS A STORY.
          </p>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: "clamp(28px, 4vw, 48px)",
            fontWeight: 300,
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.5)",
            marginBottom: 48,
            fontStyle: "italic",
          }}>
            EVERY SUIT STARTS WITH AN IDEA.
          </p>
          <button
            data-cursor="EXPLORE"
            onClick={onExploreAgain}
            style={{
              background: "none",
              border: "1px solid rgba(196,18,48,0.6)",
              color: "white",
              fontFamily: "'Space Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.3em",
              padding: "14px 36px",
              transition: "all 0.3s ease",
              boxShadow: "0 0 20px rgba(196,18,48,0.1)",
            }}
            onMouseEnter={e => {
              (e.target as HTMLElement).style.background = "rgba(196,18,48,0.15)";
              (e.target as HTMLElement).style.boxShadow = "0 0 30px rgba(196,18,48,0.3)";
            }}
            onMouseLeave={e => {
              (e.target as HTMLElement).style.background = "none";
              (e.target as HTMLElement).style.boxShadow = "0 0 20px rgba(196,18,48,0.1)";
            }}
          >
            EXPLORE AGAIN
          </button>
        </div>
      ),
    },
  ], [onExploreAgain]);

  const positionStyles: Record<string, React.CSSProperties> = {
    center: {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      textAlign: "center",
    },
    "bottom-left": {
      position: "fixed",
      bottom: 80,
      left: 60,
      maxWidth: 480,
    },
    "top-left": {
      position: "fixed",
      top: 100,
      left: 60,
      maxWidth: 480,
    },
    "center-left": {
      position: "fixed",
      top: "50%",
      left: 60,
      transform: "translateY(-50%)",
      maxWidth: 480,
    },
  };

  return (
    <>
      {scenes.map((scene) => {
        const a = alpha(t, scene.startT, 0.02, 0.02, scene.endT);
        if (a < 0.01) return null;
        return (
          <div
            key={scene.sceneNum}
            style={{
              ...(positionStyles[scene.position || "bottom-left"] as React.CSSProperties),
              zIndex: 300,
              opacity: a,
              pointerEvents: a > 0.5 ? "auto" : "none",
              transition: "opacity 0.1s linear",
            }}
          >
            {scene.content}
          </div>
        );
      })}
    </>
  );
}
