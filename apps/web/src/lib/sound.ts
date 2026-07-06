// Sonido de notificación generado con Web Audio API (sin archivos de audio).
// Los navegadores bloquean el audio hasta que hay una interacción del usuario,
// por eso "primeAudio" desbloquea el contexto en el primer gesto.

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  return audioCtx;
}

/** Desbloquea el contexto de audio. Llamar dentro de un gesto del usuario. */
export function primeAudio(): void {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

/** Campanita "ding-dong" para nuevos pedidos. */
export function playNewOrderSound(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  const tones = [
    { f: 880, t: 0 },
    { f: 660, t: 0.18 },
  ];
  for (const { f, t } of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, now + t);
    gain.gain.exponentialRampToValueAtTime(0.3, now + t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + t);
    osc.stop(now + t + 0.36);
  }
}
