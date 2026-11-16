'use strict';

/**
 * The guardian's face.
 *
 * A pair of eyes drawn on a canvas, and nothing else. The shape of the eyes and
 * the angle of the brows carry the verdict: wide and still while listening, hard
 * and narrowed at a fraud, level and attentive at a civic matter, softly closed
 * when all is well. It is the fastest channel there is — a face is read before
 * any word on the page, in any language, by anyone.
 *
 * Drawn rather than drawn-up: no image files, no model, nothing to download.
 */
(() => {
  /** Each state is a set of numbers the drawing interpolates toward. */
  const MOODS = {
    idle:   { open: 1.00, brow: 0,     tilt: 0,     squint: 0,   pupil: 1.00 },
    listen: { open: 1.20, brow: -0.18, tilt: 0,     squint: 0,   pupil: 1.15 },
    threat: { open: 0.74, brow: 0.55,  tilt: 0.34,  squint: .55, pupil: 0.72 },
    civic:  { open: 1.02, brow: 0.12,  tilt: -0.10, squint: .12, pupil: 1.05 },
    safe:   { open: 0.46, brow: -0.34, tilt: -0.26, squint: 0,   pupil: 0.90 },
  };

  const lerp = (a, b, t) => a + (b - a) * t;

  /**
   * @param {HTMLCanvasElement} canvas
   */
  function createGuardian(canvas) {
    const ctx = canvas.getContext('2d');
    const cur = { ...MOODS.idle };
    let target = { ...MOODS.idle };
    let blink = 0;
    let nextBlink = 2000 + Math.random() * 3000;
    let gaze = { x: 0, y: 0 };
    let want = { x: 0, y: 0 };
    let last = performance.now();
    let raf = 0;

    const fit = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, r.width * dpr);
      canvas.height = Math.max(1, r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // The eyes follow the pointer, which is what makes them feel awake.
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      want.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width || 1) * 2.2));
      want.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height || 1) * 2.2));
    };
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('resize', fit);

    const ink = () => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#123';
    const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#39f';

    /** One eye, drawn as a lens with a lid closing over it. */
    function eye(cx, cy, r, side) {
      const open = cur.open * (1 - blink);
      const lid = r * open;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(side * cur.tilt * 0.5);

      // Lens
      ctx.beginPath();
      ctx.ellipse(0, 0, r, Math.max(lid, 0.04 * r), 0, 0, Math.PI * 2);
      ctx.fillStyle = accent();
      ctx.globalAlpha = 0.16;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(2, r * 0.1);
      ctx.strokeStyle = accent();
      ctx.stroke();

      // Pupil, which looks where the pointer is
      if (open > 0.12) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, 0, r, Math.max(lid, 0.04 * r), 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.beginPath();
        ctx.arc(gaze.x * r * 0.32, gaze.y * lid * 0.34, r * 0.42 * cur.pupil, 0, Math.PI * 2);
        ctx.fillStyle = ink();
        ctx.fill();
        // A catchlight, so it reads as wet and alive rather than printed
        ctx.beginPath();
        ctx.arc(gaze.x * r * 0.32 - r * 0.14, gaze.y * lid * 0.34 - r * 0.15, r * 0.1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.82)';
        ctx.fill();
        ctx.restore();
      }

      // A squint line, which is what makes suspicion legible
      if (cur.squint > 0.02) {
        ctx.beginPath();
        ctx.moveTo(-r, -lid * (1 - cur.squint * 0.8));
        ctx.lineTo(r, -lid * (1 - cur.squint * 0.8));
        ctx.lineWidth = Math.max(2, r * 0.12);
        ctx.strokeStyle = accent();
        ctx.stroke();
      }
      ctx.restore();

      // Brow: angle alone separates anger from calm
      ctx.save();
      ctx.translate(cx, cy - r * 1.75);
      ctx.rotate(side * cur.brow * 0.55);
      ctx.beginPath();
      ctx.moveTo(-r * 0.92, 0);
      ctx.lineTo(r * 0.92, 0);
      ctx.lineWidth = Math.max(3, r * 0.19);
      ctx.lineCap = 'round';
      ctx.strokeStyle = ink();
      ctx.stroke();
      ctx.restore();
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      for (const k of Object.keys(cur)) cur[k] = lerp(cur[k], target[k], 1 - Math.pow(0.0008, dt));
      gaze.x = lerp(gaze.x, want.x, 1 - Math.pow(0.004, dt));
      gaze.y = lerp(gaze.y, want.y, 1 - Math.pow(0.004, dt));

      nextBlink -= dt * 1000;
      if (nextBlink <= 0) {
        blink = Math.min(1, blink + dt * 11);
        if (blink >= 1) { nextBlink = 2200 + Math.random() * 3600; }
      } else if (blink > 0) {
        blink = Math.max(0, blink - dt * 9);
      }

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const r = Math.min(w / 6.2, h / 3.1);
      eye(w / 2 - r * 1.5, h / 2, r, -1);
      eye(w / 2 + r * 1.5, h / 2, r, 1);
    }

    fit();
    raf = requestAnimationFrame(frame);

    return {
      /** @param {'idle'|'listen'|'threat'|'civic'|'safe'} mood */
      set(mood) { target = { ...(MOODS[mood] || MOODS.idle) }; },
      stop() { cancelAnimationFrame(raf); removeEventListener('pointermove', onMove); removeEventListener('resize', fit); },
    };
  }

  window.createGuardian = createGuardian;
})();
