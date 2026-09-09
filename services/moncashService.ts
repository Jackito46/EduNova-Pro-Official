import { supabase } from '../supabase';
import { PaymentGateway } from '../types';

export interface MonCashPaymentRequest {
  amount: number;
  orderId: string;
  description: string;
}

export interface MonCashPaymentResponse {
  payment_token: {
    expired: string;
    created: string;
    token: string;
  };
  redirect_url: string;
  mode: string;
  status: number;
}

export class MonCashService {
  private static async getGatewayConfig(schoolId: string): Promise<PaymentGateway | null> {
    try {
      const { data: gatewayData, error } = await supabase
        .from('payment_gateways')
        .select('*')
        .eq('school_id', schoolId)
        .eq('gateway_name', 'moncash')
        .eq('is_active', true)
        .maybeSingle();

      if (gatewayData) {
        return gatewayData;
      }

      // Récupération depuis le coffre-fort api_credentials
      const { data: creds } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('school_id', schoolId)
        .eq('service_name', 'moncash')
        .eq('is_active', true);

      if (creds && creds.length > 0) {
        const clientId = creds.find(c => c.key_name === 'MONCASH_CLIENT_ID')?.key_value || '';
        const clientSecret = creds.find(c => c.key_name === 'MONCASH_CLIENT_SECRET')?.encrypted_value || '';
        const businessKey = creds.find(c => c.key_name === 'MONCASH_BUSINESS_KEY')?.key_value || '';
        const mode = (creds.find(c => c.key_name === 'MONCASH_MODE')?.key_value || 'sandbox') as 'sandbox' | 'live';
        
        return {
          id: creds[0].id,
          school_id: schoolId,
          gateway_name: 'moncash',
          client_id: clientId,
          client_secret: clientSecret,
          business_key: businessKey,
          mode,
          is_active: true,
          created_at: creds[0].created_at,
          updated_at: creds[0].updated_at
        } as PaymentGateway;
      }

      return null;
    } catch (err) {
      console.error('Error fetching MonCash config:', err);
      return null;
    }
  }

  /**
   * Initiates a payment with MonCash
   * Note: This is a skeleton. Real implementation would call MonCash API via a secure proxy or edge function.
   */
  static async initiatePayment(schoolId: string, request: MonCashPaymentRequest): Promise<string | null> {
    const config = await this.getGatewayConfig(schoolId);
    if (!config) {
      throw new Error('MonCash non configuré pour cet établissement.');
    }

    // In a real scenario, we would:
    // 1. Get OAuth token from MonCash
    // 2. Create payment request
    // 3. Return the redirect URL
    
    console.log(`Initiating MonCash payment for school ${schoolId}, amount: ${request.amount}, order: ${request.orderId}`);
    
    // For now, we return a mock URL or handle the logic to be implemented
    // Since we are in a client-side environment, sensitive API calls should be handled by a backend.
    // We can use a Supabase Edge Function for this.
    
    const baseUrl = config.mode === 'live'
      ? 'https://moncashbutton.digicelgroup.com'
      : 'https://sandbox.moncashbutton.digicelgroup.com';

    return `${baseUrl}/Moncash-middleware/Checkout/${config.business_key}?token=MOCK_TOKEN`;
  }

  /**
   * Verifies the status of a transaction
   */
  static async verifyTransaction(schoolId: string, transactionId: string): Promise<any> {
    const config = await this.getGatewayConfig(schoolId);
    if (!config) return null;

    console.log(`Verifying MonCash transaction ${transactionId} for school ${schoolId}`);
    
    // Logic to call MonCash Transaction Details API
    return { status: 'SUCCESSFUL', transaction_id: transactionId };
  }
}
