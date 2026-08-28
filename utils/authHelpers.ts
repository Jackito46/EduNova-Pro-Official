/**
 * Normalizes a login identifier or creation input.
 * - If it's already an email (contains '@'), returns it trimmed and lowercased.
 * - If it's a simple username (e.g., 'eugene.roseline' or 'jean_dupont' or 'direction_boulard'),
 *   transforms it to a standard internal email format (e.g. 'eugene.roseline@edunova.ht').
 */
export function normalizeIdentifier(input: string): string {
  if (!input) return '';
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes('@')) {
    return trimmed;
  }
  // Sanitize username: replace invalid email local part chars if any
  const cleanUsername = trimmed.replace(/[^a-z0-9._-]/g, '');
  return `${cleanUsername}@edunova.ht`;
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
