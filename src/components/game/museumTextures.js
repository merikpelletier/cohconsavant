import * as THREE from 'three';

/**
 * Loads a grayscale height map image and converts it to a normal map
 * using a Sobel filter. Returns a THREE.CanvasTexture or null on failure.
 */
export function loadHeightMapAsNormal(url, strength = 2.0, repeat = 8) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      const src = ctx.getImageData(0, 0, size, size);
      const dst = ctx.createImageData(size, size);

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const x1 = Math.min(x + 1, size - 1);
          const x2 = Math.max(x - 1, 0);
          const y1 = Math.min(y + 1, size - 1);
          const y2 = Math.max(y - 1, 0);

          const hL = src.data[(y * size + x2) * 4] / 255;
          const hR = src.data[(y * size + x1) * 4] / 255;
          const hD = src.data[(y2 * size + x) * 4] / 255;
          const hU = src.data[(y1 * size + x) * 4] / 255;

          const dx = (hL - hR) * strength;
          const dy = (hD - hU) * strength;
          const dz = 1.0;
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

          const i = (y * size + x) * 4;
          dst.data[i] = (dx / len * 0.5 + 0.5) * 255;
          dst.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
          dst.data[i + 2] = (dz / len * 0.5 + 0.5) * 255;
          dst.data[i + 3] = 255;
        }
      }

      ctx.putImageData(dst, 0, 0);
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeat, repeat);
      resolve(tex);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Loads an albedo (color) texture with proper repeat and color space.
 */
/**
 * Generates a seamless red hardwood plank texture on a canvas.
 * Draws vertical planks with grain lines, color variation, and plank seams.
 * Returns a THREE.CanvasTexture.
 */
export function createRedWoodTexture(repeat = 8) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Deep espresso / dark mahogany palette with amber-copper undertones
  const baseColors = [
    '#3C2B1D', '#2E2218', '#241A12', '#4A3324', '#352519', '#2A1E14',
    '#3F2A1C', '#321F15', '#42291B', '#2D1F15',
  ];
  // Amber / copper highlight tones for grain
  const grainDark = 'rgba(16,10,6,';
  const grainLight = 'rgba(157,108,66,';
  const highlightColor = 'rgba(197,137,87,';

  // Fill background
  ctx.fillStyle = '#1a1108';
  ctx.fillRect(0, 0, size, size);

  // Planks run vertically (length = full texture height). Width = 64px → 8 planks.
  const plankW = 64;
  const plankCount = size / plankW;

  for (let p = 0; p < plankCount; p++) {
    const x = p * plankW;
    const base = baseColors[(p * 3 + Math.floor(Math.random() * 3)) % baseColors.length];

    // Fill plank base
    ctx.fillStyle = base;
    ctx.fillRect(x, 0, plankW, size);

    // Vertical gradient: darker at edges, slightly lighter in center
    const grad = ctx.createLinearGradient(x, 0, x + plankW, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.35)');
    grad.addColorStop(0.15, 'rgba(0,0,0,0.05)');
    grad.addColorStop(0.5, 'rgba(157,108,66,0.06)');
    grad.addColorStop(0.85, 'rgba(0,0,0,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, plankW, size);

    // Long horizontal grain streaks — follow the plank length
    const grainCount = 18 + Math.floor(Math.random() * 10);
    for (let g = 0; g < grainCount; g++) {
      const gy = (g / grainCount) * size + (Math.random() - 0.5) * 6;
      const gOpacity = 0.08 + Math.random() * 0.15;
      ctx.strokeStyle = grainDark + gOpacity + ')';
      ctx.lineWidth = 0.4 + Math.random() * 0.8;
      ctx.beginPath();
      // Wavy grain running the full length of the plank
      for (let yy = 0; yy < size; yy += 3) {
        const wave = Math.sin((yy + p * 13) * 0.04) * 2 + Math.sin((yy + p * 7) * 0.11) * 1;
        const px = x + plankW * 0.5 + wave * 3 + (Math.random() - 0.5) * 1;
        if (yy === 0) ctx.moveTo(px, yy);
        else ctx.lineTo(px, yy);
      }
      ctx.stroke();
    }

    // Lighter amber grain highlights
    const hlCount = 8 + Math.floor(Math.random() * 6);
    for (let h = 0; h < hlCount; h++) {
      const hy = Math.random() * size;
      const hOpacity = 0.04 + Math.random() * 0.08;
      ctx.strokeStyle = grainLight + hOpacity + ')';
      ctx.lineWidth = 0.4 + Math.random() * 0.4;
      ctx.beginPath();
      for (let yy = 0; yy < size; yy += 3) {
        const wave = Math.sin((yy + p * 5) * 0.06) * 1.5;
        const px = x + plankW * 0.5 + wave * 2;
        if (yy === 0) ctx.moveTo(px, yy);
        else ctx.lineTo(px, yy);
      }
      ctx.stroke();
    }

    // Occasional copper sheen streak (the waxed gloss catching light)
    if (Math.random() > 0.4) {
      const sy = Math.random() * size;
      const sheen = ctx.createLinearGradient(x, 0, x + plankW, 0);
      sheen.addColorStop(0, highlightColor + '0)');
      sheen.addColorStop(0.5, highlightColor + '0.04)');
      sheen.addColorStop(1, highlightColor + '0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(x, sy, plankW, 2 + Math.random() * 3);
    }

    // Plank seam — thin, dark, defined
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, 0, 2, size);

    // Subtle bevel highlight
    ctx.fillStyle = 'rgba(157,108,66,0.06)';
    ctx.fillRect(x + 2, 0, 1, size);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + plankW - 1, 0, 1, size);
  }

  // Add knots — dark circular imperfections
  const knotCount = 2 + Math.floor(Math.random() * 3);
  for (let k = 0; k < knotCount; k++) {
    const kx = Math.random() * size;
    const ky = Math.random() * size;
    const kr = 4 + Math.random() * 6;
    const kGrad = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
    kGrad.addColorStop(0, 'rgba(10,5,2,0.85)');
    kGrad.addColorStop(0.4, 'rgba(20,12,6,0.5)');
    kGrad.addColorStop(0.7, 'rgba(36,24,14,0.2)');
    kGrad.addColorStop(1, 'rgba(60,40,24,0)');
    ctx.fillStyle = kGrad;
    ctx.beginPath();
    ctx.arc(kx, ky, kr, 0, Math.PI * 2);
    ctx.fill();
    // Ring around knot
    ctx.strokeStyle = 'rgba(16,10,6,0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(kx, ky, kr * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function loadAlbedoTexture(url, repeat = 8) {
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeat, repeat);
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      },
      undefined,
      () => resolve(null)
    );
  });
}