export interface MPPreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

export interface MPWebhookPayload {
  action: string;
  api_version: string;
  data: { id: string };
  date_created: string;
  id: number;
  live_mode: boolean;
  type: string;
  user_id: number;
}

export interface MPPaymentData {
  id: number;
  status: string;
  status_detail: string;
  external_reference: string;
  transaction_amount: number;
  payment_method_id: string;
  payer: {
    email: string;
    phone?: { number: string };
  };
}
