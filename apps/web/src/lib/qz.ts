// Wrapper de QZ Tray (https://qz.io). QZ Tray es un agente de escritorio que
// corre en la PC de la "estación de impresión" y permite imprimir a impresoras
// por nombre, en silencio. El navegador se conecta por WebSocket a
// wss://localhost:8181 (la MISMA PC donde corre QZ Tray).
//
// Nota: en modo sin firmar, QZ Tray muestra un diálogo "Allow" la primera vez.
// Para producción se configura un certificado + firma; queda pendiente para
// cuando haya hardware. Ver memoria [[printing-architecture]].

/* eslint-disable @typescript-eslint/no-explicit-any */

let qzPromise: Promise<any> | null = null;
let connecting: Promise<void> | null = null;

async function getQz(): Promise<any> {
  if (!qzPromise) {
    // Import dinámico: qz-tray usa WebSocket/window, sólo debe cargarse en el browser.
    qzPromise = import('qz-tray').then((m) => (m as any).default ?? m);
  }
  return qzPromise;
}

export async function qzConnect(): Promise<void> {
  const qz = await getQz();
  if (qz.websocket.isActive()) return;
  if (!connecting) {
    connecting = qz.websocket
      .connect({ retries: 1, delay: 1 })
      .finally(() => {
        connecting = null;
      });
  }
  await connecting;
}

export async function qzIsActive(): Promise<boolean> {
  try {
    const qz = await getQz();
    return qz.websocket.isActive();
  } catch {
    return false;
  }
}

export async function qzDisconnect(): Promise<void> {
  const qz = await getQz();
  if (qz.websocket.isActive()) await qz.websocket.disconnect();
}

export async function qzListPrinters(): Promise<string[]> {
  const qz = await getQz();
  await qzConnect();
  const found = await qz.printers.find();
  return Array.isArray(found) ? found : [found].filter(Boolean);
}

interface PrintOptions {
  /** Tamaño de hoja en mm (para láser A6 usar 105×148). Omitir para térmica. */
  sizeMm?: { width: number; height: number };
}

function buildConfig(qz: any, printerName: string, opts?: PrintOptions) {
  const cfg: Record<string, unknown> = {};
  if (opts?.sizeMm) {
    cfg.size = opts.sizeMm;
    cfg.units = 'mm';
    cfg.scaleContent = true;
  }
  return qz.configs.create(printerName, cfg);
}

/** Imprime una URL (página HTML) en la impresora indicada. QZ renderiza el HTML. */
export async function qzPrintUrl(printerName: string, url: string, opts?: PrintOptions): Promise<void> {
  const qz = await getQz();
  await qzConnect();
  const config = buildConfig(qz, printerName, opts);
  await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'file', data: url }]);
}

/** Imprime HTML literal (para pruebas rápidas). */
export async function qzPrintHtml(printerName: string, html: string, opts?: PrintOptions): Promise<void> {
  const qz = await getQz();
  await qzConnect();
  const config = buildConfig(qz, printerName, opts);
  await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
}
