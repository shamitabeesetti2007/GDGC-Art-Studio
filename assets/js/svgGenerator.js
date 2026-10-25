/* ==========================================================================
   DETERMINISTIC ABSTRACT SVG ARTWORK GENERATOR
   Generates museum-grade abstract compositions when an image URL is absent.
   ========================================================================== */

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function generateDeterministicSvg(id, title = 'Abstract Study', width = 600, height = 750) {
  const seed = hashCode(id || 'default');
  
  // Palette extracted from the editorial design system
  const palette = [
    '#B7654B', // Burnt terracotta
    '#272622', // Charcoal ink
    '#D9B9A7', // Soft clay
    '#A69A8A', // Warm taupe
    '#E7E0D6', // Fine borders
    '#F8F5EF', // Gallery ivory
    '#FFFEFA'  // Paper white
  ];

  const c1 = palette[seed % palette.length];
  const c2 = palette[(seed + 2) % palette.length];
  const c3 = palette[(seed + 4) % palette.length];
  const c4 = palette[(seed + 5) % palette.length];

  // Pseudo-random helper using linear congruential generator
  let state = seed;
  function rand(min, max) {
    state = (state * 9301 + 49297) % 233280;
    const rnd = state / 233280;
    return min + rnd * (max - min);
  }

  // Generate organic paths
  const p1_x1 = rand(50, 200), p1_y1 = rand(100, 300);
  const p1_cx1 = rand(150, 450), p1_cy1 = rand(50, 250);
  const p1_x2 = rand(350, 550), p1_y2 = rand(450, 700);

  const circleX = rand(200, 400);
  const circleY = rand(220, 500);
  const circleR = rand(80, 160);

  const rectX = rand(60, 250);
  const rectY = rand(180, 400);
  const rectW = rand(180, 320);
  const rectH = rand(140, 260);
  const rectRot = rand(-12, 12);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="background-color: #F8F5EF; font-family: 'Fraunces', serif;">
  <defs>
    <!-- Paper canvas texture filter -->
    <filter id="canvas-grain-${id}" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
      <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0.07 0" />
      <feBlend mode="multiply" in="SourceGraphic" result="blend" />
    </filter>

    <linearGradient id="grad-base-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFEFA" />
      <stop offset="100%" stop-color="#F3EEE6" />
    </linearGradient>

    <linearGradient id="grad-terracotta-${id}" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="${c1}" stop-opacity="0.9" />
      <stop offset="100%" stop-color="${c2}" stop-opacity="0.8" />
    </linearGradient>
  </defs>

  <!-- Background Base -->
  <rect width="${width}" height="${height}" fill="url(#grad-base-${id})" />

  <!-- Organic wash layers -->
  <g filter="url(#canvas-grain-${id})">
    <!-- Subdued Wash Block -->
    <rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" 
          transform="rotate(${rectRot} ${rectX + rectW/2} ${rectY + rectH/2})" 
          fill="${c3}" opacity="0.35" rx="4" />

    <!-- Organic Gestural Circle -->
    <circle cx="${circleX}" cy="${circleY}" r="${circleR}" 
            fill="${c4}" opacity="0.4" />
    
    <!-- Heavy Brushstroke Shape -->
    <path d="M ${p1_x1} ${p1_y1} Q ${p1_cx1} ${p1_cy1} ${p1_x2} ${p1_y2} L ${p1_x2 + 35} ${p1_y2 + 25} Q ${p1_cx1 + 20} ${p1_cy1 + 40} ${p1_x1 + 10} ${p1_y1 + 45} Z" 
          fill="url(#grad-terracotta-${id})" opacity="0.85" />

    <!-- Secondary gestural stroke -->
    <path d="M ${rand(80, 200)} ${rand(400, 600)} C ${rand(200, 350)} ${rand(300, 500)}, ${rand(300, 480)} ${rand(500, 650)}, ${rand(400, 550)} ${rand(550, 700)}" 
          fill="none" stroke="${c2}" stroke-width="${rand(14, 28)}" stroke-linecap="round" opacity="0.75" />

    <!-- Delicate linear mark -->
    <line x1="${rand(40, 100)}" y1="${rand(100, 200)}" x2="${rand(250, 400)}" y2="${rand(600, 720)}" 
          stroke="#272622" stroke-width="1.5" stroke-dasharray="4,6" opacity="0.45" />

    <!-- Delicate Monogram / Framing Marker -->
    <text x="${width - 45}" y="${height - 35}" font-size="11" fill="#A69A8A" letter-spacing="2" opacity="0.8" text-anchor="end">STUDIO ARCHIVE · ${id.toUpperCase()}</text>
  </g>
</svg>
  `.trim();

  return svg;
}

window.generateDeterministicSvg = generateDeterministicSvg;
