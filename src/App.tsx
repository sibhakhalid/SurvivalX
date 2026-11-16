import { useEffect, useRef, useState } from "react";
import { Game, type HudSnapshot } from "./game/engine";
import { HUD } from "./components/HUD";
import { GameOverScreen, MenuScreen, PauseScreen } from "./components/Screens";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new Game(canvas);
    game.onHud = setHud;
    setHud(game.snapshot());
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const playing = hud?.state === "playing";

  return (
    <div className="fixed inset-0 overflow-hidden bg-pit font-body">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ cursor: playing ? "none" : "default" }}
      />

      {/* HUD is visible during play and pause (frozen behind the overlay) */}
      {hud && (playing || hud.state === "paused") && <HUD hud={hud} />}

      {hud?.state === "menu" && (
        <MenuScreen best={hud.best} onStart={() => gameRef.current?.startGame()} />
      )}
      {hud?.state === "paused" && (
        <PauseScreen
          onResume={() => gameRef.current?.resume()}
          onQuit={() => gameRef.current?.toMenu()}
        />
      )}
      {hud?.state === "gameover" && hud && (
        <GameOverScreen
          hud={hud}
          onRestart={() => gameRef.current?.startGame()}
          onMenu={() => gameRef.current?.toMenu()}
        />
      )}
    </div>
  );
}
