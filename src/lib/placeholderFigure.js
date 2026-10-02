/**
 * Placeholder character art, drawn with canvas paths.
 *
 * Used two ways:
 *  - tools/make-placeholders.html renders these to the PNGs in assets/characters/
 *  - at runtime, if a slot's PNG fails to load, the same figure is drawn on the fly
 *
 * Image convention (same for your own PNGs): transparent background, the figure
 * fills the full image height, feet touching the bottom edge.
 */

export const FIGURE_STYLES = {
  A: { top: '#5d6774', topDark: '#454d58', bottom: '#3a414c', skin: '#b8967e', hair: '#3b2f27', shoe: '#2a2a2a', label: 'A' },
  B: { top: '#40443b', topDark: '#30332c', bottom: '#27282b', skin: '#a68873', hair: '#161413', shoe: '#1b1b1b', label: 'B' },
};

export const FIGURE_SIZES = {
  standing: { width: 400, height: 1000 },
  seated: { width: 560, height: 760 },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function shade(ctx, x0, y0, x1, y1, light, dark) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  return g;
}

/** Draw a figure onto `canvas` (resizes it). pose: 'standing' | 'seated'. */
export function drawFigure(canvas, pose = 'standing', styleKey = 'A') {
  const s = FIGURE_STYLES[styleKey] || FIGURE_STYLES.A;
  const size = FIGURE_SIZES[pose] || FIGURE_SIZES.standing;
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const outline = 'rgba(12, 12, 14, 0.85)';

  const fillStroke = (fill) => {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = outline;
    ctx.stroke();
  };

  if (pose === 'seated') drawSeated(ctx, s, fillStroke);
  else drawStanding(ctx, s, fillStroke);
  return canvas;
}

function drawStanding(ctx, s, fillStroke) {
  const cx = 200;
  // Legs
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 6, 505);
    ctx.lineTo(cx + side * 84, 505);
    ctx.lineTo(cx + side * 72, 948);
    ctx.lineTo(cx + side * 14, 948);
    ctx.closePath();
    fillStroke(shade(ctx, cx + side * 84, 0, cx, 0, s.bottom, s.bottom));
  }
  // Shoes
  for (const side of [-1, 1]) {
    roundRect(ctx, cx + side * 44 - 38, 938, 76, 58, [18, 18, 10, 10]);
    fillStroke(s.shoe);
  }
  // Arms (behind the torso edges)
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 88, 178);
    ctx.quadraticCurveTo(cx + side * 128, 200, cx + side * 122, 330);
    ctx.lineTo(cx + side * 118, 540);
    ctx.lineTo(cx + side * 78, 545);
    ctx.lineTo(cx + side * 80, 320);
    ctx.closePath();
    fillStroke(s.topDark);
    ctx.beginPath();
    ctx.ellipse(cx + side * 99, 568, 21, 30, 0, 0, Math.PI * 2);
    fillStroke(s.skin);
  }
  // Torso (hoodie)
  ctx.beginPath();
  ctx.moveTo(cx - 70, 170);
  ctx.quadraticCurveTo(cx - 98, 180, cx - 96, 240);
  ctx.lineTo(cx - 86, 520);
  ctx.quadraticCurveTo(cx, 535, cx + 86, 520);
  ctx.lineTo(cx + 96, 240);
  ctx.quadraticCurveTo(cx + 98, 180, cx + 70, 170);
  ctx.quadraticCurveTo(cx, 150, cx - 70, 170);
  ctx.closePath();
  fillStroke(shade(ctx, 0, 160, 0, 530, s.top, s.topDark));
  // Pocket + hood collar
  roundRect(ctx, cx - 58, 400, 116, 70, 16);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, 176, 62, 26, 0, 0, Math.PI * 2);
  fillStroke(s.topDark);
  // Neck + head
  roundRect(ctx, cx - 21, 128, 42, 50, 10);
  fillStroke(s.skin);
  ctx.beginPath();
  ctx.ellipse(cx, 80, 52, 66, 0, 0, Math.PI * 2);
  fillStroke(s.skin);
  // Hair
  ctx.beginPath();
  ctx.ellipse(cx, 58, 55, 46, 0, Math.PI, Math.PI * 2);
  ctx.quadraticCurveTo(cx + 58, 76, cx + 48, 92);
  ctx.quadraticCurveTo(cx + 30, 50, cx, 46);
  ctx.quadraticCurveTo(cx - 32, 50, cx - 50, 92);
  ctx.quadraticCurveTo(cx - 58, 76, cx - 55, 58);
  ctx.closePath();
  fillStroke(s.hair);
  // Slot letter printed on the hoodie
  ctx.fillStyle = 'rgba(235, 230, 220, 0.55)';
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(s.label, cx, 330);
}

function drawSeated(ctx, s, fillStroke) {
  const cx = 280;
  // Lower legs
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 22, 470);
    ctx.lineTo(cx + side * 98, 470);
    ctx.lineTo(cx + side * 90, 712);
    ctx.lineTo(cx + side * 34, 712);
    ctx.closePath();
    fillStroke(s.bottom);
    roundRect(ctx, cx + side * 62 - 38, 700, 76, 56, [16, 16, 10, 10]);
    fillStroke(s.shoe);
  }
  // Thighs / lap (foreshortened, knees toward the viewer)
  ctx.beginPath();
  ctx.moveTo(cx - 112, 405);
  ctx.quadraticCurveTo(cx - 118, 486, cx - 60, 488);
  ctx.lineTo(cx + 60, 488);
  ctx.quadraticCurveTo(cx + 118, 486, cx + 112, 405);
  ctx.closePath();
  fillStroke(shade(ctx, 0, 400, 0, 490, s.bottom, s.bottom));
  // Arms
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 84, 168);
    ctx.quadraticCurveTo(cx + side * 124, 190, cx + side * 120, 300);
    ctx.lineTo(cx + side * 112, 420);
    ctx.lineTo(cx + side * 70, 432);
    ctx.lineTo(cx + side * 76, 300);
    ctx.closePath();
    fillStroke(s.topDark);
    ctx.beginPath();
    ctx.ellipse(cx + side * 70, 440, 26, 20, 0, 0, Math.PI * 2);
    fillStroke(s.skin);
  }
  // Torso
  ctx.beginPath();
  ctx.moveTo(cx - 68, 160);
  ctx.quadraticCurveTo(cx - 96, 172, cx - 94, 230);
  ctx.lineTo(cx - 90, 420);
  ctx.quadraticCurveTo(cx, 436, cx + 90, 420);
  ctx.lineTo(cx + 94, 230);
  ctx.quadraticCurveTo(cx + 96, 172, cx + 68, 160);
  ctx.quadraticCurveTo(cx, 142, cx - 68, 160);
  ctx.closePath();
  fillStroke(shade(ctx, 0, 150, 0, 430, s.top, s.topDark));
  ctx.beginPath();
  ctx.ellipse(cx, 166, 60, 25, 0, 0, Math.PI * 2);
  fillStroke(s.topDark);
  roundRect(ctx, cx - 20, 120, 40, 48, 10);
  fillStroke(s.skin);
  ctx.beginPath();
  ctx.ellipse(cx, 74, 50, 63, 0, 0, Math.PI * 2);
  fillStroke(s.skin);
  ctx.beginPath();
  ctx.ellipse(cx, 54, 53, 44, 0, Math.PI, Math.PI * 2);
  ctx.quadraticCurveTo(cx + 56, 72, cx + 46, 86);
  ctx.quadraticCurveTo(cx + 28, 46, cx, 42);
  ctx.quadraticCurveTo(cx - 30, 46, cx - 48, 86);
  ctx.quadraticCurveTo(cx - 56, 72, cx - 53, 54);
  ctx.closePath();
  fillStroke(s.hair);
  ctx.fillStyle = 'rgba(235, 230, 220, 0.55)';
  ctx.font = 'bold 58px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(s.label, cx, 310);
}
