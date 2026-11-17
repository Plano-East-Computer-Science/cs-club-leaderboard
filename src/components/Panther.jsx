import { useEffect, useRef } from 'react';

/**
 * The mascot: a panther head drawn to a canvas, then rasterised to ASCII with
 * an ordered dither. The eyes are a second layer so they can glow and blink.
 */
function draw() {
  const W = 96;
  const H = 96;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.translate(3, 0);
  const head = new Path2D(
    'M45 18C38 16 32 14 28 18L22 2L12 24C6 34 4 48 10 58C16 70 28 82 38 86L45 88L52 86C62 82 74 70 80 58C86 48 84 34 78 24L68 2L62 18C58 14 52 16 45 18Z'
  );
  const g = x.createRadialGradient(45, 34, 4, 45, 50, 52);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.6, '#c4c4c4');
  g.addColorStop(1, '#6a6a6a');
  x.fillStyle = g;
  x.fill(head);
  // inner ears
  x.fillStyle = '#111';
  x.beginPath(); x.moveTo(23, 10); x.lineTo(30, 22); x.lineTo(17, 25); x.fill();
  x.beginPath(); x.moveTo(67, 10); x.lineTo(60, 22); x.lineTo(73, 25); x.fill();
  // brow shadows + muzzle highlight
  x.fillStyle = 'rgba(0,0,0,.55)';
  x.beginPath(); x.moveTo(14, 38); x.quadraticCurveTo(30, 32, 42, 44); x.lineTo(40, 36); x.quadraticCurveTo(28, 28, 14, 34); x.fill();
  x.beginPath(); x.moveTo(76, 38); x.quadraticCurveTo(60, 32, 48, 44); x.lineTo(50, 36); x.quadraticCurveTo(62, 28, 76, 34); x.fill();
  x.fillStyle = 'rgba(255,255,255,.35)';
  x.beginPath(); x.ellipse(45, 66, 12, 9, 0, 0, 7); x.fill();
  // nose + mouth
  x.fillStyle = '#050505';
  x.beginPath(); x.moveTo(38, 60); x.lineTo(52, 60); x.lineTo(45, 69); x.fill();
  x.strokeStyle = '#050505';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(45, 69); x.lineTo(45, 75); x.moveTo(33, 77); x.quadraticCurveTo(45, 80, 45, 75); x.quadraticCurveTo(45, 80, 57, 77);
  x.stroke();
  // eyes mask kept separate
  const E = document.createElement('canvas');
  E.width = W;
  E.height = H;
  const ex = E.getContext('2d', { willReadFrequently: true });
  ex.translate(3, 0);
  ex.fillStyle = '#fff';
  ex.beginPath(); ex.moveTo(20, 44); ex.quadraticCurveTo(30, 37, 40, 46); ex.quadraticCurveTo(30, 46, 20, 44); ex.fill();
  ex.beginPath(); ex.moveTo(70, 44); ex.quadraticCurveTo(60, 37, 50, 46); ex.quadraticCurveTo(60, 46, 70, 44); ex.fill();
  x.fillStyle = '#000';
  x.beginPath(); x.moveTo(18, 44); x.quadraticCurveTo(30, 35, 42, 47); x.quadraticCurveTo(30, 48, 18, 44); x.fill();
  x.beginPath(); x.moveTo(72, 44); x.quadraticCurveTo(60, 35, 48, 47); x.quadraticCurveTo(60, 48, 72, 44); x.fill();

  const D = x.getImageData(0, 0, W, H).data;
  const ED = ex.getImageData(0, 0, W, H).data;
  const ramp = ' .,:;-=+*#%@';
  const B = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  let body = '';
  let eyes = '';
  for (let r = 0; r < H / 2; r++) {
    let a = '';
    let e = '';
    for (let q = 0; q < W; q++) {
      let lum = 0;
      let al = 0;
      let eye = 0;
      for (let k = 0; k < 2; k++) {
        const i = ((r * 2 + k) * W + q) * 4;
        al += D[i + 3];
        lum += (D[i] * D[i + 3]) / 255;
        eye += (ED[i] * ED[i + 3]) / 255 / 255;
      }
      al /= 2; lum /= 2; eye /= 2;
      if (eye > 0.5) { a += ' '; e += '@'; continue; }
      e += ' ';
      if (al < 110) { a += ' '; continue; }
      const v = Math.min(1, Math.max(0, lum / 255));
      const t = B[r & 3][q & 3] / 16;
      const idx = Math.min(ramp.length - 1, Math.floor(v * (ramp.length - 1) * 1.15 + t * 0.9));
      a += ramp[Math.max(2, idx)];
    }
    body += `${a}\n`;
    eyes += `${e}\n`;
  }
  return [body, eyes];
}

export function Panther() {
  const body = useRef(null);
  const eyes = useRef(null);
  useEffect(() => {
    const [b, e] = draw();
    body.current.textContent = b;
    eyes.current.textContent = e;
  }, []);
  return (
    <div className="panther" role="img" aria-label="ASCII art of a panther head">
      <pre ref={body} aria-hidden="true" />
      <pre ref={eyes} className="eyes" aria-hidden="true" />
    </div>
  );
}
