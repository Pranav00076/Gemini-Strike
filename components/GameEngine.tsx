
import React, { useRef, useEffect, useCallback } from 'react';
import { GameState, Target, Particle, Vector2, HandData, EnemyProjectile, PowerUpDrop, PowerUpType } from '../types';
import { GAME_CONFIG, COLORS, TARGET_TYPES } from '../constants';
import { soundManager } from '../services/soundManager';
import BackgroundFX from './BackgroundFX';

interface GameEngineProps {
  gameState: GameState;
  updateGameState: (updates: Partial<GameState>) => void;
  onGameOver: () => void;
  onAchievement?: (title: string, message: string) => void;
}

const GameEngine: React.FC<GameEngineProps> = ({ gameState, updateGameState, onGameOver, onAchievement }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastUpdateRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const handsRef = useRef<any>(null);
  
  // Hand tracking refs
  const handsDataRef = useRef<HandData[]>([
    { active: false, pos: { x: 0.5, y: 0.5 }, isFiring: false, landmarks: [], gesture: 'none' },
    { active: false, pos: { x: 0.5, y: 0.5 }, isFiring: false, landmarks: [], gesture: 'none' }
  ]);
  const smoothedHandPositions = useRef<Vector2[]>([
    { x: 0.5, y: 0.5 },
    { x: 0.5, y: 0.5 }
  ]);
  const lastFiredRefs = useRef<number[]>([0, 0]);

  // Local game state references for high-performance loop
  const targetsRef = useRef<Target[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const healthRef = useRef<number>(GAME_CONFIG.INITIAL_HEALTH);
  const scoreRef = useRef<number>(0);
  const levelRef = useRef<number>(1);
  const comboRef = useRef<number>(0);
  const maxComboRef = useRef<number>(0);
  const screenShakeRef = useRef<number>(0);
  const enemyProjectilesRef = useRef<EnemyProjectile[]>([]);
  const powerUpsRef = useRef<PowerUpDrop[]>([]);
  const activeBuffRef = useRef<PowerUpType | null>(null);
  const buffTimerRef = useRef<number>(0);
  const achievementLocks = useRef<Record<string, boolean>>({});
  const isPlayingRef = useRef<boolean>(false);
  const isMounted = useRef<boolean>(true);
  const damageFlashRef = useRef<number>(0);
  const levelUpRef = useRef<number>(0);

  // Sync props to refs
  useEffect(() => {
    isPlayingRef.current = gameState.isPlaying;
    levelRef.current = gameState.level;
    if (!gameState.isPlaying) {
      healthRef.current = GAME_CONFIG.INITIAL_HEALTH;
      scoreRef.current = 0;
      comboRef.current = 0;
      targetsRef.current = [];
      particlesRef.current = [];
      enemyProjectilesRef.current = [];
      powerUpsRef.current = [];
      activeBuffRef.current = null;
      buffTimerRef.current = 0;
      achievementLocks.current = {};
    }
  }, [gameState.isPlaying, gameState.level]);

  const detectGesture = (landmarks: any): 'gun' | 'pinch' | 'palm' | 'none' => {
    if (!landmarks || landmarks.length < 21) return 'none';

    // Index finger extended?
    const isIndexExtended = landmarks[8].y < landmarks[6].y;
    // Middle finger curled/extended?
    const isMiddleCurled = landmarks[12].y > landmarks[10].y;
    const isMiddleExtended = landmarks[12].y < landmarks[10].y;
    // Ring finger curled/extended?
    const isRingCurled = landmarks[16].y > landmarks[14].y;
    const isRingExtended = landmarks[16].y < landmarks[14].y;
    // Pinky finger curled/extended?
    const isPinkyCurled = landmarks[20].y > landmarks[18].y;
    const isPinkyExtended = landmarks[20].y < landmarks[18].y;
    
    if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
      return 'palm';
    }

    // Gun gesture: Index extended, others curled
    if (isIndexExtended && isMiddleCurled && isRingCurled && isPinkyCurled) {
      return 'gun';
    }

    // Pinch detection (distance between thumb and index finger tip)
    const dx = landmarks[8].x - landmarks[4].x;
    const dy = landmarks[8].y - landmarks[4].y;
    const dz = landmarks[8].z - landmarks[4].z;
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (distance < 0.06) return 'pinch';

    return 'none';
  };

  // Initialize MediaPipe
  useEffect(() => {
    if (!videoRef.current) return;

    const { Hands, Camera } = (window as any);
    
    if (!Hands || !Camera) {
      console.error("MediaPipe Hands or Camera not loaded yet");
      return;
    }

    const hands = new Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    });

    hands.onResults((results: any) => {
      if (!isMounted.current) return;
      
      const newHandsData: HandData[] = [
        { active: false, pos: { x: 0.5, y: 0.5 }, isFiring: false, landmarks: [], gesture: 'none', shieldActive: false, shieldEnergy: handsDataRef.current[0].shieldEnergy },
        { active: false, pos: { x: 0.5, y: 0.5 }, isFiring: false, landmarks: [], gesture: 'none', shieldActive: false, shieldEnergy: handsDataRef.current[1].shieldEnergy }
      ];

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        results.multiHandLandmarks.forEach((landmarks: any, index: number) => {
          if (index >= 2) return;

          const indexTip = landmarks[8];
          const targetX = 1 - indexTip.x;
          const targetY = indexTip.y;
          
          const smoothing = GAME_CONFIG.HAND_SMOOTHING;
          smoothedHandPositions.current[index] = {
            x: smoothedHandPositions.current[index].x * smoothing + targetX * (1 - smoothing),
            y: smoothedHandPositions.current[index].y * smoothing + targetY * (1 - smoothing)
          };

          const gesture = detectGesture(landmarks);
          const isFiring = gesture === 'gun' || gesture === 'pinch';

          newHandsData[index] = {
            active: true,
            pos: smoothedHandPositions.current[index],
            isFiring: isFiring,
            landmarks: landmarks,
            gesture: gesture,
            shieldActive: false,
            shieldEnergy: handsDataRef.current[index].shieldEnergy
          };
        });
      }

      const statusChanged = newHandsData.some((h, i) => h.active !== handsDataRef.current[i].active || h.gesture !== handsDataRef.current[i].gesture);
      handsDataRef.current = newHandsData;

      if (statusChanged) {
        updateGameState({ hands: newHandsData });
      }
    });

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (isMounted.current && videoRef.current && videoRef.current.readyState >= 2) {
          await hands.send({ image: videoRef.current }).catch(e => {
            console.error("Hands send failed", e);
          });
        }
      },
      width: 1280,
      height: 720
    });

    camera.start().catch((e: any) => {
      console.error("Camera start failed", e);
      updateGameState({ cameraError: `Camera start failed: ${e.message || e}` });
    });
    handsRef.current = hands;

    return () => {
      camera.stop();
      hands.close();
    };
  }, [updateGameState]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let requestId: number;

    const animate = (time: number) => {
      if (!isPlayingRef.current || !isMounted.current || !canvas) {
        requestId = requestAnimationFrame(animate);
        return;
      }

      const delta = lastUpdateRef.current ? time - lastUpdateRef.current : 0;
      lastUpdateRef.current = time;

      // 1. Spawning logic
      const spawnInterval = GAME_CONFIG.TARGET_SPAWN_RATE / (1 + (levelRef.current - 1) * 0.2);
      if (time - lastSpawnRef.current > spawnInterval) {
        const id = Math.random().toString(36).substr(2, 9);
        const rand = Math.random();
        let type: Target['type'] = 'drone';
        if (rand > 0.95) type = 'boss';
        else if (rand > 0.85) type = 'carrier';
        else if (rand > 0.75) type = 'shield';
        else if (rand > 0.65) type = 'interceptor';
        else if (rand > 0.5) type = 'scout';

        const config = (TARGET_TYPES as any)[type] || { size: 50, health: 1, points: 100, color: COLORS.CYAN };
        const speedMult = (config as any).speedMult || 1;
        
        targetsRef.current.push({
          id,
          pos: { x: Math.random() * (canvas.width - 100) + 50, y: -50 },
          vel: { x: (Math.random() - 0.5) * 2, y: (GAME_CONFIG.TARGET_BASE_SPEED + Math.random() * (levelRef.current * 0.5)) * speedMult },
          size: config.size,
          health: config.health,
          maxHealth: config.health,
          type,
          color: config.color,
          points: config.points,
          hitTimer: 0,
          shield: config.shield,
          movementType: (config as any).movementType || 'linear',
          baseX: Math.random() * (canvas.width - 100) + 50,
          spawnTime: time
        });
        soundManager.playSpawn();
        lastSpawnRef.current = time;
      }

      // 1.5 Buffs, Hand States & Shields
      if (buffTimerRef.current > 0) {
        buffTimerRef.current--;
        if (buffTimerRef.current <= 0) {
          activeBuffRef.current = null;
          updateGameState({ activeBuff: null });
        }
      }

      handsDataRef.current.forEach(hand => {
         if (hand.gesture === 'palm' && hand.shieldEnergy > 0) {
            hand.shieldActive = true;
            hand.shieldEnergy = Math.max(0, hand.shieldEnergy - 1.5);
         } else {
            hand.shieldActive = false;
            hand.shieldEnergy = Math.min(100, hand.shieldEnergy + 0.5);
         }
      });

      // 2. Firing Logic (Multiple Hands)
      let hitThisFrame = false;
      const currentFireRate = activeBuffRef.current === 'rapidFire' ? GAME_CONFIG.FIRE_RATE / 3 : GAME_CONFIG.FIRE_RATE;
      
      handsDataRef.current.forEach((hand, handIdx) => {
        if (hand.active && hand.isFiring && !hand.shieldActive && time - lastFiredRefs.current[handIdx] > currentFireRate) {
          lastFiredRefs.current[handIdx] = time;
          soundManager.playFire();
          const fireX = hand.pos.x * canvas.width;
          const fireY = hand.pos.y * canvas.height;

          targetsRef.current.forEach(t => {
            const dx = fireX - t.pos.x;
            const dy = fireY - t.pos.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            const hitRadius = activeBuffRef.current === 'multiShot' ? t.size + 100 : t.size;
            
            if (dist < hitRadius && t.pos.y < fireY) { // Added directional fire check so it only hits above hand
              hitThisFrame = true;
              if (t.shield && t.shield > 0) {
                t.shield -= 1;
                screenShakeRef.current = 5;
                soundManager.playHit();
              } else {
                t.health -= activeBuffRef.current === 'multiShot' ? 2 : 1;
                screenShakeRef.current = 3;
                soundManager.playHit();
              }
              t.hitTimer = 10;
              for(let i=0; i<6; i++) {
                particlesRef.current.push({
                  id: Math.random().toString(),
                  pos: { x: t.pos.x, y: t.pos.y },
                  vel: { x: (Math.random()-0.5)*20, y: (Math.random()-0.5)*20 - 5 },
                  life: 1,
                  maxLife: 1,
                  color: t.shield && t.shield > 0 ? COLORS.CYAN : '#ffaa00',
                  size: Math.random() * 4 + 2,
                  type: 'spark'
                });
              }
            }
          });

          const killed = targetsRef.current.filter(t => t.health <= 0);
          if (killed.length > 0) {
            killed.forEach(t => {
              comboRef.current += 1;
              soundManager.playExplosion();
              if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;
              
              const comboMult = 1 + Math.floor(comboRef.current / 5) * 0.5;
              scoreRef.current += Math.floor(t.points * comboMult);
              
              screenShakeRef.current = t.type === 'boss' ? 20 : 10;

              if (scoreRef.current > levelRef.current * 2000) {
                 levelRef.current += 1;
                 soundManager.playLevelUp();
                 updateGameState({ level: levelRef.current });
                 levelUpRef.current = 60;
              }

              if (t.type === 'boss' && !achievementLocks.current['bossSlayer']) {
                 achievementLocks.current['bossSlayer'] = true;
                 if (onAchievement) onAchievement('Boss Slayer', 'Destroyed a Boss-class Invader!');
              }

              if (comboRef.current >= 20 && !achievementLocks.current['comboMaster']) {
                 achievementLocks.current['comboMaster'] = true;
                 if (onAchievement) onAchievement('Combo Master', 'Hit a 20x Combo Streak!');
              }

              if (t.type === 'boss' || t.type === 'carrier') {
                const types: PowerUpType[] = ['rapidFire', 'timeFreeze', 'multiShot'];
                powerUpsRef.current.push({
                   id: Math.random().toString(),
                   pos: { ...t.pos },
                   vel: { x: (Math.random()-0.5)*2, y: 2 },
                   type: types[Math.floor(Math.random() * types.length)],
                   size: 30
                });
              }

              for(let i=0; i<GAME_CONFIG.PARTICLE_COUNT * 3; i++) {
                const r = Math.random();
                const pType: Particle['type'] = r > 0.7 ? 'smoke' : (r > 0.4 ? 'debris' : 'spark');
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * (pType === 'spark' ? 30 : 15);
                particlesRef.current.push({
                  id: Math.random().toString(),
                  pos: { ...t.pos },
                  vel: { x: Math.cos(angle)*speed, y: Math.sin(angle)*speed },
                  life: 1,
                  maxLife: 1 + Math.random(),
                  color: pType === 'smoke' ? '#475569' : (pType === 'spark' ? '#ffffff' : t.color),
                  size: pType === 'smoke' ? Math.random() * 30 + 10 : Math.random() * 8 + 2,
                  type: pType
                });
              }
            });
            targetsRef.current = targetsRef.current.filter(t => t.health > 0);
            updateGameState({ score: scoreRef.current, combo: comboRef.current, maxCombo: maxComboRef.current });
          }
        }
      });

      // 3. Movement, Enemy Actions & Collision
      const speedMult = activeBuffRef.current === 'timeFreeze' ? 0.2 : 1;
      targetsRef.current = targetsRef.current.filter(t => {
        // Apply movement pattern
        if (t.movementType === 'sine') {
          t.pos.x = t.baseX + Math.sin((time - t.spawnTime) / 500) * 150;
        } else if (t.movementType === 'zigzag') {
          if (Math.floor(time / 500) % 2 === 0) t.pos.x += t.vel.y * speedMult;
          else t.pos.x -= t.vel.y * speedMult;
        } else {
          t.pos.x += t.vel.x * speedMult;
        }
        
        t.pos.y += t.vel.y * speedMult;
        if (t.hitTimer > 0) t.hitTimer--;

        // Boss / Enemy attacks
        if ((t.type === 'boss' || t.type === 'carrier') && Math.random() < 0.01 + (levelRef.current * 0.005)) {
            const activeHands = handsDataRef.current.filter(h => h.active);
            if (activeHands.length > 0) {
              const targetHand = activeHands[Math.floor(Math.random() * activeHands.length)];
              const pX = targetHand.pos.x * canvas.width;
              const pY = targetHand.pos.y * canvas.height;
              
              const dx = pX - t.pos.x;
              const dy = pY - t.pos.y;
              const mag = Math.sqrt(dx*dx + dy*dy);
              const projVel = 5 + levelRef.current;

              enemyProjectilesRef.current.push({
                id: Math.random().toString(),
                pos: { x: t.pos.x, y: t.pos.y },
                vel: { x: (dx/mag) * projVel, y: (dy/mag) * projVel },
                size: 10,
                damage: 5,
                color: COLORS.RED
              });
              soundManager.playFire(); // Use fire sound for enemy shot for now
            }
        }
        
        if (t.pos.x < t.size) t.pos.x = t.size;
        if (t.pos.x > canvas.width - t.size) t.pos.x = canvas.width - t.size;
        
        if (t.pos.y > canvas.height + t.size) {
          healthRef.current -= 10;
          comboRef.current = 0;
          damageFlashRef.current = 1.0;
          screenShakeRef.current = 15;
          soundManager.playDamage();
          updateGameState({ health: healthRef.current, combo: 0 });
          if (healthRef.current <= 0) {
            soundManager.playGameOver();
            onGameOver();
            return false;
          }
          return false;
        }
        return true;
      });

      particlesRef.current = particlesRef.current.filter(p => {
        p.pos.x += p.vel.x;
        p.pos.y += p.vel.y;
        
        if (p.type === 'debris') {
          p.vel.y += 0.5; // gravity
          p.vel.x *= 0.99;
        } else if (p.type === 'smoke') {
          p.vel.x *= 0.9;
          p.vel.y *= 0.9;
        } else {
          p.vel.x *= 0.95;
          p.vel.y *= 0.95;
        }
        
        p.life -= 0.02;
        return p.life > 0;
      });

      // Projectile movement and collisions
      enemyProjectilesRef.current = enemyProjectilesRef.current.filter(p => {
        p.pos.x += p.vel.x;
        p.pos.y += p.vel.y;
        
        // Hit detection on hands
        let hit = false;
        let shieldBlock = false;
        handsDataRef.current.forEach(hand => {
           if (hand.active && !hit && !shieldBlock) {
              const hX = hand.pos.x * canvas.width;
              const hY = hand.pos.y * canvas.height;
              const dist = Math.sqrt(Math.pow(p.pos.x - hX, 2) + Math.pow(p.pos.y - hY, 2));
              
              if (hand.shieldActive && dist < 70) {
                 shieldBlock = true;
                 hand.shieldEnergy = Math.max(0, hand.shieldEnergy - 20);
                 soundManager.playShieldHit();
                 for(let i=0; i<8; i++) {
                   particlesRef.current.push({ id: Math.random().toString(), pos: { ...p.pos }, vel: { x: (Math.random()-0.5)*15, y: -Math.random()*15 }, life: 1, maxLife: 1, color: COLORS.CYAN, size: 4, type: 'spark' });
                 }
                 if (!achievementLocks.current['shieldUser']) {
                    achievementLocks.current['shieldUser'] = true;
                    if (onAchievement) onAchievement('Perfect Defense', 'Blocked incoming fire with Energy Shield.');
                 }
              } else if (dist < 40) { // hand hitbox
                 hit = true;
                 healthRef.current -= p.damage;
                 comboRef.current = 0;
                 damageFlashRef.current = 0.8;
                 screenShakeRef.current = 10;
                 soundManager.playDamage();
                 
                 updateGameState({ health: healthRef.current, combo: 0 });
                 if (healthRef.current <= 0) {
                   soundManager.playGameOver();
                   onGameOver();
                 }
                 
                 // Spawn hit particles
                 for(let i=0; i<10; i++) {
                   particlesRef.current.push({
                     id: Math.random().toString(),
                     pos: { ...p.pos },
                     vel: { x: (Math.random()-0.5)*15, y: (Math.random()-0.5)*15 },
                     life: 1,
                     maxLife: 1,
                     color: COLORS.RED,
                     size: 4,
                     type: 'spark'
                   });
                 }
              }
           }
        });

        if (shieldBlock || hit) return false;
        return p.pos.y < canvas.height && p.pos.y > 0 && p.pos.x > 0 && p.pos.x < canvas.width;
      });

      // PowerUp Collision and Movement
      powerUpsRef.current = powerUpsRef.current.filter(p => {
        p.pos.x += p.vel.x;
        p.pos.y += p.vel.y;
        
        let collected = false;
        handsDataRef.current.forEach(hand => {
           if (hand.active && !collected) {
              const hX = hand.pos.x * canvas.width;
              const hY = hand.pos.y * canvas.height;
              const dist = Math.sqrt(Math.pow(p.pos.x - hX, 2) + Math.pow(p.pos.y - hY, 2));
              if (dist < p.size + 40) {
                 collected = true;
                 activeBuffRef.current = p.type;
                 buffTimerRef.current = 60 * 5; // 5 seconds buff
                 updateGameState({ activeBuff: p.type });
                 soundManager.playPowerUp();
                 
                 for(let i=0; i<15; i++) {
                   particlesRef.current.push({ id: Math.random().toString(), pos: { ...p.pos }, vel: { x: (Math.random()-0.5)*15, y: -Math.random()*15 }, life: 1, maxLife: 1, color: '#ffffff', size: 5, type: 'spark' });
                 }
              }
           }
        });
        
        return !collected && p.pos.y < canvas.height + 50;
      });

      if (damageFlashRef.current > 0) damageFlashRef.current -= 0.05;
      if (levelUpRef.current > 0) levelUpRef.current--;
      if (screenShakeRef.current > 0) screenShakeRef.current *= 0.9;

      // 4. Rendering
      ctx.save();
      if (screenShakeRef.current > 0.5) {
        ctx.translate((Math.random() - 0.5) * screenShakeRef.current, (Math.random() - 0.5) * screenShakeRef.current);
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Rendering: Hand Skeletons
      handsDataRef.current.forEach((hand) => {
        if (hand.active && hand.landmarks.length > 0) {
          ctx.save();
          ctx.lineWidth = 2;
          ctx.shadowBlur = 10;
          ctx.shadowColor = COLORS.CYAN;
          ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
          
          const HAND_CONNECTIONS = (window as any).HAND_CONNECTIONS || [
            [0, 1], [1, 2], [2, 3], [3, 4], // thumb
            [0, 5], [5, 6], [6, 7], [7, 8], // index
            [0, 9], [9, 10], [10, 11], [11, 12], // middle
            [0, 13], [13, 14], [14, 15], [15, 16], // ring
            [0, 17], [17, 18], [18, 19], [19, 20], // pinky
            [5, 9], [9, 13], [13, 17] // palm
          ];

          HAND_CONNECTIONS.forEach(([startIdx, endIdx]: [number, number]) => {
            const start = hand.landmarks[startIdx];
            const end = hand.landmarks[endIdx];
            if (start && end) {
              ctx.beginPath();
              ctx.moveTo((1 - start.x) * canvas.width, start.y * canvas.height);
              ctx.lineTo((1 - end.x) * canvas.width, end.y * canvas.height);
              ctx.stroke();
            }
          });

          // Joints
          ctx.fillStyle = COLORS.CYAN;
          hand.landmarks.forEach((lm) => {
            ctx.beginPath();
            ctx.arc((1 - lm.x) * canvas.width, lm.y * canvas.height, 3, 0, Math.PI * 2);
            ctx.fill();
          });
          
          if (hand.shieldActive) {
            const hx = hand.pos.x * canvas.width;
            const hy = hand.pos.y * canvas.height;
            ctx.beginPath();
            const flicker = Math.random() * 0.2 + 0.8;
            ctx.arc(hx, hy, 80, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(34, 211, 238, ${0.15 * flicker * (hand.shieldEnergy/100)})`;
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = `rgba(34, 211, 238, ${0.8 * flicker * (hand.shieldEnergy/100)})`;
            ctx.stroke();

            ctx.beginPath();
            const ripple = (time % 1000) / 1000 * 50 + 80;
            ctx.arc(hx, hy, ripple, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(34, 211, 238, ${1 - ((ripple - 80) / 50)})`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          ctx.restore();
        }
      });

      // Render Targets
      targetsRef.current.forEach(t => {
        ctx.save();
        ctx.translate(t.pos.x, t.pos.y);
        const isHit = t.hitTimer > 0;
        ctx.shadowBlur = isHit ? 30 : 15;
        ctx.shadowColor = isHit ? '#ffffff' : t.color;
        ctx.strokeStyle = isHit ? '#ffffff' : t.color;
        ctx.lineWidth = isHit ? 6 : 3;
        
        if (t.type === 'drone') {
          ctx.strokeRect(-t.size/2, -t.size/2, t.size, t.size);
          ctx.beginPath(); ctx.moveTo(-t.size/4, -t.size/4); ctx.lineTo(t.size/4, t.size/4); ctx.stroke();
        } else if (t.type === 'scout') {
          ctx.beginPath(); ctx.moveTo(0, -t.size/2); ctx.lineTo(t.size/2, t.size/2); ctx.lineTo(-t.size/2, t.size/2); ctx.closePath(); ctx.stroke();
        } else if (t.type === 'interceptor') {
          ctx.beginPath(); ctx.moveTo(0, -t.size/2); ctx.lineTo(t.size/2, 0); ctx.lineTo(0, t.size/2); ctx.lineTo(-t.size/2, 0); ctx.closePath(); ctx.stroke();
        } else if (t.type === 'carrier') {
          ctx.strokeRect(-t.size/2, -t.size/2, t.size, t.size);
          ctx.strokeRect(-t.size/4, -t.size/4, t.size/2, t.size/2);
          ctx.beginPath(); ctx.moveTo(-t.size/2, 0); ctx.lineTo(t.size/2, 0); ctx.moveTo(0, -t.size/2); ctx.lineTo(0, t.size/2); ctx.stroke();
        } else if (t.type === 'shield') {
          ctx.beginPath(); ctx.arc(0, 0, t.size/2, 0, Math.PI * 2); ctx.stroke();
          if (t.shield && t.shield > 0) {
            ctx.save();
            ctx.strokeStyle = COLORS.BLUE;
            ctx.lineWidth = 4;
            ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.arc(0, 0, t.size/2 + 10, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
          }
        } else {
          ctx.strokeRect(-t.size/2, -t.size/2, t.size, t.size);
          ctx.strokeRect(-t.size/3, -t.size/3, t.size*0.6, t.size*0.6);
        }
        
        if (t.maxHealth > 1) {
          ctx.fillStyle = COLORS.RED;
          ctx.fillRect(-t.size/2, -t.size/2 - 15, t.size, 6);
          ctx.fillStyle = COLORS.GREEN;
          ctx.fillRect(-t.size/2, -t.size/2 - 15, t.size * (t.health/t.maxHealth), 6);
        }
        ctx.restore();
      });

      // Render PowerUps
      powerUpsRef.current.forEach(p => {
        ctx.save();
        ctx.translate(p.pos.x, p.pos.y);
        ctx.rotate((time % 2000) / 2000 * Math.PI * 2);
        
        let color = COLORS.YELLOW;
        if (p.type === 'timeFreeze') color = COLORS.CYAN;
        if (p.type === 'multiShot') color = COLORS.MAGENTA;
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size, 0);
        ctx.closePath();
        ctx.stroke();
        
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fill();
        ctx.restore();
      });

      // Render Enemy Projectiles
      enemyProjectilesRef.current.forEach(p => {
        ctx.save();
        ctx.translate(p.pos.x, p.pos.y);
        ctx.shadowBlur = 15;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Particles (Enhanced)
      particlesRef.current.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.translate(p.pos.x, p.pos.y);
        
        if (p.type === 'spark') {
           ctx.beginPath();
           ctx.moveTo(0, 0);
           ctx.lineTo(p.vel.x * 2.5, p.vel.y * 2.5);
           ctx.strokeStyle = p.color;
           ctx.lineWidth = Math.max(1, p.size * (p.life / p.maxLife));
           ctx.stroke();
        } else if (p.type === 'smoke') {
           ctx.beginPath();
           ctx.arc(0, 0, p.size * (1 + (1 - p.life/p.maxLife)), 0, Math.PI * 2);
           ctx.fill();
        } else {
           // debris and default
           ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        }
        ctx.restore();
      });
      ctx.globalAlpha = 1.0;

      // Crosshairs for each hand
      handsDataRef.current.forEach((hand, handIdx) => {
        if (!hand.active) return;

        const hx = hand.pos.x * canvas.width;
        const hy = hand.pos.y * canvas.height;
        const muzzleFlashActive = (time - lastFiredRefs.current[handIdx] < 50) && hand.isFiring;
        
        ctx.save();
        ctx.translate(hx, hy);
        
        if (muzzleFlashActive) {
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 80);
          gradient.addColorStop(0, 'white');
          gradient.addColorStop(0.3, 'rgba(255, 0, 0, 0.8)');
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.fill();
          
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 1;
          for(let i=0; i<4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 200); ctx.stroke();
          }
        }

        ctx.strokeStyle = hand.isFiring ? COLORS.RED : COLORS.CYAN;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.strokeStyle;
        
        // Crosshair shape based on gesture
        if (hand.gesture === 'gun') {
           ctx.beginPath(); ctx.arc(0, 0, hand.isFiring ? 10 : 20, 0, Math.PI * 2); ctx.stroke();
           ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-10, 0); ctx.moveTo(40, 0); ctx.lineTo(10, 0); ctx.stroke();
           ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, -10); ctx.moveTo(0, 40); ctx.lineTo(0, 10); ctx.stroke();
        } else {
           ctx.beginPath(); ctx.arc(0, 0, hand.isFiring ? 15 : 25, 0, Math.PI * 2); ctx.stroke();
           ctx.beginPath();
           ctx.moveTo(-35, 0); ctx.lineTo(-15, 0);
           ctx.moveTo(35, 0); ctx.lineTo(15, 0);
           ctx.moveTo(0, -35); ctx.lineTo(0, -15);
           ctx.moveTo(0, 35); ctx.lineTo(0, 15);
           ctx.stroke();
        }

        if (hand.isFiring) {
          ctx.fillStyle = COLORS.RED;
          ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      });

      // Overlays
      if (damageFlashRef.current > 0) {
        ctx.save();
        const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, canvas.height/3, canvas.width/2, canvas.height/2, canvas.width/1.1);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, `rgba(255, 0, 0, ${damageFlashRef.current * 0.4})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      if (levelUpRef.current > 0) {
        ctx.save();
        ctx.font = 'bold 100px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255, 255, 255, ${levelUpRef.current / 60})`;
        ctx.shadowBlur = 20;
        ctx.shadowColor = COLORS.CYAN;
        ctx.fillText(`THREAT LEVEL ${levelRef.current}`, canvas.width/2, canvas.height/2);
        ctx.restore();
      }

      ctx.restore(); // Restore screen shake
      requestId = requestAnimationFrame(animate);
    };

    requestId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestId);
  }, [onGameOver, updateGameState]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      <video ref={videoRef} className="hidden" playsInline muted />
      
      {/* Background Cyberpunk Scene */}
      <div className="absolute inset-0 z-0">
        <BackgroundFX />
      </div>

      {/* Camera Feed overlay with blend modes */}
      <div className="absolute inset-0 w-full h-full overflow-hidden z-[5]">
        <video
          className="w-full h-full object-cover scale-x-[-1] opacity-30 mix-blend-screen grayscale brightness-[0.8] contrast-125"
          autoPlay
          playsInline
          muted
          ref={(el) => {
            if (el && videoRef.current && videoRef.current.srcObject) {
              el.srcObject = videoRef.current.srcObject;
            }
          }}
        />
        {/* Subtle camera borders to frame it */}
        <div className="absolute inset-0 pointer-events-none ring-inset ring-2 ring-cyan-500/10"></div>
      </div>

      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="relative w-full h-full object-contain z-10"
      />
    </div>
  );
};

export default GameEngine;
