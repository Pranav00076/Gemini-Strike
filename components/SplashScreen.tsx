
import React, { useState } from 'react';
import { HighScore } from '../types';
import { signInWithGoogle, logout } from '../services/firebaseService';
import { User } from 'firebase/auth';

interface SplashScreenProps {
  onStart: () => void;
  isLoading: boolean;
  isGameOver: boolean;
  score?: number;
  highScores?: HighScore[];
  onSaveScore?: (name: string) => void;
  user?: User | null;
  onLobbyOpen: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onStart, isLoading, isGameOver, score = 0, highScores = [], onSaveScore, user, onLobbyOpen }) => {
  const [playerName, setPlayerName] = useState('');
  const [scoreSaved, setScoreSaved] = useState(false);

  const handleSave = () => {
    if (onSaveScore && !scoreSaved) {
      onSaveScore(playerName);
      setScoreSaved(true);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950 p-6 overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900 via-transparent to-transparent"></div>
        <div className="grid grid-cols-12 gap-4 w-full h-full">
           {Array.from({length: 48}).map((_, i) => (
             <div key={i} className="border border-cyan-500/20 aspect-square"></div>
           ))}
        </div>
      </div>

      <div className="absolute top-6 right-6 z-20 flex flex-col items-end gap-2 text-right">
        {user ? (
          <div className="space-y-1">
            <div className="font-mono text-cyan-400 text-sm">PILOT: {user.displayName}</div>
            <button onClick={logout} className="text-xs text-red-400 font-mono border border-red-500/30 px-2 py-1 hover:bg-red-500/20">LOGOUT</button>
          </div>
        ) : (
          <button onClick={signInWithGoogle} className="font-mono text-cyan-50 border border-cyan-500/50 bg-cyan-900/30 px-4 py-2 hover:bg-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
            CONNECT NEURAL ID (GOOGLE)
          </button>
        )}
      </div>

      <div className="relative z-10 max-w-4xl w-full text-center space-y-8 flex flex-col md:flex-row gap-8 items-center justify-center">
        <div className="flex-1 space-y-8">
          <div>
            <h1 className="text-5xl md:text-7xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-cyan-400 animate-pulse tracking-tighter">
              {isGameOver ? 'MISSION FAILED' : 'GEMINI STRIKE'}
            </h1>
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent mt-2"></div>
            <p className="mt-4 text-cyan-500 tracking-[0.4em] font-bold uppercase text-sm">
              Neural Interactive Tactical System
            </p>
          </div>

          {isGameOver && (
            <div className="bg-slate-900 border border-red-500/30 p-6 backdrop-blur-lg">
              <div className="text-sm text-red-400 uppercase tracking-widest">Final Operational Score</div>
              <div className="text-6xl font-orbitron text-white mb-6 animate-pulse">{score.toLocaleString()}</div>
              
              {!scoreSaved && (
                <div className="flex flex-col items-center gap-3">
                  {!user ? (
                    <div className="text-cyan-400 font-mono text-sm border border-cyan-500/30 p-4 bg-cyan-900/20">
                      You must <button onClick={signInWithGoogle} className="underline hover:text-white">Sign In</button> to transmit your score to the Global Leaderboard.
                    </div>
                  ) : (
                    <button 
                      onClick={handleSave}
                      className="px-6 py-2 bg-cyan-600/30 border border-cyan-400 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all font-bold font-mono text-sm w-64 tracking-widest"
                    >
                      TRANSMIT SCORE
                    </button>
                  )}
                </div>
              )}
              {scoreSaved && (
                 <div className="text-green-400 font-mono text-sm border border-green-500/30 p-4 bg-green-900/20">
                    SCORE TRANSMITTED.
                 </div>
              )}
            </div>
          )}

          <div className="space-y-4 bg-slate-900/50 p-8 border border-cyan-500/20 backdrop-blur-xl rounded-sm">
            {!isGameOver && (
               <div className="text-left space-y-3 mb-8">
                  <h3 className="text-cyan-400 font-bold flex items-center gap-2">
                     <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
                     NEURAL INTERFACE INSTRUCTIONS
                  </h3>
                  <ul className="text-cyan-100/70 text-sm space-y-2">
                     <li className="flex gap-2"><span className="text-cyan-400">01.</span> Enable Camera Access when prompted.</li>
                     <li className="flex gap-2"><span className="text-cyan-400">02.</span> Position your hand so the sensor detects it.</li>
                     <li className="flex gap-2"><span className="text-cyan-400">03.</span> <strong>INDEX FINGER:</strong> Use as target crosshair.</li>
                     <li className="flex gap-2"><span className="text-cyan-400">04.</span> <strong>GUN GESTURE:</strong> Extend thumb and index finger to fire.</li>
                     <li className="flex gap-2"><span className="text-cyan-400">05.</span> <strong>PALM (Defensive):</strong> Extend all fingers to activate temporary Energy Shield. Block enemy fire.</li>
                  </ul>
               </div>
            )}

            <div className="flex flex-col gap-4">
              <button
                onClick={onStart}
                disabled={isLoading}
                className="w-full group relative overflow-hidden bg-cyan-500 hover:bg-cyan-400 text-slate-950 py-4 px-12 font-orbitron font-bold text-2xl transition-all duration-300 disabled:opacity-50"
              >
                <span className="relative z-10">
                  {isLoading ? 'INITIALIZING...' : (isGameOver ? 'REBOOT SINGLE PLAYER' : 'SINGLE PLAYER MISSION')}
                </span>
                <div className="absolute inset-0 w-full h-full bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12"></div>
              </button>

              <button
                onClick={onLobbyOpen}
                disabled={isLoading}
                className="w-full group relative overflow-hidden bg-transparent border-2 border-amber-500 hover:bg-amber-500/20 text-amber-500 py-4 px-12 font-orbitron font-bold text-2xl transition-all duration-300 disabled:opacity-50"
              >
                <span className="relative z-10">
                   MULTIPLAYER CO-OP
                </span>
                <div className="absolute inset-0 w-full h-full bg-amber-500/10 translate-x-[100%] group-hover:translate-x-[-100%] transition-transform duration-500 skew-x-12"></div>
              </button>
            </div>
          </div>
        </div>

        {/* Global Leaderboard Panel */}
        <div className="flex-1 w-full max-w-sm mt-8 md:mt-0">
           <div className="bg-slate-900/80 border border-cyan-500/50 p-6 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
              <h3 className="text-cyan-500 font-bold mb-4 border-b border-cyan-500/30 pb-2 text-center font-orbitron tracking-widest flex items-center justify-center gap-2">
                 <span className="w-2 h-2 bg-cyan-500 animate-ping rounded-full inline-block"></span>
                 GLOBAL LEADERBOARD
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {highScores.length === 0 ? (
                   <div className="text-cyan-500/50 text-sm font-mono text-center py-8">NO DATA FOUND</div>
                ) : (
                  highScores.map((hs, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm font-mono bg-cyan-950/20 p-2 border border-cyan-500/10 hover:border-cyan-500/40 transition-colors">
                      <div className="flex items-center gap-2">
                         <span className={`w-6 font-bold ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-cyan-500'}`}>#{idx + 1}</span>
                         <span className="text-cyan-100 truncate max-w-[120px]">{hs.name}</span>
                      </div>
                      <span className="text-white font-bold tracking-wider">{hs.score.toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default SplashScreen;
