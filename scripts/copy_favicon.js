import fs from 'fs';
import path from 'path';

const srcIco = path.join(process.cwd(), 'public', 'favicon.ico');
const srcPng = path.join(process.cwd(), 'public', 'favicon.png');
const srcLogo = path.join(process.cwd(), 'public', 'logo.png');
const distDir = path.join(process.cwd(), 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

try {
  if (fs.existsSync(srcIco)) {
    fs.copyFileSync(srcIco, path.join(distDir, 'favicon.ico'));
    console.log('favicon.ico successfully copied to dist/');
  }
  if (fs.existsSync(srcPng)) {
    fs.copyFileSync(srcPng, path.join(distDir, 'favicon.png'));
    console.log('favicon.png successfully copied to dist/');
  }
  if (fs.existsSync(srcLogo)) {
    fs.copyFileSync(srcLogo, path.join(distDir, 'logo.png'));
    console.log('logo.png successfully copied to dist/');
  }
} catch (e) {
  console.error('Failed to copy favicon or logo:', e);
}
