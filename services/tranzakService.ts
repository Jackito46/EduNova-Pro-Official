import { supabase } from '../supabase';

export interface TranzakPaymentRequest {
  schoolId: string;
  amount: number;
  currency?: 'HTG' | 'USD';
  operator?: 'moncash' | 'natcash';
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  reference?: string;
  description?: string;
  studentId?: string;
  studentName?: string;
  feeType?: string;
  campaignId?: string;
}

export interface TranzakPaymentResponse {
  success: boolean;
  payment_url?: string;
  transaction_id?: string;
  reference?: string;
  error?: string;
  is_simulated?: boolean;
}

/**
 * Service client pour les paiements MonCash et NatCash via la passerelle Tranzak
 */
export class TranzakService {
  /**
   * Vérifie si Tranzak est configuré et actif pour l'établissement
   */
  static async isConfigured(schoolId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('api_credentials')
        .select('key_name, key_value, is_active')
        .eq('school_id', schoolId)
        .eq('service_name', 'tranzak')
        .eq('is_active', true);

      if (!data || data.length === 0) return false;
      return data.some(d => d.key_name === 'TRANZAK_API_KEY' && Boolean(d.key_value));
    } catch (e) {
      return false;
    }
  }

  /**
   * Initialise un paiement MonCash ou NatCash via Tranzak
   * Appelle l'endpoint sécurisé du serveur qui communique avec https://api.tranzak.co/api/gateway/v1/payments
   */
  static async createPayment(req: TranzakPaymentRequest): Promise<TranzakPaymentResponse> {
    try {
      const token = (await supabase.auth.getSession()).data?.session?.access_token;
      const res = await fetch('/api/tranzak/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(req)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        const errorMsg = data.error || data.message || `Erreur Tranzak (${res.status})`;
        console.warn('[TranzakService.createPayment] Résultat:', errorMsg);
        return {
          success: false,
          error: errorMsg
        };
      }

      return data;
    } catch (err: any) {
      console.warn('[TranzakService.createPayment] Exception réseau:', err?.message);
      return {
        success: false,
        error: err.message || 'Impossible d’initialiser le paiement Tranzak'
      };
    }
  }

  /**
   * Vérifie l'état d'une transaction Tranzak
   */
  static async checkStatus(transactionId: string): Promise<any> {
    try {
      const token = (await supabase.auth.getSession()).data?.session?.access_token;
      const res = await fetch(`/api/tranzak/payment-status/${encodeURIComponent(transactionId)}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Annule une commande Tranzak non aboutie auprès du serveur
   */
  static async cancelPayment(orderId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const token = (await supabase.auth.getSession()).data?.session?.access_token;
      const res = await fetch('/api/tranzak/cancel-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ order_id: orderId, reason })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}
