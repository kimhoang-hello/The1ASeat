// Tiny synthesized tones: no downloads, no music, and never started before a gesture.
export class Sound {
  constructor() {
    this.enabled = true;
    this.context = null;
  }
  unlock() {
    if (!this.enabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context ||= new AudioContext();
      if (this.context.state === "suspended")
        this.context.resume().catch(() => {});
    } catch {
      /* Gameplay still works if audio is unavailable. */
    }
  }
  play(type) {
    if (!this.enabled || !this.context || this.context.state !== "running")
      return;
    const melodies = {
      normal: [680, 920],
      welcome: [520, 660, 790, 1040],
      transfer: [660, 830, 990],
      bad: [200, 140],
      devaluation: [330, 260, 195],
      end: [440, 350, 260, 220],
      chaos: [660, 660, 880],
      event: [600, 800, 1000],
      combo: [620, 780, 930, 1240],
      golden: [520, 660, 790, 1040, 1320],
      tick: [540],
      record: [660, 830, 990, 1320],
    };
    const now = this.context.currentTime;
    (melodies[type] || melodies.bad).forEach((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const start = now + index * 0.07;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.055, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.13);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.14);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }
}
