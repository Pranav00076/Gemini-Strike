import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, setDoc, getDocs, onSnapshot, query, orderBy, limit, serverTimestamp, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { HighScore } from '../types';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Error signing in with Google', error);
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out', error);
  }
};

export const submitScore = async (score: number) => {
  if (!auth.currentUser) return;
  try {
    await setDoc(doc(db, 'leaderboard', auth.currentUser.uid + '_' + Date.now()), {
      uid: auth.currentUser.uid,
      name: auth.currentUser.displayName || 'Unknown Pilot',
      score,
      date: new Date().toLocaleDateString()
    });
  } catch (error) {
    console.error('Error submitting score:', error);
  }
};

export const subscribeToLeaderboard = (callback: (scores: HighScore[]) => void) => {
  const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(10));
  return onSnapshot(q, (snapshot) => {
    const scores: HighScore[] = [];
    snapshot.forEach(doc => {
      scores.push(doc.data() as HighScore);
    });
    callback(scores);
  }, error => {
    console.error("Error fetching leaderboard:", error);
  });
};

/* MULTIPLAYER LOGIC */

export const createRoom = async (roomName: string) => {
  if (!auth.currentUser) return null;
  try {
    const roomRef = doc(collection(db, 'rooms'));
    await setDoc(roomRef, {
      name: roomName,
      hostName: auth.currentUser.displayName || 'Unknown',
      hostUid: auth.currentUser.uid,
      status: 'waiting',
      playerCount: 1
    });

    const playerRef = doc(db, 'rooms', roomRef.id, 'players', auth.currentUser.uid);
    await setDoc(playerRef, {
      uid: auth.currentUser.uid,
      name: auth.currentUser.displayName || 'Unknown',
      isHost: true,
      health: 100,
      score: 0,
      isReady: false,
      gameOver: false
    });

    return roomRef.id;
  } catch (e) {
    console.error("Error creating room", e);
    return null;
  }
};

export const joinRoom = async (roomId: string) => {
  if (!auth.currentUser) return false;
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return false;
    
    const count = roomSnap.data().playerCount || 0;
    if (roomSnap.data().status !== 'waiting') return false;

    await updateDoc(roomRef, {
      playerCount: count + 1
    });

    const playerRef = doc(db, 'rooms', roomId, 'players', auth.currentUser.uid);
    await setDoc(playerRef, {
      uid: auth.currentUser.uid,
      name: auth.currentUser.displayName || 'Unknown',
      isHost: false,
      health: 100,
      score: 0,
      isReady: false,
      gameOver: false
    });
    return true;
  } catch (e) {
    console.error("Error joining room", e);
    return false;
  }
};

export const updatePlayerState = async (roomId: string, updates: any) => {
  if (!auth.currentUser) return;
  try {
    const playerRef = doc(db, 'rooms', roomId, 'players', auth.currentUser.uid);
    await updateDoc(playerRef, updates);
  } catch (e) {
    console.error("Error updating state", e);
  }
};

export const updateRoomStatus = async (roomId: string, status: string) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, { status });
  } catch (e) {}
};

export const subscribeToRooms = (callback: (rooms: any[]) => void) => {
  const q = query(collection(db, 'rooms'), orderBy('playerCount', 'desc'), limit(10));
  return onSnapshot(q, (snapshot) => {
    const rooms: any[] = [];
    snapshot.forEach(doc => {
      rooms.push({ id: doc.id, ...doc.data() });
    });
    callback(rooms);
  }, error => {
    console.error("Error fetching rooms:", error);
  });
};

export const subscribeToRoomPlayers = (roomId: string, callback: (players: any[]) => void) => {
  const q = collection(db, 'rooms', roomId, 'players');
  return onSnapshot(q, (snapshot) => {
    const players: any[] = [];
    snapshot.forEach(doc => {
      players.push({ id: doc.id, ...doc.data() });
    });
    callback(players);
  }, error => {
    console.error("Error fetching players:", error);
  });
};

export const subscribeToRoom = (roomId: string, callback: (room: any) => void) => {
  return onSnapshot(doc(db, 'rooms', roomId), (doc) => {
    callback(doc.data() ? { id: doc.id, ...doc.data() } : null);
  });
};

