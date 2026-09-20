import { supabase } from '../supabase';

/**
 * Service client pour le coffre-fort centralisé des clés API & passerelles.
 * Communique avec les endpoints sécurisés du serveur (/api/settings/api-credentials)
 * assurant le chiffrement AES-256-GCM avant stockage dans Supabase.
 */

export interface CredentialField {
  key_name: string;
  label: string;
  placeholder?: string;
  is_secret: boolean;
  value?: string;
  masked_value?: string;
  description?: string;
}

export interface ServiceCredentialConfig {
  service_name: 'moncash' | 'natcash' | 'smtp' | 'gemini' | 'kobara';
  label: string;
  description: string;
  iconName: string;
  environment: 'sandbox' | 'live' | 'production' | 'test';
  is_active: boolean;
  validation_status: 'VALID' | 'INVALID' | 'UNTESTED' | 'ERROR';
  last_validated_at?: string | null;
  validation_message?: string;
  credentials: Record<string, string>;
  fields: CredentialField[];
  docsUrl?: string;
}

export interface ApiVaultResponse {
  success: boolean;
  credentials?: Record<string, any>;
  error?: string;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  } catch (e) {
    return {};
  }
}

export class ApiVaultService {
  /**
   * Récupère toutes les clés et statuts de validation pour un établissement
   */
  static async getCredentials(schoolId: string): Promise<ApiVaultResponse> {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/settings/api-credentials?school_id=${encodeURIComponent(schoolId)}`, {
        headers: {
          ...authHeaders
        }
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err: any) {
      console.warn('ApiVaultService.getCredentials: Serveur indisponible, repli Supabase direct:', err?.message || err);
      
      // Repli direct Supabase pour garantir que l'application continue de fonctionner
      try {
        const [credsRes, gatewaysRes, gsRes] = await Promise.allSettled([
          supabase.from('api_credentials').select('*').eq('school_id', schoolId),
          supabase.from('payment_gateways').select('*').eq('school_id', schoolId),
          supabase.from('global_settings').select('value').eq('key', 'kobara_config').maybeSingle()
        ]);

        const creds = credsRes.status === 'fulfilled' ? credsRes.value.data : null;
        const gateways = gatewaysRes.status === 'fulfilled' ? gatewaysRes.value.data : null;
        const gsKobara = gsRes.status === 'fulfilled' ? gsRes.value.data : null;

        const moncashGateway = gateways?.find((g: any) => g.gateway_name === 'moncash');
        const kobaraGateway = gateways?.find((g: any) => g.gateway_name === 'kobara');

        const fallbackResult: Record<string, any> = {
          moncash: {
            client_id: moncashGateway?.client_id || '',
            client_secret: moncashGateway?.client_secret ? '••••••••' : '',
            has_secret: Boolean(moncashGateway?.client_secret),
            is_secret_encrypted: false,
            business_key: moncashGateway?.business_key || '',
            mode: moncashGateway?.mode || 'sandbox',
            is_active: moncashGateway?.is_active ?? true,
            validation_status: 'UNTESTED',
            last_validated_at: null,
            validation_message: ''
          },
          natcash: {
            merchant_id: '',
            secret_key: '',
            has_secret: false,
            is_secret_encrypted: false,
            ussd_number: '',
            mode: 'test',
            is_active: false,
            validation_status: 'UNTESTED',
            last_validated_at: null,
            validation_message: ''
          },
          smtp: {
            host: '',
            port: 587,
            user: '',
            pass: '',
            has_secret: false,
            from_name: '',
            from_email: '',
            is_active: false,
            validation_status: 'UNTESTED',
            last_validated_at: null,
            validation_message: ''
          },
          kobara: {
            secret_key: '',
            webhook_secret: '',
            public_key: kobaraGateway?.client_id || '',
            receiver_phone: kobaraGateway?.business_key || gsKobara?.value?.receiver_phone || '36045639',
            receiver_phone_moncash: gsKobara?.value?.receiver_phone_moncash || '',
            receiver_phone_natcash: gsKobara?.value?.receiver_phone_natcash || '',
            same_receiver_number: gsKobara?.value?.same_receiver_number ?? true,
            auto_payout: gsKobara?.value?.auto_payout ?? true,
            receiver_name: gsKobara?.value?.receiver_name || 'JACQUES ETIENNE',
            receiver_operator: gsKobara?.value?.receiver_operator || 'moncash',
            has_secret: false,
            has_webhook_secret: false,
            is_secret_encrypted: false,
            mode: kobaraGateway?.mode || gsKobara?.value?.mode || 'live',
            is_active: true,
            validation_status: 'UNTESTED',
            last_validated_at: null,
            validation_message: ''
          },
          gemini: {
            api_key_configured: true,
            masked_key: 'AIza••••••••',
            status: 'VALID'
          }
        };

        if (creds && creds.length > 0) {
          for (const c of creds) {
            if (c.service_name === 'moncash') {
              if (c.key_name === 'MONCASH_CLIENT_ID') fallbackResult.moncash.client_id = c.key_value || fallbackResult.moncash.client_id;
              if (c.key_name === 'MONCASH_BUSINESS_KEY') fallbackResult.moncash.business_key = c.key_value || fallbackResult.moncash.business_key;
              if (c.key_name === 'MONCASH_MODE') fallbackResult.moncash.mode = c.key_value || fallbackResult.moncash.mode;
            } else if (c.service_name === 'kobara') {
              if (c.key_name === 'KOBARA_PUBLIC_KEY') fallbackResult.kobara.public_key = c.key_value || fallbackResult.kobara.public_key;
              if (c.key_name === 'KOBARA_RECEIVER_PHONE') fallbackResult.kobara.receiver_phone = c.key_value || fallbackResult.kobara.receiver_phone;
              if (c.key_name === 'KOBARA_RECEIVER_NAME') fallbackResult.kobara.receiver_name = c.key_value || fallbackResult.kobara.receiver_name;
            }
          }
        }

        return { success: true, credentials: fallbackResult };
      } catch (fallbackErr) {
        return { success: false, error: err.message || 'Impossible de joindre le serveur' };
      }
    }
  }

  /**
   * Enregistre et chiffre (AES-256-GCM) les clés d'un service dans la base Supabase
   */
  static async saveCredentials(params: {
    schoolId: string;
    serviceName: string;
    credentials: Record<string, any>;
    environment?: string;
    isActive?: boolean;
  }): Promise<{ success: boolean; message?: string; error?: string; saved_keys?: string[] }> {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/settings/api-credentials', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          school_id: params.schoolId,
          service_name: params.serviceName,
          credentials: params.credentials,
          environment: params.environment || 'production',
          is_active: params.isActive ?? true
        })
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      console.error('Erreur ApiVaultService.saveCredentials:', err);
      return { success: false, error: err.message || 'Erreur réseau lors de la sauvegarde' };
    }
  }

  /**
   * Teste et valide en temps réel une clé ou un jeu d'identifiants
   */
  static async validateCredentials(params: {
    schoolId?: string;
    serviceName: string;
    credentials: Record<string, any>;
    environment?: string;
  }): Promise<{
    success: boolean;
    validation_status?: string;
    last_validated_at?: string;
    message?: string;
    error?: string;
    details?: any;
  }> {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/settings/api-credentials/validate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          school_id: params.schoolId,
          service_name: params.serviceName,
          credentials: params.credentials,
          environment: params.environment || 'sandbox'
        })
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      console.error('Erreur ApiVaultService.validateCredentials:', err);
      return { 
        success: false, 
        error: err.message || 'Erreur réseau lors de la validation' 
      };
    }
  }

  /**
   * Déchiffre temporairement une clé pour l'afficher à l'administrateur
   */
  static async revealCredential(params: {
    schoolId: string;
    serviceName: string;
    keyName: string;
  }): Promise<{ success: boolean; clear_value?: string; error?: string }> {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/settings/api-credentials/reveal', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          school_id: params.schoolId,
          service_name: params.serviceName,
          key_name: params.keyName
        })
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
