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

export class ApiVaultService {
  /**
   * Récupère toutes les clés et statuts de validation pour un établissement
   */
  static async getCredentials(schoolId: string): Promise<ApiVaultResponse> {
    try {
      const res = await fetch(`/api/settings/api-credentials?school_id=${encodeURIComponent(schoolId)}`);
      const data = await res.json();
      return data;
    } catch (err: any) {
      console.error('Erreur ApiVaultService.getCredentials:', err);
      return { success: false, error: err.message || 'Impossible de joindre le serveur' };
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
      const res = await fetch('/api/settings/api-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch('/api/settings/api-credentials/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch('/api/settings/api-credentials/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
