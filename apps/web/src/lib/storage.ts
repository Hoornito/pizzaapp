import path from 'path';
import fs from 'fs/promises';

export interface StorageProvider {
  upload(file: Buffer, filename: string, mimeType: string): Promise<string>;
  delete(url: string): Promise<void>;
}

/**
 * Guarda las imágenes en disco (directorio configurable por UPLOAD_DIR, que en
 * producción es un volumen persistente) y las sirve por `/api/uploads/<archivo>`
 * (una ruta propia, en vez de depender de que Next sirva archivos escritos en
 * runtime dentro de /public).
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads');
const PUBLIC_PATH = '/api/uploads';

class LocalStorageProvider implements StorageProvider {
  async upload(file: Buffer, filename: string, _mimeType: string): Promise<string> {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const uniqueName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    await fs.writeFile(path.join(UPLOAD_DIR, uniqueName), file);
    return `${PUBLIC_PATH}/${uniqueName}`;
  }

  async delete(url: string): Promise<void> {
    // Soporta URLs viejas (/uploads/...) y nuevas (/api/uploads/...).
    const filename = path.basename(url);
    try {
      await fs.unlink(path.join(UPLOAD_DIR, filename));
    } catch {}
  }
}

export const storage: StorageProvider = new LocalStorageProvider();
