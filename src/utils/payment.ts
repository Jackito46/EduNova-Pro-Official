import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Comparaison sécurisée en temps constant (Timing-Safe) universelle
 * fonctionnant sans dépendance exclusive à Node.js (compatible navigateur + Node).
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Interface représentant le corps de la notification asynchrone / webhook MonCash (Digicel)
 */
export interface MonCashWebhookPayload {
  /** Identifiant unique de transaction attribué par Digicel MonCash (ex: "123456789") */
  transaction_id?: string | number;
  /** Identifiant de commande ou référence unique fournie lors de l'initiation du paiement */
  order_id?: string;
  /** Référence alternative parfois envoyée par le système MonCash */
  reference?: string;
  /** Montant payé en Gourdes Haïtiennes (HTG) */
  amount?: number | string;
  /** Numéro de téléphone MonCash du payeur (format national 509... ou 8 chiffres) */
  phone?: string;
  payer?: string;
  msisdn?: string;
  /** Statut de la transaction selon MonCash (200, "successful", "completed", etc.) */
  status?: string | number;
  status_code?: string | number;
  message?: string;
  /** Horodatage de l'événement */
  timestamp?: string | number;
  date?: string;
  /** Jeton de sécurité optionnel passé dans le corps de la notification */
  token?: string;
  security_token?: string;
  [key: string]: any;
}

/**
 * Options de configuration et sécurité pour traiter le webhook MonCash
 */
export interface MonCashWebhookOptions {
  /** En-têtes HTTP de la requête webhook (ex: req.headers dans Express) */
  headers?: Record<string, string | string[] | undefined>;
  /** Jeton de sécurité secret attendu (clé secrète configurée dans l'école ou variable d'env) */
  expectedSecurityToken?: string;
  /** Clé secrète / business key MonCash pour vérification HMAC ou token direct */
  businessKey?: string;
  /** Client Supabase (optionnel) pour persister / mettre à jour directement le paiement */
  supabaseClient?: SupabaseClient;
  /** Si true et si credentials fournis, interroge l'API officielle Digicel pour confirmer à 100% */
  verifyWithMonCashApi?: boolean;
  /** Paramètres de connexion MonCash nécessaires si verifyWithMonCashApi est true */
  moncashConfig?: {
    client_id: string;
    client_secret: string;
    business_key?: string;
    mode?: 'sandbox' | 'live';
  };
  /** ID de l'école (tenant) associée pour l'audit et l'isolement multi-tenant */
  schoolId?: string;
}

/**
 * Résultat standardisé du traitement de la notification webhook MonCash
 */
export interface MonCashWebhookResult {
  /** Indique si le traitement global a réussi et le paiement est confirmé */
  success: boolean;
  /** Indique si le jeton de sécurité et l'authenticité de la requête ont été validés */
  verified: boolean;
  /** Statut canonique de la transaction */
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'INVALID_TOKEN' | 'DUPLICATE' | 'INVALID_PAYLOAD' | 'ERROR';
  /** Code HTTP recommandé pour la réponse au webhook (ex: 200, 400, 401, 409, 500) */
  httpStatusCode: number;
  /** Numéro de transaction MonCash officiel */
  transactionId?: string;
  /** Identifiant de commande ou référence interne associée */
  orderId?: string;
  /** Montant validé en Gourdes (HTG) */
  amount?: number;
  /** Devise canonique (MonCash opère exclusivement en HTG) */
  currency: 'HTG';
  /** Numéro du payeur si disponible */
  payerPhone?: string;
  /** Enregistrement du paiement inséré ou mis à jour en base de données */
  paymentRecord?: any;
  /** Message explicatif détaillé du traitement */
  message: string;
  /** Détail de l'erreur en cas d'échec */
  error?: string;
  /** Horodatage ISO du traitement */
  processedAt: string;
}

/**
 * Valide de manière sécurisée (Timing-Safe) un jeton de sécurité MonCash
 * contre le jeton secret attendu pour prévenir les attaques temporelles (Timing Attacks).
 */
export function validateMonCashSecurityToken(
  providedToken: string | undefined | null,
  expectedToken: string | undefined | null
): boolean {
  if (!providedToken || !expectedToken) {
    return false;
  }

  const cleanProvided = String(providedToken).trim();
  const cleanExpected = String(expectedToken).trim();

  if (!cleanProvided || !cleanExpected) {
    return false;
  }

  return timingSafeEqualString(cleanProvided, cleanExpected);
}

/**
 * Extrait le jeton de sécurité MonCash depuis les en-têtes ou le payload
 */
export function extractMonCashToken(
  headers?: Record<string, string | string[] | undefined>,
  payload?: MonCashWebhookPayload
): string | undefined {
  if (headers) {
    // 1. Header Authorization: Bearer <token>
    const authHeader = headers['authorization'] || headers['Authorization'];
    if (typeof authHeader === 'string') {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // 2. Headers personnalisés spécifiques à MonCash
    const customHeaders = [
      'x-moncash-token',
      'x-moncash-signature',
      'x-security-token',
      'x-webhook-token',
      'moncash-token'
    ];

    for (const headerName of customHeaders) {
      const val = headers[headerName];
      if (typeof val === 'string' && val.trim()) {
        return val.trim();
      }
    }
  }

  // 3. Jeton dans le corps de la requête (fallback si transmis en POST JSON/Form)
  if (payload) {
    if (payload.security_token && typeof payload.security_token === 'string') {
      return payload.security_token.trim();
    }
    if (payload.token && typeof payload.token === 'string') {
      return payload.token.trim();
    }
  }

  return undefined;
}

/**
 * Interroge directement l'API officielle Digicel MonCash pour valider l'état
 * d'une transaction de manière infalsifiable (Double validation bancaire).
 */
export async function verifyMonCashTransactionWithApi(params: {
  transactionId?: string;
  orderId?: string;
  clientId: string;
  clientSecret: string;
  mode?: 'sandbox' | 'live';
}): Promise<{
  verified: boolean;
  moncashStatus?: string;
  amount?: number;
  message: string;
  rawResponse?: any;
}> {
  const { transactionId, orderId, clientId, clientSecret, mode = 'live' } = params;

  if (!transactionId && !orderId) {
    return {
      verified: false,
      message: 'Un transactionId ou un orderId est obligatoire pour interroger l’API MonCash.'
    };
  }

  const baseUrl = mode === 'live'
    ? 'https://moncashbutton.digicelgroup.com'
    : 'https://sandbox.moncashbutton.digicelgroup.com';

  try {
    // 1. Obtenir un token d'accès OAuth auprès de MonCash
    const basicAuth = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64');
    const tokenResponse = await fetch(`${baseUrl}/Api/oauth/token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        scope: 'read,write',
        grant_type: 'client_credentials'
      }).toString()
    });

    if (!tokenResponse.ok) {
      return {
        verified: false,
        message: `Échec d'authentification auprès de l'API MonCash (HTTP ${tokenResponse.status}).`
      };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return {
        verified: false,
        message: 'Jeton d’accès introuvable dans la réponse OAuth MonCash.'
      };
    }

    // 2. Interroger la transaction soit par TransactionId soit par OrderId
    let queryUrl = '';
    let queryBody = '';

    if (transactionId) {
      queryUrl = `${baseUrl}/Api/v1/RetrieveTransactionPayment`;
      queryBody = JSON.stringify({ transactionId: String(transactionId) });
    } else {
      queryUrl = `${baseUrl}/Api/v1/RetrieveOrderPayment`;
      queryBody = JSON.stringify({ orderId: String(orderId) });
    }

    const verifyResponse = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: queryBody
    });

    if (!verifyResponse.ok) {
      return {
        verified: false,
        message: `L'API MonCash a rejeté la recherche de transaction (HTTP ${verifyResponse.status}).`
      };
    }

    const verifyData = await verifyResponse.json();
    const payment = verifyData.payment || verifyData;
    const paymentStatus = payment.status || payment.message || '';
    const isSuccessful =
      String(paymentStatus).toLowerCase().includes('success') ||
      verifyResponse.status === 200;

    return {
      verified: isSuccessful,
      moncashStatus: paymentStatus,
      amount: payment.amount ? Number(payment.amount) : undefined,
      message: isSuccessful
        ? 'Transaction confirmée avec succès auprès de l’API officielle Digicel MonCash.'
        : `Statut non approuvé retourné par MonCash: ${paymentStatus}`,
      rawResponse: verifyData
    };
  } catch (error: any) {
    return {
      verified: false,
      message: `Erreur de communication avec l'API MonCash: ${error?.message || 'Erreur inconnue'}`
    };
  }
}

/**
 * Fonction utilitaire principale pour traiter les notifications de paiement asynchrones
 * en provenance de l'API MonCash (Webhooks / IPN / Callbacks).
 *
 * Elle prend en charge :
 * 1. La validation sécurisée du jeton d'authentification (timing-safe).
 * 2. L'extraction et la normalisation des champs (transaction_id, order_id, montant, téléphone).
 * 3. La vérification de non-duplication (idempotence) pour empêcher la double comptabilisation.
 * 4. La double-vérification directe optionnelle auprès de l'API Digicel MonCash.
 * 5. La mise à jour ou l'enregistrement sécurisé du paiement dans Supabase.
 *
 * @param payload Les données brutes reçues du webhook MonCash
 * @param options Options de validation (headers, expectedToken, supabaseClient, etc.)
 * @returns Résultat standardisé MonCashWebhookResult avec code HTTP recommandé
 */
export async function handleMonCashWebhook(
  payload: MonCashWebhookPayload,
  options: MonCashWebhookOptions = {}
): Promise<MonCashWebhookResult> {
  const processedAt = new Date().toISOString();

  // 1. Validation de l'intégrité minimale du payload
  if (!payload || typeof payload !== 'object') {
    return {
      success: false,
      verified: false,
      status: 'INVALID_PAYLOAD',
      httpStatusCode: 400,
      currency: 'HTG',
      message: 'Payload de webhook MonCash invalide ou absent.',
      processedAt
    };
  }

  // 2. Extraction du jeton de sécurité
  const providedToken = extractMonCashToken(options.headers, payload);

  // Déterminer le jeton de sécurité attendu (priorité : option explicite > businessKey > env var)
  const expectedToken =
    options.expectedSecurityToken ||
    options.businessKey ||
    options.moncashConfig?.business_key ||
    process.env.MONCASH_WEBHOOK_SECRET ||
    process.env.MONCASH_SECURITY_TOKEN ||
    process.env.MONCASH_BUSINESS_KEY;

  // 3. Validation du jeton de sécurité (CRITIQUE)
  let isTokenVerified = false;

  if (expectedToken) {
    isTokenVerified = validateMonCashSecurityToken(providedToken, expectedToken);
    if (!isTokenVerified) {
      console.warn('[MonCash Webhook] Échec de validation du jeton de sécurité.');
      return {
        success: false,
        verified: false,
        status: 'INVALID_TOKEN',
        httpStatusCode: 401,
        currency: 'HTG',
        message: 'Jeton de sécurité MonCash invalide, manquant ou falsifié.',
        error: 'AUTH_FAILED',
        processedAt
      };
    }
  } else {
    // Si aucun jeton n'est configuré dans le système, avertir dans les logs
    console.warn(
      '[MonCash Webhook] Attention: Aucun jeton de sécurité attendu configuré. ' +
      'Veuillez définir MONCASH_WEBHOOK_SECRET ou passer expectedSecurityToken pour sécuriser vos webhooks.'
    );
    isTokenVerified = true;
  }

  // 4. Extraction et normalisation des attributs de transaction
  const rawTxId = payload.transaction_id || payload.reference || payload.transactionId;
  const transactionId = rawTxId !== undefined && rawTxId !== null ? String(rawTxId).trim() : undefined;

  const rawOrderId = payload.order_id || payload.orderId || payload.reference;
  const orderId = rawOrderId !== undefined && rawOrderId !== null ? String(rawOrderId).trim() : undefined;

  const rawAmount = payload.amount;
  const amount = rawAmount !== undefined && rawAmount !== null ? Number(rawAmount) : undefined;

  const payerPhone = payload.phone || payload.payer || payload.msisdn ? String(payload.phone || payload.payer || payload.msisdn).trim() : undefined;

  // Validation des champs indispensables
  if (!transactionId && !orderId) {
    return {
      success: false,
      verified: isTokenVerified,
      status: 'INVALID_PAYLOAD',
      httpStatusCode: 422,
      currency: 'HTG',
      message: 'Le webhook MonCash doit obligatoirement contenir un transaction_id ou un order_id.',
      processedAt
    };
  }

  // 5. Interprétation du statut MonCash
  const rawStatus = String(payload.status || payload.status_code || '').toLowerCase();
  const isSuccessfulPayload =
    rawStatus === '200' ||
    rawStatus === 'success' ||
    rawStatus === 'successful' ||
    rawStatus === 'completed' ||
    rawStatus === 'ok' ||
    // Si status est absent mais qu'un transaction_id valide et un montant sont fournis
    (!rawStatus && !!transactionId && typeof amount === 'number' && amount > 0);

  if (!isSuccessfulPayload) {
    return {
      success: false,
      verified: isTokenVerified,
      status: 'FAILED',
      httpStatusCode: 200, // On acquitte 200 à MonCash pour éviter qu'il rejoue indéfiniment un échec utilisateur
      transactionId,
      orderId,
      amount,
      currency: 'HTG',
      payerPhone,
      message: `La transaction MonCash n'a pas abouti (statut reçu: ${rawStatus || 'inconnu'}).`,
      processedAt
    };
  }

  // 6. Vérification directe optionnelle auprès de l'API Digicel MonCash
  const effectiveClientId = options.moncashConfig?.client_id || process.env.MONCASH_CLIENT_ID;
  const effectiveClientSecret = options.moncashConfig?.client_secret || process.env.MONCASH_CLIENT_SECRET;
  const effectiveMode = options.moncashConfig?.mode || (process.env.MONCASH_MODE === 'live' ? 'live' : 'sandbox');

  if (options.verifyWithMonCashApi && effectiveClientId && effectiveClientSecret) {
    const apiVerification = await verifyMonCashTransactionWithApi({
      transactionId,
      orderId,
      clientId: effectiveClientId,
      clientSecret: effectiveClientSecret,
      mode: effectiveMode
    });

    if (!apiVerification.verified) {
      return {
        success: false,
        verified: false,
        status: 'FAILED',
        httpStatusCode: 400,
        transactionId,
        orderId,
        amount,
        currency: 'HTG',
        payerPhone,
        message: `Rejet suite à la vérification API Digicel MonCash : ${apiVerification.message}`,
        error: 'API_VERIFICATION_FAILED',
        processedAt
      };
    }
  }

  // 7. Traitement en base de données avec Supabase (si fourni)
  let paymentRecord: any = null;
  const supabase = options.supabaseClient;

  if (supabase) {
    try {
      // A. Contrôle d'unicité / Idempotence (empêcher le double traitement du même transaction_id)
      if (transactionId) {
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id, amount, status, transaction_reference, order_id, created_at')
          .or(`transaction_reference.eq.${transactionId},notes.ilike.%${transactionId}%`)
          .limit(1)
          .maybeSingle();

        if (existingPayment && existingPayment.status === 'VALIDE') {
          return {
            success: true,
            verified: isTokenVerified,
            status: 'DUPLICATE',
            httpStatusCode: 200, // Idempotence : acquitter 200 sans recréditer
            transactionId,
            orderId: existingPayment.order_id || orderId,
            amount: existingPayment.amount || amount,
            currency: 'HTG',
            payerPhone,
            paymentRecord: existingPayment,
            message: `Paiement MonCash déjà traité et validé précédemment (Réf: ${transactionId}).`,
            processedAt
          };
        }
      }

      // B. Mise à jour d'un paiement en attente lié à order_id
      if (orderId) {
        // Tentative de recherche par order_id ou transaction_reference
        const { data: pendingPayment } = await supabase
          .from('payments')
          .select('*')
          .or(`id.eq.${orderId},notes.ilike.%${orderId}%,transaction_reference.eq.${orderId}`)
          .limit(1)
          .maybeSingle();

        if (pendingPayment) {
          const updatePayload: Record<string, any> = {
            status: 'VALIDE',
            payment_method: 'MonCash',
            transaction_reference: transactionId || orderId,
            updated_at: new Date().toISOString()
          };

          if (amount && (!pendingPayment.amount || pendingPayment.amount === 0)) {
            updatePayload.amount = amount;
            updatePayload.amount_htg_equivalent = amount;
          }

          if (payerPhone) {
            updatePayload.notes = `${pendingPayment.notes || ''} | Payeur MonCash: ${payerPhone}`.trim();
          }

          const { data: updated, error: updateErr } = await supabase
            .from('payments')
            .update(updatePayload)
            .eq('id', pendingPayment.id)
            .select()
            .single();

          if (!updateErr && updated) {
            paymentRecord = updated;
          }
        }
      }

      // C. Création d'une entrée de paiement confirmée si aucune ligne préalable n'a été trouvée
      if (!paymentRecord && options.schoolId && amount && amount > 0) {
        const newPaymentPayload = {
          school_id: options.schoolId,
          amount,
          amount_htg_equivalent: amount,
          currency: 'HTG',
          payment_method: 'MonCash',
          status: 'VALIDE',
          transaction_reference: transactionId || orderId,
          notes: `Paiement automatique via MonCash Webhook (Réf: ${transactionId || orderId}${payerPhone ? `, Tél: ${payerPhone}` : ''})`,
          payment_date: new Date().toISOString().split('T')[0]
        };

        const { data: inserted, error: insertErr } = await supabase
          .from('payments')
          .insert([newPaymentPayload])
          .select()
          .maybeSingle();

        if (!insertErr && inserted) {
          paymentRecord = inserted;
        }
      }

      // D. Si le paiement concerne une recharge de portefeuille (CREDIT_PORTEFEUILLE ou WLT-)
      if (paymentRecord && paymentRecord.student_id && (
        paymentRecord.fee_type === 'CREDIT_PORTEFEUILLE' || 
        paymentRecord.fee_type === 'PORTEFEUILLE' || 
        (paymentRecord.notes && (paymentRecord.notes.includes('Portefeuille') || paymentRecord.notes.includes('WLT-')))
      )) {
        try {
          const creditAmount = Number(paymentRecord.amount || amount || 0);
          if (creditAmount > 0) {
            const { data: std } = await supabase
              .from('students')
              .select('id, wallet_balance_htg')
              .eq('id', paymentRecord.student_id)
              .maybeSingle();

            if (std) {
              const currentBalance = Number(std.wallet_balance_htg || 0);
              const newBalance = currentBalance + creditAmount;
              await supabase
                .from('students')
                .update({
                  wallet_balance_htg: newBalance,
                  updated_at: new Date().toISOString()
                })
                .eq('id', std.id);
              console.log(`[MonCash Webhook] Portefeuille élève ${std.id} crédité de +${creditAmount} HTG. Nouveau solde: ${newBalance} HTG`);
            }
          }
        } catch (walletErr) {
          console.warn('[MonCash Webhook] Erreur lors du crédit automatique du portefeuille:', walletErr);
        }
      }
    } catch (dbError: any) {
      console.error('[MonCash Webhook] Erreur lors de la persistance en base:', dbError);
      // On continue pour retourner la confirmation du webhook même si l'enregistrement a rencontré un écueil
    }
  }

  return {
    success: true,
    verified: isTokenVerified,
    status: 'COMPLETED',
    httpStatusCode: 200,
    transactionId,
    orderId,
    amount,
    currency: 'HTG',
    payerPhone,
    paymentRecord,
    message: `Paiement MonCash validé avec succès (Transaction: ${transactionId || orderId}, Montant: ${amount ?? 'N/A'} HTG).`,
    processedAt
  };
}

/**
 * Paramètres pour interroger l'état d'un paiement MonCash
 */
export interface CheckMonCashStatusParams {
  /** ID du paiement dans la table Supabase `payments` */
  paymentId?: string;
  /** Identifiant unique de commande MonCash (ex: "TC-172579...") */
  orderId?: string;
  /** Numéro de transaction officiel ou référence interne */
  transactionReference?: string;
  /** Client Supabase optionnel pour vérifier directement en base de données */
  supabaseClient?: SupabaseClient;
  /** ID de l'école (tenant) pour isolation multi-tenant */
  schoolId?: string;
}

/**
 * Résultat de la vérification de statut d'un paiement MonCash
 */
export interface CheckMonCashStatusResult {
  /** Indique si le paiement est définitivement confirmé et validé */
  isConfirmed: boolean;
  /** Indique si la transaction a échoué, expiré ou a été rejetée */
  isFailed: boolean;
  /** Indique si la transaction est toujours en cours d'attente de confirmation par le parent */
  isPending: boolean;
  /** Statut canonique normalisé */
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'NOT_FOUND';
  /** Numéro de transaction Digicel MonCash ou référence */
  transactionId?: string;
  /** Identifiant de commande */
  orderId?: string;
  /** Montant en HTG */
  amount?: number;
  /** Téléphone du payeur si renseigné */
  payerPhone?: string;
  /** Ligne de paiement complète récupérée en base */
  paymentRecord?: any;
  /** Message d'état pour affichage UI */
  message: string;
  /** Horodatage ISO de la vérification */
  checkedAt: string;
}

/**
 * Fonction utilitaire dédiée au polling du statut de paiement MonCash.
 * Appelée de manière récurrente (ex: toutes les 5 secondes) par l'UI
 * pour détecter l'arrivée du webhook ou la confirmation de la transaction.
 */
export async function checkMonCashPaymentStatus(
  params: CheckMonCashStatusParams
): Promise<CheckMonCashStatusResult> {
  const checkedAt = new Date().toISOString();
  const { paymentId, orderId, transactionReference, supabaseClient } = params;

  if (!paymentId && !orderId && !transactionReference) {
    return {
      isConfirmed: false,
      isFailed: true,
      isPending: false,
      status: 'FAILED',
      message: 'Identifiant de transaction MonCash non spécifié pour la vérification.',
      checkedAt
    };
  }

  // Si un client Supabase est fourni, interroge la base de données en temps réel
  if (supabaseClient) {
    try {
      let query = supabaseClient.from('payments').select('*');

      if (paymentId) {
        query = query.eq('id', paymentId);
      } else if (orderId) {
        query = query.or(`moncash_order_id.eq.${orderId},notes.ilike.%${orderId}%,transaction_reference.eq.${orderId}`);
      } else if (transactionReference) {
        query = query.eq('transaction_reference', transactionReference);
      }

      if (params.schoolId) {
        query = query.eq('school_id', params.schoolId);
      }

      const { data, error } = await query.limit(1).maybeSingle();

      if (error) {
        console.warn('[MonCash Polling] Erreur requête statut:', error.message);
      }

      if (data) {
        const rawStatus = String(data.status || '').toUpperCase();
        const moncashStatus = String(data.moncash_status || '').toUpperCase();

        const isSuccess =
          rawStatus === 'VALIDE' ||
          rawStatus === 'CONFIRMED' ||
          moncashStatus === 'COMPLETED' ||
          moncashStatus === 'SUCCESSFUL';

        const isFailure =
          rawStatus === 'ANNULE' ||
          rawStatus === 'REJETE' ||
          rawStatus === 'ECHEC' ||
          moncashStatus === 'FAILED' ||
          moncashStatus === 'EXPIRED';

        if (isSuccess) {
          return {
            isConfirmed: true,
            isFailed: false,
            isPending: false,
            status: 'COMPLETED',
            transactionId: data.transaction_reference || data.reference_number || undefined,
            orderId: data.moncash_order_id || orderId,
            amount: data.amount,
            paymentRecord: data,
            message: 'Paiement MonCash validé et confirmé avec succès.',
            checkedAt
          };
        }

        if (isFailure) {
          return {
            isConfirmed: false,
            isFailed: true,
            isPending: false,
            status: 'FAILED',
            transactionId: data.transaction_reference || data.reference_number || undefined,
            orderId: data.moncash_order_id || orderId,
            amount: data.amount,
            paymentRecord: data,
            message: 'La transaction MonCash a échoué ou a été annulée.',
            checkedAt
          };
        }

        // Toujours en attente (EN_ATTENTE / PENDING)
        return {
          isConfirmed: false,
          isFailed: false,
          isPending: true,
          status: 'PENDING',
          transactionId: data.transaction_reference || data.reference_number || undefined,
          orderId: data.moncash_order_id || orderId,
          amount: data.amount,
          paymentRecord: data,
          message: 'En attente de confirmation par le parent sur son téléphone...',
          checkedAt
        };
      }
    } catch (dbErr: any) {
      console.error('[MonCash Polling] Erreur base de données:', dbErr);
    }
  }

  // Fallback si non trouvé immédiatement
  return {
    isConfirmed: false,
    isFailed: false,
    isPending: true,
    status: 'PENDING',
    orderId,
    transactionId: transactionReference,
    message: 'En attente de transmission de la confirmation MonCash...',
    checkedAt
  };
}

/**
 * Permet au guichetier de valider manuellement un paiement MonCash
 * après vérification du SMS officiel Digicel présenté par le parent.
 */
export async function confirmMonCashPaymentManually(params: {
  paymentId?: string;
  orderId?: string;
  transactionReference: string;
  supabaseClient: SupabaseClient;
  confirmedBy?: string;
}): Promise<{ success: boolean; error?: string; paymentRecord?: any }> {
  const { paymentId, orderId, transactionReference, supabaseClient, confirmedBy } = params;

  try {
    let query = supabaseClient.from('payments').select('id, notes');
    if (paymentId) {
      query = query.eq('id', paymentId);
    } else if (orderId) {
      query = query.or(`moncash_order_id.eq.${orderId},transaction_reference.eq.${orderId}`);
    }

    const { data: record, error: findError } = await query.limit(1).maybeSingle();

    if (findError || !record) {
      return {
        success: false,
        error: 'Paiement introuvable pour validation manuelle.'
      };
    }

    const updatedNotes = `${record.notes || ''} | Validé manuellement au guichet (Réf SMS: ${transactionReference}${confirmedBy ? `, par: ${confirmedBy}` : ''})`.trim();

    const { data: updated, error: updateError } = await supabaseClient
      .from('payments')
      .update({
        status: 'VALIDE',
        moncash_status: 'COMPLETED',
        transaction_reference: transactionReference,
        reference_number: transactionReference,
        notes: updatedNotes,
        updated_at: new Date().toISOString()
      })
      .eq('id', record.id)
      .select()
      .single();

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true, paymentRecord: updated };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erreur inconnue' };
  }
}

export default handleMonCashWebhook;
