'use strict';

/**
 * The page.
 *
 * One box, one button, one answer. The verdict is carried by the colour of the
 * whole page and by the guardian's eyes before a single word is read, because the
 * people most often defrauded in India are the people least able to read a screen
 * full of English. The words are there for everyone else.
 */
(() => {
  const $ = (id) => document.getElementById(id);
  const form = $('ask');
  if (!form) return;

  const text = $('text');
  const place = $('place');
  const out = $('out');
  const lang = $('lang');
  const root = document.documentElement;

  const guardian = window.createGuardian ? window.createGuardian($('eyes')) : { set() {} };

  /* ---------------- theme ---------------- */

  const setTheme = (mode) => {
    root.dataset.theme = mode;
    $('theme').setAttribute('aria-label', mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    try { localStorage.setItem('urimai:theme', mode); } catch { /* private mode */ }
  };
  try {
    const saved = localStorage.getItem('urimai:theme');
    setTheme(saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  } catch {
    setTheme('dark');
  }
  $('theme').addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));

  /** The page takes the colour of the answer; the eyes take its mood. */
  const setState = (state) => {
    root.dataset.state = state;
    guardian.set(state === 'threat' ? 'threat' : state === 'civic' ? 'civic' : state === 'safe' ? 'safe' : 'idle');
  };

  /* ---------------- examples ---------------- */

  const SAMPLES = {
    kyc: 'Dear customer, your SBI KYC has expired and your account will be blocked today. Update immediately at http://sbi-kyc-verify.in and share the OTP sent to your number.',
    arrest: 'This is Inspector Sharma from the Cyber Cell. A parcel in your name contains narcotics and an arrest warrant is issued. Stay on this video call and do not tell anyone in your family.',
    light: 'The street light outside our house has not been working for more than a month. The whole lane is dark at night and two people have fallen near the corner.',
    safe: 'Amma, I will be home by 8 tonight. Shall I bring curd rice from the shop?',
  };
  for (const btn of form.querySelectorAll('[data-s]')) {
    btn.addEventListener('click', () => {
      text.value = SAMPLES[btn.dataset.s] || '';
      text.focus();
    });
  }

  $('clear').addEventListener('click', () => {
    form.reset();
    out.innerHTML = '';
    setState('idle');
    text.focus();
  });

  /* ---------------- rendering ---------------- */

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const WORD = {
    THREAT: { en: 'This is a fraud', ta: 'இது மோசடி', hi: 'यह धोखाधड़ी है' },
    CIVIC: { en: 'A matter for an office', ta: 'அலுவலகத்துக்கான விஷயம்', hi: 'दफ़्तर का मामला' },
    SAFE: { en: 'Nothing wrong here', ta: 'இதில் தவறில்லை', hi: 'इसमें कुछ गलत नहीं' },
  };
  const say = (table, l) => table[l] || table.en;

  function evidenceRow(e) {
    const bits = [];
    const add = (label, arr) => {
      if (arr && arr.length) bits.push(`<span><b>${esc(label)}</b> ${arr.map((v) => `<code>${esc(v)}</code>`).join(' ')}</span>`);
    };
    add('UPI', e.upi); add('Phone', e.phones); add('Link', e.links);
    add('Amount', e.amounts); add('Account', e.accounts);
    return bits.length ? `<p class="ev">${bits.join('')}</p>` : '';
  }

  function docCard(doc, destinations) {
    const links = (destinations[doc.id] || [])
      .map((d) => `<a class="chip" href="${esc(d.url)}"${d.url.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(d.label)}</a>`)
      .join('');
    return `
      <article class="doc card">
        <div class="doc-head">
          <h3>${esc(doc.title)}</h3>
          <button type="button" class="chip copy" data-doc="${esc(doc.id)}">Copy</button>
        </div>
        <pre dir="auto" id="doc-${esc(doc.id)}">${esc(doc.body)}</pre>
        ${links ? `<div class="dests">${links}</div>` : ''}
      </article>`;
  }

  function render(r) {
    const l = r.lang || 'en';
    const headline = r.headline || say(WORD[r.kind], l);
    const why = r.why || r.tell || '';
    const advice = r.advice || '';

    out.innerHTML = `
      <section class="card verdict">
        <div class="verdict-top">
          <span class="badge">${esc(say(WORD[r.kind], l))}</span>
          ${r.kind === 'THREAT'
            ? `<span class="meter" role="meter" aria-valuenow="${r.score}" aria-valuemin="0" aria-valuemax="100"
                 aria-label="Risk ${r.score} out of 100"><i></i></span>
               <span class="muted">${r.score}/100</span>`
            : ''}
        </div>
        <h2>${esc(headline)}</h2>
        ${r.label && r.kind === 'THREAT' ? `<p class="muted">${esc(r.label)}${r.tactic ? ` · ${esc(r.tactic)}` : ''}</p>` : ''}
        ${r.department ? `<p><span class="dept">${esc(r.department)}</span></p>` : ''}
        ${why ? `<p class="why">${esc(why)}</p>` : ''}
        ${advice ? `<p class="advice">${esc(advice)}</p>` : ''}
        ${r.kind === 'THREAT' ? evidenceRow(r.evidence) : ''}
      </section>
      ${r.documents.length ? `<div class="docs">${r.documents.map((d) => docCard(d, r.destinations)).join('')}</div>` : ''}`;

    // Set through the CSSOM, not a style attribute: our own CSP forbids inline styles.
    const bar = out.querySelector('.meter > i');
    if (bar) bar.style.setProperty('--p', `${r.score}%`);

    for (const b of out.querySelectorAll('.copy')) {
      b.addEventListener('click', async () => {
        const pre = document.getElementById(`doc-${b.dataset.doc}`);
        try {
          await navigator.clipboard.writeText(pre.textContent);
          b.textContent = 'Copied';
          setTimeout(() => (b.textContent = 'Copy'), 1600);
        } catch {
          const range = document.createRange();
          range.selectNodeContents(pre);
          getSelection().removeAllRanges();
          getSelection().addRange(range);
          b.textContent = 'Selected — press Ctrl+C';
        }
      });
    }

    $('engine-note').textContent = r.offline
      ? 'Answered by Urimai’s own rules (no AI key configured).'
      : `Explained by ${r.engine}.`;
  }

  /* ---------------- asking ---------------- */

  /** If the server cannot be reached, the same rules still run here in the browser. */
  function locally(value, l, where) {
    const v = window.UrimaiRules.judge(value);
    const t = v.type;
    return {
      kind: v.kind, score: v.score, lang: l,
      headline: null,
      why: t && t.tell ? (t.tell[l] || t.tell.en) : null,
      advice: null,
      label: t ? ((t.name || t.dept)[l] || (t.name || t.dept).en) : null,
      tactic: t && t.tactic ? (t.tactic[l] || t.tactic.en) : null,
      department: t && t.dept ? (t.dept[l] || t.dept.en) : null,
      tell: t && t.tell ? (t.tell[l] || t.tell.en) : null,
      evidence: v.evidence, redacted: v.redacted,
      documents: window.UrimaiLetters.draft(v, l, where || undefined),
      destinations: window.UrimaiLetters.DESTINATIONS,
      engine: 'Urimai rules (in your browser)', offline: true,
    };
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = text.value.trim();
    if (!value) { text.focus(); return; }

    const l = lang.value;
    const where = place.value.trim();
    const go = $('go');
    go.disabled = true;
    setState('idle');
    guardian.set('listen');
    out.innerHTML = '<p class="thinking"><i></i> Reading it…</p>';

    let result;
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: value, lang: l, place: where }),
      });
      if (!res.ok) throw new Error(String(res.status));
      result = await res.json();
    } catch {
      result = locally(value, l, where);
    }

    setState(result.kind.toLowerCase());
    render(result);
    go.disabled = false;
    out.querySelector('h2')?.focus?.();
  });

  // Ctrl+Enter sends, which is what anyone who types a lot will reach for.
  text.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') form.requestSubmit();
  });
})();
