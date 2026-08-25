import { useEffect, useRef, useState } from "react";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState("");
  const [isHovering, setIsHovering] = useState(false);
  const posRef = useRef({ x: 0, y: 0 });
  const dotPos = useRef({ x: 0, y: 0 });
  const ringPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const onMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const interactive = el?.closest("[data-cursor]");
      if (interactive) {
        setIsHovering(true);
        setLabel((interactive as HTMLElement).dataset.cursor || "INSPECT");
      } else {
        setIsHovering(false);
        setLabel("");
      }
    };

    const onClick = (e: MouseEvent) => {
      if (!rippleRef.current) return;
      const r = rippleRef.current;
      r.style.left = `${e.clientX}px`;
      r.style.top = `${e.clientY}px`;
      r.style.animation = "none";
      void r.offsetWidth;
      r.style.animation = "ripple 0.6s ease-out forwards";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("click", onClick);

    let raf: number;
    const animate = () => {
      if (dotRef.current && ringRef.current) {
        dotPos.current.x = lerp(dotPos.current.x, posRef.current.x, 0.9);
        dotPos.current.y = lerp(dotPos.current.y, posRef.current.y, 0.9);
        ringPos.current.x = lerp(ringPos.current.x, posRef.current.x, 0.15);
        ringPos.current.y = lerp(ringPos.current.y, posRef.current.y, 0.15);

        dotRef.current.style.transform = `translate(${dotPos.current.x - 4}px, ${dotPos.current.y - 4}px)`;
        ringRef.current.style.transform = `translate(${ringPos.current.x - (isHovering ? 24 : 16)}px, ${ringPos.current.y - (isHovering ? 24 : 16)}px)`;
      }
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("click", onClick);
      cancelAnimationFrame(raf);
    };
  }, [isHovering]);

  return (
    <>
      {/* Dot */}
      <div
        ref={dotRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: isHovering ? "#c41230" : "white",
          pointerEvents: "none",
          zIndex: 99999,
          mixBlendMode: "normal",
          transition: "background 0.2s, width 0.2s, height 0.2s",
        }}
      />

      {/* Ring */}
      <div
        ref={ringRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: isHovering ? 48 : 32,
          height: isHovering ? 48 : 32,
          borderRadius: "50%",
          border: isHovering ? "1px solid rgba(196,18,48,0.8)" : "1px solid rgba(255,255,255,0.4)",
          pointerEvents: "none",
          zIndex: 99998,
          transition: "width 0.3s ease, height 0.3s ease, border-color 0.3s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Corner marks when hovering */}
        {isHovering && (
          <>
            {[
              { top: -3, left: -3, borderTop: "1px solid #c41230", borderLeft: "1px solid #c41230" },
              { top: -3, right: -3, borderTop: "1px solid #c41230", borderRight: "1px solid #c41230" },
              { bottom: -3, left: -3, borderBottom: "1px solid #c41230", borderLeft: "1px solid #c41230" },
              { bottom: -3, right: -3, borderBottom: "1px solid #c41230", borderRight: "1px solid #c41230" },
            ].map((style, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: 8,
                  height: 8,
                  ...style,
                }}
              />
            ))}
          </>
        )}
      </div>

      {/* Label */}
      {label && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            transform: `translate(${ringPos.current.x + 28}px, ${ringPos.current.y - 8}px)`,
            fontFamily: "'Space Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.15em",
            color: "#c41230",
            pointerEvents: "none",
            zIndex: 99997,
            whiteSpace: "nowrap",
            animation: "fadeIn 0.2s ease",
          }}
        >
          {label}
        </div>
      )}

      {/* Ripple */}
      <div
        ref={rippleRef}
        style={{
          position: "fixed",
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.5)",
          pointerEvents: "none",
          zIndex: 99996,
          opacity: 0,
        }}
      />
    </>
  );
}
