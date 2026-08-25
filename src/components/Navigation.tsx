interface Props {
  onNavigate: (scene: number) => void;
  currentScene: number;
}

const NAV_ITEMS = [
  { label: "MASK", scene: 0 },
  { label: "TECH", scene: 1 },
  { label: "AI", scene: 5 },
  { label: "SYMBOL", scene: 7 },
  { label: "SUITS", scene: 9 },
];

export default function Navigation({ onNavigate, currentScene }: Props) {
  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "24px 40px",
        background: "linear-gradient(to bottom, rgba(5,5,5,0.8) 0%, transparent 100%)",
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 80 80" fill="none">
          <ellipse cx="40" cy="28" rx="7" ry="9" fill="#c41230" />
          <ellipse cx="40" cy="52" rx="11" ry="13" fill="#c41230" />
          {["M40,32 Q20,28 8,18", "M40,32 Q22,38 12,42", "M40,32 Q60,28 72,18", "M40,32 Q58,38 68,42"].map((d, i) => (
            <path key={i} d={d} stroke="#c41230" strokeWidth="2.5" strokeLinecap="round" />
          ))}
        </svg>
        <div>
          <div
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: "white",
              lineHeight: 1,
            }}
          >
            SPIDER
          </div>
          <div
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 8,
              color: "rgba(255,255,255,0.3)",
              letterSpacing: "0.2em",
              lineHeight: 1,
              marginTop: 2,
            }}
          >
            // ARCHIVE
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ display: "flex", gap: 36, alignItems: "center" }}>
        {NAV_ITEMS.map(({ label, scene }) => (
          <button
            key={label}
            data-cursor="NAVIGATE"
            onClick={() => onNavigate(scene)}
            style={{
              background: "none",
              border: "none",
              fontFamily: "'Space Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.2em",
              color: currentScene === scene ? "white" : "rgba(255,255,255,0.35)",
              padding: "4px 0",
              position: "relative",
              transition: "color 0.3s ease",
            }}
          >
            {label}
            {currentScene === scene && (
              <div
                style={{
                  position: "absolute",
                  bottom: -2,
                  left: 0,
                  right: 0,
                  height: 1,
                  background: "#c41230",
                  boxShadow: "0 0 6px #c41230",
                }}
              />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
