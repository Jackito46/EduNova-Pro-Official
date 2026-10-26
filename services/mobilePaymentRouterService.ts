import { supabase } from '../supabase';
import { TranzakService, TranzakPaymentRequest, TranzakPaymentResponse } from './tranzakService';

export type MobileMoneyGateway = 'tranzak' | 'kobara' | 'moncash' | 'none';

export interface MobilePaymentDispatchParams {
  schoolId: string;
  amount: number;
  currency?: 'HTG' | 'USD';
  operator?: 'moncash' | 'natcash';
  studentId?: string;
  studentName?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  payerPhone?: string;
  orderId?: string;
  description?: string;
  feeType?: string;
  campaignId?: string;
}

export interface MobilePaymentDispatchResult {
  success: boolean;
  gateway: MobileMoneyGateway;
  operator: 'moncash' | 'natcash';
  orderId: string;
  transactionId?: string;
  paymentUrl?: string;
  redirectUrl?: string;
  error?: string;
  message?: string;
  is_simulated?: boolean;
}

let cachedGateway: { schoolId: string; gateway: MobileMoneyGateway; timestamp: number } | null = null;

export class MobilePaymentRouterService {
  /**
   * Récupère la passerelle Mobile Money actuellement configurée et active pour l'école
   */
  static async getActiveGateway(schoolId: string): Promise<MobileMoneyGateway> {
    if (!schoolId) return 'none';

    // Cache court de 5 secondes pour éviter le spam de requêtes
    const now = Date.now();
    if (cachedGateway && cachedGateway.schoolId === schoolId && (now - cachedGateway.timestamp) < 5000) {
      return cachedGateway.gateway;
    }

    // 1. Vérification prioritaire : statut d'activation SaaS des passerelles pour cet établissement
    try {
      const { data: schoolRow } = await supabase
        .from('schools')
        .select('has_api_gateways, global_settings')
        .eq('id', schoolId)
        .maybeSingle();

      if (schoolRow && schoolRow.has_api_gateways === false) {
        cachedGateway = { schoolId, gateway: 'none', timestamp: now };
        return 'none';
      }

      if (schoolRow?.global_settings) {
        const gs = typeof schoolRow.global_settings === 'string' ? JSON.parse(schoolRow.global_settings) : schoolRow.global_settings;
        if (gs?.active_mobile_money_gateway) {
          const gw = gs.active_mobile_money_gateway as MobileMoneyGateway;
          cachedGateway = { schoolId, gateway: gw, timestamp: now };
          return gw;
        }
      }
    } catch (e) {
      console.warn('[MobilePaymentRouterService] Erreur lecture statut école:', e);
    }

    try {
      const token = (await supabase.auth.getSession()).data?.session?.access_token;
      const res = await fetch(`/api/settings/api-credentials?school_id=${encodeURIComponent(schoolId)}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.active_mobile_money_gateway) {
          const gw = data.active_mobile_money_gateway as MobileMoneyGateway;
          cachedGateway = { schoolId, gateway: gw, timestamp: now };
          return gw;
        }
      }
    } catch (err) {
      console.warn('[MobilePaymentRouterService] Erreur interrogation serveur:', err);
    }

    return 'tranzak';
  }

  /**
   * Modifie et persiste la passerelle Mobile Money active pour l'école
   */
  static async setActiveGateway(schoolId: string, gateway: MobileMoneyGateway): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!schoolId) {
      return { success: false, error: 'Identifiant d’école manquant' };
    }

    try {
      const token = (await supabase.auth.getSession()).data?.session?.access_token;
      const res = await fetch('/api/settings/active-gateway', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          school_id: schoolId,
          active_gateway: gateway
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        cachedGateway = { schoolId, gateway, timestamp: Date.now() };
        return { success: true, message: data.message };
      }
      throw new Error(data.error || 'Erreur lors de la mise à jour');
    } catch (err: any) {
      console.warn('[MobilePaymentRouterService] Erreur endpoint dédié, repli direct Supabase:', err);

      try {
        const { data: schoolRow } = await supabase
          .from('schools')
          .select('global_settings')
          .eq('id', schoolId)
          .maybeSingle();

        let sSettings: any = {};
        if (schoolRow?.global_settings) {
          sSettings = typeof schoolRow.global_settings === 'string' ? JSON.parse(schoolRow.global_settings) : schoolRow.global_settings;
        }
        sSettings.active_mobile_money_gateway = gateway;

        await supabase
          .from('schools')
          .update({ global_settings: sSettings })
          .eq('id', schoolId);

        cachedGateway = { schoolId, gateway, timestamp: Date.now() };
        return { success: true, message: `Passerelle basculée sur ${gateway.toUpperCase()}` };
      } catch (dbErr: any) {
        return { success: false, error: dbErr.message || 'Impossible de mettre à jour la passerelle' };
      }
    }
  }

  /**
   * Déclenche un paiement Mobile Money en l'aiguillant automatiquement
   * vers la passerelle actuellement active (Tranzak, Kobara ou MonCash direct)
   */
  static async dispatchPayment(params: MobilePaymentDispatchParams): Promise<MobilePaymentDispatchResult> {
    const activeGateway = await this.getActiveGateway(params.schoolId);
    const effectiveOperator = params.operator || 'moncash';
    const effectiveOrderId = params.orderId || `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    console.log(`[MobilePaymentRouterService] Aiguillage transaction ${effectiveOrderId} vers passerelle active :`, activeGateway);

    if (activeGateway === 'none') {
      return {
        success: false,
        gateway: 'none',
        operator: effectiveOperator,
        orderId: effectiveOrderId,
        error: "Les passerelles électroniques sont désactivées pour cet établissement. L'établissement fonctionne en mode manuel uniquement (Cash, Dépôt Bancaire, Chèque)."
      };
    }

    // 1. ROUTAGE TRANZAK
    if (activeGateway === 'tranzak') {
      const tranzakReq: TranzakPaymentRequest = {
        schoolId: params.schoolId,
        amount: params.amount,
        currency: params.currency || 'HTG',
        operator: effectiveOperator,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        customerPhone: params.customerPhone || params.payerPhone,
        reference: effectiveOrderId,
        description: params.description,
        studentId: params.studentId,
        studentName: params.studentName,
        feeType: params.feeType,
        campaignId: params.campaignId
      };

      const tranzakRes: TranzakPaymentResponse = await TranzakService.createPayment(tranzakReq);

      if (tranzakRes.success) {
        return {
          success: true,
          gateway: 'tranzak',
          operator: effectiveOperator,
          orderId: effectiveOrderId,
          transactionId: tranzakRes.transaction_id,
          paymentUrl: tranzakRes.payment_url,
          redirectUrl: tranzakRes.payment_url,
          is_simulated: tranzakRes.is_simulated,
          message: tranzakRes.is_simulated 
            ? 'Session Tranzak Sandbox simulée avec succès' 
            : 'Session Tranzak initialisée avec succès'
        };
      }

      return {
        success: false,
        gateway: 'tranzak',
        operator: effectiveOperator,
        orderId: effectiveOrderId,
        error: tranzakRes.error || 'Échec de l’initialisation Tranzak'
      };
    }

    // 2. ROUTAGE KOBARA
    if (activeGateway === 'kobara') {
      try {
        const token = (await supabase.auth.getSession()).data?.session?.access_token;
        const res = await fetch('/api/payments/kobara/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            school_id: params.schoolId,
            amount: params.amount,
            phone: params.payerPhone || params.customerPhone,
            operator: effectiveOperator,
            student_id: params.studentId,
            student_name: params.studentName,
            fee_type: params.feeType || 'SCOLARITE',
            order_id: effectiveOrderId
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          return {
            success: true,
            gateway: 'kobara',
            operator: effectiveOperator,
            orderId: effectiveOrderId,
            transactionId: data.transaction_id || effectiveOrderId,
            paymentUrl: data.payment_url || data.checkout_url,
            redirectUrl: data.payment_url || data.checkout_url,
            message: 'Requête Kobara soumise avec succès'
          };
        }
        return {
          success: false,
          gateway: 'kobara',
          operator: effectiveOperator,
          orderId: effectiveOrderId,
          error: data.error || 'Erreur lors de la requête Kobara'
        };
      } catch (kErr: any) {
        return {
          success: false,
          gateway: 'kobara',
          operator: effectiveOperator,
          orderId: effectiveOrderId,
          error: kErr.message || 'Impossible de contacter Kobara'
        };
      }
    }

    // 3. ROUTAGE MONCASH DIRECT
    try {
      const res = await fetch('/api/moncash/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: params.amount,
          orderId: effectiveOrderId,
          schoolId: params.schoolId,
          payerPhone: params.payerPhone || params.customerPhone,
          description: params.description || `Paiement ${params.feeType || 'Scolarité'} - ${params.studentName || params.customerName}`
        })
      });

      const data = await res.json();
      return {
        success: Boolean(data.redirect_url || res.ok),
        gateway: 'moncash',
        operator: 'moncash',
        orderId: effectiveOrderId,
        transactionId: data.transaction_id || effectiveOrderId,
        paymentUrl: data.redirect_url,
        redirectUrl: data.redirect_url,
        message: 'Session MonCash direct créée'
      };
    } catch (mErr: any) {
      return {
        success: false,
        gateway: 'moncash',
        operator: 'moncash',
        orderId: effectiveOrderId,
        error: mErr.message || 'Erreur MonCash Direct'
      };
    }
  }
}
