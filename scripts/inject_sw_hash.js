import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.resolve(__dirname, '..', 'dist');
const swDistPath = path.join(distDir, 'sw.js');

const renderGitCommit = process.env.RENDER_GIT_COMMIT || '';
const deployHash = renderGitCommit 
  ? `render-${renderGitCommit.substring(0, 10)}` 
  : `edunova-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
const buildTimestamp = new Date().toISOString();

if (fs.existsSync(swDistPath)) {
  let content = fs.readFileSync(swDistPath, 'utf-8');
  const header = `/**\n * EduNova Pro - Render Service Worker Cache Buster\n * Deployment Hash: ${deployHash}\n * Build Timestamp: ${buildTimestamp}\n */\n`;
  
  if (!content.includes('Deployment Hash:')) {
    content = header + content;
  } else {
    content = content.replace(/\/\*\*[\s\S]*?Deployment Hash:[\s\S]*?\*\/\n/, header);
  }
  
  fs.writeFileSync(swDistPath, content, 'utf-8');
  console.log(`✨ [Render SW Buster] Service Worker dist/sw.js stamped with deploy hash: ${deployHash}`);
} else {
  console.warn(`⚠️ [Render SW Buster] dist/sw.js not found at ${swDistPath}`);
}
