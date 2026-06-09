
import React, { useState, useEffect, useCallback } from 'react';
import { GameState, HighScore, Achievement } from './types';
import { GAME_CONFIG } from './constants';
import { getTacticalBriefing } from './services/geminiService';
import HUD from './components/HUD';
import GameEngine from './components/GameEngine';
import SplashScreen from './components/SplashScreen';
import { soundManager } from './services/soundManager';
import { auth, subscribeToLeaderboard, submitScore as submitScoreToFirebase } from './services/firebaseService';
import { onAuthStateChanged, User } from 'firebase/auth';

import Lobby from './components/Lobby';

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
    enemyProjectiles: [],
    activeBuff: null,
    buffTimer: 0,
    cameraError: null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [showLobby, setShowLobby] = useState(false);
  const [multiplayerRoomId, setMultiplayerRoomId] = useState<string | null>(null);
  const [isMultiplayerHost, setIsMultiplayerHost] = useState(false);
  const [multiplayerPlayers, setMultiplayerPlayers] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    const unsubscribeLeaderboard = subscribeToLeaderboard((scores) => {
      setHighScores(scores);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeLeaderboard();
    };
  }, []);

  useEffect(() => {
    if (multiplayerRoomId) {
      import('./services/firebaseService').then(({ subscribeToRoomPlayers }) => {
        const unsub = subscribeToRoomPlayers(multiplayerRoomId, setMultiplayerPlayers);
        return () => unsub();
      });
    }
  }, [multiplayerRoomId]);

  const handleSaveScore = async (name: string) => {
    if (user) {
      await submitScoreToFirebase(gameState.score);
    }
  };

  const handleAchievement = useCallback((title: string, message: string) => {
    const id = Date.now().toString() + Math.random().toString();
    setAchievements(prev => [...prev, { id, title, message }]);
    soundManager.playAchievement();
    setTimeout(() => {
      setAchievements(prev => prev.filter(a => a.id !== id));
    }, 4000);
  }, []);

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
      cameraError: null,
    }));
    setIsLoading(false);
  };

  const handleStartMultiplayer = async (roomId: string, isHost: boolean) => {
    setMultiplayerRoomId(roomId);
    setIsMultiplayerHost(isHost);
    setShowLobby(false);
    await startGame();
  };

  const handleGameOver = () => {
    setGameState(prev => ({ ...prev, isGameOver: true, isPlaying: false }));
  };

  const updateGameState = useCallback((updates: Partial<GameState>) => {
    setGameState(prev => ({ ...prev, ...updates }));
  }, []);

  useEffect(() => {
    if (multiplayerRoomId && gameState.isPlaying) {
      // Sync local score and health to firebase
      import('./services/firebaseService').then(({ updatePlayerState }) => {
        updatePlayerState(multiplayerRoomId, {
          score: gameState.score,
          health: gameState.health,
          gameOver: gameState.isGameOver
        });
      });
    }
  }, [gameState.score, gameState.health, gameState.isGameOver, multiplayerRoomId, gameState.isPlaying]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-rajdhani select-none">
      {!gameState.isPlaying && !showLobby && (
        <SplashScreen 
          onStart={startGame} 
          isLoading={isLoading} 
          isGameOver={gameState.isGameOver}
          score={gameState.score}
          highScores={highScores}
          onSaveScore={handleSaveScore}
          user={user}
          onLobbyOpen={() => setShowLobby(true)}
        />
      )}

      {showLobby && !gameState.isPlaying && (
         <Lobby
           user={user}
           onBack={() => setShowLobby(false)}
           onStartMultiplayer={handleStartMultiplayer}
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
            activeBuff={gameState.activeBuff}
            achievements={achievements}
            multiplayerPlayers={multiplayerPlayers.filter(p => p.uid !== user?.uid)}
          />
          
          <div className="absolute inset-0 z-0">
             <GameEngine 
                gameState={gameState}
                updateGameState={updateGameState}
                onGameOver={handleGameOver}
                onAchievement={handleAchievement}
             />
          </div>

          <div className="absolute inset-0 pointer-events-none border-[12px] border-cyan-500/20 box-border z-20">
            <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-cyan-400"></div>
            <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-cyan-400"></div>
            <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-cyan-400"></div>
            <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-cyan-400"></div>
          </div>
          
          <div className="scanner-line"></div>

          {gameState.cameraError && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-6">
                <div className="bg-red-950/50 border border-red-500 p-8 max-w-lg text-center animate-pulse shadow-[0_0_50px_rgba(239,68,68,0.3)]">
                   <div className="text-4xl text-red-500 mb-4 font-orbitron">SYSTEM FAILURE</div>
                   <div className="text-xl text-white mb-6 uppercase tracking-widest leading-relaxed">
                      {gameState.cameraError}
                   </div>
                   <div className="text-md text-red-300 font-mono italic">
                      Camera access is mandatory for tactical hand-tracking. Please allow camera permissions and reload the interface to resume combat operations.
                   </div>
                   <button 
                     onClick={() => window.location.reload()}
                     className="mt-8 px-6 py-3 bg-red-600/30 border border-red-400 text-red-400 hover:bg-red-500 hover:text-white transition-all font-bold font-mono tracking-widest"
                   >
                     REBOOT SYSTEM
                   </button>
                </div>
             </div>
          )}
        </>
      )}
    </div>
  );
};

export default App;
