import { supabase, withTimeout } from '../supabase';
import { computeFeeCategoryBalance } from './financeCalculations';
import { isPaymentCompleted, isWalletDeposit } from '../src/utils/payment';

export interface StudentDebtAuditOptions {
  studentId: string;
  schoolId?: string | null;
  excludeYearId?: string | null;
  exchangeRateFallback?: number;
}

export interface SessionArrearsDetail {
  academicYearId: string;
  academicYearLabel: string;
  className: string;
  totalDueHTG: number;
  totalPaidHTG: number;
  remainingDebtHTG: number;
  isReenrollment: boolean;
}

export interface StudentDebtAuditResult {
  totalArrears: number;
  sessions: SessionArrearsDetail[];
  source: 'CLIENT_AUDIT' | 'RPC_FALLBACK';
}

const parseAcademicYearStart = (label?: string | null): number => {
  if (!label) return 0;
  const match = String(label).match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : 0;
};

const isFutureOrPrepYear = (yearObj?: { status?: string | null; is_active?: boolean | null } | null): boolean => {
  if (!yearObj) return false;
  if (yearObj.is_active) return false;
  const st = String(yearObj.status || '').toUpperCase();
  return st === 'FUTURE' || st === 'PLANIFIEE' || st === 'PLANIFIÉE' || st === 'PREPARATION' || st === 'PRÉPARATION';
};

const isAdmissionPayment = (p: any): boolean => {
  const s = `${p.fee_type || ''} ${p.nature || ''} ${p.type || ''} ${p.description || ''}`.toLowerCase();
  return (
    s.includes('inscri') ||
    s.includes('admiss') ||
    s.includes('reinscri') ||
    s.includes('réinscri') ||
    s.includes('entree') ||
    s.includes('entrée')
  );
};

const isMiscPayment = (p: any): boolean => {
  const s = `${p.fee_type || ''} ${p.nature || ''} ${p.type || ''} ${p.description || ''}`.toLowerCase();
  return s.includes('divers') || s.includes('misc');
};

const isSupplyPayment = (p: any): boolean => {
  const ft = String(p.fee_type || '').toUpperCase();
  return ft === 'FOURNITURE' || ft === 'SUPPLIES';
};

const isCampaignPayment = (p: any, campaignsForYear: any[]): boolean => {
  const ft = String(p.fee_type || '').toUpperCase();
  const campRel = Array.isArray(p.campaign) ? p.campaign[0] : p.campaign;
  if (p.ad_hoc_campaign_id || p.campaign_id || campRel?.id) return true;
  if (ft === 'AD_HOC' || ft === 'CAMPAGNE' || ft === 'CAMPAIGN') return true;

  const text = `${p.nature || ''} ${p.label || ''} ${p.type || ''} ${p.description || ''} ${p.notes || ''}`.toLowerCase();
  if (text.includes('campagne') || text.includes('adhoc') || text.includes('ad-hoc')) return true;

  return (campaignsForYear || []).some((fee: any) => {
    const camp = Array.isArray(fee.campaign) ? fee.campaign[0] : fee.campaign;
    const cName = String(fee.name || camp?.name || '').trim().toLowerCase();
    const cType = String(camp?.type || '').trim().toLowerCase();
    if (!cName) return false;
    return (
      text.includes(cName) ||
      (cName.includes('assurance') && text.includes('assurance')) ||
      (cType && cType !== 'autre' && text.includes(cType))
    );
  });
};

const getPaymentHTG = (p: any, fallbackRate: number): number => {
  const htgEq = Number(p.amount_htg_equivalent || 0);
  if (htgEq > 0) return htgEq;
  const isUSD = p.currency === 'USD';
  const rawAmt = Number(p.rawAmount ?? p.amount ?? 0);
  if (isUSD) {
    if (rawAmt > 2000) return rawAmt;
    const pRate = Number(p.exchange_rate_applied || 0) || fallbackRate;
    return Math.round(rawAmt * pRate);
  }
  return rawAmt;
};

/**
 * Audit comptable multi-devises, multi-catégories et multi-tenant des arriérés d'un élève.
 * Élimine les arriérés fantômes causés par :
 * - des colonnes optionnelles absentes sur certains schémas (ex: students.is_foreign)
 * - des doublons d'inscriptions ou d'assignations de campagnes sur une même session
 * - des campagnes ad-hoc mal classées en SQL (ex: ASSURANCE SCOLAIRE)
 * - des remises ad-hoc (`custom_amount`) ou bourses non prises en compte
 * - des variations de taux USD/HTG sur frais déjà acquittés
 * - des paiements sans `academic_year_id` ou avec `fee_type` non standard
 * - la confusion entre Inscription (1ère année) et Réinscription (années suivantes)
 * - l'inclusion d'une session FUTURE / en préparation dans les arriérés
 */
export async function computeCertifiedStudentArrears({
  studentId,
  schoolId,
  excludeYearId,
  exchangeRateFallback = 135
}: StudentDebtAuditOptions): Promise<StudentDebtAuditResult> {
  if (!studentId) {
    return { totalArrears: 0, sessions: [], source: 'CLIENT_AUDIT' };
  }

  const safeFallbackRate =
    Number.isFinite(Number(exchangeRateFallback)) && Number(exchangeRateFallback) > 1
      ? Number(exchangeRateFallback)
      : 135;

  try {
    // Offline fast guard
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { totalArrears: 0, sessions: [], source: 'RPC_FALLBACK' };
    }

    let effectiveSchoolId = schoolId || null;

    // 1. Charger l'élève via select('*') pour compatibilité universelle multi-écoles (évite crash si is_foreign absent)
    let studentQuery = supabase
      .from('students')
      .select('*')
      .eq('id', studentId);

    if (effectiveSchoolId) {
      studentQuery = studentQuery.eq('school_id', effectiveSchoolId);
    }

    const { data: studentData, error: studentErr } = await withTimeout(
      studentQuery.maybeSingle(),
      7000,
      'Délai dépassé lors de la vérification du dossier élève.'
    );

    if (studentErr || !studentData) {
      throw studentErr || new Error('Élève introuvable');
    }

    effectiveSchoolId = effectiveSchoolId || studentData.school_id;

    // 2. Charger en parallèle toutes les données comptables via select('*') pour éviter toute erreur de colonne manquante selon les schémas d'école
    const [yearsRes, enrollmentsPrimaryRes, paymentsPrimaryRes, adHocPrimaryRes, rateRes] = await withTimeout(
      Promise.all([
        supabase
          .from('academic_years')
          .select('*')
          .eq('school_id', effectiveSchoolId),
        supabase
          .from('enrollments')
          .select('*, academic_year:academic_years(*), class:classes(*)')
          .eq('student_id', studentId),
        supabase
          .from('payments')
          .select('*, campaign:ad_hoc_campaigns(id, name)')
          .eq('student_id', studentId),
        supabase
          .from('student_ad_hoc_fees')
          .select('*, campaign:ad_hoc_campaigns!campaign_id(*)')
          .eq('student_id', studentId),
        supabase
          .from('exchange_rates')
          .select('*')
          .eq('school_id', effectiveSchoolId)
          .order('effective_date', { ascending: false })
          .limit(1)
      ]),
      9000,
      'Délai dépassé lors de l\'audit financier du dossier.'
    );

    // Tolérance de repli si une relation imbriquée échoue sur un schéma ancien (évite d'ignorer silencieusement des versements)
    let rawEnrollments = enrollmentsPrimaryRes.data;
    if (enrollmentsPrimaryRes.error) {
      console.warn('studentDebtAudit: enrollments join fallback:', enrollmentsPrimaryRes.error.message);
      const { data, error } = await supabase.from('enrollments').select('*').eq('student_id', studentId);
      if (error) throw error;
      rawEnrollments = data;
    }

    let rawPayments = paymentsPrimaryRes.data;
    if (paymentsPrimaryRes.error) {
      console.warn('studentDebtAudit: payments join fallback:', paymentsPrimaryRes.error.message);
      const { data, error } = await supabase.from('payments').select('*').eq('student_id', studentId);
      if (error) throw error;
      rawPayments = data;
    }

    let rawAdHoc = adHocPrimaryRes.data;
    if (adHocPrimaryRes.error) {
      console.warn('studentDebtAudit: adHoc join fallback:', adHocPrimaryRes.error.message);
      const { data, error } = await supabase.from('student_ad_hoc_fees').select('*').eq('student_id', studentId);
      if (!error) rawAdHoc = data;
      else rawAdHoc = [];
    }

    const allYears = yearsRes.data || [];
    const yearsMap = new Map<string, any>();
    allYears.forEach((y: any) => yearsMap.set(y.id, y));

    const rateRow = rateRes.data?.[0];
    const parsedRate = Number(rateRow?.rate_usd_to_htg ?? rateRow?.rate ?? safeFallbackRate);
    const currentExchangeRate = Number.isFinite(parsedRate) && parsedRate > 1 ? parsedRate : safeFallbackRate;

    const allEnrollmentsRaw = (rawEnrollments || [])
      .filter((e: any) => !e.school_id || !effectiveSchoolId || e.school_id === effectiveSchoolId)
      .filter((e: any) => {
        const st = String(e.status || '').toUpperCase();
        return st !== 'ANNULE' && st !== 'ANNULÉ' && st !== 'CANCELLED';
      })
      .map((e: any) => {
        const ay = Array.isArray(e.academic_year) ? e.academic_year[0] : (e.academic_year || yearsMap.get(e.academic_year_id));
        const cls = Array.isArray(e.class) ? e.class[0] : e.class;
        return { ...e, academic_year: ay, class: cls };
      });

    // Dédoublonner par academic_year_id (conserver la ligne la plus récente/active si doublon en base)
    const enrollmentByYearMap = new Map<string, any>();
    for (const enr of allEnrollmentsRaw) {
      if (!enr.academic_year_id) continue;
      const existing = enrollmentByYearMap.get(enr.academic_year_id);
      if (!existing) {
        enrollmentByYearMap.set(enr.academic_year_id, enr);
      } else {
        const prevTime = new Date(existing.created_at || 0).getTime();
        const currTime = new Date(enr.created_at || 0).getTime();
        if (currTime >= prevTime) {
          enrollmentByYearMap.set(enr.academic_year_id, enr);
        }
      }
    }
    const allEnrollments = Array.from(enrollmentByYearMap.values());

    // Trier toutes les inscriptions chronologiquement (du plus ancien au plus récent)
    const sortedEnrollments = [...allEnrollments].sort((a, b) => {
      const yrA = parseAcademicYearStart(a.academic_year?.label);
      const yrB = parseAcademicYearStart(b.academic_year?.label);
      if (yrA !== yrB && yrA > 0 && yrB > 0) return yrA - yrB;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    const excludedYearObj = excludeYearId ? yearsMap.get(excludeYearId) : null;
    const excludedStartYear = parseAcademicYearStart(excludedYearObj?.label);

    // Filtrer les inscriptions éligibles aux arriérés (PAST ou ACTIVE, jamais FUTURE, jamais excludeYearId)
    const auditableEnrollments = sortedEnrollments.filter((enr) => {
      if (excludeYearId && enr.academic_year_id === excludeYearId) return false;
      if (isFutureOrPrepYear(enr.academic_year)) return false;

      // Si une année cible future est exclue (ex: 2026-2027), aucune session ultérieure ne peut être un arriéré
      const enrStart = parseAcademicYearStart(enr.academic_year?.label);
      if (excludeYearId && excludedStartYear > 0 && enrStart >= excludedStartYear) {
        return false;
      }
      return true;
    });

    // Aucune session antérieure/active auditable => 0 arriéré garanti
    if (auditableEnrollments.length === 0) {
      return { totalArrears: 0, sessions: [], source: 'CLIENT_AUDIT' };
    }

    // Charger les plans tarifaires de toutes les inscriptions auditables en une requête
    const classIds = Array.from(new Set(auditableEnrollments.map(e => e.class_id).filter(Boolean)));
    const yearIds = Array.from(new Set(auditableEnrollments.map(e => e.academic_year_id).filter(Boolean)));

    let allFeePlans: any[] = [];
    if (classIds.length > 0 && yearIds.length > 0) {
      const { data: plansData } = await withTimeout(
        supabase
          .from('fee_plans')
          .select('*')
          .eq('school_id', effectiveSchoolId)
          .in('class_id', classIds),
        7000,
        'Délai dépassé lors du chargement des plans tarifaires.'
      );
      allFeePlans = plansData || [];
    }

    // Filtrer strictement les paiements valides de cet élève (hors annulés, rejetés, en attente, portefeuille, fournitures)
    const validFeePayments: any[] = (rawPayments || []).filter((p: any) => {
      if (p.student_id && p.student_id !== studentId) return false;
      if (p.school_id && effectiveSchoolId && p.school_id !== effectiveSchoolId) return false;
      if (!isPaymentCompleted(p)) return false;
      if (isWalletDeposit(p)) return false;
      if (isSupplyPayment(p)) return false;
      return true;
    });

    // Dédoublonner les assignations de campagnes ad-hoc par campaign_id pour éviter toute double facturation
    const adHocByCampaignMap = new Map<string, any>();
    for (const f of (rawAdHoc || [])) {
      if (f.school_id && effectiveSchoolId && f.school_id !== effectiveSchoolId) continue;
      const camp = Array.isArray(f.campaign) ? f.campaign[0] : f.campaign;
      const dedupKey = String(f.campaign_id || camp?.id || f.id);
      if (!adHocByCampaignMap.has(dedupKey)) {
        adHocByCampaignMap.set(dedupKey, { ...f, campaign: camp });
      }
    }
    const allAdHocFees = Array.from(adHocByCampaignMap.values());

    // Rattacher à la dernière session auditable les paiements sans année OU dont l'année n'appartient à aucune inscription existante (et n'est pas l'année exclue)
    const enrolledYearIds = new Set(allEnrollments.map(e => e.academic_year_id));
    const unallocatedPayments = validFeePayments.filter((p) => {
      if (!p.academic_year_id) return true;
      if (excludeYearId && p.academic_year_id === excludeYearId) return false;
      return !enrolledYearIds.has(p.academic_year_id);
    });

    let totalArrears = 0;
    const sessions: SessionArrearsDetail[] = [];

    for (let idx = 0; idx < auditableEnrollments.length; idx++) {
      const enr = auditableEnrollments[idx];
      const yrId = enr.academic_year_id;
      const clsId = enr.class_id;
      const yearLabel = enr.academic_year?.label || 'Session';
      const className = enr.class?.name || 'Classe';
      const isLatestAuditableSession = idx === auditableEnrollments.length - 1;

      // Rang chronologique réel : seule la TOUTE PREMIÈRE inscription utilise inscription_fee
      const chronoIndex = sortedEnrollments.findIndex(e => e.academic_year_id === yrId);
      const isReenrollment = chronoIndex > 0;

      const plan =
        allFeePlans.find(p => p.class_id === clsId && p.academic_year_id === yrId) ||
        allFeePlans.find(p => p.class_id === clsId) ||
        null;

      // Paiements attribués à cette année (plus les paiements non tagués rattachés à la session auditable la plus récente)
      const yearSpecificPayments = validFeePayments.filter(p => p.academic_year_id === yrId);
      const yearPayments = isLatestAuditableSession
        ? [...yearSpecificPayments, ...unallocatedPayments]
        : yearSpecificPayments;

      // Campagnes de cette année (les campagnes sans academic_year_id ne sont comptées que sur la session auditable la plus récente)
      const yearCampaigns = allAdHocFees.filter((f: any) => {
        if (!f.campaign) return false;
        if (!f.campaign.academic_year_id) return isLatestAuditableSession;
        return f.campaign.academic_year_id === yrId;
      });

      const campaignPayments = yearPayments.filter(p => isCampaignPayment(p, yearCampaigns));
      const admissionPayments = yearPayments.filter(p => !isCampaignPayment(p, yearCampaigns) && isAdmissionPayment(p));
      const miscPayments = yearPayments.filter(p => !isCampaignPayment(p, yearCampaigns) && !isAdmissionPayment(p) && isMiscPayment(p));
      const tuitionPayments = yearPayments.filter(p => !isCampaignPayment(p, yearCampaigns) && !isAdmissionPayment(p) && !isMiscPayment(p));

      // 1. Admission / Inscription ou Réinscription
      const admHTG = plan ? (isReenrollment ? Number(plan.reenrollment_fee || 0) : Number(plan.inscription_fee || 0)) : 0;
      const admUSD = plan ? (isReenrollment ? Number(plan.reenrollment_fee_usd || 0) : Number(plan.inscription_fee_usd || 0)) : 0;
      const admBal = computeFeeCategoryBalance(admHTG, admUSD, admissionPayments, currentExchangeRate);

      // 2. Frais Divers Obligatoires
      const miscHTG = plan && plan.is_misc_mandatory ? Number(plan.misc_fee_htg || 0) : 0;
      const miscUSD = plan && plan.is_misc_mandatory ? Number(plan.misc_fee_usd || 0) : 0;
      const miscBal = computeFeeCategoryBalance(miscHTG, miscUSD, miscPayments, currentExchangeRate);

      // 3. Frais de Scolarité
      const totalYearDiscount = Number(enr.tuition_discount || 0) + Number(studentData.discount_amount || 0);
      const baseTuitionHTG = plan
        ? Number((studentData.is_foreign && plan.foreign_tuition_fee ? plan.foreign_tuition_fee : plan.tuition_fee) || 0)
        : 0;
      const tuitionHTG = baseTuitionHTG + Number(enr.tuition_addition || 0);
      const tuitionUSD = plan ? Number(plan.tuition_fee_usd || 0) : 0;
      const tuitionBal = computeFeeCategoryBalance(tuitionHTG, tuitionUSD, tuitionPayments, currentExchangeRate, totalYearDiscount);

      // 4. Campagnes Ad-Hoc (respectant custom_amount et devise)
      let campDueHTG = 0;
      let campPaidHTG = 0;
      let campRemainingHTG = 0;

      for (const fee of yearCampaigns) {
        const camp = fee.campaign;
        const cAmt =
          fee.custom_amount !== null && fee.custom_amount !== undefined
            ? Number(fee.custom_amount)
            : Number(camp?.amount || 0);
        const cCurr = String(camp?.currency || 'HTG').toUpperCase();
        const plannedCampHTG = cCurr === 'USD' ? 0 : cAmt;
        const plannedCampUSD = cCurr === 'USD' ? cAmt : 0;
        const fId = camp?.id || fee.campaign_id;
        const fName = String(camp?.name || '').trim().toLowerCase();

        const matchedCampPayments = campaignPayments.filter((p: any) => {
          const pCamp = Array.isArray(p.campaign) ? p.campaign[0] : p.campaign;
          if (fId && (p.ad_hoc_campaign_id === fId || p.campaign_id === fId || pCamp?.id === fId)) return true;
          const text = `${p.nature || ''} ${p.label || ''} ${p.type || ''} ${p.description || ''} ${p.notes || ''}`.toLowerCase();
          return Boolean(fName && text && (text.includes(fName) || (fName.includes('assurance') && text.includes('assurance'))));
        });

        const campBal = computeFeeCategoryBalance(plannedCampHTG, plannedCampUSD, matchedCampPayments, currentExchangeRate);
        campDueHTG += campBal.effectiveDueHTG;
        campPaidHTG += campBal.paidHTGEquiv;
        campRemainingHTG += campBal.remainingHTGEquiv;
      }

      const rawCategoryRemaining =
        admBal.remainingHTGEquiv +
        miscBal.remainingHTGEquiv +
        tuitionBal.remainingHTGEquiv +
        campRemainingHTG;

      const totalSessionDueHTG =
        admBal.effectiveDueHTG +
        miscBal.effectiveDueHTG +
        tuitionBal.effectiveDueHTG +
        campDueHTG;

      const sumAllSessionPaymentsHTG = yearPayments.reduce(
        (acc, p) => acc + getPaymentHTG(p, currentExchangeRate),
        0
      );

      const totalSessionPaidHTG = Math.max(
        admBal.paidHTGEquiv + miscBal.paidHTGEquiv + tuitionBal.paidHTGEquiv + campPaidHTG,
        sumAllSessionPaymentsHTG
      );

      const netYearDiffHTG = totalSessionDueHTG - totalSessionPaidHTG;

      // Règle de réconciliation comptable globale de la session :
      // Si la somme totale des paiements couvre l'engagement contractuel complet (à 50 HTG près),
      // aucun arriéré fantôme ne peut subsister même si un ancien paiement a été mal catégorisé.
      const sessionRemainingHTG =
        netYearDiffHTG <= 50 || rawCategoryRemaining <= 50
          ? 0
          : Math.min(Math.round(rawCategoryRemaining), Math.max(0, Math.round(netYearDiffHTG)));

      totalArrears += sessionRemainingHTG;

      sessions.push({
        academicYearId: yrId,
        academicYearLabel: yearLabel,
        className,
        totalDueHTG: Math.round(totalSessionDueHTG),
        totalPaidHTG: Math.round(totalSessionPaidHTG),
        remainingDebtHTG: sessionRemainingHTG,
        isReenrollment
      });
    }

    return {
      totalArrears: Math.max(0, Math.round(totalArrears)),
      sessions,
      source: 'CLIENT_AUDIT'
    };
  } catch (err) {
    console.warn('computeCertifiedStudentArrears fallback to RPC:', err);
    try {
      const { data: rpcDebt } = await supabase.rpc('get_student_global_debt', {
        p_student_id: studentId,
        ...(excludeYearId ? { p_exclude_year_id: excludeYearId } : {}),
        ...(schoolId ? { p_school_id: schoolId } : {})
      });
      return {
        totalArrears: Math.max(0, Number(rpcDebt || 0)),
        sessions: [],
        source: 'RPC_FALLBACK'
      };
    } catch {
      return { totalArrears: 0, sessions: [], source: 'RPC_FALLBACK' };
    }
  }
}
