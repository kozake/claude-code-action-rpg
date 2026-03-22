export class AudioManager {
  private fieldBgm: HTMLAudioElement;
  private bossBgm: HTMLAudioElement;
  private current: HTMLAudioElement | null = null;
  private started = false;

  constructor() {
    this.fieldBgm = this.createAudio('./audio/field');
    this.bossBgm = this.createAudio('./audio/boss');
  }

  private createAudio(basePath: string): HTMLAudioElement {
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.5;
    const canOgg = audio.canPlayType('audio/ogg') !== '';
    audio.src = canOgg ? `${basePath}.ogg` : `${basePath}.mp3`;
    return audio;
  }

  // Call this on first user gesture to unlock audio
  unlock() {
    this.started = true;
    if (this.current) {
      this.current.play().catch(() => {});
    }
  }

  playField() {
    this.switchTo(this.fieldBgm);
  }

  playBoss() {
    this.switchTo(this.bossBgm);
  }

  private switchTo(audio: HTMLAudioElement) {
    if (audio === this.current) return;
    if (this.current) {
      this.current.pause();
      this.current.currentTime = 0;
    }
    this.current = audio;
    if (this.started) {
      audio.play().catch(() => {});
    }
  }

  stop() {
    if (this.current) {
      this.current.pause();
      this.current.currentTime = 0;
      this.current = null;
    }
  }
}
