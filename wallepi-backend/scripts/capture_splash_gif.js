/**
 * capture_splash_gif.js
 *
 * Uses Puppeteer to open splash_preview.html, pause all CSS animations at
 * specific progress points (matching the keyframe percentages), screenshot
 * each frame, and encode them into an animated GIF using gif-encoder-2.
 *
 * Run:  node scripts/capture_splash_gif.js
 */

const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const GIFEncoder = require('gif-encoder-2');
const { createWriteStream } = require('fs');
const path = require('path');
const { Writable } = require('stream');

const HTML_PATH = path.resolve(
  'C:/Users/DCOMPUTER/.gemini/antigravity-ide/brain/b7455c8d-9c6c-44fb-a380-7a9d66629c62/splash_preview.html'
);
const OUTPUT_GIF = path.resolve(
  'C:/Users/DCOMPUTER/.gemini/antigravity-ide/brain/b7455c8d-9c6c-44fb-a380-7a9d66629c62/splash_concept.gif'
);

// --- Animation settings (must match HTML) ---
const ANIM_DURATION_MS = 3800;   // total animation cycle (3.8 s)
const FPS = 25;                   // output frames per second
const TOTAL_FRAMES = Math.ceil((ANIM_DURATION_MS / 1000) * FPS); // ~95 frames
const FRAME_DELAY_MS = Math.round(1000 / FPS);                    // 40 ms

// Device viewport (matches .device-frame size in HTML)
const VIEWPORT = { width: 360, height: 720 };

async function captureFrames(page) {
  const frames = [];

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    // Progress through the animation (0 → 1)
    const progress = i / (TOTAL_FRAMES - 1);
    const timeMs = progress * ANIM_DURATION_MS;

    // Pause all animations at exactly timeMs using the Web Animations API
    await page.evaluate((t) => {
      // Grab every element that has a running animation
      document.getAnimations().forEach(anim => {
        anim.currentTime = t;
        anim.pause();
      });
    }, timeMs);

    // Small settle delay so Chrome flushes the paint
    await new Promise(r => setTimeout(r, 16));

    const pngBuffer = await page.screenshot({
      clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
      type: 'png',
    });

    frames.push(pngBuffer);

    if (i % 10 === 0) {
      process.stdout.write(`  Frame ${i + 1}/${TOTAL_FRAMES} (${(progress * 100).toFixed(0)}%)\n`);
    }
  }

  return frames;
}

async function encodeGIF(frames) {
  return new Promise((resolve, reject) => {
    const encoder = new GIFEncoder(VIEWPORT.width, VIEWPORT.height, 'neuquant', true);
    const fileStream = createWriteStream(OUTPUT_GIF);

    encoder.createReadStream().pipe(fileStream);
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);

    encoder.start();
    encoder.setRepeat(0);           // loop forever
    encoder.setDelay(FRAME_DELAY_MS);
    encoder.setQuality(10);

    // gif-encoder-2 needs raw RGBA pixel data. We decode each PNG using
    // sharp (already installed in this project).
    const sharp = require('sharp');

    (async () => {
      for (let i = 0; i < frames.length; i++) {
        const { data } = await sharp(frames[i])
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        encoder.addFrame(data);

        if (i % 10 === 0) {
          process.stdout.write(`  Encoding frame ${i + 1}/${frames.length}\n`);
        }
      }

      encoder.finish();
      console.log('\n✅ GIF encoding complete!');
    })().catch(reject);
  });
}

(async () => {
  console.log('🚀 Launching Puppeteer with Chromium...');
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
  await page.setViewport(VIEWPORT);

  // Load the HTML file
  console.log('📄 Loading splash_preview.html...');
  await page.goto(`file://${HTML_PATH.replace(/\\/g, '/')}`, {
    waitUntil: 'networkidle0',
  });

  // Wait for Google Fonts to load (they're in the HTML <link>)
  await new Promise(r => setTimeout(r, 2000));

  // Start all animations from t=0, then immediately pause so we control time
  await page.evaluate(() => {
    document.getAnimations().forEach(anim => {
      anim.currentTime = 0;
      anim.pause();
    });
  });

  console.log(`\n🎬 Capturing ${TOTAL_FRAMES} frames at ${FPS} FPS (${ANIM_DURATION_MS}ms animation)...`);
  const frames = await captureFrames(page);

  await browser.close();

  console.log(`\n🖼️  Encoding ${frames.length} frames into animated GIF...`);
  console.log(`   Output: ${OUTPUT_GIF}`);
  await encodeGIF(frames);

  console.log(`\n🎉 Done! GIF saved to:\n   ${OUTPUT_GIF}`);
})();
