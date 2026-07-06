import { NextRequest, NextResponse } from 'next/server';
import { processIncomingMessage } from '@/services/whatsapp.service';
import type { WAWebhookBody } from '@/types/whatsapp.types';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// Webhook verification (Meta requires this)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

// Receive incoming messages
export async function POST(req: NextRequest) {
  const body = await req.json() as WAWebhookBody;

  if (body.object !== 'whatsapp_business_account') {
    return NextResponse.json({ error: 'Unknown object' }, { status: 400 });
  }

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;

      const { messages, contacts } = change.value;
      if (!messages?.length) continue;

      for (const message of messages) {
        const contact = contacts?.find((c) => c.wa_id === message.from);
        const phone = `+${message.from}`;

        processIncomingMessage(phone, message).catch((err) => {
          console.error('[WA Webhook] Error processing message:', err);
        });
      }
    }
  }

  return NextResponse.json({ status: 'ok' });
}
