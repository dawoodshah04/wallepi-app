import GIFEncoder from 'gif-encoder-2';
import { createCanvas, Image } from 'canvas';
import sharp from 'sharp';
import { createWriteStream } from 'fs';
import { join } from 'path';

const artifactDir = "C:\\Users\\DCOMPUTER\\.gemini\\antigravity-ide\\brain\\b7455c8d-9c6c-44fb-a380-7a9d66629c62";
const gifPath = join(artifactDir, "splash_concept.gif");

async function main() {
  const width = 360;
  const height = 480;
  const totalFrames = 45;

  const encoder = new GIFEncoder(width, height);
  const writeStream = createWriteStream(gifPath);
  encoder.createReadStream().pipe(writeStream);

  encoder.start();
  encoder.setRepeat(0);   // 0 = loop
  encoder.setDelay(40);   // 40ms ~ 25 FPS
  encoder.setQuality(10);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  console.log(`Rendering ${totalFrames} exact SVG frames matching preview HTML...`);

  for (let i = 0; i < totalFrames; i++) {
    const p = i / (totalFrames - 1); // 0.0 to 1.0

    // Animation progress timings matching preview HTML exactly:
    // 0.00 - 0.40: 'wallep' draws in white
    // 0.40 - 0.58: 'i' stem draws slower in white
    // 0.58 - 0.66: Electric Lime (#CCFF00) dot pops fast & bounces onto 'i' stem (x:239, y:324)
    // 0.66 - 1.00: Full logo glows & holds

    let wallepDashOffset = Math.max(0, 380 - (p / 0.40) * 380);
    let wallepFillOpacity = Math.max(0, Math.min(1, (p - 0.30) / 0.12));

    let iDashOffset = p < 0.40 ? 80 : Math.max(0, 80 - ((p - 0.40) / 0.18) * 80);
    let iFillOpacity = Math.max(0, Math.min(1, (p - 0.50) / 0.10));

    let dotProgress = Math.max(0, Math.min(1, (p - 0.56) / 0.08));
    let glowOpacity = Math.max(0, Math.min(1, (p - 0.56) / 0.12)) * (1 - Math.max(0, (p - 0.88) / 0.12));

    // Calculate dot position & scale during fast bounce
    let dotY = 300 - Math.sin(dotProgress * Math.PI) * 18;
    let dotScale = dotProgress > 0 ? (1 + Math.sin(dotProgress * Math.PI) * 0.4) : 0;
    let dotOpacity = dotProgress > 0 ? 1 : 0;

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .wallep-stroke {
          font-family: 'Dancing Script', 'Brush Script MT', 'Segoe Script', cursive;
          font-size: 78px;
          font-weight: 700;
          fill: none;
          stroke: #ffffff;
          stroke-width: 2.6;
          stroke-dasharray: 380;
          stroke-dashoffset: ${wallepDashOffset};
          stroke-linecap: round;
        }
        .wallep-fill {
          font-family: 'Dancing Script', 'Brush Script MT', 'Segoe Script', cursive;
          font-size: 78px;
          font-weight: 700;
          fill: #ffffff;
          opacity: ${wallepFillOpacity};
        }
        .i-stroke {
          font-family: 'Dancing Script', 'Brush Script MT', 'Segoe Script', cursive;
          font-size: 78px;
          font-weight: 700;
          fill: none;
          stroke: #ffffff;
          stroke-width: 2.6;
          stroke-dasharray: 80;
          stroke-dashoffset: ${iDashOffset};
          stroke-linecap: round;
        }
        .i-fill {
          font-family: 'Dancing Script', 'Brush Script MT', 'Segoe Script', cursive;
          font-size: 78px;
          font-weight: 700;
          fill: #ffffff;
          opacity: ${iFillOpacity};
        }
      </style>
      <rect width="100%" height="100%" fill="#000000"/>
      
      <!-- Radial Glow -->
      ${glowOpacity > 0 ? `
        <circle cx="180" cy="240" r="140" fill="#CCFF00" opacity="${glowOpacity * 0.25}"/>
      ` : ''}

      <!-- Wallep (White) -->
      <text x="50" y="260" class="wallep-fill">wallep</text>
      <text x="50" y="260" class="wallep-stroke">wallep</text>

      <!-- Stem of 'i' (Dotless 'ı') (Slower White) -->
      <text x="232" y="260" class="i-fill">ı</text>
      <text x="232" y="260" class="i-stroke">ı</text>

      <!-- Electric Lime Dot on 'i' -->
      ${dotOpacity > 0 ? `
        <circle cx="259" cy="${dotY}" r="${6 * dotScale}" fill="#CCFF00" opacity="${dotOpacity}"/>
      ` : ''}
    </svg>
    `;

    // Render SVG into PNG buffer using Sharp
    const pngBuffer = await sharp(Buffer.from(svg)).toFormat('png').toBuffer();
    
    // Draw PNG onto Canvas frame for GIF encoder
    const img = new Image();
    img.src = pngBuffer;
    ctx.drawImage(img, 0, 0);

    encoder.addFrame(ctx);
  }

  encoder.finish();
  console.log(`✅ Successfully generated exact preview GIF at ${gifPath}`);
}

main().catch(console.error);
