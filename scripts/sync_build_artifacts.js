import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const distDir = path.join(rootDir, 'dist');
const buildDir = path.join(rootDir, 'build');

if (fs.existsSync(distDir)) {
  fs.cpSync(distDir, buildDir, { recursive: true });
  console.log('✅ [Build Artifacts Sync] Build artifacts mirrored to build/ directory successfully.');
  
  const outputPublicDir = path.join(rootDir, '.output', 'public');
  fs.mkdirSync(outputPublicDir, { recursive: true });
  fs.cpSync(distDir, outputPublicDir, { recursive: true });
  console.log('✅ [Build Artifacts Sync] Build artifacts mirrored to .output/public directory successfully.');
} else {
  console.warn('⚠️ [Build Artifacts Sync] dist/ not found to mirror.');
}
