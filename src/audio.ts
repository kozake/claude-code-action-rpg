type NoteEvent = { freq: number; beats: number; vol: number; type: OscillatorType };

// Field BGM: C major, peaceful exploration, 100 BPM
const FIELD_BPM = 100;
const FIELD_MELODY: NoteEvent[] = [
  { freq: 261.63, beats: 1, vol: 0.28, type: 'sine' },  // C4
  { freq: 329.63, beats: 1, vol: 0.24, type: 'sine' },  // E4
  { freq: 392.00, beats: 1, vol: 0.24, type: 'sine' },  // G4
  { freq: 440.00, beats: 1, vol: 0.28, type: 'sine' },  // A4
  { freq: 392.00, beats: 1, vol: 0.24, type: 'sine' },  // G4
  { freq: 329.63, beats: 1, vol: 0.24, type: 'sine' },  // E4
  { freq: 293.66, beats: 1, vol: 0.22, type: 'sine' },  // D4
  { freq: 261.63, beats: 1, vol: 0.28, type: 'sine' },  // C4
];
const FIELD_BASS: NoteEvent[] = [
  { freq: 65.41,  beats: 2, vol: 0.18, type: 'triangle' }, // C2
  { freq: 98.00,  beats: 2, vol: 0.14, type: 'triangle' }, // G2
  { freq: 87.31,  beats: 2, vol: 0.14, type: 'triangle' }, // F2
  { freq: 98.00,  beats: 2, vol: 0.14, type: 'triangle' }, // G2
];

// Boss BGM: D minor, intense battle, 160 BPM
const BOSS_BPM = 160;
const BOSS_MELODY: NoteEvent[] = [
  { freq: 293.66, beats: 1,   vol: 0.38, type: 'square' }, // D4
  { freq: 293.66, beats: 0.5, vol: 0.32, type: 'square' }, // D4
  { freq: 349.23, beats: 0.5, vol: 0.32, type: 'square' }, // F4
  { freq: 440.00, beats: 1,   vol: 0.38, type: 'square' }, // A4
  { freq: 466.16, beats: 1,   vol: 0.32, type: 'square' }, // Bb4
  { freq: 440.00, beats: 0.5, vol: 0.32, type: 'square' }, // A4
  { freq: 349.23, beats: 0.5, vol: 0.32, type: 'square' }, // F4
  { freq: 293.66, beats: 2,   vol: 0.38, type: 'square' }, // D4 (held)
];
const BOSS_BASS: NoteEvent[] = [
  { freq: 73.42,  beats: 2, vol: 0.22, type: 'sawtooth' }, // D2
  { freq: 65.41,  beats: 2, vol: 0.18, type: 'sawtooth' }, // C2
  { freq: 58.27,  beats: 2, vol: 0.18, type: 'sawtooth' }, // Bb1
  { freq: 65.41,  beats: 2, vol: 0.18, type: 'sawtooth' }, // C2
];

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private started = false;
  private currentTrack: 'field' | 'boss' | null = null;
  private generation = 0;

  // Call this on first user gesture to unlock audio context
  unlock() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;

    this.ctx = new AC();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.4;
    this.masterGain.connect(this.ctx.destination);
    this.started = true;

    if (this.currentTrack === 'field') this.loop('field');
    else if (this.currentTrack === 'boss') this.loop('boss');
  }

  playField() {
    if (this.currentTrack === 'field') return;
    this.currentTrack = 'field';
    this.generation++;
    if (this.started) this.loop('field');
  }

  playBoss() {
    if (this.currentTrack === 'boss') return;
    this.currentTrack = 'boss';
    this.generation++;
    if (this.started) this.loop('boss');
  }

  stop() {
    this.currentTrack = null;
    this.generation++;
  }

  private loop(track: 'field' | 'boss') {
    const gen = this.generation;
    const ctx = this.ctx!;
    const masterGain = this.masterGain!;

    const bpm = track === 'field' ? FIELD_BPM : BOSS_BPM;
    const melody = track === 'field' ? FIELD_MELODY : BOSS_MELODY;
    const bass = track === 'field' ? FIELD_BASS : BOSS_BASS;
    const beatSec = 60 / bpm;
    const startTime = ctx.currentTime + 0.05;

    const scheduleNotes = (pattern: NoteEvent[]): number => {
      let t = startTime;
      for (const note of pattern) {
        const dur = note.beats * beatSec;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = note.type;
        osc.frequency.value = note.freq;
        osc.connect(env);
        env.connect(masterGain);

        const attack = Math.min(0.02, dur * 0.1);
        const release = Math.min(0.08, dur * 0.3);
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(note.vol, t + attack);
        env.gain.linearRampToValueAtTime(note.vol * 0.75, t + dur - release);
        env.gain.linearRampToValueAtTime(0, t + dur);

        osc.start(t);
        osc.stop(t + dur);
        t += dur;
      }
      return t - startTime;
    };

    const duration = scheduleNotes(melody);
    scheduleNotes(bass);

    setTimeout(() => {
      if (this.generation !== gen) return;
      this.loop(track);
    }, (duration - 0.05) * 1000);
  }
}
