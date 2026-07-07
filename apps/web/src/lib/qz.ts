// Wrapper de QZ Tray (https://qz.io). QZ Tray es un agente de escritorio que
// corre en la PC de la "estación de impresión" y permite imprimir a impresoras
// por nombre, en silencio. El navegador se conecta por WebSocket a
// wss://localhost:8181 (la MISMA PC donde corre QZ Tray).
//
// Firma: la app firma cada pedido con la clave privada (server-side, ver
// /api/qz/sign) usando el certificado de /api/qz/cert. Con el certificado
// importado en QZ Tray, deja de pedir "Allow" en cada impresión. Si el
// certificado/clave no están configurados, QZ cae al modo sin firma (prompt),
// sin romper nada. Ver memoria [[printing-architecture]].

/* eslint-disable @typescript-eslint/no-explicit-any */

let qzPromise: Promise<any> | null = null;
let connecting: Promise<void> | null = null;
let securitySet = false;

async function getQz(): Promise<any> {
  if (!qzPromise) {
    // Import dinámico: qz-tray usa WebSocket/window, sólo debe cargarse en el browser.
    qzPromise = import('qz-tray').then((m) => (m as any).default ?? m);
  }
  return qzPromise;
}

/** Configura certificado + firma (una sola vez) antes de conectar. */
function setupSecurity(qz: any): void {
  if (securitySet) return;
  securitySet = true;

  qz.security.setCertificatePromise((resolve: (v: string) => void, reject: () => void) => {
    fetch('/api/qz/cert')
      .then((r) => r.text())
      .then((cert) => (cert && cert.includes('CERTIFICATE') ? resolve(cert) : reject()))
      .catch(reject);
  });

  qz.security.setSignatureAlgorithm('SHA512');

  qz.security.setSignaturePromise((toSign: string) => (resolve: (v: string) => void, reject: () => void) => {
    fetch('/api/qz/sign?request=' + encodeURIComponent(toSign))
      .then((r) => r.text())
      .then((sig) => (sig ? resolve(sig) : reject()))
      .catch(reject);
  });
}

export async function qzConnect(): Promise<void> {
  const qz = await getQz();
  setupSecurity(qz);
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
