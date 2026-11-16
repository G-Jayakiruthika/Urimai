'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../shared/rules');

test('a fraud family plus a demand is judged a threat', () => {
  const v = rules.judge('Dear customer your SBI KYC expired, account blocked today. Share OTP 445566 now.');
  assert.equal(v.kind, 'THREAT');
  assert.equal(v.type.id, 'kyc');
  assert.ok(v.score >= 60, `expected a high score, got ${v.score}`);
});

test('a fraud word on its own is not enough to accuse someone', () => {
  // Mentioning a word like "invest" in ordinary conversation must not cry fraud.
  const v = rules.judge('I was reading about how to invest in mutual funds for my retirement.');
  assert.notEqual(v.kind, 'THREAT');
});

test('each of the eight fraud families is recognised', () => {
  const samples = {
    investment: 'VIP stock group, guaranteed 8% profit daily, send money now',
    arrest: 'This is CBI. You are under digital arrest, stay on the video call, do not tell anyone',
    kyc: 'Your KYC expired, account will be blocked, share the OTP immediately',
    courier: 'Your parcel is held at customs, pay the customs duty on this link urgently',
    job: 'Part time job, like 50 videos daily, deposit Rs 1000 now to unlock tasks',
    prize: 'You won the KBC lucky draw, pay the processing fee today to claim the prize',
    impersonation: 'Mummy this is my new number, my phone broke, send money urgently',
    loan: 'Pre-approved loan, install this app from the link now to claim it',
  };
  for (const [id, text] of Object.entries(samples)) {
    const v = rules.judge(text);
    assert.equal(v.kind, 'THREAT', `${id} should be a threat: ${text}`);
    assert.equal(v.type.id, id, `${id} was classified as ${v.type.id}`);
  }
});

test('a civic complaint reaches the office that owns the problem', () => {
  const cases = [
    ['There are big potholes on the road near the bus stop', 'Highways'],
    ['The street light outside our house has not worked for a month', 'Electrical'],
    ['Garbage has not been collected on our street for two weeks', 'Sanitation'],
    ['No water supply in our area for three days', 'Water'],
    ['The sewage manhole is overflowing near the school', 'Sewerage'],
    ['Stray dogs on our street are attacking children', 'Veterinary'],
  ];
  for (const [text, dept] of cases) {
    const v = rules.judge(text);
    assert.equal(v.kind, 'CIVIC', text);
    assert.match(v.type.dept.en, new RegExp(dept), text);
  }
});

test('the most specific civic match wins over an incidental word', () => {
  // "road" appears, but the complaint is about the light.
  const v = rules.judge('The street light outside our house has not worked, the road is very dark');
  assert.match(v.type.dept.en, /Electrical/);
});

test('ordinary messages are left alone', () => {
  for (const text of [
    'Amma, I will be home by 8. Shall I bring curd rice?',
    'Your Amazon order has been delivered. Thank you for shopping with us.',
    'Dr Menon clinic: your appointment is confirmed for Tuesday 10:30 am.',
  ]) {
    assert.equal(rules.judge(text).kind, 'SAFE', text);
  }
});

test('identifiers are redacted before anything leaves the device', () => {
  const out = rules.redact('Call me on 9876543210, Aadhaar 2345 6789 0123, PAN ABCDE1234F, pay to ravi@okaxis, mail a.b@c.com');
  assert.match(out, /\[PHONE\]/);
  assert.match(out, /\[AADHAAR\]/);
  assert.match(out, /\[PAN\]/);
  assert.match(out, /\[UPI\]/);
  assert.match(out, /\[EMAIL\]/);
  assert.doesNotMatch(out, /9876543210|ABCDE1234F|ravi@okaxis/);
});

test('evidence a complaint form will ask for is extracted', () => {
  const e = rules.evidence('Pay Rs 4,999 to fraud.pay@ybl or call 9876543210, link http://fake-bank.in account 123456789012');
  assert.deepEqual(e.upi, ['fraud.pay@ybl']);
  assert.deepEqual(e.phones, ['9876543210']);
  assert.equal(e.links.length, 1);
  assert.equal(e.amounts.length, 1);
  assert.deepEqual(e.accounts, ['123456789012']);
});

test('an email address is not mistaken for a UPI handle', () => {
  const e = rules.evidence('Write to support@company.com about this');
  assert.deepEqual(e.upi, []);
});

test('the score is bounded and empty input is handled', () => {
  assert.equal(rules.judge('').kind, 'SAFE');
  assert.equal(rules.judge(undefined).kind, 'SAFE');
  const v = rules.judge('CBI arrest warrant urgent pay fee now otp pin upi link install app immediately');
  assert.ok(v.score <= 98, 'score must stay within bounds');
});
