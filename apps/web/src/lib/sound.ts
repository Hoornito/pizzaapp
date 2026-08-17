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

/** Toca una secuencia de tonos con la campanita de siempre. */
function playTones(tones: { f: number; t: number }[], type: OscillatorType = 'sine'): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  for (const { f, t } of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, now + t);
    gain.gain.exponentialRampToValueAtTime(0.3, now + t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + t);
    osc.stop(now + t + 0.36);
  }
}

/** Campanita "ding-dong" para nuevos pedidos (los que carga el local). */
export function playNewOrderSound(): void {
  playTones([
    { f: 880, t: 0 },
    { f: 660, t: 0.18 },
  ]);
}

/**
 * Pedido entrado por la WEB: tres notas ascendentes, más largas y con otro
 * timbre. Tiene que distinguirse de oído del "ding-dong" del mostrador, porque
 * es el que nadie está esperando y hay que ir a atender.
 */
export function playWebOrderSound(): void {
  playTones(
    [
      { f: 523, t: 0 },
      { f: 659, t: 0.2 },
      { f: 784, t: 0.4 },
      { f: 1047, t: 0.6 },
    ],
    'triangle'
  );
}
