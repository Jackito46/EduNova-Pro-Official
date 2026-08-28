import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * High-definition SVG generator for EduNova Pro branding
 */
function getIconSvg(size, isMaskable = false) {
  // Safe zone scaling for maskable icons (Android adaptive icons)
  const padding = isMaskable ? size * 0.12 : size * 0.05;
  const contentSize = size - (padding * 2);
  const cornerRadius = isMaskable ? 0 : size * 0.22;

  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="35%" stop-color="#1e1b4b"/>
        <stop offset="70%" stop-color="#312e81"/>
        <stop offset="100%" stop-color="#2563eb"/>
      </linearGradient>

      <linearGradient id="emblemGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#60a5fa"/>
        <stop offset="50%" stop-color="#818cf8"/>
        <stop offset="100%" stop-color="#c084fc"/>
      </linearGradient>

      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fbbf24"/>
        <stop offset="100%" stop-color="#f59e0b"/>
      </linearGradient>

      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="${size * 0.02}" stdDeviation="${size * 0.03}" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
    </defs>

    <!-- Background card -->
    <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#bgGrad)"/>

    <!-- Subtle decorative concentric circles -->
    <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.38}" fill="none" stroke="rgba(255, 255, 255, 0.06)" stroke-width="${Math.max(1, size * 0.008)}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.28}" fill="none" stroke="rgba(255, 255, 255, 0.08)" stroke-width="${Math.max(1, size * 0.008)}"/>

    <!-- Main Emblem Group -->
    <g transform="translate(${padding}, ${padding}) scale(${contentSize / 512})" filter="url(#glow)">
      <!-- Shield / Modern Portal Base -->
      <path d="M256 60 C360 60 410 110 410 230 C410 340 330 420 256 452 C182 420 102 340 102 230 C102 110 152 60 256 60 Z" 
            fill="rgba(255, 255, 255, 0.08)" 
            stroke="url(#emblemGrad)" 
            stroke-width="8" 
            stroke-linejoin="round"/>

      <!-- Graduation Cap / Mortarboard -->
      <path d="M256 128 L392 188 L256 248 L120 188 Z" fill="url(#emblemGrad)"/>
      <path d="M256 142 L368 190 L256 238 L144 190 Z" fill="#ffffff" fill-opacity="0.95"/>
      
      <!-- Mortarboard Skullcap -->
      <path d="M168 214 L168 288 C168 334 256 360 256 360 C256 360 344 334 344 288 L344 214 L256 254 Z" 
            fill="url(#emblemGrad)"/>
      
      <!-- Tassel & Pendant -->
      <path d="M388 190 L388 280" stroke="url(#goldGrad)" stroke-width="7" stroke-linecap="round"/>
      <circle cx="388" cy="286" r="11" fill="url(#goldGrad)"/>

      <!-- Open Book / Wings of Knowledge -->
      <path d="M256 320 C220 295 160 295 130 305 L130 380 C165 370 220 370 256 395 C292 370 347 370 382 380 L382 305 C352 295 292 295 256 320 Z" 
            fill="#ffffff" 
            fill-opacity="0.96"/>
      <path d="M256 320 L256 395" stroke="#1e1b4b" stroke-width="5" stroke-linecap="round"/>

      <!-- Academic Star / Sparkle of Excellence -->
      <path d="M256 270 L261 282 L274 284 L264 293 L267 306 L256 299 L245 306 L248 293 L238 284 L251 282 Z" fill="url(#goldGrad)"/>
    </g>
  </svg>
  `;
}

/**
 * High-definition Desktop Screenshot generator (1280x720)
 */
function getDesktopScreenshotSvg() {
  return `
  <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="d_bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
      <linearGradient id="d_card" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#f8fafc"/>
      </linearGradient>
      <linearGradient id="d_accent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#2563eb"/>
        <stop offset="100%" stop-color="#4f46e5"/>
      </linearGradient>
      <linearGradient id="d_emerald" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#059669"/>
        <stop offset="100%" stop-color="#10b981"/>
      </linearGradient>
    </defs>

    <!-- App Window Frame -->
    <rect width="1280" height="720" fill="url(#d_bg)"/>

    <!-- Top Window Controls -->
    <rect x="0" y="0" width="1280" height="40" fill="#0b1120"/>
    <circle cx="24" cy="20" r="6" fill="#ef4444"/>
    <circle cx="44" cy="20" r="6" fill="#f59e0b"/>
    <circle cx="64" cy="20" r="6" fill="#10b981"/>
    <text x="640" y="25" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" text-anchor="middle">EduNova Pro — Système de Gestion Académique &amp; Financière</text>

    <!-- Sidebar -->
    <rect x="0" y="40" width="240" height="680" fill="#0f172a"/>
    <!-- Logo item -->
    <rect x="20" y="60" width="200" height="48" rx="12" fill="rgba(255,255,255,0.06)"/>
    <circle cx="44" cy="84" r="14" fill="#3b82f6"/>
    <text x="68" y="90" fill="#ffffff" font-family="sans-serif" font-size="16" font-weight="bold">EduNova Pro</text>

    <!-- Nav items -->
    <rect x="20" y="128" width="200" height="38" rx="10" fill="#2563eb"/>
    <text x="60" y="152" fill="#ffffff" font-family="sans-serif" font-size="13" font-weight="600">Tableau de bord</text>
    
    <rect x="20" y="174" width="200" height="36" rx="8" fill="transparent"/>
    <text x="60" y="197" fill="#94a3b8" font-family="sans-serif" font-size="13" font-weight="500">Gestion Élèves</text>

    <rect x="20" y="216" width="200" height="36" rx="8" fill="transparent"/>
    <text x="60" y="239" fill="#94a3b8" font-family="sans-serif" font-size="13" font-weight="500">Classes &amp; Cours</text>

    <rect x="20" y="258" width="200" height="36" rx="8" fill="transparent"/>
    <text x="60" y="281" fill="#94a3b8" font-family="sans-serif" font-size="13" font-weight="500">Bulletins &amp; Notes</text>

    <rect x="20" y="300" width="200" height="36" rx="8" fill="transparent"/>
    <text x="60" y="323" fill="#94a3b8" font-family="sans-serif" font-size="13" font-weight="500">Économat &amp; Frais</text>

    <rect x="20" y="342" width="200" height="36" rx="8" fill="transparent"/>
    <text x="60" y="365" fill="#94a3b8" font-family="sans-serif" font-size="13" font-weight="500">Ressources Humaines</text>

    <!-- Main Content Area -->
    <rect x="240" y="40" width="1040" height="680" fill="#f1f5f9"/>

    <!-- Header bar -->
    <rect x="240" y="40" width="1040" height="64" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
    <text x="272" y="80" fill="#0f172a" font-family="sans-serif" font-size="22" font-weight="800">Vue d'ensemble Institutionnelle</text>
    <rect x="1100" y="54" width="150" height="36" rx="18" fill="#2563eb"/>
    <text x="1175" y="77" fill="#ffffff" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">+ Inscription</text>

    <!-- KPI Metric Cards -->
    <g transform="translate(272, 128)">
      <!-- Card 1 -->
      <rect x="0" y="0" width="230" height="110" rx="16" fill="url(#d_card)" stroke="#e2e8f0" stroke-width="1"/>
      <text x="20" y="36" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="700" text-transform="uppercase">Élèves Inscrits</text>
      <text x="20" y="78" fill="#0f172a" font-family="sans-serif" font-size="30" font-weight="900">1,248</text>
      <rect x="170" y="24" width="40" height="40" rx="12" fill="#dbeafe"/>

      <!-- Card 2 -->
      <rect x="250" y="0" width="230" height="110" rx="16" fill="url(#d_card)" stroke="#e2e8f0" stroke-width="1"/>
      <text x="270" y="36" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="700" text-transform="uppercase">Taux de Présence</text>
      <text x="270" y="78" fill="#059669" font-family="sans-serif" font-size="30" font-weight="900">96.4%</text>
      <rect x="420" y="24" width="40" height="40" rx="12" fill="#d1fae5"/>

      <!-- Card 3 -->
      <rect x="500" y="0" width="230" height="110" rx="16" fill="url(#d_card)" stroke="#e2e8f0" stroke-width="1"/>
      <text x="520" y="36" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="700" text-transform="uppercase">Recouvrement</text>
      <text x="520" y="78" fill="#2563eb" font-family="sans-serif" font-size="30" font-weight="900">89.2%</text>
      <rect x="670" y="24" width="40" height="40" rx="12" fill="#e0e7ff"/>

      <!-- Card 4 -->
      <rect x="750" y="0" width="226" height="110" rx="16" fill="url(#d_card)" stroke="#e2e8f0" stroke-width="1"/>
      <text x="770" y="36" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="700" text-transform="uppercase">Enseignants &amp; Staff</text>
      <text x="770" y="78" fill="#7c3aed" font-family="sans-serif" font-size="30" font-weight="900">64 Actifs</text>
      <rect x="916" y="24" width="40" height="40" rx="12" fill="#f3e8ff"/>
    </g>

    <!-- Big Chart and Activity Panels -->
    <g transform="translate(272, 262)">
      <!-- Main Chart Card -->
      <rect x="0" y="0" width="600" height="390" rx="18" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <text x="24" y="36" fill="#0f172a" font-family="sans-serif" font-size="16" font-weight="800">Évolution Académique &amp; Recouvrement Mensuel</text>
      <!-- Simulated chart bars -->
      <g transform="translate(40, 70)">
        <rect x="20" y="180" width="36" height="90" rx="6" fill="#93c5fd"/>
        <rect x="20" y="130" width="36" height="50" rx="6" fill="#2563eb"/>

        <rect x="90" y="150" width="36" height="120" rx="6" fill="#93c5fd"/>
        <rect x="90" y="100" width="36" height="50" rx="6" fill="#2563eb"/>

        <rect x="160" y="130" width="36" height="140" rx="6" fill="#93c5fd"/>
        <rect x="160" y="70" width="36" height="60" rx="6" fill="#2563eb"/>

        <rect x="230" y="110" width="36" height="160" rx="6" fill="#93c5fd"/>
        <rect x="230" y="50" width="36" height="60" rx="6" fill="#2563eb"/>

        <rect x="300" y="90" width="36" height="180" rx="6" fill="#93c5fd"/>
        <rect x="300" y="30" width="36" height="60" rx="6" fill="#2563eb"/>

        <rect x="370" y="70" width="36" height="200" rx="6" fill="#93c5fd"/>
        <rect x="370" y="10" width="36" height="60" rx="6" fill="#2563eb"/>

        <rect x="440" y="60" width="36" height="210" rx="6" fill="#93c5fd"/>
        <rect x="440" y="0" width="36" height="60" rx="6" fill="#2563eb"/>
      </g>

      <!-- Side Quick Activity Card -->
      <rect x="624" y="0" width="352" height="390" rx="18" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <text x="648" y="36" fill="#0f172a" font-family="sans-serif" font-size="16" font-weight="800">Derniers Encaissements</text>
      
      <!-- List Items -->
      <g transform="translate(648, 64)">
        <rect x="0" y="0" width="304" height="64" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
        <circle cx="32" cy="32" r="16" fill="#d1fae5"/>
        <text x="60" y="28" fill="#0f172a" font-family="sans-serif" font-size="13" font-weight="700">Jean-Baptiste Emmanuel</text>
        <text x="60" y="46" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="500">Scolarité • Terminale S1</text>
        <text x="290" y="37" fill="#059669" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="end">+ 15,000 G</text>

        <rect x="0" y="74" width="304" height="64" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
        <circle cx="32" cy="106" r="16" fill="#dbeafe"/>
        <text x="60" y="102" fill="#0f172a" font-family="sans-serif" font-size="13" font-weight="700">Pierre Lovensky</text>
        <text x="60" y="120" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="500">Frais Inscription • 9e AF</text>
        <text x="290" y="111" fill="#2563eb" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="end">+ $80 USD</text>

        <rect x="0" y="148" width="304" height="64" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
        <circle cx="32" cy="180" r="16" fill="#d1fae5"/>
        <text x="60" y="176" fill="#0f172a" font-family="sans-serif" font-size="13" font-weight="700">Saintil Dorothée</text>
        <text x="60" y="194" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="500">Scolarité 2e Tranche</text>
        <text x="290" y="185" fill="#059669" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="end">+ 22,500 G</text>
      </g>
    </g>
  </svg>
  `;
}

/**
 * High-definition Mobile Screenshot generator (720x1280)
 */
function getMobileScreenshotSvg() {
  return `
  <svg width="720" height="1280" viewBox="0 0 720 1280" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="m_bg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e1b4b"/>
      </linearGradient>
      <linearGradient id="m_card" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#f8fafc"/>
      </linearGradient>
    </defs>

    <!-- Phone Canvas -->
    <rect width="720" height="1280" fill="#f1f5f9"/>

    <!-- Status Bar -->
    <rect width="720" height="48" fill="#ffffff"/>
    <text x="40" y="32" fill="#0f172a" font-family="sans-serif" font-size="16" font-weight="bold">09:41</text>
    <circle cx="630" cy="26" r="6" fill="#0f172a"/>
    <rect x="650" y="20" width="28" height="14" rx="3" fill="#0f172a"/>

    <!-- App Mobile TopBar -->
    <rect x="0" y="48" width="720" height="96" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
    <circle cx="64" cy="96" r="24" fill="#2563eb"/>
    <text x="104" y="94" fill="#0f172a" font-family="sans-serif" font-size="22" font-weight="800">EduNova Mobile</text>
    <text x="104" y="114" fill="#64748b" font-family="sans-serif" font-size="14" font-weight="600">Portail Académique &amp; Économat</text>

    <!-- Welcome Hero Card -->
    <g transform="translate(32, 168)">
      <rect x="0" y="0" width="656" height="200" rx="24" fill="url(#m_bg)"/>
      <text x="36" y="56" fill="#93c5fd" font-family="sans-serif" font-size="14" font-weight="700" text-transform="uppercase">Année Académique 2025-2026</text>
      <text x="36" y="104" fill="#ffffff" font-family="sans-serif" font-size="28" font-weight="900">Institution Sainte Trinité</text>
      <text x="36" y="146" fill="#e2e8f0" font-family="sans-serif" font-size="16" font-weight="500">1,248 Élèves • 64 Enseignants • 96% Présence</text>
    </g>

    <!-- Quick Action Grid -->
    <g transform="translate(32, 396)">
      <!-- Action 1 -->
      <rect x="0" y="0" width="314" height="150" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <circle cx="56" cy="56" r="24" fill="#dbeafe"/>
      <text x="36" y="108" fill="#0f172a" font-family="sans-serif" font-size="18" font-weight="800">Nouvel Élève</text>
      <text x="36" y="130" fill="#64748b" font-family="sans-serif" font-size="13" font-weight="500">Inscrire / Réinscrire</text>

      <!-- Action 2 -->
      <rect x="342" y="0" width="314" height="150" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <circle cx="398" cy="56" r="24" fill="#d1fae5"/>
      <text x="378" y="108" fill="#0f172a" font-family="sans-serif" font-size="18" font-weight="800">Encaisser Frais</text>
      <text x="378" y="130" fill="#64748b" font-family="sans-serif" font-size="13" font-weight="500">Reçu &amp; Relevé rapide</text>

      <!-- Action 3 -->
      <rect x="0" y="174" width="314" height="150" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <circle cx="56" cy="230" r="24" fill="#fef3c7"/>
      <text x="36" y="282" fill="#0f172a" font-family="sans-serif" font-size="18" font-weight="800">Cahier Présence</text>
      <text x="36" y="304" fill="#64748b" font-family="sans-serif" font-size="13" font-weight="500">Appel &amp; Retards</text>

      <!-- Action 4 -->
      <rect x="342" y="174" width="314" height="150" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <circle cx="398" cy="230" r="24" fill="#f3e8ff"/>
      <text x="378" y="282" fill="#0f172a" font-family="sans-serif" font-size="18" font-weight="800">Notes &amp; Bulletins</text>
      <text x="378" y="304" fill="#64748b" font-family="sans-serif" font-size="13" font-weight="500">Calcul &amp; Impression</text>
    </g>

    <!-- Recent Payments Feed -->
    <g transform="translate(32, 750)">
      <text x="8" y="24" fill="#0f172a" font-family="sans-serif" font-size="20" font-weight="800">Versements Récent</text>
      
      <rect x="0" y="44" width="656" height="88" rx="18" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <circle cx="48" cy="88" r="20" fill="#d1fae5"/>
      <text x="84" y="82" fill="#0f172a" font-family="sans-serif" font-size="16" font-weight="700">Dorceus Alex</text>
      <text x="84" y="104" fill="#64748b" font-family="sans-serif" font-size="13">Scolarité • Terminale S1</text>
      <text x="620" y="93" fill="#059669" font-family="sans-serif" font-size="16" font-weight="900" text-anchor="end">+ 15,000 G</text>

      <rect x="0" y="148" width="656" height="88" rx="18" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <circle cx="48" cy="192" r="20" fill="#dbeafe"/>
      <text x="84" y="186" fill="#0f172a" font-family="sans-serif" font-size="16" font-weight="700">Toussaint Mirlande</text>
      <text x="84" y="208" fill="#64748b" font-family="sans-serif" font-size="13">Inscription • 3e AF</text>
      <text x="620" y="197" fill="#2563eb" font-family="sans-serif" font-size="16" font-weight="900" text-anchor="end">+ $80 USD</text>

      <rect x="0" y="252" width="656" height="88" rx="18" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
      <circle cx="48" cy="296" r="20" fill="#d1fae5"/>
      <text x="84" y="290" fill="#0f172a" font-family="sans-serif" font-size="16" font-weight="700">Jean Paul Stanley</text>
      <text x="84" y="312" fill="#64748b" font-family="sans-serif" font-size="13">Frais Divers Examens</text>
      <text x="620" y="301" fill="#059669" font-family="sans-serif" font-size="16" font-weight="900" text-anchor="end">+ 5,000 G</text>
    </g>

    <!-- Bottom Navigation Bar -->
    <rect x="0" y="1170" width="720" height="110" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
    <circle cx="360" cy="1210" r="32" fill="#2563eb"/>
    <text x="360" y="1218" fill="#ffffff" font-family="sans-serif" font-size="28" font-weight="bold" text-anchor="middle">+</text>
  </svg>
  `;
}

async function run() {
  const publicDir = path.join(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const iconSizes = [72, 96, 128, 144, 152, 180, 192, 256, 384, 512];

  console.log('🚀 Generating pristine PWA icons and assets with sharp...');

  for (const size of iconSizes) {
    const svg = getIconSvg(size, false);
    const fileName = size === 180 ? 'apple-touch-icon.png' : `pwa-${size}x${size}.png`;
    const dest = path.join(publicDir, fileName);
    await sharp(Buffer.from(svg)).png().toFile(dest);
    console.log(`✅ Generated ${fileName} (${size}x${size})`);
  }

  // Maskable icons (with proper padding)
  const maskableSizes = [192, 512];
  for (const size of maskableSizes) {
    const svg = getIconSvg(size, true);
    const fileName = `pwa-maskable-${size}x${size}.png`;
    const dest = path.join(publicDir, fileName);
    await sharp(Buffer.from(svg)).png().toFile(dest);
    console.log(`✅ Generated ${fileName} (${size}x${size} maskable)`);
  }

  // Favicons and Logo
  const favSvg = getIconSvg(64, false);
  await sharp(Buffer.from(favSvg)).png().toFile(path.join(publicDir, 'favicon.png'));
  await sharp(Buffer.from(favSvg)).resize(32, 32).png().toFile(path.join(publicDir, 'favicon.ico'));
  await sharp(Buffer.from(getIconSvg(512, false))).png().toFile(path.join(publicDir, 'logo.png'));
  console.log('✅ Generated favicon.png, favicon.ico and logo.png');

  // Screenshots
  const desktopSvg = getDesktopScreenshotSvg();
  await sharp(Buffer.from(desktopSvg)).png().toFile(path.join(publicDir, 'screenshot-desktop.png'));
  console.log('✅ Generated screenshot-desktop.png (1280x720)');

  const mobileSvg = getMobileScreenshotSvg();
  await sharp(Buffer.from(mobileSvg)).png().toFile(path.join(publicDir, 'screenshot-mobile.png'));
  console.log('✅ Generated screenshot-mobile.png (720x1280)');

  console.log('\n🎉 All PWA assets generated with 100% valid PNG headers and sizes!');
}

run().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
