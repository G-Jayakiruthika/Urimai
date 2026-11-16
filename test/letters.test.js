'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../shared/rules');
const letters = require('../shared/letters');

const THREAT = rules.judge('Your KYC expired. Share OTP 445566, pay Rs 4,999 to fraud.pay@ybl, click http://fake-bank.in now');
const CIVIC = rules.judge('The street light outside our house has not worked for a month');

test('a threat produces a reply, a complaint and a family warning', () => {
  assert.deepEqual(letters.draft(THREAT, 'en').map((d) => d.id), ['refusal', 'complaint', 'warn']);
});

test('a civic matter produces a grievance letter and nothing else', () => {
  assert.deepEqual(letters.draft(CIVIC, 'en').map((d) => d.id), ['grievance']);
});

test('a safe message produces no paperwork at all', () => {
  assert.deepEqual(letters.draft(rules.judge('Shall I bring curd rice?'), 'en'), []);
});

test('the complaint carries the evidence the portal will ask for', () => {
  const body = letters.draft(THREAT, 'en').find((d) => d.id === 'complaint').body;
  assert.match(body, /fraud\.pay@ybl/);
  assert.match(body, /fake-bank\.in/);
  assert.match(body, /cybercrime\.gov\.in/);
  assert.match(body, /Urimai risk assessment: \d+\/100/);
});

test('the quoted message in a complaint is redacted, never raw', () => {
  const v = rules.judge('Your KYC expired, share OTP now. My number is 9876543210 and PAN ABCDE1234F');
  const body = letters.draft(v, 'en').find((d) => d.id === 'complaint').body;
  // The evidence block lists identifiers on purpose — a police complaint needs them.
  // The quoted message must not, because it is reproduced in full.
  const excerpt = body.split('Message received')[1];
  assert.doesNotMatch(excerpt, /9876543210|ABCDE1234F/);
  assert.match(excerpt, /\[PHONE\]|\[PAN\]/);
});

test('the evidence block warns the filer to strip their own details', () => {
  const body = letters.draft(THREAT, 'en').find((d) => d.id === 'complaint').body;
  assert.match(body, /remove any that are your own/);
});

test('the grievance letter is addressed to the correct department', () => {
  const body = letters.draft(CIVIC, 'en')[0].body;
  assert.match(body, /Electrical Wing/);
  assert.match(body, /Subject: Request for redressal/);
});

test('a supplied location appears in the grievance letter', () => {
  const body = letters.draft(CIVIC, 'en', 'Gandhi Street, Ward 12')[0].body;
  assert.match(body, /Gandhi Street, Ward 12/);
});

test('every document is written in the language asked for', () => {
  const ta = letters.draft(THREAT, 'ta').find((d) => d.id === 'refusal').body;
  const hi = letters.draft(THREAT, 'hi').find((d) => d.id === 'refusal').body;
  assert.match(ta, /[஀-௿]/, 'Tamil script expected');
  assert.match(hi, /[ऀ-ॿ]/, 'Devanagari script expected');
  assert.notEqual(ta, hi);
});

test('an unknown language falls back to English rather than breaking', () => {
  const out = letters.draft(THREAT, 'xx').find((d) => d.id === 'refusal').body;
  assert.match(out, /I do not share OTP/);
});

test('documents never contain an unresolved placeholder', () => {
  for (const d of [...letters.draft(THREAT, 'en'), ...letters.draft(CIVIC, 'en')]) {
    assert.doesNotMatch(d.body, /undefined|\[object Object\]|NaN/, d.id);
  }
});
