import path from 'path';
import fs from 'fs/promises';

export interface StorageProvider {
  upload(file: Buffer, filename: string, mimeType: string): Promise<string>;
  delete(url: string): Promise<void>;
}

class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;
  private publicPath: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'public', 'uploads');
    this.publicPath = '/uploads';
  }

  async upload(file: Buffer, filename: string, _mimeType: string): Promise<string> {
    await fs.mkdir(this.uploadDir, { recursive: true });
    const uniqueName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(this.uploadDir, uniqueName);
    await fs.writeFile(filePath, file);
    return `${this.publicPath}/${uniqueName}`;
  }

  async delete(url: string): Promise<void> {
    const filename = url.replace(this.publicPath + '/', '');
    const filePath = path.join(this.uploadDir, filename);
    try {
      await fs.unlink(filePath);
    } catch {}
  }
}

// Swap this with S3Provider in production
export const storage: StorageProvider = new LocalStorageProvider();
