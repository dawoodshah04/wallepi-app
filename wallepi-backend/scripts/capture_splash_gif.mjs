/**
 * capture_splash_gif.mjs
 *
 * Uses puppeteer-core + system Chrome to open splash_preview.html,
 * steps through CSS animations frame-by-frame, and encodes to animated GIF.
 *
 * Run:  node scripts/capture_splash_gif.mjs
 */

import puppeteer from 'puppeteer-core';
import GIFEncoder from 'gif-encoder-2';
import { createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const HTML_PATH = path.resolve(
  'C:/Users/DCOMPUTER/.gemini/antigravity-ide/brain/b7455c8d-9c6c-44fb-a380-7a9d66629c62/splash_preview.html'
);
const OUTPUT_GIF = path.resolve(
  'C:/Users/DCOMPUTER/.gemini/antigravity-ide/brain/b7455c8d-9c6c-44fb-a380-7a9d66629c62/splash_concept.gif'
);

// --- Animation settings (must match HTML) ---
const ANIM_DURATION_MS = 3800;   // total animation cycle (3.8s)
const FPS = 20;                   // output FPS (20 = good quality, manageable file size)
const TOTAL_FRAMES = Math.ceil((ANIM_DURATION_MS / 1000) * FPS); // 76 frames
const FRAME_DELAY_MS = Math.round(1000 / FPS);                    // 50ms

// Device viewport - just the inner canvas (no outer page chrome needed)
const VIEWPORT = { width: 360, height: 720 };

async function captureFrames(page) {
  const frames = [];

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const progress = i / (TOTAL_FRAMES - 1); // 0.0 → 1.0
    const timeMs = progress * ANIM_DURATION_MS;

    // Seek all CSS animations to this exact time point
    await page.evaluate((t) => {
      document.getAnimations().forEach(anim => {
        anim.currentTime = t;
        anim.pause();
      });
    }, timeMs);

    // Wait one paint cycle
    await new Promise(r => setTimeout(r, 20));

    // Screenshot just the device frame element
    const deviceFrame = await page.$('.device-frame');
    const pngBuffer = deviceFrame
      ? await deviceFrame.screenshot({ type: 'png' })
      : await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height } });

    frames.push(pngBuffer);

    if (i % 10 === 0 || i === TOTAL_FRAMES - 1) {
      process.stdout.write(`  Frame ${i + 1}/${TOTAL_FRAMES} (${(progress * 100).toFixed(0)}% of animation)\n`);
    }
  }

  return frames;
}

async function encodeGIF(frames, gifWidth, gifHeight) {
  return new Promise((resolve, reject) => {
    const encoder = new GIFEncoder(gifWidth, gifHeight, 'neuquant', true);
    const fileStream = createWriteStream(OUTPUT_GIF);

    encoder.createReadStream().pipe(fileStream);
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);

    encoder.start();
    encoder.setRepeat(0);             // loop forever
    encoder.setDelay(FRAME_DELAY_MS);
    encoder.setQuality(10);

    (async () => {
      for (let i = 0; i < frames.length; i++) {
        const { data, info } = await sharp(frames[i])
          .resize(gifWidth, gifHeight)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        encoder.addFrame(data);

        if (i % 10 === 0 || i === frames.length - 1) {
          process.stdout.write(`  Encoding frame ${i + 1}/${frames.length}\n`);
        }
      }

      encoder.finish();
    })().catch(reject);
  });
}

(async () => {
  console.log('🚀 Launching Chrome (puppeteer-core)...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-web-security',
      '--allow-file-access-from-files',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 900 }); // larger viewport so device-frame fits

  console.log('📄 Loading splash_preview.html...');
  await page.goto(`file:///${HTML_PATH.replace(/\\/g, '/')}`, {
    waitUntil: 'networkidle0',
  });

  // Wait for Google Fonts to load
  console.log('⏳ Waiting for fonts to load...');
  await new Promise(r => setTimeout(r, 2500));

  // Get actual device frame dimensions for GIF encoder
  const deviceFrame = await page.$('.device-frame');
  const box = await deviceFrame.boundingBox();
  const gifWidth = Math.round(box.width);
  const gifHeight = Math.round(box.height);
  console.log(`📐 Device frame: ${gifWidth}×${gifHeight}px`);

  // Pause all animations at t=0
  await page.evaluate(() => {
    document.getAnimations().forEach(anim => {
      anim.currentTime = 0;
      anim.pause();
    });
  });

  console.log(`\n🎬 Capturing ${TOTAL_FRAMES} frames at ${FPS} FPS (${ANIM_DURATION_MS}ms animation)...`);
  const frames = await captureFrames(page);

  await browser.close();
  console.log('\n✅ All frames captured. Encoding GIF...');

  console.log(`\n🖼️  Encoding ${frames.length} frames → ${OUTPUT_GIF}`);
  await encodeGIF(frames, gifWidth, gifHeight);

  console.log(`\n🎉 Done! GIF saved to:\n   ${OUTPUT_GIF}`);
})();
