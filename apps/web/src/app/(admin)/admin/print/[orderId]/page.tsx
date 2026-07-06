import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ orderId: string }>;
}

/** Compatibilidad: la impresión ahora se divide en /cocina y /comanda. */
export default async function PrintRedirectPage({ params }: Props) {
  const { orderId } = await params;
  redirect(`/admin/print/${orderId}/comanda`);
}
