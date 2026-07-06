import { NextRequest, NextResponse } from 'next/server';
import { processMercadoPagoWebhook } from '@/services/payment.service';
import type { MPWebhookPayload } from '@/types/payment.types';

export async function POST(req: NextRequest) {
  const body = await req.json() as MPWebhookPayload;

  if (body.type !== 'payment' || !body.data?.id) {
    return NextResponse.json({ received: true });
  }

  try {
    await processMercadoPagoWebhook(String(body.data.id));
  } catch (err) {
    console.error('[MP Webhook] Error:', err);
  }

  return NextResponse.json({ received: true });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const topic = searchParams.get('topic');
  const id = searchParams.get('id');

  if (topic === 'payment' && id) {
    try {
      await processMercadoPagoWebhook(id);
    } catch (err) {
      console.error('[MP Webhook GET] Error:', err);
    }
  }

  return NextResponse.json({ received: true });
}
