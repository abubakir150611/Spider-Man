interface Props {
  currentScene: number;
  total?: number;
}

const SCENE_LABELS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15"];

export default function ProgressIndicator({ currentScene, total = 15 }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        right: 32,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 500,
        alignItems: "flex-end",
      }}
    >
      {SCENE_LABELS.slice(0, total).map((label, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: Math.abs(i - currentScene) <= 2 ? 1 : 0.3,
            transition: "opacity 0.4s ease",
          }}
        >
          {i === currentScene && (
            <div
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 8,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.1em",
              }}
            >
              {label}
            </div>
          )}
          <div
            style={{
              width: i === currentScene ? 20 : 4,
              height: 1,
              background: i === currentScene ? "#c41230" : "rgba(255,255,255,0.2)",
              transition: "width 0.4s ease, background 0.4s ease",
              boxShadow: i === currentScene ? "0 0 6px rgba(196,18,48,0.6)" : "none",
            }}
          />
          <div
            style={{
              width: 3,
              height: 3,
              borderRadius: "50%",
              background: i === currentScene ? "#c41230" : "rgba(255,255,255,0.2)",
              transition: "background 0.4s ease",
              boxShadow: i === currentScene ? "0 0 4px #c41230" : "none",
            }}
          />
        </div>
      ))}
    </div>
  );
}
