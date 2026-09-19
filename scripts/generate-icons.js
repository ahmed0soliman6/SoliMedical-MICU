import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generateIcons() {
  const svgPath = path.resolve('public/logo.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  const targets = [
    { name: 'pwa-192x192.png', width: 192, height: 192 },
    { name: 'icon-192.png', width: 192, height: 192 },
    { name: 'pwa-512x512.png', width: 512, height: 512 },
    { name: 'apple-touch-icon.png', width: 180, height: 180 },
    { name: 'apple-touch-icon-precomposed.png', width: 180, height: 180 },
    { name: 'favicon-32x32.png', width: 32, height: 32 },
    { name: 'favicon-16x16.png', width: 16, height: 16 },
  ];

  console.log('Generating PWA standard PNG icons...');
  for (const t of targets) {
    const outPath = path.resolve('public', t.name);
    await sharp(svgBuffer)
      .resize(t.width, t.height)
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(outPath);
    console.log(`Generated: ${t.name} (${t.width}x${t.height})`);
  }

  // Maskable icon with 15% safe padding
  // Canvas 512x512 with background #070d18 and inner logo ~410x410 centered
  console.log('Generating maskable icon...');
  const innerLogoBuffer = await sharp(svgBuffer)
    .resize(410, 410)
    .png()
    .toBuffer();

  const maskablePath = path.resolve('public/pwa-maskable-512x512.png');
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 7, g: 13, b: 24, alpha: 1 } // #070d18
    }
  })
  .composite([{ input: innerLogoBuffer, gravity: 'center' }])
  .png({ quality: 100 })
  .toFile(maskablePath);
  console.log('Generated: pwa-maskable-512x512.png (512x512 maskable with safe zone)');

  console.log('All icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
