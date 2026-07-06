import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
  console.warn('[MercadoPago] MERCADOPAGO_ACCESS_TOKEN not set');
}

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
  options: { timeout: 5000, idempotencyKey: undefined },
});

export const mpPreference = new Preference(client);
export const mpPayment = new Payment(client);
export { client as mercadopagoClient };
