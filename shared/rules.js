'use strict';

/**
 * Urimai's offline brain.
 *
 * One pipeline, pointed both ways. Anything a person pastes in is either
 * something coming AT them that may be a fraud (THREAT), something wrong around
 * them that an office should fix (CIVIC), or neither (SAFE). The same three-step
 * shape — judge it, say why, write the reply — serves both directions, which is
 * why the scam shield and the grievance helper are one product and not two.
 *
 * This file needs no API key and no network. Gemini sharpens the wording when it
 * is available (see ai.js), but the verdict below always stands on its own, so
 * the app is never a blank screen.
 */

/** The eight fraud families that account for most money lost in India. */
const THREATS = [
  {
    id: 'investment',
    name: { en: 'Fake investment', ta: 'போலி முதலீடு', hi: 'नकली निवेश' },
    re: /\b(invest|trading|stock\s*tips?|guaranteed|assured\s*return|profit|double|crypto|ipo\s*allot|vip\s*group|portfolio|demat)\b/i,
    tactic: { en: 'Greed and false scarcity', ta: 'பேராசையும் போலி பற்றாக்குறையும்', hi: 'लालच और नकली कमी' },
    tell: {
      en: 'Nobody can guarantee a daily or monthly profit. A promised return is the single clearest sign of a fraud.',
      ta: 'தினசரி அல்லது மாதாந்திர லாபத்தை யாரும் உறுதியளிக்க முடியாது. உறுதியளிக்கப்பட்ட வருமானமே மோசடியின் தெளிவான அடையாளம்.',
      hi: 'रोज़ या महीने का मुनाफ़ा कोई पक्का नहीं कर सकता। गारंटीड रिटर्न ही धोखे की सबसे साफ़ पहचान है।',
    },
  },
  {
    id: 'arrest',
    name: { en: 'Digital arrest', ta: 'டிஜிட்டல் கைது', hi: 'डिजिटल अरेस्ट' },
    re: /\b(cbi|c\.?b\.?i|police|arrest|warrant|narcotics|customs\s*officer|cyber\s*cell|court|enforcement\s*directorate|interrogat)\b/i,
    tactic: { en: 'Authority and fear', ta: 'அதிகாரமும் பயமும்', hi: 'रौब और डर' },
    tell: {
      en: 'No police force in India arrests anyone over a video call, and none will tell you to hide it from your family.',
      ta: 'இந்தியாவில் எந்தக் காவல்துறையும் வீடியோ அழைப்பில் கைது செய்வதில்லை; குடும்பத்திடம் மறைக்கச் சொல்வதுமில்லை.',
      hi: 'भारत में कोई पुलिस वीडियो कॉल पर गिरफ़्तार नहीं करती, और न ही परिवार से छिपाने को कहती है।',
    },
  },
  {
    id: 'kyc',
    name: { en: 'KYC or OTP theft', ta: 'KYC / OTP திருட்டு', hi: 'KYC या OTP चोरी' },
    re: /\b(kyc|otp|aadhaar|pan\s*card|re-?kyc|account\s*(will\s*be\s*)?(block|suspend|freez)|verify\s*(your\s*)?(account|card|details)|net\s*?banking|cvv|pin)\b/i,
    tactic: { en: 'Urgency wearing a bank uniform', ta: 'வங்கி உடையணிந்த அவசரம்', hi: 'बैंक की वर्दी पहने जल्दबाज़ी' },
    tell: {
      en: 'A bank already has your KYC. It never sends a link for it, and no real employee will ever ask for an OTP.',
      ta: 'வங்கியிடம் உங்கள் KYC ஏற்கனவே உள்ளது. அதற்காக இணைப்பு அனுப்பாது; உண்மையான ஊழியர் OTP கேட்கமாட்டார்.',
      hi: 'बैंक के पास आपका KYC पहले से है। वह लिंक नहीं भेजता, और कोई असली कर्मचारी OTP नहीं माँगता।',
    },
  },
  {
    id: 'courier',
    name: { en: 'Courier or customs', ta: 'கூரியர் / சுங்கம்', hi: 'कूरियर या कस्टम' },
    re: /\b(courier|parcel|fedex|dtdc|blue\s*dart|customs\s*(duty|clearance)|package|consignment|shipment\s*(hold|seiz))\b/i,
    tactic: { en: 'Fear wrapped in paperwork', ta: 'ஆவணங்களில் மறைந்த பயம்', hi: 'कागज़ात में लिपटा डर' },
    tell: {
      en: 'Customs duty is paid to the government, never through a link or a UPI id sent to you by message.',
      ta: 'சுங்க வரி அரசுக்குச் செலுத்தப்படுகிறது; செய்தியில் வந்த இணைப்பு அல்லது UPI முகவரிக்கு அல்ல.',
      hi: 'कस्टम ड्यूटी सरकार को दी जाती है, किसी लिंक या मैसेज में आए UPI पर नहीं।',
    },
  },
  {
    id: 'job',
    name: { en: 'Task or part-time job', ta: 'டாஸ்க் / பகுதிநேர வேலை', hi: 'टास्क या पार्ट-टाइम जॉब' },
    re: /\b(task|work\s*from\s*home|part[\s-]?time|like\s*(and\s*earn|\d+\s*video)|rating\s*job|prepaid\s*task|daily\s*income|telegram\s*job)\b/i,
    tactic: { en: 'A small win, then a deposit', ta: 'சிறு வெற்றி, பின் டெபாசிட்', hi: 'छोटी जीत, फिर जमा' },
    tell: {
      en: 'A real job pays you. The moment you are asked to deposit money to start earning, it is a fraud.',
      ta: 'உண்மையான வேலை உங்களுக்குப் பணம் தரும். சம்பாதிக்கத் தொடங்க பணம் கட்டச் சொன்னால் அது மோசடி.',
      hi: 'असली नौकरी आपको पैसे देती है। कमाने के लिए पैसे जमा करने को कहा जाए तो वह धोखा है।',
    },
  },
  {
    id: 'prize',
    name: { en: 'Lottery or fake bill', ta: 'லாட்டரி / போலி பில்', hi: 'लॉटरी या नकली बिल' },
    re: /\b(lottery|lucky\s*draw|prize|winner|kbc|jackpot|processing\s*fee|electricity\s*(bill|will\s*be\s*disconnect)|disconnect(ed|ion)?\s*tonight)\b/i,
    tactic: { en: 'Sudden luck or sudden shock', ta: 'திடீர் அதிர்ஷ்டம் அல்லது அதிர்ச்சி', hi: 'अचानक किस्मत या झटका' },
    tell: {
      en: 'You cannot win a draw you never entered, and paying to receive money is always backwards.',
      ta: 'நீங்கள் பங்கேற்காத குலுக்கலில் வெல்ல முடியாது; பணம் பெற பணம் கட்டுவது எப்போதும் தலைகீழ்.',
      hi: 'जिस ड्रॉ में आपने भाग ही नहीं लिया उसे आप जीत नहीं सकते; पैसे पाने के लिए पैसे देना हमेशा उल्टा है।',
    },
  },
  {
    id: 'impersonation',
    name: { en: 'Voice clone or fake relative', ta: 'குரல் நகல் / போலி உறவினர்', hi: 'आवाज़ की नकल या नकली रिश्तेदार' },
    re: /\b(new\s*number|phone\s*(broke|lost|damage)|this\s*is\s*(your\s*)?(amma|appa|mummy|papa|son|daughter)|urgent(ly)?\s*(need|send)?\s*(money|transfer)|accident|hospital\s*urgent)\b/i,
    tactic: { en: 'Wearing someone you love', ta: 'நீங்கள் நேசிப்பவரின் வேடம்', hi: 'अपने किसी प्रिय का रूप' },
    tell: {
      en: 'Always ring the number you already have. A new number asking for money is the oldest trick there is.',
      ta: 'உங்களிடம் ஏற்கனவே உள்ள எண்ணுக்கே அழையுங்கள். புது எண்ணில் பணம் கேட்பது மிகப் பழைய தந்திரம்.',
      hi: 'पहले से सेव नंबर पर ही कॉल करें। नए नंबर से पैसे माँगना सबसे पुरानी चाल है।',
    },
  },
  {
    id: 'loan',
    name: { en: 'Loan app or blackmail', ta: 'கடன் செயலி / மிரட்டல்', hi: 'लोन ऐप या ब्लैकमेल' },
    re: /\b(loan|pre[\s-]?approved|\.apk|install\s*(this\s*)?app|screen\s*shar|anydesk|teamviewer|nude|morph|video\s*leak|blackmail|viral)\b/i,
    tactic: { en: 'Shame, or desperation for cash', ta: 'அவமானம் அல்லது பணத் தேவை', hi: 'शर्म या पैसे की मजबूरी' },
    tell: {
      en: 'Installing an app from a link hands a stranger your contacts, photos and screen. No lender needs that.',
      ta: 'இணைப்பிலிருந்து செயலியை நிறுவினால் உங்கள் தொடர்புகள், படங்கள், திரை அனைத்தும் அந்நியரிடம் செல்லும்.',
      hi: 'लिंक से ऐप इंस्टॉल करने पर आपके संपर्क, फ़ोटो और स्क्रीन अजनबी के हाथ चले जाते हैं।',
    },
  },
];

/** Words that mean someone is being hurried — pressure is the common thread of every fraud. */
const PRESSURE = /\b(urgent|immediately|right\s*now|within\s*\d+\s*(min|hour)|today\s*only|last\s*chance|final\s*notice|act\s*now|do\s*not\s*(tell|disconnect|inform)|don'?t\s*tell|keep\s*(this\s*)?(secret|confidential))\b/i;

/** Words that mean someone is being asked to hand something over. */
const DEMAND = /\b(otp|pin|cvv|password|upi|qr|pay|paid|transfer|deposit|send\s*money|fee|fine|charge|click|link|install|download|share\s*(your)?\s*(screen|details))\b/i;

/**
 * Civic complaints, each routed to the office that actually owns the problem.
 * Getting the department right is most of what makes a grievance letter work.
 */
const CIVIC = [
  { id: 'road', re: /\b(potholes?|roads?|speed\s*breakers?|footpaths?|pavements?|tar|dig(ging)?\s*up)\b/i,
    dept: { en: 'Highways Department / Corporation Engineering Wing', ta: 'நெடுஞ்சாலைத் துறை / மாநகராட்சி பொறியியல் பிரிவு', hi: 'राजमार्ग विभाग / निगम अभियांत्रिकी शाखा' } },
  { id: 'waste', re: /\b(garbage|waste|trash|rubbish|dump|sweep|sanitation|drain\s*block|clean)\b/i,
    dept: { en: 'Sanitation / Solid Waste Management Department', ta: 'துப்புரவு / திடக்கழிவு மேலாண்மைத் துறை', hi: 'स्वच्छता / ठोस अपशिष्ट प्रबंधन विभाग' } },
  { id: 'light', re: /\b(street\s*lights?|lamp\s*posts?|dark\s*(street|road)|no\s*light)\b/i,
    dept: { en: 'Electrical Wing, Municipal Corporation', ta: 'மின் பிரிவு, மாநகராட்சி', hi: 'विद्युत शाखा, नगर निगम' } },
  { id: 'water', re: /\b(water\s*(supply|shortage|leak|tank|pipe)|no\s*water|tap|borewell|hand\s*pump)\b/i,
    dept: { en: 'Water Supply and Sewerage Board', ta: 'குடிநீர் மற்றும் கழிவுநீர் வாரியம்', hi: 'जल आपूर्ति एवं सीवरेज बोर्ड' } },
  { id: 'sewage', re: /\b(sewage|sewers?|manholes?|overflow(ing)?|stagnant|septic)\b/i,
    dept: { en: 'Sewerage Division', ta: 'கழிவுநீர் பிரிவு', hi: 'सीवरेज प्रभाग' } },
  { id: 'power', re: /\b(power\s*cut|electricity\s*(cut|fail)|transformer|voltage|current\s*(not|off))\b/i,
    dept: { en: 'State Electricity Board, Area Engineer', ta: 'மாநில மின்சார வாரியம், பகுதி பொறியாளர்', hi: 'राज्य विद्युत बोर्ड, क्षेत्र अभियंता' } },
  { id: 'ration', re: /\b(ration|pds|fair\s*price\s*shop|smart\s*card|foodgrain)\b/i,
    dept: { en: 'Civil Supplies and Consumer Protection Department', ta: 'உணவுப் பொருள் வழங்கல் மற்றும் நுகர்வோர் பாதுகாப்புத் துறை', hi: 'नागरिक आपूर्ति एवं उपभोक्ता संरक्षण विभाग' } },
  { id: 'transport', re: /\b(bus\s*stops?|bus\s*service|auto\s*fare|transport|route\s*cancel)\b/i,
    dept: { en: 'State Road Transport Corporation', ta: 'மாநில சாலைப் போக்குவரத்துக் கழகம்', hi: 'राज्य सड़क परिवहन निगम' } },
  { id: 'animal', re: /\b(stray\s*(dogs?|cattle|cows?)|monkeys?|animal\s*menace)\b/i,
    dept: { en: 'Veterinary / Public Health Department', ta: 'கால்நடை / பொது சுகாதாரத் துறை', hi: 'पशु चिकित्सा / जन स्वास्थ्य विभाग' } },
  { id: 'encroach', re: /\b(encroach|illegal\s*(construction|building|shop)|unauthoris?zed\s*construction)\b/i,
    dept: { en: 'Revenue Department / Town Planning', ta: 'வருவாய்த் துறை / நகர அமைப்பு', hi: 'राजस्व विभाग / नगर नियोजन' } },
];

/** Nothing identifying ever leaves the device unmasked. */
function redact(text) {
  return String(text)
    .replace(/\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b/g, '[AADHAAR]')
    .replace(/\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g, '[PHONE]')
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[PAN]')
    .replace(/\b\d{9,18}\b/g, '[ACCOUNT]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g, '[EMAIL]')
    .replace(/\b[\w.-]+@[a-z]{2,}\b/gi, '[UPI]');
}

const PHONE_RE = /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/g;

/**
 * Pull out the details a complaint form will ask for.
 *
 * Two distinctions matter and neither is obvious. A UPI handle has no dot after
 * the @ — `ravi@okaxis` is one, `ravi@gmail.com` is an email — so a trailing dot
 * disqualifies it. And an Indian mobile number is ten digits, which also fits the
 * shape of a bank account, so phones are claimed first and excluded from accounts.
 * Mixing either pair up puts the wrong identifier in a police complaint.
 */
function evidence(text) {
  const src = String(text);
  const grab = (re) => [...new Set(src.match(re) || [])].slice(0, 6);
  const phones = grab(PHONE_RE);
  const bare = new Set(phones.map((p) => p.replace(/\D/g, '').slice(-10)));
  return {
    upi: grab(/\b[\w.-]{2,}@[a-z]{2,}\b(?!\.[a-z])/gi),
    phones,
    links: grab(/\bhttps?:\/\/[^\s<>"]+|\b(?:bit\.ly|tinyurl\.com)\/\S+/gi),
    amounts: grab(/(?:₹|rs\.?\s?|inr\s?)\s?[\d,]+(?:\.\d+)?/gi),
    accounts: grab(/\b\d{9,18}\b/g).filter((n) => !bare.has(n.slice(-10)) || n.length > 10),
  };
}

/**
 * Pick the office that owns the problem.
 *
 * A complaint usually names more than one thing — "the street light on our road"
 * is about the light, not the road — so matches are weighted by how specific they
 * are. "street light" is twelve characters of evidence; the bare word "road" is
 * four, and loses. Without this, whichever pattern sits first in the list wins,
 * and the letter goes to the wrong office.
 */
function bestCivic(text) {
  let best = null;
  let bestWeight = 0;
  for (const c of CIVIC) {
    const found = String(text).match(new RegExp(c.re.source, 'gi')) || [];
    const weight = [...new Set(found.map((m) => m.toLowerCase()))]
      .reduce((sum, m) => sum + m.replace(/\s+/g, ' ').trim().length, 0);
    if (weight > bestWeight) { best = c; bestWeight = weight; }
  }
  return best;
}

/**
 * Judge one piece of text.
 * @param {string} text what the person pasted or described
 * @returns {{kind:'THREAT'|'CIVIC'|'SAFE', score:number, ...}}
 */
function judge(text) {
  const t = String(text || '');
  const threat = THREATS.find((x) => x.re.test(t));
  const pressure = PRESSURE.test(t);
  const demand = DEMAND.test(t);
  const civic = bestCivic(t);
  const ev = evidence(t);

  // A fraud family on its own proves little; a family plus a demand proves a lot.
  let score = 0;
  if (threat) score += 42;
  if (pressure) score += 24;
  if (demand) score += 24;
  if (ev.links.length) score += 6;
  if (ev.upi.length) score += 6;
  if (threat && pressure && demand) score += 5;
  score = Math.min(score, 98);

  if (threat && (pressure || demand)) {
    return { kind: 'THREAT', score, type: threat, evidence: ev, redacted: redact(t) };
  }
  if (civic && !threat) {
    return { kind: 'CIVIC', score: 0, type: civic, evidence: ev, redacted: redact(t) };
  }
  return { kind: 'SAFE', score: Math.min(score, 28), type: null, evidence: ev, redacted: redact(t) };
}

const RULES_API = { judge, redact, evidence, THREATS, CIVIC };
if (typeof window !== 'undefined') window.UrimaiRules = RULES_API;
if (typeof module !== 'undefined') module.exports = RULES_API;
