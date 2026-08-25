import { useCallback, useEffect, useRef, useState } from "react";
import LoadingScreen from "./components/LoadingScreen";
import CustomCursor from "./components/CustomCursor";
import Navigation from "./components/Navigation";
import ProgressIndicator from "./components/ProgressIndicator";
import HUDOverlay from "./components/HUDOverlay";
import SceneText from "./components/SceneText";
import SpiderScene from "./SpiderScene";

const SCROLL_HEIGHT_VH = 1900;
const SCENE_TARGETS = [0, 0.08, 0.17, 0.295, 0.39, 0.48, 0.57, 0.645, 0.712, 0.78, 0.845, 0.88, 0.913, 0.943, 0.963, 0.99];

const SUIT_DATA = [
  { num: "01", name: "CLASSIC", desc: "The original. Red and blue, balanced for agility." },
  { num: "02", name: "SCARLET", desc: "Red dominant. Raw visual impact. No compromise." },
  { num: "03", name: "IRON SPIDER", desc: "Metallic integration. Engineered for extreme conditions." },
  { num: "04", name: "ADVANCED SUIT", desc: "Precision engineering. The pinnacle of suit design." },
  { num: "05", name: "FUTURE CONCEPT", desc: "Speculative. Dark matter. Unknown potential." },
];

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [currentScene, setCurrentScene] = useState(0);
  const [hoveredSuit, setHoveredSuit] = useState(-1);

  const rawScrollRef = useRef(0);
  const smoothScrollRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      rawScrollRef.current = max > 0 ? window.scrollY / max : 0;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const smooth = () => {
      smoothScrollRef.current += (rawScrollRef.current - smoothScrollRef.current) * 0.07;
      setScrollProgress(smoothScrollRef.current);
      rafRef.current = requestAnimationFrame(smooth);
    };
    rafRef.current = requestAnimationFrame(smooth);

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const onMouse = (e: MouseEvent) =>
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    window.addEventListener("mousemove", onMouse, { passive: true });
    return () => window.removeEventListener("mousemove", onMouse);
  }, []);

  const handleLoadComplete = useCallback(() => setIsLoaded(true), []);

  const handleNavigate = useCallback((sceneIndex: number) => {
    const target = SCENE_TARGETS[sceneIndex] ?? 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: target * max, behavior: "smooth" });
  }, []);

  const handleExploreAgain = useCallback(() => window.scrollTo({ top: 0, behavior: "smooth" }), []);

  const isHUDScene = currentScene === 6;

  return (
    <div style={{ position: "relative" }}>
      {!isLoaded && <LoadingScreen onComplete={handleLoadComplete} />}

      {/* Scroll driver */}
      <div style={{ height: `${SCROLL_HEIGHT_VH}vh`, position: "relative" }} />

      {/* 3D Canvas */}
      <SpiderScene
        scrollProgress={scrollProgress}
        mousePos={mousePos}
        onSceneChange={setCurrentScene}
        onHoveredSuit={setHoveredSuit}
        isLoaded={isLoaded}
      />

      <CustomCursor />

      {isLoaded && <Navigation onNavigate={handleNavigate} currentScene={currentScene} />}
      {isLoaded && <ProgressIndicator currentScene={currentScene} total={15} />}

      <HUDOverlay visible={isHUDScene && isLoaded} mouseX={mousePos.x} mouseY={mousePos.y} />

      {isLoaded && <SceneText scrollProgress={scrollProgress} onExploreAgain={handleExploreAgain} />}

      {/* Lens interaction hint */}
      {isLoaded && currentScene === 1 && (
        <div
          style={{
            position: "fixed",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "'Space Mono', monospace",
            fontSize: 9,
            letterSpacing: "0.25em",
            color: "rgba(0,212,255,0.5)",
            animation: "pulse 2s ease-in-out infinite",
            zIndex: 400,
            pointerEvents: "none",
          }}
        >
          CLICK LENS TO EXPLODE LAYERS
        </div>
      )}

      {/* Suit hover panel */}
      {isLoaded && hoveredSuit >= 0 && currentScene >= 9 && currentScene <= 13 && (
        <div
          style={{
            position: "fixed",
            bottom: 120,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 400,
            animation: "fadeIn 0.25s ease",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 8,
              letterSpacing: "0.3em",
              color: "rgba(196,18,48,0.8)",
              marginBottom: 6,
            }}
          >
            {SUIT_DATA[hoveredSuit]?.num}
          </div>
          <div
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: 24,
              letterSpacing: "0.12em",
              color: "white",
              marginBottom: 6,
            }}
          >
            {SUIT_DATA[hoveredSuit]?.name}
          </div>
          <div
            style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: 12,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.04em",
              maxWidth: 280,
              textAlign: "center",
            }}
          >
            {SUIT_DATA[hoveredSuit]?.desc}
          </div>
          <div
            data-cursor="INSPECT"
            style={{
              marginTop: 14,
              border: "1px solid rgba(196,18,48,0.5)",
              padding: "8px 22px",
              fontFamily: "'Space Mono', monospace",
              fontSize: 8,
              letterSpacing: "0.25em",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            INSPECT SUIT
          </div>
        </div>
      )}

      {/* Suit archive bottom labels */}
      {isLoaded && currentScene >= 9 && currentScene <= 13 && (
        <div
          style={{
            position: "fixed",
            bottom: 36,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 48,
            zIndex: 400,
            opacity: 1,
          }}
        >
          {SUIT_DATA.map(({ num, name }, i) => (
            <div
              key={name}
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 8,
                letterSpacing: "0.2em",
                color: i === hoveredSuit ? "rgba(255,255,255,0.85)" : i === 3 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.22)",
                textAlign: "center",
                transition: "color 0.3s ease",
              }}
            >
              <div style={{ marginBottom: 2, color: "rgba(196,18,48,0.5)" }}>{num}</div>
              <div>{name}</div>
            </div>
          ))}
        </div>
      )}

      {/* Scene counter */}
      {isLoaded && (
        <div style={{ position: "fixed", bottom: 32, left: 60, fontFamily: "'Space Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.18)", letterSpacing: "0.2em", zIndex: 400 }}>
          {String(currentScene + 1).padStart(2, "0")} / 15
        </div>
      )}

      {/* Vignette */}
      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at center, transparent 38%, rgba(5,5,5,0.65) 100%)", pointerEvents: "none", zIndex: 100 }} />

      {/* Scan overlay during HUD */}
      {isHUDScene && (
        <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at center, rgba(0,212,255,0.02) 0%, transparent 70%)", pointerEvents: "none", zIndex: 150 }} />
      )}
    </div>
  );
}
