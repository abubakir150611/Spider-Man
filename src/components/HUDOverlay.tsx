interface Props {
  visible: boolean;
  mouseX: number;
  mouseY: number;
}

export default function HUDOverlay({ visible, mouseX, mouseY }: Props) {
  const offsetX = (mouseX - 0.5) * 12;
  const offsetY = (mouseY - 0.5) * 8;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.6s ease",
      }}
    >
      {/* Scan line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 2,
          background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.15), transparent)",
          animation: visible ? "hudScan 4s linear infinite" : "none",
        }}
      />

      {/* Corner brackets */}
      {[
        { top: 60, left: 60, borderTop: "1px solid rgba(0,212,255,0.4)", borderLeft: "1px solid rgba(0,212,255,0.4)" },
        { top: 60, right: 60, borderTop: "1px solid rgba(0,212,255,0.4)", borderRight: "1px solid rgba(0,212,255,0.4)" },
        { bottom: 60, left: 60, borderBottom: "1px solid rgba(0,212,255,0.4)", borderLeft: "1px solid rgba(0,212,255,0.4)" },
        { bottom: 60, right: 60, borderBottom: "1px solid rgba(0,212,255,0.4)", borderRight: "1px solid rgba(0,212,255,0.4)" },
      ].map((style, i) => (
        <div key={i} style={{ position: "absolute", width: 40, height: 40, ...style }} />
      ))}

      {/* Center crosshair */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
          transition: "transform 0.1s ease",
        }}
      >
        {/* Outer ring */}
        <div style={{
          position: "absolute",
          width: 80,
          height: 80,
          borderRadius: "50%",
          border: "1px solid rgba(0,212,255,0.25)",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          animation: "spinSlow 8s linear infinite",
        }}>
          {[0, 90, 180, 270].map(deg => (
            <div key={deg} style={{
              position: "absolute",
              width: 6,
              height: 1,
              background: "rgba(0,212,255,0.6)",
              top: "50%",
              left: deg === 270 ? -6 : deg === 90 ? "100%" : "50%",
              transform: `rotate(${deg}deg)`,
              transformOrigin: "left center",
            }} />
          ))}
        </div>

        {/* Inner dot */}
        <div style={{
          position: "absolute",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "rgba(0,212,255,0.8)",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          boxShadow: "0 0 10px rgba(0,212,255,0.6)",
          animation: "pulse 2s ease-in-out infinite",
        }} />

        {/* Cross lines */}
        <div style={{ position: "absolute", width: 30, height: 1, background: "rgba(0,212,255,0.5)", top: "50%", left: "50%", transform: "translate(8px, 0)" }} />
        <div style={{ position: "absolute", width: 30, height: 1, background: "rgba(0,212,255,0.5)", top: "50%", left: "50%", transform: "translate(-38px, 0)" }} />
        <div style={{ position: "absolute", width: 1, height: 30, background: "rgba(0,212,255,0.5)", top: "50%", left: "50%", transform: "translate(0, 8px)" }} />
        <div style={{ position: "absolute", width: 1, height: 30, background: "rgba(0,212,255,0.5)", top: "50%", left: "50%", transform: "translate(0, -38px)" }} />
      </div>

      {/* Left panel */}
      <div style={{
        position: "absolute",
        left: 60,
        bottom: 80,
        fontFamily: "'Space Mono', monospace",
        fontSize: 9,
        color: "rgba(0,212,255,0.6)",
        letterSpacing: "0.1em",
        lineHeight: 2,
      }}>
        <div style={{ color: "rgba(0,212,255,0.3)", marginBottom: 4 }}>// ENVIRONMENT</div>
        <div>THREAT LEVEL — MINIMAL</div>
        <div>SCAN RANGE — 12.4m</div>
        <div>TEMP — 21.3°C</div>
        <div>WIND — 0.8 m/s NW</div>
        <div style={{ marginTop: 12, color: "rgba(0,212,255,0.3)" }}>// SUIT STATUS</div>
        <div style={{ color: "rgba(255,255,255,0.6)" }}>INTEGRITY — 100%</div>
        <div style={{ color: "rgba(255,255,255,0.6)" }}>POWER — OPTIMAL</div>
      </div>

      {/* Right panel */}
      <div style={{
        position: "absolute",
        right: 60,
        bottom: 80,
        fontFamily: "'Space Mono', monospace",
        fontSize: 9,
        color: "rgba(0,212,255,0.6)",
        letterSpacing: "0.1em",
        lineHeight: 2,
        textAlign: "right",
      }}>
        <div style={{ color: "rgba(0,212,255,0.3)", marginBottom: 4 }}>// COORDINATES</div>
        <div>LAT — 40.7128° N</div>
        <div>LON — 74.0060° W</div>
        <div>ALT — 312.4m</div>
        <div style={{ marginTop: 12, color: "rgba(0,212,255,0.3)" }}>// SYSTEM</div>
        <div>EVA AI — ACTIVE</div>
        <div>HUD SYNC — 60fps</div>
      </div>

      {/* Top center - target */}
      <div style={{
        position: "absolute",
        top: 60,
        left: "50%",
        transform: "translateX(-50%)",
        fontFamily: "'Space Mono', monospace",
        fontSize: 9,
        color: "rgba(0,212,255,0.4)",
        letterSpacing: "0.2em",
        display: "flex",
        gap: 32,
      }}>
        <span>TARGET // NONE</span>
        <span style={{ color: "rgba(0,212,255,0.2)" }}>|</span>
        <span>MODE // ANALYSIS</span>
      </div>

      {/* Waveform bottom center */}
      <div style={{
        position: "absolute",
        bottom: 60,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 2,
        alignItems: "center",
      }}>
        {Array.from({ length: 32 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 2,
              height: Math.abs(Math.sin(i * 0.5)) * 16 + 2,
              background: `rgba(0,212,255,${0.2 + Math.abs(Math.sin(i * 0.7)) * 0.4})`,
              animation: `pulse ${1 + i * 0.05}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      {/* Target markers - scattered */}
      {[
        { x: "25%", y: "35%" },
        { x: "70%", y: "28%" },
        { x: "45%", y: "65%" },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: pos.x,
            top: pos.y,
            width: 20,
            height: 20,
            border: "1px solid rgba(196,18,48,0.4)",
            animation: `targetLock 0.5s ease ${i * 0.2}s both`,
          }}
        >
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "rgba(196,18,48,0.5)",
          }} />
        </div>
      ))}
    </div>
  );
}
