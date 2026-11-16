'use strict';

const rules = require('../shared/rules');
const letters = require('../shared/letters');
const { createGemini } = require('./gemini');

const MAX_TEXT = 4000;
const LANGS = ['en', 'ta', 'hi'];

class InputError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * The one place a request becomes an answer.
 *
 * The rules engine always runs and always decides. Gemini is asked afterwards,
 * and only to improve the wording and to catch a phrasing the patterns missed.
 * It is never allowed to downgrade a THREAT: a model argued into calling a fraud
 * harmless is the single failure that would cost a user money, so that door is
 * shut in code rather than in a prompt.
 */
function createEngine({ gemini = createGemini(), logger = console, timeoutMs = 9000 } = {}) {
  function validate(body) {
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) throw new InputError(400, 'Field "text" is required');
    if (text.length > MAX_TEXT) throw new InputError(413, `Field "text" must be at most ${MAX_TEXT} characters`);
    const lang = LANGS.includes(body.lang) ? body.lang : 'en';
    const place = typeof body.place === 'string' ? body.place.slice(0, 120) : '';
    return { text, lang, place };
  }

  async function analyze(body) {
    const { text, lang, place } = validate(body);
    const verdict = rules.judge(text);
    verdict.lang = lang;
    verdict.engine = 'Urimai rules';

    if (gemini.enabled) {
      const ac = new AbortController();
      let timer;
      // The deadline is enforced here rather than left to the caller. Aborting the
      // request is the polite half; racing it is the half that actually guarantees
      // a user is never left watching a spinner because something upstream stalled.
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => { ac.abort(); reject(new Error(`timed out after ${timeoutMs}ms`)); }, timeoutMs);
      });
      try {
        // Only the redacted copy is sent, so identifiers never reach the model.
        const ai = await Promise.race([gemini.read(verdict.redacted, lang, ac.signal), deadline]);
        if (verdict.kind !== 'THREAT' && ai.kind) verdict.kind = ai.kind;
        if (verdict.kind === 'THREAT' && typeof ai.confidence === 'number') {
          verdict.score = Math.max(verdict.score, Math.min(ai.confidence, 98));
        }
        verdict.headline = ai.headline;
        verdict.why = ai.why;
        verdict.advice = ai.advice;
        verdict.engine = gemini.model;
      } catch (err) {
        verdict.note = 'offline';
        logger.error('[gemini]', err instanceof Error ? err.message : String(err));
      } finally {
        clearTimeout(timer);
      }
    }

    // A verdict changed by the model may no longer match the type the rules found.
    if (verdict.kind === 'CIVIC' && !verdict.type) verdict.type = rules.CIVIC[0];
    if (verdict.kind === 'THREAT' && !verdict.type) verdict.type = rules.THREATS[0];

    return {
      kind: verdict.kind,
      score: verdict.score,
      lang,
      headline: verdict.headline || null,
      why: verdict.why || null,
      advice: verdict.advice || null,
      label: verdict.type ? localName(verdict.type, lang) : null,
      tell: verdict.type && verdict.type.tell ? pickLang(verdict.type.tell, lang) : null,
      tactic: verdict.type && verdict.type.tactic ? pickLang(verdict.type.tactic, lang) : null,
      department: verdict.type && verdict.type.dept ? pickLang(verdict.type.dept, lang) : null,
      evidence: verdict.evidence,
      redacted: verdict.redacted,
      documents: letters.draft(verdict, lang, place || undefined),
      destinations: letters.DESTINATIONS,
      engine: verdict.engine,
      offline: verdict.note === 'offline' || !gemini.enabled,
    };
  }

  return { analyze, aiEnabled: () => gemini.enabled, model: gemini.model };
}

const pickLang = (table, lang) => (table && (table[lang] || table.en)) || null;
const localName = (type, lang) => pickLang(type.name || type.dept, lang);

module.exports = { createEngine, InputError, MAX_TEXT, LANGS };
