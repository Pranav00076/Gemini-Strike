
class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = false;

  constructor() {
    // AudioContext must be initialized after a user gesture
  }

  private init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.3;
    this.enabled = true;
  }

  public async unlock() {
    this.init();
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number, slideTo?: number) {
    if (!this.ctx || !this.masterGain || !this.enabled) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  public playFire() {
    this.playTone(880, 'square', 0.1, 0.2, 110);
  }

  public playHit() {
    this.playTone(440, 'sine', 0.05, 0.1, 220);
  }

  public playExplosion() {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    
    const duration = 0.5;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
  }

  public playSpawn() {
    this.playTone(220, 'sine', 0.2, 0.05, 880);
  }

  public playLevelUp() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sawtooth', 0.4, 0.1, f * 1.2), i * 100);
    });
  }

  public playGameOver() {
    this.playTone(220, 'sawtooth', 1.5, 0.3, 40);
  }

  public playDamage() {
    this.playTone(110, 'triangle', 0.3, 0.4, 55);
  }
}

export const soundManager = new SoundManager();
