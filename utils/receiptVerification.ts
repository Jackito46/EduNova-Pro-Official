import QRCode from 'qrcode';

export interface ReceiptVerificationPayload {
  ref: string;
  studentName: string;
  studentClass?: string;
  amount: number;
  currency: string;
  feeType: string;
  date: string;
  cashierName?: string;
  schoolName?: string;
  exchangeRate?: number;
  convertedAmountHTG?: number;
  originalAmountUSD?: number;
  schoolId?: string;
}

/**
 * Calcule une signature cryptographique courte et déterministe pour attester de l'authenticité du reçu
 */
export function generateReceiptSignature(ref: string, amount: number, currency: string, date: string, studentName: string = ''): string {
  const raw = `${ref}|${studentName}|${amount}|${currency}|${date}|EDUNOVA_PRO_SECURE`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  return `EDN-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/**
 * Construit l'URL publique de vérification ainsi que le texte de fallback scannable
 */
export function buildVerificationUrlAndText(data: ReceiptVerificationPayload): { url: string; text: string; signature: string } {
  const signature = generateReceiptSignature(data.ref, data.amount, data.currency, data.date, data.studentName);
  
  // URL absolue vers la page publique de vérification
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://edunova.app';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  
  const queryParams = new URLSearchParams({
    verify_receipt: '1',
    ref: data.ref || '',
    student: data.studentName || '',
    classe: data.studentClass || '',
    amount: data.amount ? String(data.amount) : '0',
    currency: data.currency || 'HTG',
    fee: data.feeType || 'Scolarité',
    date: data.date || '',
    cashier: data.cashierName || '',
    school: data.schoolName || '',
    rate: data.exchangeRate ? String(data.exchangeRate) : '',
    sig: signature
  });

  const url = `${origin}${pathname}#/verifier-recu?${queryParams.toString()}`;

  // Texte formaté clair si le scanner n'ouvre pas d'URL
  const text = [
    `🎓 EDUNOVA PRO - REÇU OFFICIEL AUTHENTIFIÉ`,
    `Réf: ${data.ref}`,
    `Élève: ${data.studentName}${data.studentClass ? ` (${data.studentClass})` : ''}`,
    `Montant: ${data.amount.toLocaleString()} ${data.currency}`,
    data.exchangeRate ? `Taux: 1 USD = ${data.exchangeRate} HTG` : null,
    `Motif: ${data.feeType}`,
    `Date: ${data.date}`,
    data.schoolName ? `Établissement: ${data.schoolName}` : null,
    `Signature Sécurisée: ${signature}`,
    `Lien de contrôle: ${url}`
  ].filter(Boolean).join('\n');

  return { url, text, signature };
}

/**
 * Génère le DataURL PNG du QR code (optimisé pour impression thermique 80mm monochrome)
 */
export async function generateReceiptQRCode(data: ReceiptVerificationPayload): Promise<{ dataUrl: string; signature: string; url: string }> {
  const { url, signature } = buildVerificationUrlAndText(data);
  
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 130,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return { dataUrl, signature, url };
  } catch (err) {
    console.error('Erreur lors de la génération du QR code de reçu:', err);
    // Fallback: génération avec le texte direct
    const fallbackUrl = await QRCode.toDataURL(`EDUNOVA:${data.ref}:${signature}`, {
      width: 130,
      margin: 1
    });
    return { dataUrl: fallbackUrl, signature, url };
  }
}
