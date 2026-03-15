
import React, { useRef, useEffect, useCallback } from 'react';
import { GameState, Target, Particle, Vector2, HandData } from '../types';
import { GAME_CONFIG, COLORS, TARGET_TYPES } from '../constants';
import { soundManager } from '../services/soundManager';

interface GameEngineProps {
  gameState: GameState;
  updateGameState: (updates: Partial<GameState>) => void;
  onGameOver: () => void;
}

const GameEngine: React.FC<GameEngineProps> = ({ gameState, updateGameState, onGameOver }) => {
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
    }
  }, [gameState.isPlaying, gameState.level]);

  const detectGesture = (landmarks: any): 'gun' | 'pinch' | 'none' => {
    if (!landmarks || landmarks.length < 21) return 'none';

    // Index finger extended?
    const isIndexExtended = landmarks[8].y < landmarks[6].y;
    // Middle finger curled?
    const isMiddleCurled = landmarks[12].y > landmarks[10].y;
    // Ring finger curled?
    const isRingCurled = landmarks[16].y > landmarks[14].y;
    // Pinky finger curled?
    const isPinkyCurled = landmarks[20].y > landmarks[18].y;
    
    // Thumb position relative to index base
    const thumbTip = landmarks[4];
    const indexBase = landmarks[5];
    const isThumbExtended = Math.abs(thumbTip.x - indexBase.x) > 0.05 || thumbTip.y < indexBase.y;

    // Gun gesture: Index extended, others curled, thumb usually extended
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
        { active: false, pos: { x: 0.5, y: 0.5 }, isFiring: false, landmarks: [], gesture: 'none' },
        { active: false, pos: { x: 0.5, y: 0.5 }, isFiring: false, landmarks: [], gesture: 'none' }
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
            gesture: gesture
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
          await hands.send({ image: videoRef.current });
        }
      },
      width: 1280,
      height: 720
    });

    camera.start().catch((e: any) => console.error("Camera start failed", e));
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
          shield: config.shield
        });
        soundManager.playSpawn();
        lastSpawnRef.current = time;
      }

      // 2. Firing Logic (Multiple Hands)
      let hitThisFrame = false;
      handsDataRef.current.forEach((hand, handIdx) => {
        if (hand.active && hand.isFiring && time - lastFiredRefs.current[handIdx] > GAME_CONFIG.FIRE_RATE) {
          lastFiredRefs.current[handIdx] = time;
          soundManager.playFire();
          const fireX = hand.pos.x * canvas.width;
          const fireY = hand.pos.y * canvas.height;

          targetsRef.current.forEach(t => {
            const dx = fireX - t.pos.x;
            const dy = fireY - t.pos.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < t.size) {
              hitThisFrame = true;
              if (t.shield && t.shield > 0) {
                t.shield -= 1;
                screenShakeRef.current = 5;
                soundManager.playHit();
              } else {
                t.health -= 1;
                screenShakeRef.current = 3;
                soundManager.playHit();
              }
              t.hitTimer = 10;
              for(let i=0; i<8; i++) {
                particlesRef.current.push({
                  id: Math.random().toString(),
                  pos: { x: fireX, y: fireY },
                  vel: { x: (Math.random()-0.5)*12, y: (Math.random()-0.5)*12 },
                  life: 1,
                  maxLife: 1,
                  color: t.shield && t.shield > 0 ? COLORS.BLUE : '#ffffff',
                  size: Math.random() * 3 + 1
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
              for(let i=0; i<GAME_CONFIG.PARTICLE_COUNT * 2; i++) {
                particlesRef.current.push({
                  id: Math.random().toString(),
                  pos: { ...t.pos },
                  vel: { x: (Math.random()-0.5)*20, y: (Math.random()-0.5)*20 },
                  life: 1,
                  maxLife: 1.5,
                  color: t.color,
                  size: Math.random() * 6 + 2
                });
              }
            });
            targetsRef.current = targetsRef.current.filter(t => t.health > 0);
            updateGameState({ score: scoreRef.current, combo: comboRef.current, maxCombo: maxComboRef.current });
          }
        }
      });

      // 3. Movement & Collision
      targetsRef.current = targetsRef.current.filter(t => {
        t.pos.x += t.vel.x;
        t.pos.y += t.vel.y;
        if (t.hitTimer > 0) t.hitTimer--;
        
        if (t.pos.x < t.size || t.pos.x > canvas.width - t.size) t.vel.x *= -1;
        
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
        p.vel.x *= 0.98;
        p.vel.y *= 0.98;
        p.life -= 0.02;
        return p.life > 0;
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

      // Particles
      particlesRef.current.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.pos.x, p.pos.y, p.size, p.size);
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
      
      {/* Background Camera Feed with Cyberpunk post-processing */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <video
          className="w-full h-full object-cover scale-x-[-1] opacity-50 grayscale brightness-[0.7] contrast-125"
          autoPlay
          playsInline
          muted
          ref={(el) => {
            if (el && videoRef.current && videoRef.current.srcObject) {
              el.srcObject = videoRef.current.srcObject;
            }
          }}
        />
        {/* Digital noise overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
        {/* Subtle cyan vignette */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_transparent_40%,_rgba(34,211,238,0.1)_100%)]"></div>
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
