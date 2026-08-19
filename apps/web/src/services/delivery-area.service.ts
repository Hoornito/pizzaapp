import { prisma } from '@/lib/prisma';
import { buscarBarrio, barrioBloqueadoA } from '@/lib/delivery-areas';

export interface DeliveryAreaInput {
  name: string;
  blockedFrom?: string | null;
  blockedTo?: string | null;
  active?: boolean;
}

export async function getDeliveryAreas() {
  return prisma.deliveryArea.findMany({ orderBy: { name: 'asc' } });
}

export async function createDeliveryArea(data: DeliveryAreaInput) {
  return prisma.deliveryArea.create({
    data: {
      name: data.name.trim(),
      blockedFrom: data.blockedFrom || null,
      blockedTo: data.blockedTo || null,
      active: data.active ?? true,
    },
  });
}

export async function updateDeliveryArea(id: string, data: DeliveryAreaInput) {
  return prisma.deliveryArea.update({
    where: { id },
    data: {
      name: data.name.trim(),
      blockedFrom: data.blockedFrom || null,
      blockedTo: data.blockedTo || null,
      active: data.active ?? true,
    },
  });
}

export async function deleteDeliveryArea(id: string) {
  return prisma.deliveryArea.delete({ where: { id } });
}

/**
 * ¿La dirección cae en un barrio al que a esa hora no se reparte? Devuelve el
 * barrio si está bloqueado, o null. El cruce de nombres y el manejo de la
 * franja viven en lib/delivery-areas, que también usa el checkout.
 */
export async function findBlockedArea(street: string, when: Date = new Date()) {
  const areas = await prisma.deliveryArea.findMany({ where: { active: true } });
  const barrio = buscarBarrio(street, areas);
  if (!barrio) return null;
  return barrioBloqueadoA(barrio, when) ? barrio : null;
}
