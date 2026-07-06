export interface WAWebhookBody {
  object: string;
  entry: WAEntry[];
}

export interface WAEntry {
  id: string;
  changes: WAChange[];
}

export interface WAChange {
  value: WAValue;
  field: string;
}

export interface WAValue {
  messaging_product: string;
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: WAContact[];
  messages?: WAMessage[];
  statuses?: WAStatus[];
}

export interface WAContact {
  profile: { name: string };
  wa_id: string;
}

export interface WAMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'interactive' | 'button';
  text?: { body: string };
  interactive?: WAInteractive;
  button?: { payload: string; text: string };
}

export interface WAInteractive {
  type: 'list_reply' | 'button_reply';
  list_reply?: { id: string; title: string };
  button_reply?: { id: string; title: string };
}

export interface WAStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
}

export type WAConversationState = 'MENU' | 'AWAITING_OPTION' | 'ORDER_LINK_SENT' | 'CHECKING_ORDER';
