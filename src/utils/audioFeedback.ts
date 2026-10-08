// Web Audio API feedback synthesizer for student attendance (100% offline, zero latency)
export function playChimeSuccess(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // Play dual-tone pleasant success chord
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    // D5 (587Hz) into A5 (880Hz)
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    // F#5 (739.99Hz) into C#6 (1108.73Hz)
    osc2.frequency.setValueAtTime(739.99, now);
    osc2.frequency.exponentialRampToValueAtTime(1108.73, now + 0.12);

    gainNode.gain.setValueAtTime(0.25, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.42);
    osc2.stop(now + 0.42);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 500);
  } catch {
    // safely ignore audio permission/driver errors
  }
}

export function playChimeWarning(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(370, now);
    osc.frequency.linearRampToValueAtTime(260, now + 0.25);

    gainNode.gain.setValueAtTime(0.28, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.32);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 400);
  } catch {
    // safely ignore
  }
}
