import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { encryptSecret, decryptSecret, maskSecret, isEncrypted } from './cryptoVault.ts';

export type DemoPreferredChannel = 'both' | 'whatsapp' | 'email';
export type DemoRequestStatus = 'NEW' | 'CONTACTED' | 'SCHEDULED' | 'ARCHIVED';

export interface DemoRequestInput {
  schoolName: string;
  contactName: string;
  phone: string;
  email?: string;
  city?: string;
  schoolType?: string;
  studentBracket?: string;
  preferredChannel?: DemoPreferredChannel;
  notes?: string;
}

export interface DemoRequestRecord {
  id: string;
  referenceCode: string;
  createdAt: string;
  updatedAt: string;
  schoolName: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  schoolType: string;
  studentBracket: string;
  preferredChannel: DemoPreferredChannel;
  notes: string;
  status: DemoRequestStatus;
  adminNotes?: string;
  delivery: {
    savedToInbox: boolean;
    emailSent: boolean;
    emailRecipientsCount: number;
    emailReason?: string;
    whatsappAutoSent: boolean;
    whatsappReason?: string;
  };
}

export interface DemoRoutingConfigStored {
  publicEmail: string;
  notificationEmail: string;
  whatsappNumber: string;
  secondaryPhoneDisplay: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassEncrypted: string;
  smtpFromName: string;
  smtpFromAddress: string;
  whatsappPhoneNumberId: string;
  whatsappAccessTokenEncrypted: string;
  updatedAt: string;
}

export interface PublicContactConfig {
  displayEmail: string;
  whatsappNumber: string;
  whatsappDisplay: string;
  secondaryPhoneDisplay: string;
  smtpReady: boolean;
  whatsappAutoReady: boolean;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const REQUESTS_FILE = path.join(DATA_DIR, 'demo_requests.json');
const ROUTING_FILE = path.join(DATA_DIR, 'demo_routing_config.json');

const DEFAULT_PUBLIC_EMAIL = 'contact@edunova-pro.tech';
const DEFAULT_WHATSAPP_NUMBER = '50936045639';
const DEFAULT_SECONDARY_PHONE = '3350-8416';

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function atomicWriteJson(filePath: string, data: unknown): void {
  ensureDataDir();
  const tmpPath = `${filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[DemoContact] Lecture JSON impossible (${filePath}):`, err);
    return fallback;
  }
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function cleanText(value: unknown, maxLen = 400): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maxLen);
}

export function normalizeWhatsappDigits(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return DEFAULT_WHATSAPP_NUMBER;
  if (digits.length === 8) return `509${digits}`;
  return digits;
}

export function formatWhatsappDisplay(digits: string): string {
  const clean = normalizeWhatsappDigits(digits);
  if (clean.startsWith('509') && clean.length === 11) {
    return `+509 ${clean.slice(3, 7)}-${clean.slice(7)}`;
  }
  return `+${clean}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim());
}

export function parseEmailList(raw: string): string[] {
  return String(raw || '')
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && isValidEmail(s));
}

function getDefaultStoredRouting(): DemoRoutingConfigStored {
  return {
    publicEmail: (process.env.DEMO_PUBLIC_EMAIL || '').trim() || DEFAULT_PUBLIC_EMAIL,
    notificationEmail: (process.env.DEMO_NOTIFICATION_EMAIL || '').trim(),
    whatsappNumber: normalizeWhatsappDigits(process.env.DEMO_WHATSAPP_NUMBER || DEFAULT_WHATSAPP_NUMBER),
    secondaryPhoneDisplay: DEFAULT_SECONDARY_PHONE,
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPassEncrypted: '',
    smtpFromName: 'EduNova Pro · Secrétariat Démos',
    smtpFromAddress: '',
    whatsappPhoneNumberId: '',
    whatsappAccessTokenEncrypted: '',
    updatedAt: ''
  };
}

function readStoredRouting(): DemoRoutingConfigStored {
  const stored = readJsonFile<Partial<DemoRoutingConfigStored>>(ROUTING_FILE, {});
  const defaults = getDefaultStoredRouting();
  return {
    ...defaults,
    ...stored,
    publicEmail: cleanText(stored.publicEmail, 180) || defaults.publicEmail,
    notificationEmail: cleanText(stored.notificationEmail, 400) || defaults.notificationEmail,
    whatsappNumber: normalizeWhatsappDigits(stored.whatsappNumber || defaults.whatsappNumber),
    secondaryPhoneDisplay: cleanText(stored.secondaryPhoneDisplay, 40) || defaults.secondaryPhoneDisplay,
    smtpHost: cleanText(stored.smtpHost, 180) || '',
    smtpPort: Number(stored.smtpPort) || 587,
    smtpUser: cleanText(stored.smtpUser, 180) || '',
    smtpPassEncrypted: typeof stored.smtpPassEncrypted === 'string' ? stored.smtpPassEncrypted : '',
    smtpFromName: cleanText(stored.smtpFromName, 140) || defaults.smtpFromName,
    smtpFromAddress: cleanText(stored.smtpFromAddress, 180) || '',
    whatsappPhoneNumberId: cleanText(stored.whatsappPhoneNumberId, 120) || '',
    whatsappAccessTokenEncrypted: typeof stored.whatsappAccessTokenEncrypted === 'string' ? stored.whatsappAccessTokenEncrypted : '',
    updatedAt: cleanText(stored.updatedAt, 60) || ''
  };
}

async function fetchSupabaseRoutingFallbacks(supabaseClient: any): Promise<{
  globalPlatformIdentity: any;
  globalDemoRouting: any;
  schoolSmtpRow: any;
  schoolWhatsappRow: any;
}> {
  const result = {
    globalPlatformIdentity: null as any,
    globalDemoRouting: null as any,
    schoolSmtpRow: null as any,
    schoolWhatsappRow: null as any
  };

  if (!supabaseClient) return result;

  try {
    const { data: gsRows } = await supabaseClient
      .from('global_settings')
      .select('key, value')
      .in('key', ['platform_identity', 'platform_demo_routing']);

    if (Array.isArray(gsRows)) {
      for (const row of gsRows) {
        if (row.key === 'platform_identity') result.globalPlatformIdentity = row.value;
        if (row.key === 'platform_demo_routing') result.globalDemoRouting = row.value;
      }
    }
  } catch {
    // Non bloquant si RLS ou table indisponible
  }

  try {
    const { data: commRows } = await supabaseClient
      .from('communication_settings')
      .select('school_id, email_from_name, email_from_address, smtp_host, smtp_port, smtp_user, smtp_pass, whatsapp_provider, whatsapp_api_key, whatsapp_phone_number_id')
      .limit(10);

    if (Array.isArray(commRows)) {
      for (const row of commRows) {
        if (!result.schoolSmtpRow && row.smtp_host && row.smtp_pass && String(row.smtp_pass).trim()) {
          result.schoolSmtpRow = row;
        }
        if (
          !result.schoolWhatsappRow &&
          row.whatsapp_provider === 'whatsapp_cloud' &&
          row.whatsapp_phone_number_id &&
          row.whatsapp_api_key
        ) {
          result.schoolWhatsappRow = row;
        }
      }
    }
  } catch {
    // Non bloquant
  }

  return result;
}

async function resolveEffectiveRuntimeRouting(supabaseClient: any) {
  const local = readStoredRouting();
  const sb = await fetchSupabaseRoutingFallbacks(supabaseClient);

  const gsRouting = sb.globalDemoRouting || {};
  const gsIdentity = sb.globalPlatformIdentity || {};

  const publicEmail =
    cleanText(local.publicEmail, 180) ||
    cleanText(gsRouting.public_email, 180) ||
    (process.env.DEMO_PUBLIC_EMAIL || '').trim() ||
    DEFAULT_PUBLIC_EMAIL;

  const whatsappNumber = normalizeWhatsappDigits(
    local.whatsappNumber ||
      gsRouting.whatsapp_number ||
      process.env.DEMO_WHATSAPP_NUMBER ||
      DEFAULT_WHATSAPP_NUMBER
  );

  // Résolution des emails internes devant recevoir les demandes de démo
  const notificationSources = [
    local.notificationEmail,
    gsRouting.notification_email,
    process.env.DEMO_NOTIFICATION_EMAIL || '',
    gsIdentity.support_email && !String(gsIdentity.support_email).includes('support@edunova.pro')
      ? gsIdentity.support_email
      : '',
    sb.schoolSmtpRow?.email_from_address || '',
    publicEmail
  ];

  const uniqueTargets: string[] = [];
  for (const src of notificationSources) {
    const parsed = parseEmailList(src);
    if (parsed.length > 0 && uniqueTargets.length === 0) {
      uniqueTargets.push(...parsed);
      break;
    }
  }
  if (uniqueTargets.length === 0) {
    uniqueTargets.push(DEFAULT_PUBLIC_EMAIL);
  }

  // Résolution SMTP : ENV -> Local Vault -> Global Settings -> School Communication Settings
  const envSmtpHost = (process.env.SMTP_HOST || '').trim();
  const envSmtpPass = (process.env.SMTP_PASS || '').trim();
  const localSmtpPass = local.smtpPassEncrypted ? decryptSecret(local.smtpPassEncrypted) : '';
  const gsSmtpPass = gsRouting.smtp_pass_enc ? decryptSecret(String(gsRouting.smtp_pass_enc)) : '';
  const dbSmtpPass = sb.schoolSmtpRow?.smtp_pass
    ? isEncrypted(sb.schoolSmtpRow.smtp_pass)
      ? decryptSecret(sb.schoolSmtpRow.smtp_pass)
      : String(sb.schoolSmtpRow.smtp_pass).trim()
    : '';

  let smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    fromName: string;
    fromAddress: string;
    source: 'env' | 'platform_config' | 'school_smtp' | 'none';
  } = {
    host: '',
    port: 587,
    user: '',
    pass: '',
    fromName: 'EduNova Pro · Démos',
    fromAddress: publicEmail,
    source: 'none'
  };

  if (envSmtpHost && envSmtpPass) {
    smtp = {
      host: envSmtpHost,
      port: Number(process.env.SMTP_PORT) || 587,
      user: (process.env.SMTP_USER || process.env.SMTP_FROM_EMAIL || '').trim(),
      pass: envSmtpPass,
      fromName: (process.env.SMTP_FROM_NAME || 'EduNova Pro · Démos').trim(),
      fromAddress: (process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || publicEmail).trim(),
      source: 'env'
    };
  } else if (local.smtpHost && localSmtpPass) {
    smtp = {
      host: local.smtpHost,
      port: local.smtpPort || 587,
      user: local.smtpUser || local.smtpFromAddress,
      pass: localSmtpPass,
      fromName: local.smtpFromName || 'EduNova Pro · Démos',
      fromAddress: local.smtpFromAddress || local.smtpUser || publicEmail,
      source: 'platform_config'
    };
  } else if (gsRouting.smtp_host && gsSmtpPass) {
    smtp = {
      host: String(gsRouting.smtp_host),
      port: Number(gsRouting.smtp_port) || 587,
      user: String(gsRouting.smtp_user || gsRouting.smtp_from_address || ''),
      pass: gsSmtpPass,
      fromName: String(gsRouting.smtp_from_name || 'EduNova Pro · Démos'),
      fromAddress: String(gsRouting.smtp_from_address || gsRouting.smtp_user || publicEmail),
      source: 'platform_config'
    };
  } else if (sb.schoolSmtpRow?.smtp_host && dbSmtpPass) {
    smtp = {
      host: String(sb.schoolSmtpRow.smtp_host),
      port: Number(sb.schoolSmtpRow.smtp_port) || 587,
      user: String(sb.schoolSmtpRow.smtp_user || sb.schoolSmtpRow.email_from_address || ''),
      pass: dbSmtpPass,
      fromName: String(sb.schoolSmtpRow.email_from_name || 'EduNova Pro · Démos'),
      fromAddress: String(sb.schoolSmtpRow.email_from_address || sb.schoolSmtpRow.smtp_user || publicEmail),
      source: 'school_smtp'
    };
  }

  // Résolution WhatsApp Cloud API (optionnel pour notification automatique en arrière-plan)
  const envWaId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const envWaToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const localWaToken = local.whatsappAccessTokenEncrypted ? decryptSecret(local.whatsappAccessTokenEncrypted) : '';
  const dbWaToken = sb.schoolWhatsappRow?.whatsapp_api_key
    ? isEncrypted(sb.schoolWhatsappRow.whatsapp_api_key)
      ? decryptSecret(sb.schoolWhatsappRow.whatsapp_api_key)
      : String(sb.schoolWhatsappRow.whatsapp_api_key).trim()
    : '';

  const gsWaToken = gsRouting.whatsapp_access_token_enc ? decryptSecret(String(gsRouting.whatsapp_access_token_enc)) : '';
  let whatsappCloud: { phoneNumberId: string; accessToken: string } | null = null;
  if (envWaId && envWaToken) {
    whatsappCloud = { phoneNumberId: envWaId, accessToken: envWaToken };
  } else if (local.whatsappPhoneNumberId && localWaToken) {
    whatsappCloud = { phoneNumberId: local.whatsappPhoneNumberId, accessToken: localWaToken };
  } else if (gsRouting.whatsapp_phone_number_id && gsWaToken) {
    whatsappCloud = { phoneNumberId: String(gsRouting.whatsapp_phone_number_id), accessToken: gsWaToken };
  } else if (sb.schoolWhatsappRow?.whatsapp_phone_number_id && dbWaToken) {
    whatsappCloud = {
      phoneNumberId: String(sb.schoolWhatsappRow.whatsapp_phone_number_id),
      accessToken: dbWaToken
    };
  }

  return {
    local,
    publicEmail,
    notificationTargets: uniqueTargets,
    whatsappNumber,
    whatsappDisplay: formatWhatsappDisplay(whatsappNumber),
    secondaryPhoneDisplay: local.secondaryPhoneDisplay || DEFAULT_SECONDARY_PHONE,
    smtp,
    whatsappCloud
  };
}

export async function getPublicContactConfig(supabaseClient: any): Promise<PublicContactConfig> {
  const resolved = await resolveEffectiveRuntimeRouting(supabaseClient);
  return {
    displayEmail: resolved.publicEmail,
    whatsappNumber: resolved.whatsappNumber,
    whatsappDisplay: resolved.whatsappDisplay,
    secondaryPhoneDisplay: resolved.secondaryPhoneDisplay,
    smtpReady: resolved.smtp.source !== 'none',
    whatsappAutoReady: !!resolved.whatsappCloud
  };
}

export function formatDemoRequestMessage(record: DemoRequestRecord): string {
  const channelLabel =
    record.preferredChannel === 'whatsapp'
      ? 'WhatsApp Direct'
      : record.preferredChannel === 'email'
      ? 'Email'
      : 'Email & WhatsApp';

  const lines = [
    `DEMANDE DE DEMO EDUNOVA PRO (${record.referenceCode})`,
    `--------------------------------`,
    `Etablissement : ${record.schoolName}`,
    `Responsable : ${record.contactName}`,
    `Telephone / WhatsApp : ${record.phone}`,
    record.email ? `Email : ${record.email}` : null,
    `Ville / Commune : ${record.city}`,
    `Type d'etablissement : ${record.schoolType}`,
    `Effectif estime : ${record.studentBracket}`,
    `Canal souhaite : ${channelLabel}`,
    record.notes ? `Precisions : ${record.notes}` : null
  ].filter(Boolean);

  return lines.join('\n');
}

function buildMailtoUrl(targetEmail: string, record: DemoRequestRecord, formattedText: string): string {
  const subject = `[Démo EduNova Pro] ${record.schoolName} (${record.referenceCode})`;
  return `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(formattedText)}`;
}

function buildWhatsappUrl(whatsappDigits: string, formattedText: string): string {
  const digits = normalizeWhatsappDigits(whatsappDigits);
  return `https://wa.me/${digits}?text=${encodeURIComponent(formattedText)}`;
}

async function persistRequests(records: DemoRequestRecord[], supabaseClient: any): Promise<void> {
  const trimmed = records.slice(0, 250);
  atomicWriteJson(REQUESTS_FILE, trimmed);

  if (supabaseClient) {
    try {
      await supabaseClient
        .from('global_settings')
        .upsert({
          key: 'demo_requests_inbox',
          value: { items: trimmed.slice(0, 80), updated_at: new Date().toISOString() },
          updated_at: new Date().toISOString()
        });
    } catch {
      // Le fichier local data/demo_requests.json reste la source fiable si RLS bloque l'écriture anonyme
    }
  }
}

export async function loadAllDemoRequests(supabaseClient: any): Promise<DemoRequestRecord[]> {
  const localRecords = readJsonFile<DemoRequestRecord[]>(REQUESTS_FILE, []);
  if (localRecords.length > 0) {
    return localRecords;
  }

  if (supabaseClient) {
    try {
      const { data } = await supabaseClient
        .from('global_settings')
        .select('value')
        .eq('key', 'demo_requests_inbox')
        .maybeSingle();
      if (data?.value?.items && Array.isArray(data.value.items)) {
        return data.value.items as DemoRequestRecord[];
      }
    } catch {
      // ignore
    }
  }
  return [];
}

export async function submitPublicDemoRequest(
  input: DemoRequestInput,
  supabaseClient: any
): Promise<{
  record: DemoRequestRecord;
  displayEmail: string;
  whatsappDisplay: string;
  whatsappUrl: string;
  mailtoUrl: string;
  formattedMessage: string;
}> {
  const schoolName = cleanText(input.schoolName, 160);
  const contactName = cleanText(input.contactName, 120);
  const phone = cleanText(input.phone, 50);
  const email = cleanText(input.email, 160);
  const city = cleanText(input.city, 80) || 'Port-au-Prince';
  const schoolType = cleanText(input.schoolType, 100) || 'Fondamentale & Secondaire';
  const studentBracket = cleanText(input.studentBracket, 60) || '150-350';
  const preferredChannel: DemoPreferredChannel =
    input.preferredChannel === 'whatsapp' || input.preferredChannel === 'email' ? input.preferredChannel : 'both';
  const notes = cleanText(input.notes, 1000);

  const nowIso = new Date().toISOString();
  const datePart = nowIso.slice(0, 10).replace(/-/g, '');
  const randPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  const referenceCode = `DEMO-${datePart}-${randPart}`;

  const resolved = await resolveEffectiveRuntimeRouting(supabaseClient);

  const record: DemoRequestRecord = {
    id: crypto.randomUUID(),
    referenceCode,
    createdAt: nowIso,
    updatedAt: nowIso,
    schoolName,
    contactName,
    phone,
    email,
    city,
    schoolType,
    studentBracket,
    preferredChannel,
    notes,
    status: 'NEW',
    delivery: {
      savedToInbox: true,
      emailSent: false,
      emailRecipientsCount: 0,
      whatsappAutoSent: false
    }
  };

  const formattedMessage = formatDemoRequestMessage(record);
  const whatsappUrl = buildWhatsappUrl(resolved.whatsappNumber, formattedMessage);
  const mailtoUrl = buildMailtoUrl(resolved.publicEmail, record, formattedMessage);

  // 1. Tentative d'envoi Email automatique via Nodemailer
  if (resolved.smtp.source !== 'none' && resolved.smtp.host && resolved.smtp.pass) {
    try {
      const transporter = nodemailer.createTransport({
        host: resolved.smtp.host,
        port: resolved.smtp.port || 587,
        secure: resolved.smtp.port === 465,
        auth: {
          user: resolved.smtp.user || resolved.smtp.fromAddress,
          pass: resolved.smtp.pass
        }
      });

      const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background: #0B132B; color: #ffffff; padding: 20px 24px;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #fbbf24; font-weight: 700;">
              Nouvelle Demande de Démonstration
            </div>
            <h2 style="margin: 6px 0 0; font-size: 20px; color: #ffffff;">${escapeHtml(schoolName)}</h2>
            <div style="font-size: 12px; color: #cbd5e1; margin-top: 4px;">Référence : ${escapeHtml(referenceCode)}</div>
          </div>
          <div style="padding: 22px 24px; background: #ffffff; color: #0f172a; font-size: 14px; line-height: 1.6;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #64748b; width: 170px;"><strong>Responsable :</strong></td><td style="padding: 6px 0;">${escapeHtml(contactName)}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;"><strong>Téléphone / WhatsApp :</strong></td><td style="padding: 6px 0;"><strong>${escapeHtml(phone)}</strong></td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;"><strong>Email du demandeur :</strong></td><td style="padding: 6px 0;">${email ? escapeHtml(email) : '<em>Non renseigné</em>'}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;"><strong>Ville / Commune :</strong></td><td style="padding: 6px 0;">${escapeHtml(city)}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;"><strong>Type :</strong></td><td style="padding: 6px 0;">${escapeHtml(schoolType)}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;"><strong>Effectif estimé :</strong></td><td style="padding: 6px 0;">${escapeHtml(studentBracket)}</td></tr>
              <tr><td style="padding: 6px 0; color: #64748b;"><strong>Canal préféré :</strong></td><td style="padding: 6px 0;">${escapeHtml(preferredChannel)}</td></tr>
            </table>
            ${
              notes
                ? `<div style="margin-top: 14px; padding: 12px 14px; background: #f8fafc; border-left: 3px solid #4f46e5; border-radius: 6px;">
                     <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 4px;">Message / Précisions :</div>
                     <div style="white-space: pre-wrap;">${escapeHtml(notes)}</div>
                   </div>`
                : ''
            }
          </div>
          <div style="background: #f8fafc; padding: 14px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
            EduNova Pro · Portail de Réception des Démos · Port-au-Prince, Haïti
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"${resolved.smtp.fromName}" <${resolved.smtp.fromAddress}>`,
        to: resolved.notificationTargets.join(', '),
        replyTo: email && isValidEmail(email) ? email : undefined,
        subject: `[Démo EduNova Pro] ${schoolName} — ${contactName} (${referenceCode})`,
        text: formattedMessage,
        html: htmlBody
      });

      record.delivery.emailSent = true;
      record.delivery.emailRecipientsCount = resolved.notificationTargets.length;
    } catch (err: any) {
      console.error('[DemoContact] Échec envoi email SMTP:', err?.message || err);
      record.delivery.emailSent = false;
      record.delivery.emailReason = err?.message || 'Erreur passerelle SMTP';
    }
  } else {
    record.delivery.emailReason = 'Passerelle SMTP plateforme non encore configurée.';
  }

  // 2. Tentative d'alerte automatique WhatsApp Cloud API (si configurée côté serveur)
  if (resolved.whatsappCloud?.phoneNumberId && resolved.whatsappCloud?.accessToken) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${resolved.whatsappCloud.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resolved.whatsappCloud.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: resolved.whatsappNumber,
            type: 'text',
            text: { preview_url: false, body: formattedMessage }
          })
        }
      );

      if (response.ok) {
        record.delivery.whatsappAutoSent = true;
      } else {
        const errPayload = await response.json().catch(() => ({}));
        record.delivery.whatsappReason = errPayload?.error?.message || `HTTP ${response.status}`;
      }
    } catch (err: any) {
      record.delivery.whatsappReason = err?.message || 'Erreur API WhatsApp Cloud';
    }
  } else {
    record.delivery.whatsappReason = 'Transmission directe via lien WhatsApp pré-rempli.';
  }

  // 3. Sauvegarde persistante dans la boîte de réception SuperAdmin
  const existing = await loadAllDemoRequests(supabaseClient);
  existing.unshift(record);
  await persistRequests(existing, supabaseClient);

  return {
    record,
    displayEmail: resolved.publicEmail,
    whatsappDisplay: resolved.whatsappDisplay,
    whatsappUrl,
    mailtoUrl,
    formattedMessage
  };
}

export async function getAdminDemoState(supabaseClient: any) {
  const requests = await loadAllDemoRequests(supabaseClient);
  const resolved = await resolveEffectiveRuntimeRouting(supabaseClient);

  return {
    requests,
    routing: {
      publicEmail: resolved.publicEmail,
      notificationEmail: resolved.notificationTargets.join(', '),
      whatsappNumber: resolved.whatsappDisplay,
      secondaryPhoneDisplay: resolved.secondaryPhoneDisplay,
      smtpHost: resolved.smtp.host || resolved.local.smtpHost || '',
      smtpPort: resolved.smtp.port || resolved.local.smtpPort || 587,
      smtpUser: resolved.smtp.user || resolved.local.smtpUser || '',
      smtpPassMasked: resolved.local.smtpPassEncrypted
        ? maskSecret(resolved.local.smtpPassEncrypted)
        : resolved.smtp.pass
        ? '••••••••'
        : '',
      smtpFromName: resolved.smtp.fromName || resolved.local.smtpFromName,
      smtpFromAddress: resolved.smtp.fromAddress || resolved.local.smtpFromAddress || '',
      smtpSource: resolved.smtp.source,
      whatsappPhoneNumberId: resolved.local.whatsappPhoneNumberId || resolved.whatsappCloud?.phoneNumberId || '',
      whatsappAccessTokenMasked: resolved.local.whatsappAccessTokenEncrypted
        ? maskSecret(resolved.local.whatsappAccessTokenEncrypted)
        : resolved.whatsappCloud?.accessToken
        ? '••••••••'
        : '',
      whatsappAutoReady: !!resolved.whatsappCloud,
      updatedAt: resolved.local.updatedAt || null
    }
  };
}

export async function saveAdminDemoRouting(
  payload: {
    publicEmail?: string;
    notificationEmail?: string;
    whatsappNumber?: string;
    secondaryPhoneDisplay?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    smtpFromName?: string;
    smtpFromAddress?: string;
    whatsappPhoneNumberId?: string;
    whatsappAccessToken?: string;
  },
  supabaseClient: any
) {
  const current = readStoredRouting();
  const cleanPublicEmail = cleanText(payload.publicEmail, 180) || current.publicEmail || DEFAULT_PUBLIC_EMAIL;
  const cleanNotificationEmail = cleanText(payload.notificationEmail, 400);
  const cleanWaDigits = normalizeWhatsappDigits(payload.whatsappNumber || current.whatsappNumber);

  const nextSmtpPassRaw = typeof payload.smtpPass === 'string' ? payload.smtpPass.trim() : '';
  const shouldKeepExistingSmtpPass =
    !nextSmtpPassRaw || nextSmtpPassRaw.includes('••••');
  const nextSmtpPassEncrypted = shouldKeepExistingSmtpPass
    ? current.smtpPassEncrypted
    : encryptSecret(nextSmtpPassRaw);

  const nextWaTokenRaw =
    typeof payload.whatsappAccessToken === 'string' ? payload.whatsappAccessToken.trim() : '';
  const shouldKeepExistingWaToken = !nextWaTokenRaw || nextWaTokenRaw.includes('••••');
  const nextWaTokenEncrypted = shouldKeepExistingWaToken
    ? current.whatsappAccessTokenEncrypted
    : encryptSecret(nextWaTokenRaw);

  const nextConfig: DemoRoutingConfigStored = {
    publicEmail: cleanPublicEmail,
    notificationEmail: cleanNotificationEmail,
    whatsappNumber: cleanWaDigits,
    secondaryPhoneDisplay: cleanText(payload.secondaryPhoneDisplay, 40) || current.secondaryPhoneDisplay,
    smtpHost: cleanText(payload.smtpHost, 180),
    smtpPort: Number(payload.smtpPort) || 587,
    smtpUser: cleanText(payload.smtpUser, 180),
    smtpPassEncrypted: nextSmtpPassEncrypted,
    smtpFromName: cleanText(payload.smtpFromName, 140) || 'EduNova Pro · Démos',
    smtpFromAddress: cleanText(payload.smtpFromAddress, 180),
    whatsappPhoneNumberId: cleanText(payload.whatsappPhoneNumberId, 120),
    whatsappAccessTokenEncrypted: nextWaTokenEncrypted,
    updatedAt: new Date().toISOString()
  };

  atomicWriteJson(ROUTING_FILE, nextConfig);

  if (supabaseClient) {
    try {
      await supabaseClient.from('global_settings').upsert({
        key: 'platform_demo_routing',
        value: {
          public_email: nextConfig.publicEmail,
          notification_email: nextConfig.notificationEmail,
          whatsapp_number: nextConfig.whatsappNumber,
          smtp_host: nextConfig.smtpHost,
          smtp_port: nextConfig.smtpPort,
          smtp_user: nextConfig.smtpUser,
          smtp_pass_enc: nextConfig.smtpPassEncrypted,
          smtp_from_name: nextConfig.smtpFromName,
          smtp_from_address: nextConfig.smtpFromAddress,
          whatsapp_phone_number_id: nextConfig.whatsappPhoneNumberId,
          whatsapp_access_token_enc: nextConfig.whatsappAccessTokenEncrypted,
          updated_at: nextConfig.updatedAt
        },
        updated_at: nextConfig.updatedAt
      });
    } catch {
      // Non bloquant
    }
  }

  return getAdminDemoState(supabaseClient);
}

export async function updateDemoRequestStatus(
  id: string,
  status: DemoRequestStatus,
  adminNotes: string | undefined,
  supabaseClient: any
): Promise<DemoRequestRecord | null> {
  const existing = await loadAllDemoRequests(supabaseClient);
  const idx = existing.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  existing[idx] = {
    ...existing[idx],
    status,
    adminNotes: adminNotes !== undefined ? cleanText(adminNotes, 500) : existing[idx].adminNotes,
    updatedAt: new Date().toISOString()
  };

  await persistRequests(existing, supabaseClient);
  return existing[idx];
}

export async function deleteDemoRequest(id: string, supabaseClient: any): Promise<boolean> {
  const existing = await loadAllDemoRequests(supabaseClient);
  const filtered = existing.filter((r) => r.id !== id);
  if (filtered.length === existing.length) return false;
  await persistRequests(filtered, supabaseClient);
  return true;
}

export async function sendDemoRoutingTestEmail(supabaseClient: any): Promise<{
  sentTo: string[];
  smtpHost: string;
}> {
  const resolved = await resolveEffectiveRuntimeRouting(supabaseClient);
  if (resolved.smtp.source === 'none' || !resolved.smtp.host || !resolved.smtp.pass) {
    throw new Error(
      "Aucun serveur SMTP actif trouvé. Renseignez l'hôte SMTP, l'utilisateur et le mot de passe d'application avant de tester."
    );
  }

  const transporter = nodemailer.createTransport({
    host: resolved.smtp.host,
    port: resolved.smtp.port || 587,
    secure: resolved.smtp.port === 465,
    auth: {
      user: resolved.smtp.user || resolved.smtp.fromAddress,
      pass: resolved.smtp.pass
    }
  });

  await transporter.verify();

  await transporter.sendMail({
    from: `"${resolved.smtp.fromName}" <${resolved.smtp.fromAddress}>`,
    to: resolved.notificationTargets.join(', '),
    subject: '[EduNova Pro] Test de réception des demandes de démo',
    text: `Félicitations ! La passerelle de notification des demandes de démo fonctionne.\n\nDestinataires configurés : ${resolved.notificationTargets.join(', ')}\nWhatsApp officiel : ${resolved.whatsappDisplay}`,
    html: `<p><strong>Félicitations !</strong> La passerelle de notification des demandes de démo <strong>EduNova Pro</strong> fonctionne correctement.</p><p><strong>Destinataires configurés :</strong> ${escapeHtml(resolved.notificationTargets.join(', '))}<br/><strong>WhatsApp officiel :</strong> ${escapeHtml(resolved.whatsappDisplay)}</p>`
  });

  return {
    sentTo: resolved.notificationTargets,
    smtpHost: resolved.smtp.host
  };
}
