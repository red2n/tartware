export interface BillingPayment {
  id: string;
  tenant_id: string;
  property_id: string;
  property_name?: string;
  reservation_id?: string;
  confirmation_number?: string;
  guest_id?: string;
  guest_name?: string;
  payment_reference: string;
  external_transaction_id?: string;
  transaction_type: string;
  transaction_type_display: string;
  payment_method: string;
  payment_method_display: string;
  status: string;
  status_display: string;
  amount: number;
  currency: string;
  processed_at?: string;
  created_at: string;
  updated_at?: string;
  version: string;
  gateway_name?: string;
  gateway_reference?: string;
}
