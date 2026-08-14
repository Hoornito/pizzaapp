import { prisma } from '@/lib/prisma';
import { MENU_CARD_KEYS, type MenuCardKey } from '@/lib/constants';

export type MenuCardImages = Partial<Record<MenuCardKey, string>>;

/** Fotos cargadas, por clave de tarjeta. Lo que no esté usa su default. */
export async function getMenuCardImages(): Promise<MenuCardImages> {
  const rows = await prisma.menuCardImage.findMany();
  const out: MenuCardImages = {};
  for (const r of rows) {
    if ((MENU_CARD_KEYS as readonly string[]).includes(r.key) && r.image) {
      out[r.key as MenuCardKey] = r.image;
    }
  }
  return out;
}

/**
 * Guarda las fotos recibidas. Una clave con string vacío borra la foto (vuelve
 * al default), en vez de dejar una fila apuntando a la nada.
 */
export async function saveMenuCardImages(images: MenuCardImages): Promise<MenuCardImages> {
  for (const key of MENU_CARD_KEYS) {
    const value = images[key];
    if (value === undefined) continue;
    const image = value.trim();
    if (!image) {
      await prisma.menuCardImage.deleteMany({ where: { key } });
    } else {
      await prisma.menuCardImage.upsert({
        where: { key },
        update: { image },
        create: { key, image },
      });
    }
  }
  return getMenuCardImages();
}
