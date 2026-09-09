import crypto from 'crypto';

/**
 * Module de chiffrement AES-256-GCM pour les secrets sensibles
 * Utilisé pour chiffrer les clés API (MONCASH_CLIENT_SECRET, mots de passe SMTP, tokens, etc.)
 * avant enregistrement dans Supabase.
 */

// Dérivation d'une clé de 256 bits (32 octets) à partir de la configuration serveur
function getMasterKey(): Buffer {
  const baseSeed = 
    process.env.ENCRYPTION_KEY || 
    process.env.APP_ENCRYPTION_KEY || 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.VITE_SUPABASE_ANON_KEY || 
    'edunova-pro-system-vault-master-key-seed-2026';
  
  return crypto.createHash('sha256').update(`${baseSeed}:edunova:vault:salt`).digest();
}

/**
 * Chiffre un texte en clair en utilisant l'algorithme AES-256-GCM.
 * Format de sortie : "enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>"
 */
export function encryptSecret(plainText: string): string {
  if (!plainText || typeof plainText !== 'string') return '';
  const trimmed = plainText.trim();
  if (!trimmed) return '';
  
  // Évite le double chiffrement si la chaîne est déjà chiffrée
  if (trimmed.startsWith('enc:v1:')) {
    return trimmed;
  }

  const iv = crypto.randomBytes(12); // IV de 96 bits recommandé pour GCM
  const masterKey = getMasterKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(trimmed, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Déchiffre une chaîne chiffrée avec encryptSecret.
 * Si la chaîne n'est pas chiffrée (sans préfixe "enc:v1:"), elle est retournée telle quelle.
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText || typeof cipherText !== 'string') return '';
  const trimmed = cipherText.trim();
  if (!trimmed) return '';

  if (!trimmed.startsWith('enc:v1:')) {
    // Rétrocompatibilité : valeur déjà en clair
    return trimmed;
  }

  try {
    const parts = trimmed.split(':');
    if (parts.length !== 5) {
      console.warn('Format de secret chiffré invalide');
      return '';
    }

    const iv = Buffer.from(parts[2], 'hex');
    const tag = Buffer.from(parts[3], 'hex');
    const encrypted = Buffer.from(parts[4], 'hex');

    const masterKey = getMasterKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Erreur lors du déchiffrement du secret :', err);
    return '';
  }
}

/**
 * Masque une clé sensible pour affichage sécurisé dans l'UI sans exposer le secret.
 * Exemple: "mc_sec_382949028402" -> "mc_s••••••••28402"
 */
export function maskSecret(value: string): string {
  if (!value) return '';
  // Si c'est chiffré, on déchiffre d'abord pour masquer de façon lisible
  const clear = value.startsWith('enc:v1:') ? decryptSecret(value) : value;
  if (!clear) return '••••••••';
  
  if (clear.length <= 8) {
    return '••••••••';
  }
  return `${clear.slice(0, 4)}••••••••${clear.slice(-4)}`;
}

/**
 * Vérifie si une valeur est au format chiffré
 */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.trim().startsWith('enc:v1:');
}
