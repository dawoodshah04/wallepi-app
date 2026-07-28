import GIFEncoder from 'gif-encoder-2';
import { createCanvas } from 'canvas';
import { createWriteStream } from 'fs';
import { join } from 'path';

const artifactDir = "C:\\Users\\DCOMPUTER\\.gemini\\antigravity-ide\\brain\\b7455c8d-9c6c-44fb-a380-7a9d66629c62";
const gifPath = join(artifactDir, "splash_concept.gif");

async function main() {
  const width = 360;
  const height = 480;
  const totalFrames = 40;

  const encoder = new GIFEncoder(width, height);
  const writeStream = createWriteStream(gifPath);
  encoder.createReadStream().pipe(writeStream);

  encoder.start();
  encoder.setRepeat(0);   // 0 = loop forever
  encoder.setDelay(40);   // 40ms per frame ~ 25 FPS
  encoder.setQuality(10); // high GIF quality

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < totalFrames; i++) {
    const p = i / (totalFrames - 1); // 0.0 to 1.0

    // Clear background to Pure Dark Mode #000000
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Timing breakdown matching HTML preview:
    // 0.00 - 0.40: White cursive "wallep" draws
    // 0.40 - 0.58: Slower white "i" stem draws
    // 0.58 - 0.64: Electric Lime Green (#CCFF00) dot pops fast onto 'i'
    // 0.64 - 1.00: Full logo glows with green aura and holds

    let strokeWallepP = Math.min(1, p / 0.40);
    let strokeIP = Math.max(0, Math.min(1, (p - 0.40) / 0.18));
    let dotP = Math.max(0, Math.min(1, (p - 0.58) / 0.08));

    // 1. Ambient Glow
    if (dotP > 0) {
      const radGrad = ctx.createRadialGradient(180, 240, 0, 180, 240, 140);
      radGrad.addColorStop(0, `rgba(204, 255, 0, ${dotP * 0.35})`);
      radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(180, 240, 140, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. White "wallep"
    if (strokeWallepP > 0) {
      ctx.save();
      ctx.globalAlpha = strokeWallepP;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'italic bold 52px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('wallep', 50, 240);
      ctx.restore();
    }

    // 3. White "ı" stem (slower pace)
    if (strokeIP > 0) {
      ctx.save();
      ctx.globalAlpha = strokeIP;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'italic bold 52px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('ı', 230, 240);
      ctx.restore();
    }

    // 4. Fast Snappy Electric Lime Dot on 'i'
    if (dotP > 0) {
      ctx.save();
      ctx.fillStyle = '#CCFF00';
      ctx.shadowColor = '#CCFF00';
      ctx.shadowBlur = 20;

      const bounceY = 198 + (1 - Math.sin(dotP * Math.PI)) * -18;
      const radius = 6 * Math.min(1, dotP * 1.4);

      ctx.beginPath();
      ctx.arc(238, bounceY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    encoder.addFrame(ctx);
  }

  encoder.finish();
  console.log(`✅ Saved updated animated GIF to ${gifPath}`);
}

main().catch(console.error);
