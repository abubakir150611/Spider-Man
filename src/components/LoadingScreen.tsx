import { useEffect, useState } from "react";

interface Props {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: Props) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "fadeout">("loading");

  useEffect(() => {
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 3 + 0.5;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setTimeout(() => {
          setPhase("fadeout");
          setTimeout(onComplete, 800);
        }, 400);
      }
      setProgress(Math.floor(p));
    }, 30);
    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#050505",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        opacity: phase === "fadeout" ? 0 : 1,
        transition: "opacity 0.8s ease",
        pointerEvents: phase === "fadeout" ? "none" : "all",
      }}
    >
      {/* Animated corner lines */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 60,
            height: 60,
            ...[
              { top: 40, left: 40, borderTop: "1px solid rgba(196,18,48,0.4)", borderLeft: "1px solid rgba(196,18,48,0.4)" },
              { top: 40, right: 40, borderTop: "1px solid rgba(196,18,48,0.4)", borderRight: "1px solid rgba(196,18,48,0.4)" },
              { bottom: 40, left: 40, borderBottom: "1px solid rgba(196,18,48,0.4)", borderLeft: "1px solid rgba(196,18,48,0.4)" },
              { bottom: 40, right: 40, borderBottom: "1px solid rgba(196,18,48,0.4)", borderRight: "1px solid rgba(196,18,48,0.4)" },
            ][i],
          }}
        />
      ))}

      {/* Spider symbol SVG */}
      <div style={{ marginBottom: 48, animation: "spiderPulse 2s ease-in-out infinite" }}>
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          {/* Spider body */}
          <ellipse cx="40" cy="28" rx="8" ry="10" fill="#c41230" />
          <ellipse cx="40" cy="52" rx="12" ry="14" fill="#c41230" />
          {/* Legs */}
          {[
            "M40,32 Q20,28 8,18", "M40,32 Q22,38 12,42",
            "M40,32 Q60,28 72,18", "M40,32 Q58,38 68,42",
            "M40,38 Q18,40 6,52", "M40,38 Q62,40 74,52",
            "M40,42 Q22,50 14,62", "M40,42 Q58,50 66,62",
          ].map((d, i) => (
            <path key={i} d={d} stroke="#c41230" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          ))}
        </svg>
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11,
          letterSpacing: "0.35em",
          color: "rgba(255,255,255,0.4)",
          marginBottom: 8,
          fontWeight: 400,
        }}
      >
        SPIDER // ARCHIVE
      </div>

      <div
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 13,
          letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.6)",
          marginBottom: 40,
        }}
      >
        INITIALIZING SUIT SYSTEM
      </div>

      {/* Progress bar container */}
      <div style={{ width: 280, position: "relative" }}>
        <div
          style={{
            width: "100%",
            height: 1,
            background: "rgba(255,255,255,0.08)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(90deg, #c41230, #ff3355)",
              transition: "width 0.1s linear",
              boxShadow: "0 0 8px rgba(196,18,48,0.8)",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 12,
            fontFamily: "'Space Mono', monospace",
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.1em",
          }}
        >
          <span>SYS.BOOT</span>
          <span style={{ color: "rgba(196,18,48,0.8)" }}>{String(progress).padStart(3, "0")}%</span>
          <span>READY</span>
        </div>
      </div>

      {/* Scan line effect */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 2,
            background: "linear-gradient(transparent, rgba(196,18,48,0.15), transparent)",
            animation: "scanLine 3s linear infinite",
          }}
        />
      </div>
    </div>
  );
}
