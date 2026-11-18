#!/usr/bin/env node
/**
 * Script d'initialisation automatique de l'environnement local EduNova Pro (.env.local)
 * Zéro dépendance externe : utilise exclusivement `node:crypto`, `node:fs`, `node:os`, `node:path`.
 *
 * Usage :
 *   node deploy/local-lan/setup-local-env.mjs
 *   node deploy/local-lan/setup-local-env.mjs --mode=standalone
 *   node deploy/local-lan/setup-local-env.mjs --mode=lan --ip=192.168.1.100 --label="Collège Saint-Paul" --force
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function signSupabaseJwt(payload, secret) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest();
  return `${header}.${body}.${base64UrlEncode(signature)}`;
}

export function detectPrimaryLanIp() {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const iface of entries) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (
          iface.address.startsWith('192.168.') ||
          iface.address.startsWith('10.') ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(iface.address)
        ) {
          return iface.address;
        }
      }
    }
  }
  return null;
}

export function generateLocalEnvConfig(options = {}) {
  const mode = options.mode === 'standalone' ? 'standalone' : 'lan';
  const serverIp = (options.ip || (mode === 'lan' ? detectPrimaryLanIp() : null) || 'localhost').trim();
  const port = Number(options.port || 3000);
  const label = (
    options.label ||
    (mode === 'standalone' ? 'Poste Autonome EduNova Pro' : 'Serveur Local Établissement')
  ).replace(/[\r\n"]/g, '');

  const postgresPassword = crypto.randomBytes(20).toString('hex');
  const jwtSecret = crypto.randomBytes(36).toString('base64url');
  const encryptionKey = crypto.randomBytes(32).toString('hex');
  const demoSecret = crypto.randomBytes(32).toString('hex');

  const iat = Math.floor(Date.now() / 1000);
  // 10 ans de validité pour le réseau local autonome
  const exp = iat + 10 * 365 * 24 * 60 * 60;

  const anonKey = signSupabaseJwt(
    {
      role: 'anon',
      iss: 'supabase',
      iat,
      exp,
    },
    jwtSecret
  );

  const serviceRoleKey = signSupabaseJwt(
    {
      role: 'service_role',
      iss: 'supabase',
      iat,
      exp,
    },
    jwtSecret
  );

  const bindHost = mode === 'standalone' ? '127.0.0.1' : '0.0.0.0';
  const baseUrl = `http://${serverIp}:${port}`;
  const redirectList =
    mode === 'lan' && serverIp !== 'localhost'
      ? `http://localhost:${port}/*,http://127.0.0.1:${port}/*,${baseUrl}/*`
      : `http://localhost:${port}/*,http://127.0.0.1:${port}/*`;

  const envContent = [
    '# ==============================================================================',
    `# Généré automatiquement par setup-local-env.mjs le ${new Date().toISOString()}`,
    `# Mode : ${mode === 'lan' ? 'Serveur Local Établissement (LAN)' : 'Poste Autonome (PC Unique)'}`,
    '# ==============================================================================',
    `EDUNOVA_DEPLOYMENT_MODE=${mode}`,
    `LAN_SERVER_LABEL=${label}`,
    `BIND_HOST=${bindHost}`,
    `APP_PORT=${port}`,
    '',
    'PG_BIND_HOST=127.0.0.1',
    'POSTGRES_PORT=5432',
    'KONG_BIND_HOST=127.0.0.1',
    'KONG_HTTP_PORT=8000',
    '',
    'POSTGRES_DB=postgres',
    `POSTGRES_PASSWORD=${postgresPassword}`,
    `JWT_SECRET=${jwtSecret}`,
    'JWT_EXPIRY=3600',
    '',
    `ANON_KEY=${anonKey}`,
    `SERVICE_ROLE_KEY=${serviceRoleKey}`,
    `ENCRYPTION_KEY=${encryptionKey}`,
    `DEMO_REQUEST_SECRET=${demoSecret}`,
    '',
    'ENABLE_EMAIL_AUTOCONFIRM=true',
    'DISABLE_SIGNUP=false',
    '',
    `APP_URL=${baseUrl}`,
    `SITE_URL=${baseUrl}`,
    `API_EXTERNAL_URL=${baseUrl}/local-supabase`,
    `VITE_SUPABASE_URL=${baseUrl}/local-supabase`,
    `ADDITIONAL_REDIRECT_URLS=${redirectList}`,
    '',
  ].join('\n');

  return {
    mode,
    bindHost,
    baseUrl,
    anonKey,
    serviceRoleKey,
    jwtSecret,
    envContent,
  };
}

function parseArgs(argv) {
  const result = {};
  for (const arg of argv) {
    if (arg === '--force') result.force = true;
    else if (arg.startsWith('--mode=')) result.mode = arg.slice('--mode='.length);
    else if (arg.startsWith('--ip=')) result.ip = arg.slice('--ip='.length);
    else if (arg.startsWith('--port=')) result.port = arg.slice('--port='.length);
    else if (arg.startsWith('--label=')) result.label = arg.slice('--label='.length);
    else if (arg.startsWith('--out=')) result.out = arg.slice('--out='.length);
  }
  return result;
}

const isCliRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCliRun) {
  const args = parseArgs(process.argv.slice(2));
  const targetPath = path.resolve(process.cwd(), args.out || '.env.local');

  if (fs.existsSync(targetPath) && !args.force) {
    console.error(
      `[EduNova Local] Le fichier ${targetPath} existe déjà. Utilisez --force pour le régénérer (attention : cela change les mots de passe si le volume DB existe déjà).`
    );
    process.exit(1);
  }

  const generated = generateLocalEnvConfig(args);
  fs.writeFileSync(targetPath, generated.envContent, { encoding: 'utf8', mode: 0o600 });

  console.log('');
  console.log('====================================================================');
  console.log('  EduNova Pro — Configuration Locale Générée (.env.local)');
  console.log('====================================================================');
  console.log(`  Mode          : ${generated.mode === 'lan' ? 'Serveur Local (LAN Multi-PC)' : 'Poste Autonome (PC Unique)'}`);
  console.log(`  Écoute        : ${generated.bindHost}:3000`);
  console.log(`  URL d'accès   : ${generated.baseUrl}`);
  console.log(`  Fichier écrit : ${targetPath}`);
  console.log('');
  console.log('  Prochaine étape :');
  console.log('    docker compose -f docker-compose.local.yml --env-file .env.local up -d --build');
  console.log('====================================================================');
  console.log('');
}
