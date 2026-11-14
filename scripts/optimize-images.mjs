import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ROOT_DIR = process.cwd();
const SRC_IMAGES_DIR = path.join(ROOT_DIR, 'src', 'assets', 'images');
const OUT_DIR = path.join(ROOT_DIR, 'public', 'optimized');

const TARGET_IMAGES = [
  {
    source: 'edunova_hero_leadership_1794531327538.jpg',
    slug: 'hero-leadership',
    widths: [480, 960, 1280],
    aspect: '3:2'
  },
  {
    source: 'edunova_bursar_mobile_1794531328203.jpg',
    slug: 'bursar-mobile',
    widths: [480, 960],
    aspect: '3:2'
  },
  {
    source: 'edunova_classroom_excellence_1794531328252.jpg',
    slug: 'classroom-excellence',
    widths: [480, 960],
    aspect: '3:2'
  }
];

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} Ko`;
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('🖼️  [EduNova Image Optimizer] Conversion AVIF / WebP / JPG progressif...');
  let totalOriginalBytes = 0;
  let totalGeneratedBytes = 0;

  for (const item of TARGET_IMAGES) {
    const srcPath = path.join(SRC_IMAGES_DIR, item.source);
    if (!fs.existsSync(srcPath)) {
      console.warn(`⚠️  Image source introuvable : ${srcPath}`);
      continue;
    }

    const srcStat = fs.statSync(srcPath);
    totalOriginalBytes += srcStat.size;
    console.log(`\n📄 Source : ${item.source} (${formatKB(srcStat.size)})`);

    for (const width of item.widths) {
      const pipeline = sharp(srcPath).rotate().resize({
        width,
        withoutEnlargement: true,
        fit: 'inside'
      });

      const avifPath = path.join(OUT_DIR, `${item.slug}-${width}.avif`);
      const webpPath = path.join(OUT_DIR, `${item.slug}-${width}.webp`);
      const jpgPath = path.join(OUT_DIR, `${item.slug}-${width}.jpg`);

      await pipeline
        .clone()
        .avif({ quality: 50, effort: 5, chromaSubsampling: '4:2:0' })
        .toFile(avifPath);

      await pipeline
        .clone()
        .webp({ quality: 78, effort: 5 })
        .toFile(webpPath);

      await pipeline
        .clone()
        .jpeg({ quality: 78, progressive: true, mozjpeg: true })
        .toFile(jpgPath);

      const avifSize = fs.statSync(avifPath).size;
      const webpSize = fs.statSync(webpPath).size;
      const jpgSize = fs.statSync(jpgPath).size;
      totalGeneratedBytes += avifSize + webpSize + jpgSize;

      console.log(
        `   ├─ ${width}w -> AVIF: ${formatKB(avifSize)} | WebP: ${formatKB(webpSize)} | JPG: ${formatKB(jpgSize)}`
      );
    }
  }

  console.log('\n✅ Optimisation terminée.');
  console.log(`   Total sources JPG brutes : ${formatKB(totalOriginalBytes)}`);
  console.log(`   Total variantes générées (960w AVIF+WebP+JPG incl.) : ${formatKB(totalGeneratedBytes)}`);
}

run().catch((err) => {
  console.error('❌ Erreur optimisation images :', err);
  process.exit(1);
});
