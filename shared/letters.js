'use strict';

/**
 * The half of Urimai that writes.
 *
 * Knowing a message is a fraud changes nothing on its own. What changes things is
 * the complaint actually being filed, the sender actually being refused, the rest
 * of the family actually being told — and those are skipped because each one is a
 * small chore in official language most people do not write comfortably.
 *
 * The same is true in the other direction: everybody knows the streetlight is out,
 * and almost nobody writes to the office that could fix it, because they do not
 * know which office that is or how to address it.
 *
 * So every verdict here comes out as finished paper, ready to copy and send.
 */

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d = new Date()) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

const L = (table, lang) => table[lang] || table.en;

/** A flat refusal that closes a conversation without arguing or revealing anything. */
const REFUSAL = {
  en: 'I do not share OTP, bank or identity details over calls or chat. I am verifying this directly with the bank and the police. Please do not contact me again.',
  ta: 'OTP, வங்கி அல்லது அடையாள விவரங்களை அழைப்பிலோ அரட்டையிலோ நான் பகிர மாட்டேன். இதை நேரடியாக வங்கியிடமும் காவல்துறையிடமும் சரிபார்க்கிறேன். மீண்டும் தொடர்பு கொள்ள வேண்டாம்.',
  hi: 'मैं OTP, बैंक या पहचान की जानकारी कॉल या चैट पर साझा नहीं करता/करती। मैं इसे सीधे बैंक और पुलिस से जाँच रहा/रही हूँ। कृपया दोबारा संपर्क न करें।',
};

const WARN = {
  en: (name) => `Careful — I just received a "${name}" message. It is a fraud. Do not reply, do not pay, do not share any OTP. If something like this reaches you, send it to me first.`,
  ta: (name) => `கவனம் — எனக்கு இப்போது "${name}" செய்தி வந்தது. இது மோசடி. பதில் அளிக்க வேண்டாம், பணம் அனுப்ப வேண்டாம், OTP பகிர வேண்டாம். இதுபோல் வந்தால் முதலில் எனக்கு அனுப்புங்கள்.`,
  hi: (name) => `सावधान — मुझे अभी "${name}" वाला संदेश मिला। यह धोखाधड़ी है। जवाब न दें, पैसे न भेजें, OTP साझा न करें। ऐसा कुछ आए तो पहले मुझे भेजें।`,
};

const HEAD = {
  complaint: { en: 'Cybercrime complaint', ta: 'சைபர் குற்றப் புகார்', hi: 'साइबर अपराध शिकायत' },
  refusal: { en: 'Reply to the sender', ta: 'அனுப்பியவருக்குப் பதில்', hi: 'भेजने वाले को जवाब' },
  warn: { en: 'Warn your family', ta: 'குடும்பத்தை எச்சரி', hi: 'परिवार को सचेत करें' },
  grievance: { en: 'Grievance letter', ta: 'மனு கடிதம்', hi: 'शिकायत पत्र' },
};

/** A line of evidence only appears when there is evidence to put on it. */
const line = (label, arr) => (arr && arr.length ? `${label}: ${arr.join(', ')}` : null);

/** The complaint that goes to cybercrime.gov.in, with every detail already filled in. */
function complaint(verdict, lang = 'en') {
  const name = L(verdict.type.name, lang);
  const e = verdict.evidence;
  return [
    'To,',
    'The Station House Officer / National Cyber Crime Reporting Portal (cybercrime.gov.in)',
    '',
    `Subject: Complaint regarding an attempted "${name}" fraud`,
    '',
    'Respected Sir/Madam,',
    '',
    'I wish to report the communication reproduced below, which I believe to be a fraudulent',
    'attempt to obtain money or personal information from me. I have not shared any OTP,',
    'password or payment with the sender.',
    '',
    `Date noted: ${stamp()}`,
    `Suspected category: ${name}`,
    `Method used: ${L(verdict.type.tactic, lang)}`,
    `Urimai risk assessment: ${verdict.score}/100`,
    '',
    'Identifiers found in the message (remove any that are your own before filing):',
    line('  UPI handles', e.upi),
    line('  Phone numbers', e.phones),
    line('  Bank accounts', e.accounts),
    line('  Links used', e.links),
    line('  Amounts demanded', e.amounts),
    '',
    'Message received (personal details of mine removed):',
    verdict.redacted.slice(0, 700),
    '',
    'I request that this complaint be registered and the identifiers above be investigated',
    'so that others are not defrauded in the same manner.',
    '',
    'Yours faithfully,',
    '[Your name]',
    '[Your phone number]',
    '[Your address]',
    `Date: ${stamp()}`,
  ].filter((l) => l !== null).join('\n');
}

/** The grievance letter, addressed to the office that actually owns the problem. */
function grievance(verdict, lang = 'en', place = '[area / street name]') {
  const dept = L(verdict.type.dept, lang);
  return [
    'To,',
    'The Executive Officer,',
    dept,
    '[City / Taluk / District]',
    '',
    'Subject: Request for redressal of a civic grievance',
    '',
    'Respected Sir/Madam,',
    '',
    'I am a resident of the area mentioned below and wish to bring the following to your',
    'kind notice:',
    '',
    verdict.redacted.slice(0, 700),
    '',
    `Location of the problem: ${place}`,
    `Date of this representation: ${stamp()}`,
    '',
    'This has been causing hardship to the residents of the locality, including risk to',
    'the safety and health of children and elderly persons. Several residents share this',
    'difficulty.',
    '',
    'I therefore request that the matter be inspected and the necessary action taken at',
    'the earliest, and that I be informed of the action taken on this representation.',
    '',
    'Thanking you,',
    '',
    'Yours faithfully,',
    '[Your name]',
    '[Your address]',
    '[Your phone number]',
  ].join('\n');
}

/**
 * Turn a verdict into the finished documents for it.
 * @returns {{id:string,title:string,body:string,copyable:boolean}[]}
 */
function draft(verdict, lang = 'en', place) {
  if (verdict.kind === 'THREAT') {
    return [
      { id: 'refusal', title: L(HEAD.refusal, lang), body: L(REFUSAL, lang), copyable: true },
      { id: 'complaint', title: L(HEAD.complaint, lang), body: complaint(verdict, lang), copyable: true },
      { id: 'warn', title: L(HEAD.warn, lang), body: L(WARN, lang)(L(verdict.type.name, lang)), copyable: true },
    ];
  }
  if (verdict.kind === 'CIVIC') {
    return [{ id: 'grievance', title: L(HEAD.grievance, lang), body: grievance(verdict, lang, place), copyable: true }];
  }
  return [];
}

/** Where a finished document is meant to go. */
const DESTINATIONS = {
  complaint: [
    { label: 'File it at cybercrime.gov.in', url: 'https://cybercrime.gov.in' },
    { label: 'Call 1930 if money has already gone', url: 'tel:1930' },
    { label: 'Report the number on Sanchar Saathi', url: 'https://sancharsaathi.gov.in' },
  ],
  grievance: [{ label: 'Find your local body on the CPGRAMS portal', url: 'https://pgportal.gov.in' }],
};

const LETTERS_API = { draft, complaint, grievance, DESTINATIONS, stamp };
if (typeof window !== 'undefined') window.UrimaiLetters = LETTERS_API;
if (typeof module !== 'undefined') module.exports = LETTERS_API;
