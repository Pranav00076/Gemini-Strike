
import React from 'react';

import { HandData, Achievement, PowerUpType } from '../types';

interface HUDProps {
  score: number;
  health: number;
  level: number;
  briefing: string;
  hands: HandData[];
  combo: number;
  maxCombo: number;
  activeBuff?: PowerUpType | null;
  achievements?: Achievement[];
  multiplayerPlayers?: any[];
}

const HUD: React.FC<HUDProps> = ({ score, health, level, briefing, hands, combo, maxCombo, activeBuff, achievements = [], multiplayerPlayers = [] }) => {
  const anyHandActive = hands.some(h => h.active);
  return (
    <div className="absolute inset-0 pointer-events-none z-30 p-8 flex flex-col justify-between">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="bg-slate-900/80 p-4 border-l-4 border-cyan-400 backdrop-blur-md relative overflow-hidden group flex flex-col items-start gap-2">
              <div className="absolute inset-0 bg-cyan-400/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500"></div>
              <div>
                <div className="text-[10px] text-cyan-500 uppercase tracking-widest font-bold mb-1">Commander Score</div>
                <div className="text-4xl font-orbitron text-white leading-none drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">{score.toLocaleString()}</div>
              </div>
            </div>

            {combo > 1 && (
              <div className="bg-slate-900/80 p-4 border-l-4 border-orange-500 backdrop-blur-md animate-bounce h-fit">
                <div className="text-[10px] text-orange-500 uppercase tracking-widest font-bold mb-1">Combo Multiplier</div>
                <div className="text-4xl font-orbitron text-white leading-none">x{(1 + Math.floor(combo / 5) * 0.5).toFixed(1)}</div>
                <div className="text-[10px] text-orange-300 mt-1">{combo} HITS</div>
              </div>
            )}

            {activeBuff && (
              <div className="bg-slate-900/80 p-4 border-l-4 border-magenta-500 backdrop-blur-md animate-pulse h-fit">
                <div className="text-[10px] text-magenta-500 uppercase tracking-widest font-bold mb-1">SYSTEM OVERRIDE</div>
                <div className="text-2xl font-orbitron text-white uppercase">{activeBuff.replace(/([A-Z])/g, ' $1').trim()}</div>
              </div>
            )}
          </div>

          {multiplayerPlayers.length > 0 && (
             <div className="space-y-2 mt-4">
               {multiplayerPlayers.map(p => (
                 <div key={p.id} className="bg-slate-900/80 border-l-2 border-amber-500 p-2 text-sm font-mono text-cyan-100 flex items-center gap-4 w-64 backdrop-blur-md">
                   <div className="flex-1 truncate">{p.name}</div>
                   <div className="text-amber-400 font-bold">{p.score}</div>
                   <div className="w-16 bg-slate-800 h-2 border border-cyan-500/30">
                     <div className={`h-full ${p.health > 40 ? 'bg-cyan-400' : 'bg-red-500'} ${p.health < 20 ? 'animate-pulse' : ''}`} style={{ width: `${Math.max(0, p.health)}%` }}></div>
                   </div>
                 </div>
               ))}
             </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="bg-slate-900/80 p-4 border-r-4 border-magenta-400 backdrop-blur-md text-right">
            <div className="text-[10px] text-cyan-500 uppercase tracking-widest font-bold mb-1">Threat Level</div>
            <div className="text-4xl font-orbitron text-cyan-400 leading-none">{level}</div>
          </div>
          <div className="text-[10px] text-cyan-500/60 font-mono">MAX_COMBO: {maxCombo}</div>
          
          <div className="mt-4 space-y-2 text-right flex flex-col items-end">
            {achievements.map((ach) => (
              <div key={ach.id} className="bg-slate-900/90 border-r-4 border-yellow-400 p-3 backdrop-blur-md w-72 animate-[slideIn_0.3s_ease-out]">
                <div className="text-[10px] text-yellow-400 uppercase tracking-widest font-bold">ACHIEVEMENT UNLOCKED</div>
                <div className="text-sm font-orbitron text-white font-bold my-1">{ach.title}</div>
                <div className="text-xs text-yellow-100/70 italic">{ach.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Middle/Briefing Overlay */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl text-center">
         {!anyHandActive && (
           <div className="bg-red-500/20 text-red-400 p-6 font-bold animate-pulse border-2 border-red-500/50 backdrop-blur-md rounded-lg shadow-[0_0_30px_rgba(239,68,68,0.3)]">
             <div className="text-2xl mb-2 font-orbitron">CRITICAL ERROR</div>
             <div className="text-sm tracking-widest">[ NEURAL LINK SEVERED: SHOW HANDS ]</div>
           </div>
         )}
      </div>

      {/* Bottom Bar */}
      <div className="flex justify-between items-end flex-1 pb-4">
         <div className="flex gap-16 ml-12">
           {hands.map((hand, idx) => hand.active ? (
             <div key={idx} className="flex flex-col gap-2 items-center text-cyan-500 w-32">
                <div className="text-[10px] uppercase font-bold tracking-widest">Hand {idx + 1} Shield</div>
                <div className="w-full h-2 bg-slate-800 rounded-sm overflow-hidden border border-cyan-500/30">
                  <div className="h-full bg-cyan-400 transition-all duration-100" style={{ width: `${hand.shieldEnergy}%` }}></div>
                </div>
                {hand.shieldActive && <div className="text-[10px] text-cyan-200 animate-pulse font-mono tracking-widest">ACTIVE</div>}
             </div>
           ) : null)}
         </div>
      </div>

      <div className="flex justify-end items-end p-4">
        <div className="w-72 bg-slate-900/80 p-5 border-t-2 border-red-500/30 backdrop-blur-md relative">
          <div className="absolute -top-1 right-0 w-12 h-1 bg-red-500"></div>
          <div className="text-[10px] text-red-400 uppercase font-bold mb-2 tracking-widest">Hull Integrity Status</div>
          <div className="w-full h-5 bg-slate-800 rounded-sm overflow-hidden border border-red-500/20 p-0.5">
            <div 
              className={`h-full transition-all duration-500 ${health > 30 ? 'bg-gradient-to-r from-cyan-600 to-cyan-400' : 'bg-gradient-to-r from-red-700 to-red-500 animate-pulse'}`}
              style={{ width: `${health}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2">
            <span className={`text-[10px] font-mono ${health < 30 ? 'text-red-500 animate-pulse' : 'text-red-400/60'}`}>
              {health < 30 ? 'WARNING: CRITICAL_DAMAGE' : 'SYSTEMS_OPERATIONAL'}
            </span>
            <span className="text-sm font-orbitron text-white">{health}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HUD;
