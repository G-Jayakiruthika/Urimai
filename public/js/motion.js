'use strict';

/**
 * Movement that is shared by both pages: the trailing cursor, sections that
 * arrive as you reach them, and buttons that lean toward the hand. None of it is
 * decoration for its own sake — it is what tells a person the page is listening.
 * All of it switches itself off for a coarse pointer or reduced-motion.
 */
(() => {
  const fine = matchMedia('(pointer: fine)').matches;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function reveal() {
    const nodes = [...document.querySelectorAll('section, .card, .reveal-me')];
    if (still) return nodes.forEach((n) => n.classList.add('seen'));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('seen');
        io.unobserve(e.target);
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -40px' });
    nodes.forEach((n, i) => {
      n.classList.add('reveal');
      n.style.setProperty('--d', `${Math.min(i % 6, 5) * 60}ms`);
      io.observe(n);
    });
  }

  function cursor() {
    const dot = Object.assign(document.createElement('div'), { className: 'cur-dot' });
    const ring = Object.assign(document.createElement('div'), { className: 'cur-ring' });
    document.body.append(ring, dot);
    document.documentElement.classList.add('cursor-on');

    let tx = innerWidth / 2; let ty = innerHeight / 2;
    let rx = tx; let ry = ty; let scale = 1; let want = 1;

    addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      if (!ring.classList.contains('on')) { ring.classList.add('on'); dot.classList.add('on'); }
      const hit = e.target instanceof Element && e.target.closest('a, button, textarea, input, select, [role="button"]');
      want = hit ? 1.45 : 1;
      ring.classList.toggle('hot', Boolean(hit));
    }, { passive: true });
    addEventListener('pointerdown', () => { want = 0.8; });
    addEventListener('pointerup', () => { want = 1; });

    (function tick() {
      rx += (tx - rx) * 0.19;
      ry += (ty - ry) * 0.19;
      scale += (want - scale) * 0.2;
      ring.style.transform = `translate3d(${rx - 23}px, ${ry - 23}px, 0) scale(${scale.toFixed(3)})`;
      dot.style.transform = `translate3d(${tx - 3.5}px, ${ty - 3.5}px, 0)`;
      requestAnimationFrame(tick);
    })();
  }

  function magnets() {
    for (const b of document.querySelectorAll('.btn')) {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        b.style.setProperty('--mx', `${((e.clientX - r.left) / r.width - 0.5) * 10}px`);
        b.style.setProperty('--my', `${((e.clientY - r.top) / r.height - 0.5) * 8}px`);
      });
      b.addEventListener('pointerleave', () => {
        b.style.setProperty('--mx', '0px');
        b.style.setProperty('--my', '0px');
      });
    }
  }

  const start = () => { reveal(); if (fine && !still) { cursor(); magnets(); } };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start);
  else start();
})();
