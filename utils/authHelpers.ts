/**
 * Anti-injection and sanitization patterns
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(union|select|insert|update|delete|drop|alter|truncate|exec|execute|declare|cast)\b)/i,
  /(--|\/\*|\*\/|;|'|")/i,
  /(1\s*=\s*1|0\s*=\s*0)/i
];

/**
 * Normalizes a login identifier or creation input with anti-injection protections.
 * - Strips control characters, null bytes, and dangerous quotation marks.
 * - If it's already an email (contains '@'), returns it trimmed, sanitized, and lowercased.
 * - If it's a simple username (e.g., 'eugene.roseline' or 'jean_dupont'),
 *   transforms it to a standard internal email format (e.g. 'eugene.roseline@edunova.ht').
 */
export function normalizeIdentifier(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  // Strip control characters, null bytes, and invisible characters
  // eslint-disable-next-line no-control-regex
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '').trim().toLowerCase();
  
  // Cap length to RFC 5321 standard (254 chars max)
  if (sanitized.length > 254) {
    sanitized = sanitized.slice(0, 254);
  }

  if (sanitized.includes('@')) {
    // Sanitize email: strip forbidden SQL and script characters while preserving standard email characters
    const parts = sanitized.split('@');
    if (parts.length === 2) {
      const localPart = parts[0].replace(/[^a-z0-9.!#$%&'*+/=?^_`{|}~-]/g, '');
      const domainPart = parts[1].replace(/[^a-z0-9.-]/g, '');
      if (localPart && domainPart) {
        return `${localPart}@${domainPart}`;
      }
    }
    return sanitized.replace(/['"`;\\<>]/g, '');
  }

  // Sanitize username: only allow standard alphanumeric and safe separators [a-z0-9._-]
  const cleanUsername = sanitized.replace(/[^a-z0-9._-]/g, '');
  return cleanUsername ? `${cleanUsername}@edunova.ht` : '';
}

/**
 * Checks if a string contains known SQL injection or script injection signatures.
 */
export function containsSuspiciousPattern(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Validates identifier and password safety before transmission.
 */
export function validateCredentialsSanity(identifier: string, password?: string): { valid: boolean; error?: string } {
  if (!identifier || typeof identifier !== 'string') {
    return { valid: false, error: "L'identifiant est requis." };
  }

  const trimmedId = identifier.trim();
  if (trimmedId.length < 3) {
    return { valid: false, error: "L'identifiant doit comporter au moins 3 caractères." };
  }

  if (trimmedId.length > 254) {
    return { valid: false, error: "L'identifiant est trop long (maximum 254 caractères)." };
  }

  if (password !== undefined) {
    if (typeof password !== 'string' || password.length === 0) {
      return { valid: false, error: "Le mot de passe est requis." };
    }
    if (password.length > 256) {
      return { valid: false, error: "Le mot de passe dépasse la taille maximale autorisée." };
    }
  }

  return { valid: true };
}

/**
 * Extracts a user-friendly identifier to display in UI.
 * If the email ends with '@edunova.ht', returns just the username part (e.g. 'eugene.roseline').
 * Otherwise returns the full email address.
 */
export function displayIdentifier(emailOrUsername?: string | null): string {
  if (!emailOrUsername) return '';
  if (emailOrUsername.endsWith('@edunova.ht')) {
    return emailOrUsername.replace('@edunova.ht', '');
  }
  return emailOrUsername;
}
