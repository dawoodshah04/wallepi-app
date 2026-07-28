import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const artifactDir = "C:\\Users\\DCOMPUTER\\.gemini\\antigravity-ide\\brain\\b7455c8d-9c6c-44fb-a380-7a9d66629c62";

// Theme Colors from src/constants/theme.ts
const COLOR_BG = "#000000";
const COLOR_ACCENT = "#CCFF00"; // Wallepi Electric Lime
const COLOR_TEXT = "#FFFFFF";
const COLOR_SECONDARY = "#707070";
const COLOR_ELEMENT = "#121212";

async function main() {
  const width = 480;
  const height = 480;
  const totalFrames = 50;
  const frameCompositeInputs = [];

  for (let i = 0; i < totalFrames; i++) {
    const p = i / (totalFrames - 1); // 0 to 1

    // Animation Choreography:
    // 0.00 - 0.25: Electric Lime Dot drops from top to center (with squash/stretch)
    // 0.25 - 0.45: Impact! Dot flattens & produces vibrant electric lime liquid splash rings
    // 0.45 - 0.75: Text "wallep" gracefully scales up & fades in; Dot glides to top of "i"
    // 0.75 - 1.00: Full logo "wallepi" glows with electric lime accent dot and holds

    let dotX = width / 2;
    let dotY = 70;
    let dotRx = 12;
    let dotRy = 12;
    let splashR1 = 0;
    let splashOp1 = 0;
    let splashR2 = 0;
    let splashOp2 = 0;
    let textOpacity = 0;
    let textScale = 0.85;

    if (p < 0.25) {
      // Drop stage with bounce physics
      const progress = p / 0.25;
      const easeIn = progress * progress * progress;
      dotY = 70 + easeIn * (height / 2 - 70);
      // Stretch while falling
      dotRx = 10;
      dotRy = 15;
    } else if (p < 0.45) {
      // Impact & Liquid Splash stage
      const progress = (p - 0.25) / 0.20;
      dotY = height / 2;
      // Squash on impact
      const squash = Math.sin(progress * Math.PI);
      dotRx = 14 + squash * 6;
      dotRy = 14 - squash * 5;

      splashR1 = progress * 110;
      splashOp1 = 1 - progress;

      splashR2 = Math.max(0, (progress - 0.15) * 90);
      splashOp2 = Math.max(0, 1 - progress * 1.1);
    } else if (p < 0.75) {
      // Morph & text reveal stage
      const progress = (p - 0.45) / 0.30;
      // Smooth cubic ease out
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      textOpacity = easeOut;
      textScale = 0.85 + easeOut * 0.15;

      // Move dot from center (240, 240) to top of 'i' in 'wallepi' (approx 346, 210)
      dotX = 240 + easeOut * 106;
      dotY = 240 - easeOut * 30;
      dotRx = 14 - easeOut * 7; // shrink down to 7px dot
      dotRy = 14 - easeOut * 7;
    } else {
      // Hold stage
      textOpacity = 1;
      textScale = 1.0;
      dotX = 346;
      dotY = 210;
      dotRx = 7;
      dotRy = 7;
    }

    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${COLOR_ACCENT}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${COLOR_BG}" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <!-- Pure Dark Mode Background -->
      <rect width="100%" height="100%" fill="${COLOR_BG}"/>
      
      <!-- Subtle Glow behind Center -->
      ${p > 0.2 ? `<circle cx="240" cy="240" r="160" fill="url(#glowGrad)" opacity="${Math.min(0.6, p)}"/>` : ''}

      <!-- Electric Lime Splash Shockwave Rings -->
      ${splashR1 > 0 ? `
        <circle cx="240" cy="240" r="${splashR1}" fill="none" stroke="${COLOR_ACCENT}" stroke-width="3.5" opacity="${splashOp1}"/>
        <circle cx="240" cy="240" r="${splashR1 * 0.65}" fill="none" stroke="${COLOR_ACCENT}" stroke-width="1.5" opacity="${splashOp1 * 0.7}"/>
      ` : ''}
      ${splashR2 > 0 ? `
        <circle cx="240" cy="240" r="${splashR2}" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="${splashOp2 * 0.5}"/>
      ` : ''}

      <!-- Wallepi Typography -->
      ${textOpacity > 0 ? `
        <g transform="translate(240, 240) scale(${textScale}) translate(-240, -240)" opacity="${textOpacity}">
          <!-- Text "wallep" without the dot on "i" -->
          <text x="134" y="248" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="900" font-size="52" fill="${COLOR_TEXT}" letter-spacing="1">
            wallep<tspan fill="${COLOR_TEXT}">ı</tspan>
          </text>
        </g>
      ` : ''}

      <!-- Animated Dot (Electric Lime #CCFF00) -->
      <ellipse cx="${dotX}" cy="${dotY}" rx="${dotRx}" ry="${dotRy}" fill="${COLOR_ACCENT}"/>
    </svg>
    `;

    const frameBuf = await sharp(Buffer.from(svg)).toFormat("png").toBuffer();

    // Add to vertical composite array
    frameCompositeInputs.push({
      input: frameBuf,
      top: i * height,
      left: 0,
    });
  }

  console.log(`Rendering ${totalFrames} frames into a vertical strip (${width}x${height * totalFrames})...`);

  // 1. Create a blank canvas of width x (height * totalFrames)
  const strip = await sharp({
    create: {
      width,
      height: height * totalFrames,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite(frameCompositeInputs)
    .toFormat("png")
    .toBuffer();

  const gifPath = join(artifactDir, "splash_concept.gif");

  // 2. Pass strip to sharp with pageHeight to produce true animated GIF
  await sharp(strip, {
    animated: true,
    pageHeight: height,
  })
    .gif({
      delay: frameCompositeInputs.map(() => 40), // 40ms per frame = 25 FPS smooth animation
      loop: 0,
    })
    .toFile(gifPath);

  console.log(`✅ Perfectly generated animated GIF at ${gifPath}`);
}

main().catch(console.error);
