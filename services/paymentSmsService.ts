import { supabase } from '../supabase';

export interface PaymentSmsData {
  schoolId: string;
  studentId: string;
  studentName: string;
  studentClass?: string;
  parentName?: string;
  parentPhone: string;
  amount: number;
  currency: string;
  feeTypeLabel: string;
  transactionRef: string;
  schoolName: string;
  remainingAmount?: number;
  paymentMethod?: string;
  customMessage?: string;
  senderId?: string;
}

export interface SmsTemplateOptions {
  type: 'standard' | 'with_balance' | 'compact';
  studentName: string;
  parentName?: string;
  schoolName: string;
  amount: number;
  currency: string;
  feeTypeLabel: string;
  transactionRef: string;
  remainingAmount?: number;
  studentClass?: string;
}

/**
 * Génère le message SMS selon le modèle sélectionné
 */
export function generatePaymentSmsText(options: SmsTemplateOptions): string {
  const {
    type,
    studentName,
    parentName,
    schoolName,
    amount,
    currency,
    feeTypeLabel,
    transactionRef,
    remainingAmount,
    studentClass
  } = options;

  const salutation = parentName && parentName.trim() ? `Cher(e) ${parentName.trim()}` : 'Cher parent';
  const cleanSchool = schoolName && schoolName.trim() ? schoolName.trim() : 'Établissement';
  const formattedAmount = `${Math.round(amount).toLocaleString()} ${currency}`;
  const classInfo = studentClass ? ` (${studentClass})` : '';

  switch (type) {
    case 'compact':
      // Modèle court optimisé pour tenir dans 1 seul SMS standard (< 160 caractères)
      return `${cleanSchool}: Paiement de ${formattedAmount} reçu pour ${studentName}${classInfo} (${feeTypeLabel}). Réf:${transactionRef}. Merci!`;

    case 'with_balance': {
      // Modèle avec solde restant
      const soldeText = typeof remainingAmount === 'number'
        ? remainingAmount <= 0
          ? 'Compte soldé.'
          : `Reste à verser: ${Math.round(remainingAmount).toLocaleString()} ${currency}.`
        : '';
      return `${salutation}, ${cleanSchool} accuse réception de ${formattedAmount} pour ${studentName}${classInfo} au titre de "${feeTypeLabel}". Réf: #${transactionRef}. ${soldeText} Merci de votre confiance.`.trim();
    }

    case 'standard':
    default:
      // Modèle standard valorisant et officiel
      return `${salutation}, ${cleanSchool} confirme la réception du paiement de ${formattedAmount} pour votre enfant ${studentName}${classInfo} (Motif: ${feeTypeLabel}). Reçu N°: #${transactionRef}. Merci de votre confiance !`;
  }
}

/**
 * Vérifie l'état de configuration de la passerelle SMS pour l'école
 */
export async function getSchoolSmsConfig(schoolId: string) {
  try {
    const { data: settings, error } = await supabase
      .from('communication_settings')
      .select('sms_provider, sms_api_key')
      .eq('school_id', schoolId)
      .maybeSingle();

    if (error || !settings) {
      return { isConfigured: false, provider: 'none' };
    }

    const isConfigured = Boolean(
      settings.sms_provider && 
      settings.sms_provider !== 'none' && 
      settings.sms_api_key
    );

    return {
      isConfigured,
      provider: settings.sms_provider || 'none'
    };
  } catch (e) {
    return { isConfigured: false, provider: 'none' };
  }
}

/**
 * Envoie le SMS de confirmation de paiement via l'API SmsModule (/api/send-sms)
 * et historise l'opération dans communication_logs et communication_recipients
 */
export async function sendPaymentConfirmationSms(data: PaymentSmsData): Promise<{
  success: boolean;
  simulated?: boolean;
  message: string;
  logId?: string;
  provider?: string;
}> {
  const {
    schoolId,
    studentId,
    studentName,
    parentName,
    parentPhone,
    amount,
    currency,
    feeTypeLabel,
    transactionRef,
    schoolName,
    remainingAmount,
    studentClass,
    customMessage,
    senderId
  } = data;

  if (!parentPhone || !parentPhone.trim()) {
    throw new Error("Numéro de téléphone du parent manquant.");
  }

  // Nettoyage du numéro
  let cleanPhone = parentPhone.replace(/[^\d+]/g, '');
  if (!cleanPhone) {
    throw new Error("Format de téléphone invalide.");
  }

  // Contenu du SMS
  const content = (customMessage && customMessage.trim()) 
    ? customMessage.trim() 
    : generatePaymentSmsText({
        type: 'standard',
        studentName,
        parentName,
        schoolName,
        amount,
        currency,
        feeTypeLabel,
        transactionRef,
        remainingAmount,
        studentClass
      });

  // Récupérer la configuration SMS
  const { isConfigured, provider } = await getSchoolSmsConfig(schoolId);

  // 1. Enregistrement dans communication_logs pour assurer la traçabilité complète dans SmsModule
  let logId: string | undefined;
  try {
    const currentUserId = senderId || (await supabase.auth.getUser()).data.user?.id;
    if (currentUserId) {
      const { data: logRecord, error: logErr } = await supabase
        .from('communication_logs')
        .insert({
          school_id: schoolId,
          sender_id: currentUserId,
          type: 'sms',
          recipient_type: 'individual',
          recipient_count: 1,
          subject: `Reçu Paiement ${transactionRef}`,
          content: content,
          status: 'sent'
        })
        .select('id')
        .single();

      if (!logErr && logRecord) {
        logId = logRecord.id;

        // Enregistrer le destinataire dans communication_recipients
        await supabase
          .from('communication_recipients')
          .insert({
            log_id: logId,
            recipient_id: studentId,
            recipient_name: parentName || studentName,
            recipient_contact: cleanPhone,
            status: 'sent'
          });
      }
    }
  } catch (logException) {
    console.warn("[PaymentSmsService] Erreur lors de l'enregistrement de l'historique:", logException);
  }

  // 2. Appel du backend /api/send-sms si la passerelle est configurée
  if (isConfigured) {
    try {
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          recipients: [{ id: studentId, contact: cleanPhone }],
          content
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Erreur serveur (${response.status})`);
      }

      return {
        success: true,
        simulated: false,
        message: `SMS transmis avec succès via ${provider.toUpperCase()}`,
        logId,
        provider
      };
    } catch (apiErr: any) {
      console.error("[PaymentSmsService] Erreur API backend SMS:", apiErr);
      throw apiErr;
    }
  }

  // Mode simulation si aucune clé d'API n'est configurée dans Paramètres
  return {
    success: true,
    simulated: true,
    message: "Enregistré dans l'historique (Passerelle SMS en mode test/simulation)",
    logId,
    provider: 'simulation'
  };
}
