
import React from 'react';

interface SplashScreenProps {
  onStart: () => void;
  isLoading: boolean;
  isGameOver: boolean;
  score: number;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onStart, isLoading, isGameOver, score }) => {
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

      <div className="relative z-10 max-w-2xl w-full text-center space-y-8">
        <div>
          <h1 className="text-6xl md:text-8xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-cyan-400 animate-pulse tracking-tighter">
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
            <div className="text-6xl font-orbitron text-white">{score.toLocaleString()}</div>
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
                   <li className="flex gap-2">
                      <span className="text-cyan-400">01.</span>
                      Enable Camera Access when prompted.
                   </li>
                   <li className="flex gap-2">
                      <span className="text-cyan-400">02.</span>
                      Position your hand so the sensor detects it.
                   </li>
                   <li className="flex gap-2">
                      <span className="text-cyan-400">03.</span>
                      <strong>INDEX FINGER:</strong> Use as target crosshair.
                   </li>
                   <li className="flex gap-2">
                      <span className="text-cyan-400">04.</span>
                      <strong>GUN GESTURE:</strong> Extend thumb and index finger to fire.
                   </li>
                   <li className="flex gap-2">
                      <span className="text-cyan-400">05.</span>
                      <strong>PINCH:</strong> Alternative firing mode.
                   </li>
                </ul>
             </div>
          )}

          <button
            onClick={onStart}
            disabled={isLoading}
            className="w-full group relative overflow-hidden bg-cyan-500 hover:bg-cyan-400 text-slate-950 py-6 px-12 font-orbitron font-bold text-2xl transition-all duration-300 disabled:opacity-50"
          >
            <span className="relative z-10">
              {isLoading ? 'INITIALIZING LINK...' : (isGameOver ? 'REBOOT SYSTEM' : 'INITIALIZE LINK')}
            </span>
            <div className="absolute inset-0 w-full h-full bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12"></div>
          </button>
          
          <p className="text-cyan-500/50 text-[10px] uppercase tracking-widest pt-4">
            Secured Tactical Data Link v3.11 // AI Powered Briefing Active
          </p>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
