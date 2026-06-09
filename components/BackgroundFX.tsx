import React, { useEffect, useRef } from 'react';
import { COLORS } from '../constants';

export const BackgroundFX: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Generate stars
    const stars = Array.from({ length: 150 }).map(() => ({
      x: Math.random() * 1280,
      y: Math.random() * 720,
      z: Math.random() * 2 + 0.5,
      color: Math.random() > 0.8 ? COLORS.CYAN : '#ffffff'
    }));

    // Generate buildings
    const buildings = Array.from({ length: 15 }).map(() => ({
      x: Math.random() * 1280,
      w: Math.random() * 60 + 40,
      h: Math.random() * 200 + 100,
      speed: Math.random() * 0.5 + 0.2, // slower parallax
      color: `rgba(15, 23, 42, ${Math.random() * 0.5 + 0.5})`
    }));

    let reqId: number;
    let time = 0;

    const animate = () => {
      time += 1;
      
      // Deep space background
      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, 1280, 720);

      // Draw stars
      stars.forEach(s => {
        s.y += s.z;
        if (s.y > 720) { s.y = 0; s.x = Math.random() * 1280; }
        ctx.fillStyle = s.color;
        const brightness = Math.sin(time * 0.05 + s.x) * 0.5 + 0.5;
        ctx.globalAlpha = brightness;
        ctx.fillRect(s.x, s.y, s.z, s.z);
      });
      ctx.globalAlpha = 1.0;

      // Draw Grid at bottom (perspective effect)
      ctx.save();
      ctx.translate(640, 720);
      ctx.strokeStyle = `rgba(34, 211, 238, 0.2)`; 
      ctx.lineWidth = 1;

      // perspective lines going to center
      for (let i = -20; i <= 20; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 15, -250);
        ctx.lineTo(i * 150, 0);
        ctx.stroke();
      }
      
      // horizontal lines moving forward
      const offset = (time * 1.5) % 30;
      for (let i = 0; i < 8; i++) {
        const y = -250 + Math.pow(i * 18 + offset, 1.3) * 0.5;
        if (y > 0) continue;
        ctx.beginPath();
        ctx.moveTo(-1280, y);
        ctx.lineTo(1280, y);
        ctx.stroke();
      }
      ctx.restore();

      // Draw buildings (parallax)
      buildings.forEach(b => {
        b.x -= b.speed;
        if (b.x + b.w < 0) {
          b.x = 1280;
          b.h = Math.random() * 200 + 100;
        }
        ctx.fillStyle = b.color;
        ctx.strokeStyle = `rgba(34, 211, 238, ${b.speed > 0.5 ? 0.8 : 0.3})`;
        ctx.lineWidth = 2;
        ctx.fillRect(b.x, 720 - b.h, b.w, b.h);
        ctx.strokeRect(b.x, 720 - b.h, b.w, b.h);
        
        if (b.speed > 0.4) {
            // Add neon window accents randomly
            ctx.fillStyle = COLORS.MAGENTA;
            for(let i=0; i<3; i++) {
                ctx.globalAlpha = Math.sin(time * 0.1 + b.x + i) > 0 ? 1 : 0.2;
                ctx.fillRect(b.x + 10 + i * 15, 720 - b.h + 20, 5, 20);
            }
            ctx.globalAlpha = 1.0;
        }
      });

      reqId = requestAnimationFrame(animate);
    };
    reqId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(reqId);
  }, []);

  return (
    <canvas ref={canvasRef} width={1280} height={720} className="w-full h-full object-cover absolute top-0 left-0 bg-transparent pointer-events-none" />
  );
};

export default BackgroundFX;
