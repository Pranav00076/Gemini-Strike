import React, { useState, useEffect } from 'react';
import { subscribeToRooms, createRoom, joinRoom, subscribeToRoom, subscribeToRoomPlayers, updateRoomStatus, updatePlayerState } from '../services/firebaseService';
import { User } from 'firebase/auth';

interface LobbyProps {
  user: User | null;
  onBack: () => void;
  onStartMultiplayer: (roomId: string, isHost: boolean) => void;
}

const Lobby: React.FC<LobbyProps> = ({ user, onBack, onStartMultiplayer }) => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  useEffect(() => {
    if (!currentRoomId && user) {
      const unsub = subscribeToRooms(setRooms);
      return () => unsub();
    }
  }, [currentRoomId, user]);

  useEffect(() => {
    if (currentRoomId) {
      const unsubRoom = subscribeToRoom(currentRoomId, setRoomData);
      const unsubPlayers = subscribeToRoomPlayers(currentRoomId, setPlayers);
      return () => {
        unsubRoom();
        unsubPlayers();
      };
    }
  }, [currentRoomId]);

  useEffect(() => {
    if (roomData?.status === 'playing' && currentRoomId) {
      const isHost = roomData.hostUid === user?.uid;
      onStartMultiplayer(currentRoomId, isHost);
    }
  }, [roomData?.status, currentRoomId, user, onStartMultiplayer]);

  const handleCreateRoom = async () => {
    if (!user || !newRoomName) return;
    setIsCreating(true);
    const id = await createRoom(newRoomName);
    if (id) setCurrentRoomId(id);
    setIsCreating(false);
  };

  const handleJoinRoom = async (id: string) => {
    const success = await joinRoom(id);
    if (success) setCurrentRoomId(id);
  };

  const handleStartGame = async () => {
    if (currentRoomId && roomData?.hostUid === user?.uid) {
      await updateRoomStatus(currentRoomId, 'playing');
    }
  };

  if (!user) {
    return (
      <div className="absolute inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-6 backdrop-blur-md">
         <div className="bg-slate-900 border border-red-500 p-8 text-center text-red-400 font-mono">
            <h2 className="text-2xl mb-4">ACCESS DENIED</h2>
            <p>You must connect your Neural ID to access Multiplayer features.</p>
            <button onClick={onBack} className="mt-6 px-4 py-2 border border-red-500/50 hover:bg-red-500/20">BACK</button>
         </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-slate-950/95 z-50 flex items-center justify-center p-6 backdrop-blur-md">
      <div className="max-w-4xl w-full bg-slate-900 border border-cyan-500/30 p-8 shadow-[0_0_50px_rgba(34,211,238,0.1)] relative">
        <button onClick={onBack} className="absolute top-4 right-4 text-cyan-500 hover:text-white font-mono border border-cyan-500/30 px-3 py-1 bg-slate-950">X</button>
        
        <h2 className="text-3xl font-orbitron font-bold text-cyan-400 mb-6 flex items-center gap-3">
          <span className="w-3 h-3 bg-cyan-400 animate-pulse"></span>
          TACTICAL LOBBY NETWORK
        </h2>

        {!currentRoomId ? (
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-4">
              <h3 className="font-mono text-cyan-300 border-b border-cyan-500/20 pb-2">ACTIVE SESSIONS</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {rooms.length === 0 ? (
                  <div className="text-slate-500 font-mono py-4">NO ACTIVE SESSIONS FOUND</div>
                ) : (
                  rooms.map(r => (
                    <div key={r.id} className="flex justify-between items-center p-3 border border-cyan-500/20 bg-slate-950/50 hover:border-cyan-400 focus:border-cyan-400">
                      <div>
                        <div className="font-bold text-cyan-100">{r.name}</div>
                        <div className="text-xs text-cyan-500 font-mono">Host: {r.hostName} | Players: {r.playerCount}/4</div>
                      </div>
                      <button 
                        onClick={() => handleJoinRoom(r.id)}
                        disabled={r.status !== 'waiting'}
                        className="px-4 py-1 border border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-slate-900 transition-colors disabled:opacity-50 font-mono"
                      >
                         {r.status === 'playing' ? 'IN PROGRESS' : 'JOIN'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="md:w-64 space-y-4 border-t md:border-t-0 md:border-l border-cyan-500/20 pt-4 md:pt-0 md:pl-8">
               <h3 className="font-mono text-cyan-300 border-b border-cyan-500/20 pb-2">CREATE SESSION</h3>
               <input 
                 type="text" 
                 value={newRoomName}
                 onChange={e => setNewRoomName(e.target.value)}
                 className="w-full bg-slate-950 border border-cyan-500/50 p-2 text-cyan-100 font-mono outline-none focus:border-cyan-400"
                 placeholder="SQUAD NAME"
                 maxLength={20}
               />
               <button 
                 onClick={handleCreateRoom}
                 disabled={!newRoomName.trim() || isCreating}
                 className="w-full bg-cyan-600/20 border border-cyan-500 text-cyan-400 p-2 hover:bg-cyan-500 hover:text-slate-900 font-mono transition-colors disabled:opacity-50"
               >
                 HOST MISSION
               </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h3 className="font-mono text-cyan-300 border-b border-cyan-500/20 pb-2 text-xl">{roomData?.name || 'SQUAD ROOM'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players.map(p => (
                <div key={p.id} className={`p-4 border ${p.uid === user.uid ? 'border-amber-500 bg-amber-950/20' : 'border-cyan-500/30 bg-slate-950'} flex justify-between items-center`}>
                   <div>
                     <div className="font-bold text-white font-mono text-lg">{p.name} {p.uid === user.uid && '(YOU)'}</div>
                     <div className="text-sm text-cyan-500 font-mono">{p.isHost ? 'SQUAD LEADER' : 'SUPPORT PILOT'}</div>
                   </div>
                   <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]"></div>
                </div>
              ))}
            </div>
            
            <div className="pt-8 flex justify-center">
              {roomData?.hostUid === user.uid ? (
                <button 
                  onClick={handleStartGame}
                  className="px-12 py-4 bg-cyan-500 text-slate-900 font-orbitron font-bold text-xl hover:bg-cyan-400 transition-colors shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                >
                  START CO-OP MISSION
                </button>
              ) : (
                <div className="text-cyan-500 font-mono animate-pulse text-lg border border-cyan-500/30 p-4 bg-slate-950 text-center w-full max-w-md">
                  WAITING FOR SQUAD LEADER...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;
