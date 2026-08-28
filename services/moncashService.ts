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
    const { data, error } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('school_id', schoolId)
      .eq('gateway_name', 'moncash')
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching MonCash config:', error);
      return null;
    }
    return data;
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
    
    return `https://moncashbutton.digicelgroup.com/Moncash-middleware/Checkout/${config.business_key}?token=MOCK_TOKEN`;
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
