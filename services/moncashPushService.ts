/**
 * Service d'envoi automatique de notifications Push pour les paiements MonCash
 * Déclenché dès qu'un paiement est validé par le webhook MonCash ou vérifié en temps réel
 */

export interface MonCashPushPayload {
  schoolId: string;
  studentId?: string;
  paymentId?: string;
  orderId?: string;
  transactionId?: string;
  amount: number;
  currency?: string;
  payerPhone?: string;
  senderUserId?: string;
  targetUserId?: string; // Utilisé pour les tests ciblés
}

export interface MonCashPushResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  message: string;
  recipientsFound: number;
  logId?: string;
  studentName?: string;
}

/**
 * Envoie une notification Push automatique aux parents d'un élève après validation MonCash
 */
export async function sendMonCashPaymentPushNotification(
  params: MonCashPushPayload,
  deps: {
    supabaseClient: any;
    webpushClient: any;
  }
): Promise<MonCashPushResult> {
  const { supabaseClient: supabase, webpushClient: webpush } = deps;
  const {
    schoolId,
    studentId,
    paymentId,
    orderId,
    transactionId,
    amount,
    currency = 'HTG',
    targetUserId
  } = params;

  if (!supabase) {
    return {
      success: false,
      sentCount: 0,
      failedCount: 0,
      recipientsFound: 0,
      message: 'Client Supabase non initialisé pour la notification Push'
    };
  }

  try {
    let resolvedStudentId = studentId;
    let resolvedSchoolId = schoolId;
    let resolvedAmount = amount;
    let resolvedPayment: any = null;

    // 1. Si studentId ou schoolId manque, charger le paiement correspondant
    if ((!resolvedStudentId || !resolvedSchoolId) && (paymentId || orderId || transactionId)) {
      let query = supabase.from('payments').select('*');
      if (paymentId) {
        query = query.eq('id', paymentId);
      } else if (orderId) {
        query = query.or(`moncash_order_id.eq.${orderId},transaction_reference.eq.${orderId},id.eq.${orderId}`);
      } else if (transactionId) {
        query = query.or(`transaction_reference.eq.${transactionId},moncash_order_id.eq.${transactionId}`);
      }

      const { data: pData } = await query.limit(1).maybeSingle();
      if (pData) {
        resolvedPayment = pData;
        resolvedStudentId = pData.student_id;
        resolvedSchoolId = pData.school_id || resolvedSchoolId;
        resolvedAmount = pData.amount || resolvedAmount;
      }
    }

    // 2. Récupérer les informations de l'élève et de ses parents
    let studentData: any = null;
    if (resolvedStudentId) {
      const { data: sData } = await supabase
        .from('students')
        .select(`
          id,
          first_name,
          last_name,
          parent_name,
          parent_email,
          parent_phone,
          class_id,
          school_id,
          classes:classes(name),
          schools:schools(name)
        `)
        .eq('id', resolvedStudentId)
        .maybeSingle();

      if (sData) {
        studentData = sData;
        resolvedSchoolId = sData.school_id || resolvedSchoolId;
      }
    }

    const studentFullName = studentData
      ? `${studentData.first_name || ''} ${studentData.last_name || ''}`.trim()
      : 'Votre enfant';
    const className = studentData?.classes?.name || '';
    const schoolName = studentData?.schools?.name || 'EduNova';
    const parentName = studentData?.parent_name || 'Parent d\'élève';
    const refNumber = transactionId || orderId || resolvedPayment?.transaction_reference || resolvedPayment?.moncash_order_id || 'N/A';
    const formattedAmount = `${Number(resolvedAmount || 0).toLocaleString('fr-FR')} ${currency}`;

    // 3. Recherche des abonnements Push ciblés
    const subscriptionsToNotify: Array<{
      endpoint: string;
      p256dh: string;
      auth: string;
      user_id?: string;
      role?: string;
      recipientName?: string;
      recipientContact?: string;
    }> = [];

    const addedEndpoints = new Set<string>();

    const addSubscription = (sub: any, name?: string, contact?: string) => {
      if (sub && sub.endpoint && !addedEndpoints.has(sub.endpoint)) {
        addedEndpoints.add(sub.endpoint);
        subscriptionsToNotify.push({
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          user_id: sub.user_id,
          role: sub.role,
          recipientName: name || parentName,
          recipientContact: contact || sub.user_id || 'Abonné Push'
        });
      }
    };

    // A. Cas cible spécifique (mode test/simulation)
    if (targetUserId) {
      const { data: targetSubs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', targetUserId);

      if (targetSubs && targetSubs.length > 0) {
        targetSubs.forEach((sub: any) => addSubscription(sub, 'Compte Connecté (Test)', targetUserId));
      }
    }

    // B. Cas Parent identifié par email de l'élève
    if (studentData?.parent_email && studentData.parent_email.trim()) {
      const parentEmailClean = studentData.parent_email.trim().toLowerCase();
      const { data: parentProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .ilike('email', parentEmailClean);

      if (parentProfiles && parentProfiles.length > 0) {
        const parentUserIds = parentProfiles.map((p: any) => p.id);
        const { data: parentSubs } = await supabase
          .from('push_subscriptions')
          .select('*')
          .in('user_id', parentUserIds);

        if (parentSubs && parentSubs.length > 0) {
          parentSubs.forEach((sub: any) => {
            const matchedProfile = parentProfiles.find((p: any) => p.id === sub.user_id);
            addSubscription(sub, matchedProfile?.full_name || parentName, matchedProfile?.email);
          });
        }
      }
    }

    // C. Si aucun abonnement direct par email, chercher via la fonction RPC pour le rôle PARENT
    if (subscriptionsToNotify.length === 0 && resolvedSchoolId) {
      const { data: roleSubs } = await supabase.rpc('admin_get_push_subscriptions', {
        p_school_id: resolvedSchoolId,
        p_roles: ['PARENT'],
        p_class_id: studentData?.class_id || null
      });

      if (roleSubs && roleSubs.length > 0) {
        roleSubs.forEach((sub: any) => addSubscription(sub, parentName, 'Parent Classe'));
      }
    }

    // D. Si toujours aucun abonnement, chercher si l'élève lui-même a souscrit (ou si le parent utilise le compte de l'élève)
    if (subscriptionsToNotify.length === 0 && resolvedStudentId) {
      const { data: studentSubs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', resolvedStudentId);

      if (studentSubs && studentSubs.length > 0) {
        studentSubs.forEach((sub: any) => addSubscription(sub, studentFullName, 'Compte Élève'));
      }
    }

    // 4. Préparation du contenu de la notification Push
    const notificationTitle = `Paiement MonCash validé ! 📲`;
    const notificationBody = `Le paiement MonCash de ${formattedAmount} pour ${studentFullName}${className ? ` (${className})` : ''} a été validé avec succès. Réf: ${refNumber}.`;

    const pushPayload = JSON.stringify({
      title: notificationTitle,
      options: {
        body: notificationBody,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: `moncash-validation-${refNumber}`,
        renotify: true,
        vibrate: [200, 100, 200, 100, 300],
        data: {
          url: '/finance',
          type: 'moncash_webhook_validated',
          schoolName,
          orderId: orderId || null,
          transactionId: transactionId || null,
          referenceNumber: refNumber,
          amount: resolvedAmount,
          currency,
          studentName: studentFullName,
          studentClass: className,
          timestamp: new Date().toISOString()
        }
      }
    });

    let sentCount = 0;
    let failedCount = 0;

    // 5. Envoi effectif via webpush
    if (webpush && subscriptionsToNotify.length > 0) {
      await Promise.all(
        subscriptionsToNotify.map(async (sub) => {
          const pushConfig = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          };

          try {
            await webpush.sendNotification(pushConfig, pushPayload);
            sentCount++;
          } catch (pushErr: any) {
            console.error('[MonCash Push] Erreur lors de l\'envoi push:', pushErr?.statusCode, pushErr?.message);
            failedCount++;

            // Nettoyage automatique des abonnements morts (404 / 410)
            if ([400, 401, 403, 404, 410].includes(pushErr?.statusCode)) {
              try {
                await supabase.rpc('admin_delete_push_subscription', { p_endpoint: sub.endpoint });
              } catch (delErr) {
                console.warn('[MonCash Push] Erreur lors du nettoyage d\'abonnement obsolète:', delErr);
              }
            }
          }
        })
      );
    }

    // 6. Historisation de l'opération dans communication_logs et communication_recipients
    let createdLogId: string | undefined;
    if (resolvedSchoolId) {
      try {
        const { data: logData, error: logErr } = await supabase
          .from('communication_logs')
          .insert({
            school_id: resolvedSchoolId,
            sender_id: params.senderUserId || '00000000-0000-0000-0000-000000000000',
            type: 'push',
            recipient_type: 'parents',
            recipient_count: subscriptionsToNotify.length,
            subject: `Paiement MonCash validé - ${studentFullName}`,
            content: notificationBody,
            status: sentCount > 0 ? 'sent' : subscriptionsToNotify.length === 0 ? 'pending' : 'failed'
          })
          .select('id')
          .maybeSingle();

        if (!logErr && logData) {
          createdLogId = logData.id;

          // Ajouter les destinataires individuels
          if (subscriptionsToNotify.length > 0) {
            const recipientRecords = subscriptionsToNotify.map((s) => ({
              log_id: createdLogId,
              recipient_id: resolvedStudentId || null,
              recipient_name: s.recipientName || parentName,
              recipient_contact: s.recipientContact || 'Appareil Push Parent',
              status: sentCount > 0 ? 'sent' : 'failed'
            }));

            await supabase.from('communication_recipients').insert(recipientRecords);
          }
        }
      } catch (logEx) {
        console.warn('[MonCash Push] Historisation dans communication_logs omise ou indisponible:', logEx);
      }
    }

    // 7. Marquer dans la table payments que le push a été transmis (idempotence)
    if (resolvedPayment?.id) {
      try {
        const existingNotes = resolvedPayment.notes || '';
        const pushTag = `[Push MonCash envoyé le ${new Date().toISOString().split('T')[0]}]`;
        if (!existingNotes.includes('Push MonCash')) {
          await supabase
            .from('payments')
            .update({
              notes: `${existingNotes} | ${pushTag}`.trim()
            })
            .eq('id', resolvedPayment.id);
        }
      } catch (noteErr) {
        console.warn('[MonCash Push] Impossible d\'ajouter le tag de push dans payments.notes:', noteErr);
      }
    }

    return {
      success: sentCount > 0 || subscriptionsToNotify.length === 0,
      sentCount,
      failedCount,
      recipientsFound: subscriptionsToNotify.length,
      logId: createdLogId,
      studentName: studentFullName,
      message: subscriptionsToNotify.length > 0
        ? `${sentCount} notification(s) Push MonCash envoyée(s) avec succès aux parents.`
        : 'Aucun appareil parent abonné trouvé pour cet élève. Notification enregistrée en historique.'
    };
  } catch (error: any) {
    console.error('[MonCash Push] Erreur globale lors du traitement push:', error);
    return {
      success: false,
      sentCount: 0,
      failedCount: 0,
      recipientsFound: 0,
      message: `Erreur push MonCash: ${error?.message || 'Erreur inconnue'}`
    };
  }
}
