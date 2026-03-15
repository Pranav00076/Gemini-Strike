
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Target, Particle, Vector2 } from './types';
import { GAME_CONFIG, COLORS } from './constants';
import { getTacticalBriefing } from './services/geminiService';
import HUD from './components/HUD';
import GameEngine from './components/GameEngine';
import SplashScreen from './components/SplashScreen';
import { soundManager } from './services/soundManager';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    health: GAME_CONFIG.INITIAL_HEALTH,
    level: 1,
    isGameOver: false,
    isPlaying: false,
    targets: [],
    particles: [],
    hands: [],
    briefing: 'Awaiting Tactical Link...',
    combo: 0,
    maxCombo: 0,
    screenShake: 0,
  });

  const [isLoading, setIsLoading] = useState(false);

  const startGame = async () => {
    setIsLoading(true);
    await soundManager.unlock();
    const briefing = await getTacticalBriefing(1);
    setGameState(prev => ({
      ...prev,
      isPlaying: true,
      isGameOver: false,
      score: 0,
      health: GAME_CONFIG.INITIAL_HEALTH,
      level: 1,
      briefing,
      targets: [],
      particles: [],
    }));
    setIsLoading(false);
  };

  const handleGameOver = () => {
    setGameState(prev => ({ ...prev, isGameOver: true, isPlaying: false }));
  };

  const updateGameState = useCallback((updates: Partial<GameState>) => {
    setGameState(prev => ({ ...prev, ...updates }));
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-rajdhani select-none">
      {!gameState.isPlaying && (
        <SplashScreen 
          onStart={startGame} 
          isLoading={isLoading} 
          isGameOver={gameState.isGameOver}
          score={gameState.score}
        />
      )}

      {gameState.isPlaying && (
        <>
          <HUD 
            score={gameState.score} 
            health={gameState.health} 
            level={gameState.level} 
            briefing={gameState.briefing}
            hands={gameState.hands}
            combo={gameState.combo}
            maxCombo={gameState.maxCombo}
          />
          
          <div className="absolute inset-0 z-0">
             <GameEngine 
                gameState={gameState}
                updateGameState={updateGameState}
                onGameOver={handleGameOver}
             />
          </div>

          <div className="absolute inset-0 pointer-events-none border-[12px] border-cyan-500/20 box-border z-20">
            <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-cyan-400"></div>
            <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-cyan-400"></div>
            <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-cyan-400"></div>
            <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-cyan-400"></div>
          </div>
          
          <div className="scanner-line"></div>
        </>
      )}
    </div>
  );
};

export default App;
