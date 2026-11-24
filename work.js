'use strict';
/* HerdBook - working cattle at the chute (tick-box plan, one animal at a time), the product
   list (common vaccines, wormers, antibiotics... with label doses), and money / expenses.
   Loaded after app.js; starts HerdBook at the bottom. */

// ================================================================ PRODUCT CATALOGUE
// Starting numbers from common US labels. Every farm should check them against the bottle's
// label once - fixing one here fixes it for good on this herd. Withdrawal blank = check label.
const CAT = [];
function P(group, rows) {
  for (const [name, d, route, site, w, x] of rows) CAT.push(Object.assign({ name, group, dose: typeof d === 'string' ? d : '', mlPer: Array.isArray(d) ? d : null, route: route || '', site: site || '', withdrawalDays: w ?? null }, x || {}));
}
const NECK = 'Neck', RX = { rx: true };
P('Respiratory vaccines', [
  ['Bovi-Shield Gold 5', '2 mL', 'SQ', NECK, 21], ['Bovi-Shield Gold One Shot', '2 mL', 'SQ', NECK, 21], ['Bovi-Shield Gold FP 5 L5 HB', '2 mL', 'SQ', NECK, 21],
  ['Express 5', '2 mL', 'SQ', NECK, 21], ['Express FP 10', '2 mL', 'SQ', NECK, 21], ['Express FP 5 VL5', '2 mL', 'SQ', NECK, 21],
  ['Pyramid 5', '2 mL', 'SQ', NECK, 21], ['Pyramid 5 + Presponse SQ', '2 mL', 'SQ', NECK, 21], ['Vista 5 SQ', '2 mL', 'SQ', NECK, 21], ['Vista Once SQ', '2 mL', 'SQ', NECK, 21],
  ['Titanium 5', '2 mL', 'SQ', NECK, 21], ['Titanium 5 + PH-M', '2 mL', 'SQ', NECK, 21], ['Triangle 10', '', 'SQ', NECK, 21], ['CattleMaster Gold FP 5 L5', '', 'SQ', NECK, 21],
  ['Inforce 3', '2 mL', 'Intranasal', 'Nose', null], ['Nasalgen 3', '2 mL', 'Intranasal', 'Nose', null],
  ['One Shot (Mannheimia)', '2 mL', 'SQ', NECK, 21], ['Once PMH SQ', '2 mL', 'SQ', NECK, null]
]);
P('Blackleg / clostridial vaccines', [
  ['Vision 7 with SPUR', '2 mL', 'SQ', NECK, 21, { boosterDays: 28 }], ['Vision 8 with SPUR', '2 mL', 'SQ', NECK, 21, { boosterDays: 28 }], ['Vision 7 Somnus with SPUR', '2 mL', 'SQ', NECK, 21, { boosterDays: 28 }],
  ['Alpha-7', '2 mL', 'SQ', NECK, 21, { boosterDays: 28 }], ['One Shot Ultra 7', '2 mL', 'SQ', NECK, 21], ['Ultrabac 7', '', 'SQ', NECK, 21, { boosterDays: 28 }], ['Ultrabac 8', '', 'SQ', NECK, 21, { boosterDays: 28 }],
  ['Covexin 8', '5 mL', 'SQ', NECK, 21, { boosterDays: 28 }], ['Calvary 9', '', 'SQ', NECK, 21], ['Bar Vac 7', '', 'SQ', NECK, 21], ['Ultrabac 7 / Somubac', '', 'SQ', NECK, 21]
]);
P('Reproductive & lepto vaccines', [
  ['Bovi-Shield Gold FP 5 VL5 HB', '', 'SQ', NECK, 21], ['CattleMaster 4 + VL5', '', 'SQ', NECK, 21], ['Vira Shield 6 + VL5 HB', '', 'SQ', NECK, 21], ['Leptoferm-5', '', 'SQ', NECK, 21],
  ['Spirovac (lepto hardjo-bo)', '2 mL', 'SQ', NECK, null], ['Vibrin (vibrio)', '', 'SQ', NECK, null], ['TrichGuard', '', 'SQ', NECK, null], ['Brucellosis RB51 (Bangs) — vet only', '2 mL', 'SQ', NECK, null, RX]
]);
P('Scours — cow vaccines & newborn calf', [
  ['ScourGuard 4KC', '2 mL', 'IM', NECK, null], ['Scour Bos 9', '2 mL', 'IM', NECK, null], ['Guardian', '2 mL', 'SQ', NECK, null],
  ['First Defense (bolus)', '1 bolus', 'Oral', 'Mouth', null], ['Bovine Ecolizer + C20', '', 'Oral', 'Mouth', null], ['Calf-Guard', '', 'Oral', 'Mouth', null],
  ['Colostrum replacer', '1 bag', 'Oral', 'Mouth', 0], ['Electrolytes', '', 'Oral', 'Mouth', 0], ['Navel dip (iodine)', '', 'Topical', 'Navel', 0]
]);
P('Pinkeye, foot rot & other vaccines', [
  ['Piliguard Pinkeye-1 Trivalent', '2 mL', 'SQ', NECK, null], ['Pinkeye Shield XT4', '', 'SQ', NECK, null], ['i-Site XP (pinkeye)', '', 'SQ', NECK, null], ['Autogenous pinkeye vaccine', '', 'SQ', NECK, null],
  ['Fusogard (foot rot)', '', 'SQ', NECK, null], ['Anthrax spore vaccine', '', 'SQ', NECK, null], ['Anaplasmosis vaccine', '', 'SQ', NECK, null, RX]
]);
P('Dewormers', [
  ['Dectomax Pour-On', [1, 22], 'Pour-on', 'Back', 45], ['Dectomax Injectable', [1, 110], 'SQ', NECK, 35], ['Cydectin Pour-On', [1, 22], 'Pour-on', 'Back', 0],
  ['Cydectin Injectable', [1, 110], 'SQ', NECK, null], ['LongRange', [1, 110], 'SQ', 'Neck (in front of shoulder)', 48], ['Ivomec Injection', [1, 110], 'SQ', NECK, 35],
  ['Ivomec Pour-On', [1, 22], 'Pour-on', 'Back', 48], ['Ivomec Plus', [1, 110], 'SQ', NECK, 49], ['Noromectin Injection', [1, 110], 'SQ', NECK, 35], ['Noromectin Pour-On', [1, 22], 'Pour-on', 'Back', 48],
  ['Eprinex Pour-On', [1, 22], 'Pour-on', 'Back', 0], ['Safe-Guard 10% drench', [2.3, 100], 'Oral', 'Mouth', 8], ['Valbazen', [4, 100], 'Oral', 'Mouth', 27], ['Safe-Guard in feed / mineral', '', 'Oral', 'Feed', null]
]);
P('Lice & fly control', [
  ['Clean-Up II Pour-On', '', 'Pour-on', 'Back', 0], ['Ultra Saber Pour-On', '', 'Pour-on', 'Back', 0], ['StandGuard Pour-On', '', 'Pour-on', 'Back', 0], ['Permectrin II spray', '', 'Spray', 'Body', 0],
  ['Python II fly tags', '2 tags', 'Ear tag', 'Ears', 0], ['Corathon fly tags', '2 tags', 'Ear tag', 'Ears', 0], ['Patriot fly tags', '2 tags', 'Ear tag', 'Ears', 0], ['XP 820 fly tags', '2 tags', 'Ear tag', 'Ears', 0], ['Optimizer fly tags', '2 tags', 'Ear tag', 'Ears', 0]
]);
P('Antibiotics (Rx — follow your vet)', [
  ['Draxxin', [1.1, 100], 'SQ', NECK, 18, RX], ['Excede', [1.5, 100], 'SQ', 'Back of ear', 13, RX], ['LA-200', [4.5, 100], 'IM', NECK, 28], ['Bio-Mycin 200', [4.5, 100], 'IM', NECK, 28],
  ['Nuflor', [6, 100], 'SQ', NECK, 38, RX], ['Resflor Gold', [6, 100], 'SQ', NECK, 38, RX], ['Zuprevo', [1, 100], 'SQ', NECK, 44, RX], ['Micotil (vet only)', '1–2 mL per 100 lb', 'SQ', NECK, 42, RX],
  ['Baytril 100', '2.3–5.7 mL per 100 lb', 'SQ', NECK, 28, RX], ['Excenel RTU EZ', '1–2 mL per 100 lb', 'SQ', NECK, 4, RX], ['Penicillin G procaine', '', 'IM', NECK, null], ['Polyflex', '', 'IM', NECK, null, RX], ['Advocin', '', 'SQ', NECK, null, RX]
]);
P('Pain & inflammation (Rx)', [['Banamine', [2, 100], 'IV', 'Jugular vein', 4, RX], ['Banamine Transdermal', '', 'Pour-on', 'Back', null, RX], ['Meloxicam (vet)', '', 'Oral', 'Mouth', null, RX], ['Dexamethasone', '', 'IM', NECK, null, RX]]);
P('Vitamins, minerals & supplements', [
  ['Multimin 90', '1 mL per 100 lb', 'SQ', NECK, 14], ['Vitamin AD&E injectable', '', 'IM', NECK, null], ['Vitamin B complex', '', 'IM', NECK, null], ['Bo-Se (vet)', '', 'IM', NECK, null, RX],
  ['Calcium / CMPK gel', '1 tube', 'Oral', 'Mouth', 0], ['Mineral oil (bloat)', '', 'Oral', 'Mouth', 0], ['Cow magnet', '1', 'Oral', 'Mouth', 0]
]);
P('Implants', [['Ralgro', '1 implant', 'Implant', 'Ear', 0], ['Synovex C', '1 implant', 'Implant', 'Ear', 0], ['Synovex S', '1 implant', 'Implant', 'Ear', 0], ['Synovex H', '1 implant', 'Implant', 'Ear', 0], ['Component E-C', '1 implant', 'Implant', 'Ear', 0], ['Revalor-G', '1 implant', 'Implant', 'Ear', 0]]);
P('Breeding & heat synchronization', [
  ['CIDR (insert)', '1 insert', 'Vaginal', '', 0], ['Lutalyse', '5 mL', 'IM', NECK, 0, RX], ['Lutalyse HighCon', '', 'SQ', NECK, null, RX], ['estroPLAN', '2 mL', 'IM', NECK, null, RX], ['Estrumate', '2 mL', 'IM', NECK, null, RX],
  ['Factrel (GnRH)', '2 mL', 'IM', NECK, null, RX], ['Cystorelin (GnRH)', '2 mL', 'IM', NECK, null, RX], ['Fertagyl (GnRH)', '2 mL', 'IM', NECK, null, RX], ['Oxytocin', '', 'IM', NECK, null, RX]
]);
const CAT_BY = {}; CAT.forEach(c => CAT_BY[c.name.toLowerCase()] = c);
const PGROUPS = [...new Set(CAT.map(c => c.group)), 'Other'];
function catalogProduct(name) { const c = CAT_BY[String(name || '').trim().toLowerCase()]; return c ? JSON.parse(JSON.stringify(c)) : null; }
function productByName(name) { const n = String(name || '').trim().toLowerCase(); return DB.products.find(p => (p.name || '').toLowerCase() === n) || CAT_BY[n] || null; }
// "5.5 mL" for a weight-dosed product when the weight is known, else the label rule
function doseMl(p, w) { return p && p.mlPer && w ? Math.round(w / p.mlPer[1] * p.mlPer[0] * 10) / 10 : (p && /^\s*[\d.]+\s*mL/i.test(p.dose || '') ? parseFloat(p.dose) : null); }
function doseText(p, w) {
  if (!p) return '';
  if (p.mlPer) return w ? doseMl(p, w) + ' mL' : `${p.mlPer[0]} mL per ${p.mlPer[1]} lb`;
  return p.dose || '';
}
const prodSum = p => [doseText(p), p.route, p.site, p.withdrawalDays != null ? (p.withdrawalDays ? p.withdrawalDays + '-day withdrawal' : 'no withdrawal') : 'withdrawal: check label', p.rx ? 'Rx' : ''].filter(Boolean).join(' · ');
// every product for a pick list: the farm's own first, then the catalogue by group
function productItems() {
  const mine = DB.products.slice().sort((a, b) => natCmp(a.name, b.name)), have = new Set(mine.map(p => p.name.toLowerCase()));
  const out = mine.length ? [{ g: 'My products' }, ...mine.map(p => ({ v: p.name, s: prodSum(p) }))] : [];
  for (const g of PGROUPS) { const l = CAT.filter(c => c.group === g && !have.has(c.name.toLowerCase())); if (l.length) out.push({ g }, ...l.map(c => ({ v: c.name, s: prodSum(c) }))); }
  return out;
}
function actProduct(id, name) {
  const p = id ? IX.products[id] : Object.assign({}, catalogProduct(name) || { name: name || '' }), set = S();
  openForm({
    title: id ? p.name : 'Add a product', wide: true,
    values: Object.assign({}, p, { mlA: p.mlPer ? p.mlPer[0] : null, mlB: p.mlPer ? p.mlPer[1] : null }),
    intro: 'Check these against the label on your bottle. Weight-based products work out the dose for each animal at the chute.',
    fields: [
      { k: 'name', label: 'Product name', req: true, full: true }, { k: 'group', label: 'Kind', type: 'list', options: PGROUPS },
      { k: 'dose', label: 'Dose (same for every animal)', ph: 'e.g. 2 mL', hint: 'Leave blank if it goes by weight.' },
      { k: 'mlA', label: 'Or by weight: mL…', type: 'number', ph: 'e.g. 1.1' }, { k: 'mlB', label: '…per this many lb', type: 'number', ph: 'e.g. 100' },
      { k: 'route', label: 'Route', type: 'list', options: set.routes }, { k: 'site', label: 'Where', type: 'list', options: set.sites },
      { k: 'withdrawalDays', label: 'Slaughter withdrawal (days)', type: 'number', hint: '0 = none. From the label.' }, { k: 'boosterDays', label: 'Booster in (days)', type: 'number', hint: 'Blank if no booster.' },
      { k: 'bottleMl', label: 'Bottle size (mL, or doses)', type: 'number' }, { k: 'bottlePrice', label: 'Bottle price ($)', type: 'number', hint: 'Lets HerdBook show what a working cost per head.' },
      { k: 'rx', label: 'Prescription', type: 'check', text: 'Rx / vet only' }, { k: 'checked', label: 'Label', type: 'check', text: 'I checked these against my label' },
      { k: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 2 }
    ],
    save: v => { const r = Object.assign({}, p, v, { mlPer: v.mlA && v.mlB ? [v.mlA, v.mlB] : null }); delete r.mlA; delete r.mlB; return put1('products', r); },
    del: id ? () => del1('products', id) : null, delConfirm: 'Remove this product from your list? Old treatment records keep its name.'
  });
}

// ================================================================ WORKING CATTLE
const WHO = [['all', 'Everyone'], ['bullcalves', 'Bull calves'], ['cows', 'Cows'], ['heifers', 'Heifers'], ['females', 'Cows + heifers'], ['breeding', 'Breeding herd (cows, heifers, bulls)'], ['calves', 'All calves'], ['hcalves', 'Heifer calves'], ['bcalves', 'Bull + steer calves'], ['scalves', 'Steer calves'], ['bulls', 'Bulls'], ['steers', 'Steers + steer calves'], ['intact', 'Bulls + bull calves'], ['males', 'All males']];
function whoOk(w, a) {
  const t = typeOf(a);
  switch (w) {
    case 'cows': return t === 'Cow'; case 'heifers': return t === 'Heifer'; case 'females': return t === 'Cow' || t === 'Heifer';
    case 'breeding': return t === 'Cow' || t === 'Heifer' || t === 'Bull';
    case 'calves': return /calf/.test(t); case 'hcalves': return t === 'Heifer calf'; case 'bcalves': return t === 'Bull calf' || t === 'Steer calf';
    case 'bullcalves': return t === 'Bull calf'; case 'scalves': return t === 'Steer calf'; case 'breedable': return breedable(a);
    case 'bulls': return t === 'Bull'; case 'steers': return /^Steer/.test(t); case 'males': return a.sex !== 'F'; case 'intact': return a.sex === 'M';
    default: return true;
  }
}
const whoLabel = w => (WHO.find(x => x[0] === w) || ['', 'Everyone'])[1];
// who a catalogue product is normally for, by its group
const GROUP_WHO = { 'Blackleg / clostridial vaccines': 'calves', 'Reproductive & lepto vaccines': 'breeding', 'Scours — cow vaccines & newborn calf': 'females', 'Implants': 'steers', 'Breeding & heat synchronization': 'females' };
const NEWBORN = /First Defense|Ecolizer|Calf-Guard|Colostrum|Electrolytes|Navel/;
function defaultWho(name) { const p = productByName(name) || {}; if (p.who) return p.who; if (/RB51/.test(p.name || '')) return 'hcalves'; if (NEWBORN.test(p.name || '')) return 'calves'; return GROUP_WHO[p.group] || 'all'; }
const isPG = p => /Lutalyse|estroPLAN|Estrumate|prostaglandin/i.test(p.name || '');
const isMLVResp = p => p.group === 'Respiratory vaccines' && !/Inforce|Nasalgen|One Shot \(|Once PMH/.test(p.name || '');
// Is this product / job right for this animal today? fits = tick it; warn = say why to think twice; stop = untick it
function check(kind, x, a) {
  const t = typeOf(a), d = ageDays(a), rs = breedable(a) ? repro(a).status : null, preg = rs === 'Bred' || rs === 'Overdue', maybe = rs === 'Exposed';
  const out = { fits: whoOk(x.who, a), warn: '', stop: false };
  if (kind === 'p') {
    const p = productByName(x.name) || {};
    if (isPG(p) && (preg || maybe)) { out.fits = false; out.stop = true; out.warn = preg ? 'she is BRED — this can make her abort' : 'she may be bred — this can make her abort'; }
    else if (isMLVResp(p) && (preg || maybe) && out.fits) out.warn = 'she may be bred — check the label says safe for pregnant cows';
    else if (p.group === 'Implants' && (t === 'Bull' || t === 'Bull calf' || t === 'Cow')) { out.fits = false; out.warn = 'implants are not for breeding cattle'; }
    else if (/RB51/.test(p.name || '') && t === 'Heifer calf' && d != null && (d < 120 || d > 365)) { out.fits = false; out.warn = 'Bangs is given at 4–12 months old'; }
    else if (/^Scour|ScourGuard|Guardian/.test(p.name || '') && out.fits && !preg && !maybe && rs) out.warn = 'not bred — the scours shot protects her coming calf';
  } else {
    const p = PROC_BY[x.k] || {};
    if (p.fx === 'castrate') { out.fits = t === 'Bull calf'; if (t === 'Bull') out.warn = 'a grown bull — not usually castrated'; if (a.sex !== 'M') { out.fits = false; out.stop = true; out.warn = t === 'Steer calf' || t === 'Steer' ? 'already a steer' : 'not a bull'; } }
    if (p.k === 'bangs') { if (t !== 'Heifer calf') { out.fits = false; out.stop = true; out.warn = 'Bangs vaccination is for heifer calves'; } else if (d != null && (d < 120 || d > 365)) { out.fits = false; out.warn = 'Bangs is given at 4–12 months old'; } }
    if (p.fx === 'ai') { if (!breedable(a)) { out.fits = false; out.stop = true; out.warn = 'not a breeding-age female'; } else if (preg) { out.fits = false; out.warn = 'already bred'; } }
    if (p.fx === 'wean' && !/calf/.test(t)) { out.fits = false; out.stop = true; out.warn = 'not a calf on the cow'; }
    if (p.k === 'dehorn' && a.horn && /Polled|Dehorned/.test(a.horn)) { out.fits = false; out.warn = (a.horn || '').toLowerCase(); }
  }
  return out;
}
// things done to an animal (each becomes a line in its health record)
const PROCS = [
  { k: 'castBand', l: 'Castrated — band', who: 'bullcalves', fx: 'castrate' }, { k: 'castKnife', l: 'Castrated — knife', who: 'bullcalves', fx: 'castrate' },
  { k: 'dehorn', l: 'Dehorned / disbudded', who: 'calves', fx: 'dehorn' }, { k: 'brand', l: 'Branded', who: 'all', fx: 'brand' },
  { k: 'retag', l: 'New ear tag put in', who: 'all', input: 'New tag number' }, { k: 'eid', l: 'EID / RFID tag put in', who: 'all', input: 'EID number (or scan)' },
  { k: 'wean', l: 'Weaned', who: 'calves', fx: 'wean' }, { k: 'bangs', l: 'Bangs tattoo (calfhood vaccinated)', who: 'hcalves' },
  { k: 'ai', l: 'AI bred', who: 'females', fx: 'ai' }, { k: 'hoof', l: 'Feet trimmed', who: 'all' }, { k: 'pinkeye', l: 'Pinkeye — treated / patched', who: 'all' },
  { k: 'footrot', l: 'Foot rot — treated', who: 'all' }, { k: 'tattoo', l: 'Tattooed', who: 'all' }, { k: 'dna', l: 'DNA / hair sample taken', who: 'all' },
  { k: 'blood', l: 'Blood drawn (preg / disease test)', who: 'all' }, { k: 'notch', l: 'BVD-PI ear notch', who: 'calves' }, { k: 'cull', l: 'Marked to cull', who: 'all', fx: 'cull' }
];
const PROC_BY = {}; PROCS.forEach(p => PROC_BY[p.k] = p);
// things measured or scored
const N19 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const MEAS = [
  { k: 'weight', l: 'Weight', t: 'num', unit: 'lb' }, { k: 'bcs', l: 'Body condition (1 thin – 9 fat)', t: 'seg', o: N19 },
  { k: 'preg', l: 'Preg check', t: 'preg', who: 'breedable' }, { k: 'docility', l: 'Docility (1 calm – 6 wild)', t: 'seg', o: [[1, '1 docile'], [2, '2 restless'], [3, '3 nervous'], [4, '4 flighty'], [5, '5 aggressive'], [6, '6 very aggr.']] },
  { k: 'scrotal', l: 'Scrotal circumference', t: 'num', unit: 'cm', who: 'intact' }, { k: 'bse', l: 'Breeding soundness (BSE)', t: 'seg', o: ['Pass', 'Fail', 'Defer'], who: 'intact' },
  { k: 'udder', l: 'Udder score (1 pendulous – 9 tight)', t: 'seg', o: N19, who: 'cows' }, { k: 'teat', l: 'Teat score (1 balloon – 9 small)', t: 'seg', o: N19, who: 'cows' },
  { k: 'feet', l: 'Feet & legs (1 bad – 9 ideal)', t: 'seg', o: N19 }, { k: 'teeth', l: 'Mouth / teeth', t: 'seg', o: ['Calf teeth', '2 tooth', '4 tooth', '6 tooth', 'Full mouth', 'Broken mouth', 'Smooth / gummer'] },
  { k: 'frame', l: 'Hip height', t: 'num', unit: 'in' }, { k: 'pelvic', l: 'Pelvic area', t: 'num', unit: 'sq cm', who: 'heifers' },
  { k: 'sort', l: 'Sort to pasture (gate cut)', t: 'pasture' }, { k: 'temp', l: 'Temperature', t: 'num', unit: '°F' }
];
const MEAS_BY = {}; MEAS.forEach(m => MEAS_BY[m.k] = m);
const measKind = m => m.l.replace(/ \(.*\)$/, '');

function newDraft(ids) { return { name: '', date: today(), by: '', ids: ids && ids.length ? ids : null, pastures: [], kinds: [], tags: '', all: false, prods: {}, procs: {}, meas: { note: 1 }, weightKind: 'Other', brand: '', sire: '', moveTo: '', pregMethod: 'Palpation', save: false, planName: '', q: '' }; }
function startWork(ids) { UI.wd = newDraft(ids); location.hash = '#/work/new'; if (route().r === 'work') refresh(); }
function draftIds(d) {
  if (d.ids) return d.ids.filter(id => AN(id));
  const s = new Set(), act = DB.animals.filter(isActive);
  const kindOk = a => !d.kinds.length || d.kinds.some(k => whoOk(k, a));
  if (d.all || (!d.pastures.length && d.kinds.length)) act.filter(kindOk).forEach(a => s.add(a.id));
  for (const p of d.pastures) act.filter(a => (p === '-' ? !a.pastureId : a.pastureId === p) && kindOk(a)).forEach(a => s.add(a.id));
  for (const t of d.tags.split(/[\s,;]+/).filter(Boolean)) { const a = findAnimal(t); if (a) s.add(a.id); }
  return [...s];
}
const openSessions = () => DB.sessions.filter(s => s.status === 'open').sort((a, b) => (b.started || 0) - (a.started || 0));
function workResumeCard() {
  return openSessions().map(s => `<a class="resume" href="#/work/${s.id}"><b>Continue: ${esc(s.name)}</b><span>${Object.keys(s.done || {}).length} of ${s.ids.length || '?'} done · ${fmtD(s.date)}</span><span class="go">Continue →</span></a>`).join('');
}

ROUTES.work = function (sid, sub) {
  if (sid === 'new') return workSetup();
  if (sid) { const s = IX.sessions[sid]; if (!s) return main(page('Work cattle', '', empty('That working session isn’t here. <a href="#/work">Back</a>'))); return sub === 'summary' ? workSummary(s) : sub === 'list' ? workList(s) : chuteView(s); }
  const past = DB.sessions.filter(s => s.status !== 'open').sort((a, b) => b.date.localeCompare(a.date));
  const plans = DB.protocols.slice().sort((a, b) => natCmp(a.name, b.name));
  main(page('Work cattle', `<button class="btn primary" onclick="startWork()">+ Start working cattle</button>`,
    `${workResumeCard()}
    ${card('How it works', `<ol class="steps"><li><b>Pick the cattle</b> — a pasture, a kind (cows, calves…), tags, or just type tags as they come up the alley.</li><li><b>Tick what you are doing</b> — shots and wormer from the product list, castrate, tag, wean, weigh, preg check, scores.</li><li><b>At the chute</b> each animal comes up with everything already ticked. Untick anything it didn’t get, type a weight, tap <b>Save &amp; next</b>.</li></ol>
      <p class="muted small">Works with no signal. Doses by weight are worked out for each animal. Withdrawal and booster dates go on every record.</p>`)}
    ${plans.length ? card('Saved plans', `<div class="planlist">${plans.map(p => `<div class="plan"><div><b>${esc(p.name)}</b><small>${esc([...(p.products || []).map(x => x.name), ...(p.procs || []).map(x => PROC_BY[x.k] ? PROC_BY[x.k].l : x.k), ...(p.meas || []).filter(k => MEAS_BY[k]).map(k => MEAS_BY[k].l)].join(', '))}</small></div><button class="btn primary sm" onclick="usePlan('${p.id}')">Use</button><button class="btn link sm" onclick="if(confirm('Delete this plan?'))del1('protocols','${p.id}').then(refresh)">delete</button></div>`).join('')}</div>`) : ''}
    ${card('Past workings', table([{ h: 'Date', f: s => fmtD(s.date) }, { h: 'What', f: s => `<a href="#/work/${s.id}/summary"><b>${esc(s.name)}</b></a>` }, { h: 'Head', f: s => Object.keys(s.done || {}).length, cls: 'num' }, { h: 'Given', f: s => esc((s.products || []).map(p => p.name).join(', ')), cls: 'hide-sm' }], past, { empty: 'Nothing worked yet.' }))}`));
};
function usePlan(id) {
  const p = IX.protocols[id], d = newDraft(UI.wd && UI.wd.ids);
  (p.products || []).forEach(x => d.prods[x.name] = { who: x.who || 'all', lot: '' });
  (p.procs || []).forEach(x => d.procs[x.k] = { who: x.who || (PROC_BY[x.k] || {}).who || 'all' });
  (p.meas || []).forEach(k => d.meas[k] = 1);
  Object.assign(d, { weightKind: p.weightKind || 'Other', brand: p.brand || '', pregMethod: p.pregMethod || 'Palpation', name: p.name });
  UI.wd = d; location.hash = '#/work/new'; refresh();
}

// ---------------- step 1-5: the plan
function workSetup() {
  const d = UI.wd || (UI.wd = newDraft());
  const act = DB.animals.filter(isActive), pas = DB.pastures.filter(p => !p.retired).sort((a, b) => natCmp(a.name, b.name));
  const ck = (on, attrs, label, sub) => `<label class="ck${on ? ' on' : ''}"><input type="checkbox" ${on ? 'checked' : ''} ${attrs}><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span></label>`;
  const whoSel = (cur, attrs) => `<select class="who" ${attrs}>${opts(WHO, cur, false)}</select>`;
  // products: mine, then the catalogue, all as tick rows (indexes into UI.wdP)
  const mine = DB.products.slice().sort((a, b) => natCmp(a.name, b.name)), have = new Set(mine.map(p => p.name.toLowerCase()));
  const extra = Object.keys(d.prods).filter(n => !have.has(n.toLowerCase()) && !CAT_BY[n.toLowerCase()]);
  UI.wdP = [...mine.map(p => p.name), ...CAT.filter(c => !have.has(c.name.toLowerCase())).map(c => c.name), ...extra];
  const prow = (name, i) => { const p = productByName(name) || { name }, on = !!d.prods[name], x = d.prods[name] || {};
    return `<div class="prow${on ? ' on' : ''}" data-i="${i}" data-s="${esc((name + ' ' + (p.group || '')).toLowerCase())}">${ck(on, `onchange="wdProd(${i},this.checked,this)"`, esc(name) + (p.checked || !CAT_BY[name.toLowerCase()] ? '' : ' <span class="chip">check label</span>'), esc(prodSum(p)))}
      <div class="pextra">${whoSel(x.who || defaultWho(name), `onchange="wdProdSet(${i},'who',this.value)" aria-label="Who gets it"`)}<input placeholder="Lot #" value="${esc(x.lot || '')}" oninput="wdProdSet(${i},'lot',this.value)"><button type="button" class="btn link sm" onclick="wdEditProduct(${i})">edit dose / label</button></div></div>`; };
  let pi = 0;
  const myRows = mine.map(p => prow(p.name, pi++)).join('');
  const catRows = PGROUPS.map(g => { const l = CAT.filter(c => c.group === g && !have.has(c.name.toLowerCase())); if (!l.length) return ''; const rows = l.map(c => prow(c.name, pi++)).join(''); const n = l.filter(c => d.prods[c.name]).length; return `<details class="pgrp"${n ? ' open' : ''}><summary>${esc(g)} <span class="muted small">(${l.length})</span></summary>${rows}</details>`; }).join('');
  const exRows = extra.map(n => prow(n, pi++)).join('');
  const procRows = PROCS.map(p => { const on = !!d.procs[p.k]; return `<div class="prow${on ? ' on' : ''}">${ck(on, `onchange="wdProc('${p.k}',this.checked,this)"`, esc(p.l), p.input ? 'You type it for each animal' : '')}<div class="pextra">${whoSel((d.procs[p.k] || {}).who || p.who, `onchange="wdProcWho('${p.k}',this.value)"`)}
     ${p.k === 'brand' ? `<input placeholder="Brand (e.g. Lazy N)" value="${esc(d.brand)}" oninput="UI.wd.brand=this.value">` : ''}${p.k === 'ai' ? comboHtml('wd_sire', 'sire', d.sire, 'AI sire (bull name)', () => animalItems(isMale)).replace('data-combo="1"', 'data-combo="1" oninput="UI.wd.sire=this.value" onchange="UI.wd.sire=this.value"') : ''}</div></div>`; }).join('');
  const measRows = MEAS.map(m => { const on = !!d.meas[m.k]; return `<div class="prow${on ? ' on' : ''}">${ck(on, `onchange="wdMeas('${m.k}',this.checked,this)"`, esc(m.l), m.who ? 'only ' + (m.who === 'breedable' ? 'breeding-age cows and heifers' : whoLabel(m.who).toLowerCase()) : '')}<div class="pextra">
     ${m.k === 'weight' ? `<select onchange="UI.wd.weightKind=this.value" aria-label="Kind of weight">${opts([['Other', 'Ordinary weight'], ['Weaning', 'Weaning weight'], ['Yearling', 'Yearling weight'], ['Sale', 'Sale weight']], d.weightKind, false)}</select>` : ''}
     ${m.k === 'preg' ? `<select onchange="UI.wd.pregMethod=this.value" aria-label="How">${opts(['Palpation', 'Ultrasound', 'Blood test'], d.pregMethod, false)}</select>` : ''}
     ${m.k === 'sort' ? `<span class="muted small">You tap a pasture for each animal.</span>` : ''}</div></div>`; }).join('') + `<div class="prow on">${ck(!!d.meas.note, `onchange="wdMeas('note',this.checked,this)"`, 'Notes box', 'a note for anything odd — lame, bad bag, wild, lost tag')}</div><div class="prow on">${ck(!!d.meas.photo, `onchange="wdMeas('photo',this.checked,this)"`, 'Photo button', 'take a picture of each one')}</div>`;
  const plans = DB.protocols.slice().sort((a, b) => natCmp(a.name, b.name));
  main(`<div class="phead"><a href="#/work" class="back">← Work cattle</a><h1>Plan the working</h1></div>
   ${plans.length ? `<div class="card"><b>Start from a saved plan:</b> ${plans.map(p => `<button class="btn sm" onclick="usePlan('${p.id}')">${esc(p.name)}</button>`).join(' ')}</div>` : ''}
   ${card('1 · Which cattle?', (d.ids ? `<p><b>${plural(d.ids.length, 'animal')} you ticked.</b> <a href="javascript:void 0" onclick="UI.wd.ids=null;refresh()">pick differently</a></p>` : `
     <div class="cklist">${ck(d.all, `onchange="UI.wd.all=this.checked;wdRow(this,this.checked);wdCount()"`, 'All active cattle', plural(act.length, 'head', 'head'))}
     ${pas.map(p => ck(d.pastures.includes(p.id), `onchange="wdArr('pastures','${p.id}',this.checked,this)"`, esc(p.name), plural(act.filter(a => a.pastureId === p.id).length, 'head', 'head'))).join('')}
     ${act.some(a => !a.pastureId) ? ck(d.pastures.includes('-'), `onchange="wdArr('pastures','-',this.checked,this)"`, 'Not in a pasture', plural(act.filter(a => !a.pastureId).length, 'head', 'head')) : ''}</div>
     <h3>Only these kinds (optional)</h3><div class="cklist">${WHO.slice(1).map(([k, l]) => ck(d.kinds.includes(k), `onchange="wdArr('kinds','${k}',this.checked,this)"`, l, '')).join('')}</div>
     <div class="fld" style="margin-top:10px"><label>And/or type tags (spaces between)</label><textarea rows="2" oninput="UI.wd.tags=this.value;wdCount()" placeholder="e.g. 12 15 102">${esc(d.tags)}</textarea></div>`)
     + `<p class="wdn" id="wd_n"></p>`)}
   ${card('2 · Shots, wormer & products', `<input class="search big" type="search" placeholder="Find a product (e.g. Draxxin, blackleg, pour-on)" oninput="wdFind(this.value)" value="${esc(d.q)}">
     <div id="wdprods">${myRows ? `<h3>My products</h3>${myRows}` : ''}${exRows}<h3>Product list</h3>${catRows}</div>
     <p><button class="btn" onclick="wdNewProduct()">+ A product that isn’t listed</button></p>
     <p class="muted small">Doses and withdrawals are starting numbers from common labels — <b>always go by your bottle’s label</b>. Tap “edit dose / label” to fix one; HerdBook remembers it.</p>`)}
   ${card('3 · What else are you doing?', procRows)}
   ${card('4 · Measure & record', measRows)}
   ${card('5 · Name it and start', `<div class="grid3"><div class="fld"><label>Name</label><input value="${esc(d.name)}" placeholder="e.g. Spring calf shots" oninput="UI.wd.name=this.value"></div><div class="fld"><label>Date</label><input type="date" value="${d.date}" onchange="UI.wd.date=this.value||today()"></div><div class="fld"><label>Done by</label><input value="${esc(d.by)}" placeholder="who gave the shots" oninput="UI.wd.by=this.value"></div></div>
     <p><label class="chk"><input type="checkbox" ${d.save ? 'checked' : ''} onchange="UI.wd.save=this.checked"> Save this as a plan to use again (e.g. every spring)</label></p>
     <div class="err" id="wd_e"></div><p><button class="btn primary big" onclick="wdStart()">Start at the chute →</button></p>`)}`);
  wdCount(); if (d.q) wdFind(d.q);
}
function wdCount() { const el = $('#wd_n'); if (!el) return; const n = draftIds(UI.wd).length; el.innerHTML = n ? `<b>${plural(n, 'head', 'head')}</b> picked.` : 'None picked — that’s fine: type each tag at the chute as they come up.'; }
function wdRow(el, on) { const r = el && el.closest('.prow'); if (r) r.classList.toggle('on', on); const l = el && el.closest('.ck'); if (l) l.classList.toggle('on', on); }
function wdArr(k, v, on, el) { const l = UI.wd[k], i = l.indexOf(v); if (on && i < 0) l.push(v); if (!on && i >= 0) l.splice(i, 1); wdRow(el, on); wdCount(); }
function wdProd(i, on, el) { const n = UI.wdP[i]; if (on) UI.wd.prods[n] = UI.wd.prods[n] || { who: defaultWho(n), lot: '' }; else delete UI.wd.prods[n]; wdRow(el, on); const s = el && el.closest('.prow') && el.closest('.prow').querySelector('select.who'); if (s && on) s.value = UI.wd.prods[n].who; }
function wdProdSet(i, k, v) {
  const n = UI.wdP[i];
  if (!UI.wd.prods[n]) { UI.wd.prods[n] = { who: k === 'who' ? v : defaultWho(n), lot: '' }; const c = document.querySelector(`#wdprods .prow[data-i="${i}"] input[type=checkbox]`); if (c) { c.checked = true; wdRow(c, true); } }
  UI.wd.prods[n][k] = v;
}
function wdProc(k, on, el) { if (on) UI.wd.procs[k] = UI.wd.procs[k] || { who: PROC_BY[k].who }; else delete UI.wd.procs[k]; wdRow(el, on); }
function wdMeas(k, on, el) { if (on) UI.wd.meas[k] = 1; else delete UI.wd.meas[k]; wdRow(el, on); }
function wdProcWho(k, v) { UI.wd.procs[k] = UI.wd.procs[k] || {}; UI.wd.procs[k].who = v; }
function wdFind(q) {
  UI.wd.q = q; q = q.trim().toLowerCase();
  document.querySelectorAll('#wdprods .prow').forEach(r => r.style.display = !q || r.dataset.s.includes(q) ? '' : 'none');
  document.querySelectorAll('#wdprods details').forEach(g => { if (q) g.open = [...g.querySelectorAll('.prow')].some(r => r.style.display !== 'none'); g.style.display = q && !g.open ? 'none' : ''; });
}
function wdEditProduct(i) { const n = UI.wdP[i], p = DB.products.find(x => x.name === n); if (p) actProduct(p.id); else actProduct(null, n); }
function wdNewProduct() { const n = prompt('Product name?'); if (!n || !n.trim()) return; UI.wd.prods[n.trim()] = { who: 'all', lot: '' }; actProduct(null, n.trim()); }
async function wdStart() {
  const d = UI.wd, ids = draftIds(d), names = Object.keys(d.prods);
  if (!names.length && !Object.keys(d.procs).length && !Object.keys(d.meas).some(k => k !== 'note' && k !== 'photo')) { $('#wd_e').textContent = 'Tick at least one thing you are doing (a product, a procedure or a measurement).'; return; }
  const ops = [];
  const products = names.map(n => {
    let p = DB.products.find(x => x.name.toLowerCase() === n.toLowerCase());
    if (!p) { p = Object.assign({ id: uid() }, catalogProduct(n) || { name: n }); ops.push({ coll: 'products', data: p }); }
    return { name: p.name, who: d.prods[n].who || 'all', lot: d.prods[n].lot || '' };
  });
  const s = { id: uid(), name: d.name.trim() || 'Worked ' + fmtD(d.date).replace(/, \d{4}$/, ''), date: d.date, by: d.by, status: 'open', ids, products,
    procs: Object.entries(d.procs).map(([k, v]) => ({ k, who: v.who })), meas: Object.keys(d.meas), weightKind: d.weightKind, brand: d.brand, sire: d.sire,
    pregMethod: d.pregMethod, done: {}, started: Date.now() };
  ops.push({ coll: 'sessions', data: s });
  if (d.save) ops.push({ coll: 'protocols', data: { name: s.name, products: products.map(p => ({ name: p.name, who: p.who })), procs: s.procs, meas: s.meas, weightKind: s.weightKind, brand: s.brand, pregMethod: s.pregMethod } });
  await saveMany(ops); UI.wd = null; UI.ch = { sid: s.id, cur: nextUp(s, null) }; location.hash = '#/work/' + s.id;
}

// ---------------- the chute: one animal at a time
const sOrder = s => s.ids.filter(id => AN(id)).sort((a, b) => natCmp(keyOf(AN(a)), keyOf(AN(b))));
function nextUp(s, after) {
  const l = sOrder(s), done = s.done || {}; if (!l.length) return null;
  const i = after ? l.indexOf(after) : -1;
  for (let k = 1; k <= l.length; k++) { const id = l[(i + k + l.length) % l.length]; if (!done[id]) return id; }
  return null;
}
// what this session already saved on one animal (so a second save replaces it)
function sessRecs(s, aid) {
  const b = s.id, o = {};
  for (const c of ['treatments', 'weights', 'obs', 'moves']) o[c] = DB[c].filter(x => x.batch === b && x.animalId === aid);
  for (const c of ['pregchecks', 'breedings']) o[c] = DB[c].filter(x => x.batch === b && x.femaleId === aid);
  return o;
}
function chuteView(s) {
  if (!UI.ch || UI.ch.sid !== s.id) UI.ch = { sid: s.id, cur: nextUp(s, null) };
  const st = UI.ch, a = st.cur && AN(st.cur), done = s.done || {}, nDone = Object.keys(done).length, total = s.ids.length;
  UI.busy = false;
  const head = `<div class="chead"><a href="#/work" class="back">← Work cattle</a><div class="ctitle"><b>${esc(s.name)}</b><span>${nDone} of ${total || '—'} done</span></div>
    <a class="btn sm" href="#/work/${s.id}/list">List</a><a class="btn sm" href="#/work/${s.id}/summary">Finish</a></div>
    ${total ? `<div class="prog"><span style="width:${Math.round(nDone / total * 100)}%"></span></div>` : ''}
    <div class="cfind"><input id="ch_find" class="big" placeholder="Tag or EID in the chute" autocomplete="off" inputmode="text" enterkeyhint="go"><button class="btn primary" onclick="chuteFind()">Go</button></div><div class="err" id="ch_fe"></div>`;
  if (!a) {
    return main(`<div id="chute">${head}${card('', total && nDone >= total ? `<div class="alldone"><b>All ${plural(total, 'head', 'head')} done.</b><p>Type another tag above if more come through, or finish up.</p><a class="btn primary big" href="#/work/${s.id}/summary">See the summary &amp; finish</a></div>` : `<p class="big2">Type the tag of the animal in the chute.</p><p class="muted">Not on the list? Type it anyway — HerdBook adds it, or lets you put a new animal in the herd.</p>`)}</div>`), chuteWire();
  }
  const t = typeOf(a), r = breedable(a) ? repro(a) : null, lw = lastW(a), wd = withdrawalUntil(a), prev = done[a.id] ? sessRecs(s, a.id) : null;
  const lastNote = (OBS[a.id] || []).filter(o => o.kind === 'Note').slice(-1)[0];
  const given = prev ? new Set(prev.treatments.map(x => x.product)) : null;
  const pObs = k => prev && MEAS_BY[k] ? (prev.obs.find(o => o.kind === measKind(MEAS_BY[k])) || {}).value : null;
  // each row: ticked when it fits this animal; a warning line when it needs a second thought; hidden-but-there when it plainly doesn't apply
  const why = (c, plain) => c.warn ? `<em class="${c.stop ? 'bad' : 'warn'}">${esc(c.warn)}</em>` : (c.fits ? '' : `<em>not planned for a ${esc(plain)}</em>`);
  const prods = s.products.map((sp, i) => { const p = productByName(sp.name) || { name: sp.name }, c = check('p', sp, a), on = prev ? given.has(p.name) : c.fits;
    return `<button type="button" class="tg${on ? ' on' : ''}${c.fits ? '' : ' dim'}${c.stop ? ' stop' : ''}" data-p="${i}"><i></i><span><b>${esc(p.name)}</b><small><span class="dose" data-pi="${i}">${esc(doseText(p, lwOf(a)))}</span>${p.route ? ' · ' + esc(p.route) : ''}${p.site ? ' · ' + esc(p.site) : ''}</small>${why(c, t.toLowerCase())}</span></button>`; }).join('');
  const procs = s.procs.map(x => { const p = PROC_BY[x.k]; if (!p) return ''; const c = check('x', x, a), on = prev ? given.has(p.l) : c.fits;
    if (c.stop && !on) return `<div class="tgna">${esc(p.l)} — ${esc(c.warn)}</div>`;
    return `<button type="button" class="tg${on ? ' on' : ''}${c.fits ? '' : ' dim'}" data-x="${x.k}"><i></i><span><b>${esc(p.l)}</b>${p.k === 'brand' && s.brand ? `<small>${esc(s.brand)}</small>` : ''}${p.k === 'ai' && s.sire ? `<small>to ${esc(s.sire)}</small>` : ''}${why(c, t.toLowerCase())}</span></button>${p.input ? `<div class="tgx"><input id="ch_in_${p.k}" class="big" placeholder="${esc(p.input)}" autocomplete="off"></div>` : ''}`; }).join('');
  const pw = prev && prev.weights[0];
  const meas = s.meas.map(k => {
    const m = MEAS_BY[k]; if (!m) return '';
    if (m.who && !whoOk(m.who, a)) return '';
    const lab = `<label>${esc(m.l)}${m.unit ? ` <span class="muted">(${m.unit})</span>` : ''}</label>`;
    if (k === 'weight') return `<div class="fld">${lab}<input id="ch_weight" class="big" type="number" inputmode="decimal" value="${pw && pw.weight != null ? pw.weight : ''}" placeholder="${lw && lw.weight ? 'last ' + num(lw.weight) + ' on ' + fmtD(lw.date) : ''}"></div>`;
    if (k === 'bcs') return `<div class="fld">${lab}${segHtml('ch_bcs', 'bcs', N19, pw ? pw.bcs : '', 'toggle n9')}</div>`;
    if (k === 'preg') { const pp = prev && prev.pregchecks[0]; return `<div class="fld">${lab}${segHtml('ch_preg', 'preg', ['Bred', 'Open'], pp ? pp.result : '', 'toggle')}<input id="ch_fetal" type="number" inputmode="numeric" placeholder="Fetal age in days (optional)" value="${pp && pp.fetalDays ? pp.fetalDays : ''}" style="margin-top:6px"><div class="seg toggle mini" data-fill="ch_fetal">${[60, 90, 120, 150, 180, 210].map(d => `<button type="button" onclick="$('#ch_fetal').value=${d}">${d / 30} mo</button>`).join('')}</div></div>`; }
    if (m.t === 'seg') return `<div class="fld">${lab}${segHtml('ch_m_' + k, k, m.o, pObs(k) ?? '', 'toggle' + (m.o.length === 9 ? ' n9' : ''))}</div>`;
    if (m.t === 'num') return `<div class="fld">${lab}<input id="ch_m_${k}" class="big" type="number" inputmode="decimal" value="${esc(pObs(k) ?? '')}"></div>`;
    if (m.t === 'pasture') { const pm = prev && prev.moves[0]; return `<div class="fld">${lab}${segHtml('ch_sort', 'sort', pastureOpts(), pm ? pm.pastureId : '', 'toggle')}</div>`; }
    return '';
  }).join('');
  const note = s.meas.includes('note') ? `<div class="fld"><label>Note</label><textarea id="ch_note" rows="2" placeholder="lame, bad bag, wild, lost tag…">${esc(prev ? ((prev.obs.find(o => o.kind === 'Note') || {}).note || '') : '')}</textarea></div>` : '';
  const needsEst = s.products.some(sp => { const p = productByName(sp.name); return p && p.mlPer; }) && !s.meas.includes('weight');
  main(`<div id="chute">${head}
   <section class="card canimal">
    <div class="ctop">${(a.photos || [])[0] ? `<img class="cphoto" data-pid="${a.photos[0]}" alt="">` : ''}<div><div class="ctag">${esc(keyOf(a))}${a.name && a.name !== a.tag ? ` <span>${esc(a.name)}</span>` : ''}</div>
     <div class="meta">${[t, ageStr(a), a.breed, pastureName(a.pastureId), lw && lw.weight ? 'last wt ' + num(lw.weight) + ' lb' : ''].filter(Boolean).map(esc).join(' · ')}</div>
     <div>${r ? reproChip(r) : ''}${wd ? `<span class="chip amber">withdrawal to ${fmtD(wd)}</span>` : ''}${a.cull ? '<span class="chip amber">cull</span>' : ''}${done[a.id] ? `<span class="chip blue">done at ${new Date(done[a.id]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} — saving again replaces it</span>` : ''}${s.ids.includes(a.id) ? '' : '<span class="chip blue">added to this group</span>'}</div>
     ${lastNote ? `<div class="small muted">Last note (${fmtD(lastNote.date)}): ${esc(lastNote.note)}</div>` : ''}</div></div>
    ${needsEst ? `<div class="fld"><label>About what does it weigh? <span class="muted">(for the dose — not saved as a weight)</span></label><input id="ch_est" class="big" type="number" inputmode="decimal" placeholder="${lw && lw.weight ? num(lw.weight) : 'lb'}"></div>` : ''}
    ${prods ? `<h3>Give</h3><div class="tgs">${prods}</div>` : ''}
    ${procs ? `<h3>Do</h3><div class="tgs">${procs}</div>` : ''}
    ${meas || note ? `<h3>Record</h3><div class="cmeas">${meas}${note}</div>` : ''}
    ${s.meas.includes('photo') ? `<p>${photoBtn('chutePhoto(this.files)', '📷 Take a photo')} <span id="ch_ph" class="small muted"></span></p>` : ''}
    <div class="err" id="ch_e"></div>
   </section>
   <div class="cbar"><button class="btn" onclick="chuteSkip()">Skip</button><button class="btn primary big" id="ch_save" onclick="chuteSave()">✓ Save &amp; next</button></div></div>`);
  chuteWire();
}
function chuteWire() {
  const ch = $('#chute'); if (!ch) return;
  ch.addEventListener('click', e => { const b = e.target.closest('.tg'); if (!b) return; if (!b.classList.contains('on') && b.classList.contains('stop') && !confirm('Careful: ' + ((b.querySelector('em') || {}).textContent || '') + '.\n\nGive it anyway?')) return; b.classList.toggle('on'); UI.busy = true; });
  ch.addEventListener('input', e => { if (e.target.id !== 'ch_find') UI.busy = true; if (e.target.id === 'ch_weight' || e.target.id === 'ch_est') chuteDoses(); });
  const f = $('#ch_find'); f.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); chuteFind(); } });
  if (!isPhone() && !UI.ch.cur) f.focus();
}
const numVal = sel => { const el = $(sel); if (!el || el.value.trim() === '') return null; const v = parseFloat(el.value); return isNaN(v) ? null : v; };
function chuteWeight(a) { return numVal('#ch_weight') ?? numVal('#ch_est') ?? lwOf(a); }
function chuteDoses() {
  const s = IX.sessions[UI.ch.sid], a = AN(UI.ch.cur), w = chuteWeight(a);
  document.querySelectorAll('#chute .dose').forEach(el => { const p = productByName(s.products[+el.dataset.pi].name); if (p) el.textContent = doseText(p, w); });
}
function chuteFind() {
  const s = IX.sessions[UI.ch.sid], t = $('#ch_find').value.trim(); if (!t) return;
  const a = findAnimal(t) || DB.animals.find(x => (x.eid || '').replace(/\s/g, '') === t.replace(/\s/g, ''));
  if (!a) { $('#ch_fe').innerHTML = `No animal “${esc(t)}” in the herd. <button class="btn sm primary" onclick="chuteNewAnimal(${esc(JSON.stringify(t))})">Add it to the herd</button>`; return; }
  if (UI.busy && UI.ch.cur && UI.ch.cur !== a.id && !confirm('Leave ' + keyOf(AN(UI.ch.cur)) + ' without saving it?')) return;
  UI.ch.cur = a.id; chuteView(s); window.scrollTo(0, 0);
}
function chuteNewAnimal(tag) {
  const set = S();
  openForm({
    title: 'Add ' + tag + ' to the herd', values: { tag, kindPick: UI.lastKind || 'Cow', pastureId: UI.lastPasture },
    fields: [{ k: 'tag', label: 'Ear tag', req: true, big: true }, { k: 'kindPick', label: 'Kind', type: 'buttons', options: TYPES, req: true, full: true },
      { k: 'breed', label: 'Breed', type: 'list', options: set.breeds }, { k: 'birthDate', label: 'Birth date (if known)', type: 'date' }, { k: 'pastureId', label: 'Pasture', type: 'select', options: pastureOpts() }],
    save: async v => {
      UI.lastKind = v.kindPick;
      const rec = setKind({ id: uid(), status: 'Active', tag: v.tag, breed: v.breed, birthDate: v.birthDate, pastureId: v.pastureId }, v.kindPick);
      const s = Object.assign({}, IX.sessions[UI.ch.sid]); s.ids = [...s.ids, rec.id];
      await saveMany([{ coll: 'animals', data: rec }, { coll: 'sessions', data: s }]); UI.ch.cur = rec.id;
    }, toastText: 'Added — now record what you did'
  });
}
function chuteSkip() { const s = IX.sessions[UI.ch.sid]; if (UI.busy && !confirm('Skip without saving?')) return; UI.ch.cur = nextUp(s, UI.ch.cur); chuteView(s); window.scrollTo(0, 0); }
async function chutePhoto(files) {
  const a = AN(UI.ch.cur); if (!a || !files || !files.length) return;
  try { const pids = []; for (const f of files) pids.push(await photoFromFile(f)); await put1('animals', Object.assign({}, AN(a.id), { photos: [...(AN(a.id).photos || []), ...pids] })); $('#ch_ph').textContent = plural(pids.length, 'photo') + ' saved'; }
  catch (e) { alert('Could not add the photo: ' + e.message); }
}
async function chuteSave() {
  const s0 = IX.sessions[UI.ch.sid], a = AN(UI.ch.cur); if (!a) return;
  const s = Object.assign({}, s0), date = s.date, b = s.id, ops = [], ch = $('#chute');
  const prev = sessRecs(s, a.id);
  for (const [c, l] of Object.entries(prev)) l.forEach(x => ops.push({ coll: c, del: x.id }));
  const rec = Object.assign({}, a), w = chuteWeight(a);
  const T = d => ops.push({ coll: 'treatments', data: Object.assign({ animalId: a.id, date, reason: s.name, by: s.by || null, batch: b }, d) });
  ch.querySelectorAll('.tg.on[data-p]').forEach(el => {
    const sp = s.products[+el.dataset.p], p = productByName(sp.name) || { name: sp.name };
    T({ product: p.name, dose: doseText(p, w), ml: doseMl(p, w), route: p.route || null, site: p.site || null, lot: sp.lot || null, withdrawalDays: p.withdrawalDays ?? null,
      withdrawalDate: p.withdrawalDays ? addDays(date, p.withdrawalDays) : null, boosterDate: p.boosterDays ? addDays(date, p.boosterDays) : null });
  });
  const errs = [];
  ch.querySelectorAll('.tg.on[data-x]').forEach(el => {
    const p = PROC_BY[el.dataset.x]; let note = null;
    if (p.input) { const v = ($('#ch_in_' + p.k).value || '').trim(); if (!v) { errs.push(p.l + ': type the number'); return; } note = v;
      if (p.k === 'retag') { rec.oldTags = [...(rec.oldTags || []), rec.tag].filter(Boolean); rec.tag = v; } else rec.eid = v; }
    if (p.fx === 'castrate' && rec.sex === 'M') setKind(rec, /calf/.test(typeOf(a)) ? 'Steer calf' : 'Steer');
    if (p.fx === 'dehorn') rec.horn = 'Dehorned';
    if (p.fx === 'brand' && s.brand) rec.brand = s.brand;
    if (p.fx === 'wean' && !rec.weanDate) rec.weanDate = date;
    if (p.fx === 'cull') rec.cull = true;
    if (p.fx === 'ai') { const sire = findAnimal(s.sire, isMale); ops.push({ coll: 'breedings', data: { femaleId: a.id, method: 'AI', date, sireId: sire ? sire.id : null, sireName: sire ? null : s.sire || null, tech: s.by || null, batch: b } }); }
    T({ product: p.l, kind: 'Procedure', note: note || (p.k === 'brand' ? s.brand : null) || null });
  });
  if (errs.length) { $('#ch_e').textContent = errs.join(' · '); return; }
  const wt = numVal('#ch_weight'), bcs = $('#ch_bcs') ? parseFloat($('#ch_bcs').value) : NaN;
  if (wt != null || !isNaN(bcs)) {
    // a weaning / yearling weight only means that on a calf / yearling; on a cow it is an ordinary weight
    const calf = /calf/.test(typeOf(a)), wk = s.weightKind === 'Weaning' && !calf ? 'Other' : s.weightKind === 'Yearling' && (ageDays(a) == null || ageDays(a) > 550) ? 'Other' : (s.weightKind || 'Other');
    ops.push({ coll: 'weights', data: { animalId: a.id, date, weight: wt, bcs: isNaN(bcs) ? null : bcs, kind: wk, batch: b } });
    if (wk === 'Weaning' && !rec.weanDate) rec.weanDate = date;
  }
  if ($('#ch_preg') && $('#ch_preg').value) { const fd = parseInt($('#ch_fetal').value); ops.push({ coll: 'pregchecks', data: { femaleId: a.id, date, method: s.pregMethod || 'Palpation', by: s.by || null, result: $('#ch_preg').value, fetalDays: $('#ch_preg').value === 'Bred' && !isNaN(fd) ? fd : null, batch: b } }); }
  for (const k of s.meas) {
    const m = MEAS_BY[k]; if (!m || !['seg', 'num'].includes(m.t) || k === 'bcs' || k === 'weight') continue;
    const el = $('#ch_m_' + k); if (!el || el.value === '') continue;
    ops.push({ coll: 'obs', data: { animalId: a.id, date, kind: measKind(m), value: m.t === 'num' ? parseFloat(el.value) : el.value, unit: m.unit || null, batch: b } });
  }
  const note = $('#ch_note') && $('#ch_note').value.trim(); if (note) ops.push({ coll: 'obs', data: { animalId: a.id, date, kind: 'Note', note, batch: b } });
  const sortTo = $('#ch_sort') && $('#ch_sort').value;
  if (sortTo && sortTo !== a.pastureId) { ops.push({ coll: 'moves', data: { animalId: a.id, pastureId: sortTo, fromId: a.pastureId || null, date, batch: b } }); rec.pastureId = sortTo; }
  if (JSON.stringify(rec) !== JSON.stringify(a)) ops.push({ coll: 'animals', data: rec });
  s.done = Object.assign({}, s.done, { [a.id]: Date.now() }); if (!s.ids.includes(a.id)) s.ids = [...s.ids, a.id];
  ops.push({ coll: 'sessions', data: s });
  $('#ch_save').disabled = true;
  try { await saveMany(ops); } catch (e) { $('#ch_e').textContent = 'Could not save: ' + e.message; $('#ch_save').disabled = false; return; }
  toast(keyOf(rec) + ' saved'); UI.busy = false;
  UI.ch.cur = nextUp(s, a.id); chuteView(IX.sessions[s.id]); window.scrollTo(0, 0);
}
function workList(s) {
  const done = s.done || {}, list = sOrder(s);
  const tr = {}; DB.treatments.filter(t => t.batch === s.id).forEach(t => (tr[t.animalId] || (tr[t.animalId] = [])).push(t.product));
  main(page(esc(s.name), `<a class="btn" href="#/work/${s.id}">← Back to the chute</a>`,
    card(`${Object.keys(done).length} of ${list.length} done`, `<div class="alist">${list.map(id => { const a = AN(id); return `<a class="arow wl${done[id] ? ' done' : ''}" href="javascript:void 0" onclick="UI.ch={sid:'${s.id}',cur:'${id}'};location.hash='#/work/${s.id}'"><span class="noimg">${done[id] ? '✓' : ''}</span><span class="atxt"><b>${esc(keyOf(a))}</b><small>${esc(typeOf(a))}${tr[id] ? ' · ' + esc(tr[id].join(', ')) : done[id] ? '' : ' · not done yet'}</small></span></a>`; }).join('') || empty('No animals in this group yet.')}</div>`)));
}
function workSummary(s) {
  const done = Object.keys(s.done || {}), b = s.id, todo = sOrder(s).filter(id => !(s.done || {})[id]);
  const tr = DB.treatments.filter(t => t.batch === b), wts = DB.weights.filter(w => w.batch === b && w.weight), pc = DB.pregchecks.filter(p => p.batch === b);
  const byP = {}; tr.forEach(t => { const o = byP[t.product] || (byP[t.product] = { n: 0, ml: 0, mlN: 0, t }); o.n++; if (t.ml) { o.ml += t.ml; o.mlN++; } });
  let cost = 0;
  const rows = Object.entries(byP).map(([name, o]) => { const p = productByName(name) || {}; const per = p.bottlePrice && p.bottleMl ? p.bottlePrice / p.bottleMl : null; const c = per ? (o.mlN ? o.ml * per : o.n * per) : null; if (c) cost += c; return { name, o, p, c }; });
  const avgW = avg(wts.map(w => w.weight));
  main(page(esc(s.name), `<button class="btn" onclick="window.print()">Print</button>${s.status === 'open' ? `<a class="btn" href="#/work/${s.id}">← Back to the chute</a><button class="btn primary" onclick="workFinish('${s.id}')">Finish</button>` : `<button class="btn" onclick="workReopen('${s.id}')">Reopen</button>`}`,
    `<div class="kpis"><div class="kpi"><div class="kl">Head worked</div><div class="kv">${done.length}</div></div>${todo.length ? `<div class="kpi"><div class="kl">Not done</div><div class="kv">${todo.length}</div></div>` : ''}${avgW ? `<div class="kpi"><div class="kl">Avg weight</div><div class="kv">${num(avgW)}</div><div class="ks">${wts.length} weighed</div></div>` : ''}${pc.length ? `<div class="kpi"><div class="kl">Bred / open</div><div class="kv">${pc.filter(p => p.result === 'Bred').length} / ${pc.filter(p => p.result === 'Open').length}</div><div class="ks">${pct(pc.filter(p => p.result === 'Bred').length, pc.length)} bred</div></div>` : ''}${cost ? `<div class="kpi"><div class="kl">Product cost</div><div class="kv">${usd(cost)}</div><div class="ks">${done.length ? usd(cost / done.length) + ' per head' : ''}</div></div>` : ''}</div>
    ${card('What was given and done', table([{ h: 'Product / job', f: r => `<b>${esc(r.name)}</b>` }, { h: 'Head', f: r => r.o.n, cls: 'num' }, { h: 'Total used', f: r => r.o.mlN ? num(r.o.ml, 1) + ' mL' : '', cls: 'num' }, { h: 'Clear for slaughter', f: r => r.o.t.withdrawalDate ? fmtD(addDays(r.o.t.withdrawalDate, 1)) : '' }, { h: 'Booster due', f: r => r.o.t.boosterDate ? fmtD(r.o.t.boosterDate) : '' }, { h: 'Cost', f: r => r.c ? usd(r.c) : '', cls: 'num' }], rows, { empty: 'Nothing recorded yet.' }) + (rows.some(r => r.o.t.boosterDate) ? '<p class="muted small">Boosters show up on Home → Needs attention when they come due.</p>' : '') + (rows.some(r => !r.c && r.o.t.kind !== 'Procedure') ? '<p class="muted small">Put a bottle size and price on a product (Health → Products) to see what a working costs.</p>' : ''))}
    ${pc.some(p => p.result === 'Open') ? card('Open', `<p>${pc.filter(p => p.result === 'Open').map(p => aLink(p.femaleId)).join(', ')}</p><p><button class="btn sm" onclick="showList(${listRef(pc.filter(p => p.result === 'Open').map(p => p.femaleId))})">Tick these on Animals</button></p>`) : ''}
    ${todo.length ? card('Not done', `<p>${todo.map(id => aLink(id)).join(', ')}</p>`) : ''}
    ${card('Each animal', table([{ h: 'Animal', f: id => aLink(id) }, { h: 'Kind', f: id => typeOf(AN(id)) }, { h: 'Weight', f: id => { const w = wts.find(x => x.animalId === id); return w ? num(w.weight) : ''; }, cls: 'num' }, { h: 'Given / done', f: id => esc(tr.filter(t => t.animalId === id).map(t => t.product + (t.dose && t.kind !== 'Procedure' ? ' ' + t.dose : '')).join(', ')) }, { h: 'Preg', f: id => { const p = pc.find(x => x.femaleId === id); return p ? esc(p.result) + (p.fetalDays ? ' ' + p.fetalDays + 'd' : '') : ''; } }], done.filter(id => AN(id)).sort((x, y) => natCmp(keyOf(AN(x)), keyOf(AN(y)))), { empty: 'Nobody worked yet.' }))}`,
    `${fmtD(s.date)}${s.by ? ' · by ' + esc(s.by) : ''}`));
}
async function workFinish(id) { await put1('sessions', Object.assign({}, IX.sessions[id], { status: 'done', finished: Date.now() })); toast('Working finished'); location.hash = '#/work/' + id + '/summary'; refresh(); }
async function workReopen(id) { await put1('sessions', Object.assign({}, IX.sessions[id], { status: 'open' })); location.hash = '#/work/' + id; }

// ================================================================ MONEY
// [category, Schedule F line]. The tax line is a guide for whoever does your taxes.
const TAXL = { F10: '10 Car & truck', F11: '11 Chemicals', F13: '13 Custom hire', F14: '14 Depreciation / Sec. 179', F16: '16 Feed', F17: '17 Fertilizer & lime', F18: '18 Freight & trucking', F19: '19 Gas, fuel & oil', F20: '20 Insurance', F21: '21b Interest', F22: '22 Labor hired', F24a: '24a Rent — machinery', F24b: '24b Rent — land & animals', F25: '25 Repairs & maintenance', F26: '26 Seeds & plants', F28: '28 Supplies', F29: '29 Taxes', F30: '30 Utilities', F31: '31 Vet, breeding & medicine', F32: '32 Other expenses', LV: 'Cattle bought (cost basis / line 1b)', I1: '1a Sales of cattle bought for resale', I2: '2 Sales of cattle & crops you raised', I47: 'Form 4797 — breeding cattle kept 24+ months', I3: '3 Co-op distributions', I4: '4 Government payments', I8: '8 Other income' };
const EXPG = [
  ['Feed', [['Hay', 'F16'], ['Grain & feed', 'F16'], ['Range cubes / cake', 'F16'], ['Protein tubs & lick', 'F16'], ['Mineral & salt', 'F16'], ['Creep feed', 'F16'], ['Milk replacer & colostrum', 'F16']]],
  ['Vet & medicine', [['Vet call / farm visit', 'F31'], ['Vet — preg check, BSE, lab', 'F31'], ['Vaccines', 'F31'], ['Dewormers & pour-ons', 'F31'], ['Antibiotics & treatments', 'F31'], ['Fly control & fly tags', 'F31'], ['Implants', 'F31'], ['Needles, syringes & vet supplies', 'F31']]],
  ['Breeding', [['Semen', 'F31'], ['AI service & sync drugs', 'F31'], ['Bull lease', 'F24b'], ['Embryos / ET', 'F31'], ['Breeding supplies (gloves, sheaths)', 'F31']]],
  ['Cattle bought', [['Cattle purchases', 'LV'], ['Bull purchase', 'LV'], ['Replacement heifers / cows bought', 'LV'], ['Feeder / stocker cattle bought', 'LV']]],
  ['Equipment & tools', [['Tools', 'F28'], ['Equipment purchase (big items)', 'F14'], ['Equipment repairs & parts', 'F25'], ['Tractor / UTV / ATV', 'F25'], ['Trailer', 'F25'], ['Chute, panels & handling', 'F25'], ['Feeders, bale rings & water tanks', 'F25'], ['Tires & batteries', 'F25'], ['Equipment rental', 'F24a']]],
  ['Fences, water & buildings', [['Fencing (wire, posts, gates)', 'F25'], ['Electric fence & chargers', 'F25'], ['Corrals & pens', 'F25'], ['Barn & buildings', 'F25'], ['Water (well, pipe, pumps)', 'F25']]],
  ['Fuel & vehicles', [['Fuel (diesel, gas)', 'F19'], ['Oil & grease', 'F19'], ['Truck expenses', 'F10']]],
  ['Pasture & hay ground', [['Pasture rent / lease', 'F24b'], ['Fertilizer & lime', 'F17'], ['Seed', 'F26'], ['Spray / herbicide', 'F11'], ['Brush & weed control', 'F13'], ['Custom haying / baling', 'F13'], ['Net wrap & twine', 'F28']]],
  ['Labor, hauling & hire', [['Hired labor', 'F22'], ['Custom hire (work done for you)', 'F13'], ['Trucking & hauling', 'F18']]],
  ['Marketing', [['Sale barn commission & yardage', 'F32'], ['Beef checkoff', 'F32'], ['Brand inspection & health papers', 'F32'], ['Advertising', 'F32']]],
  ['Supplies & small stuff', [['Ear tags & taggers', 'F28'], ['Supplies (ropes, halters, buckets)', 'F28'], ['Hardware & small parts', 'F28'], ['Office, phone & software', 'F32']]],
  ['Overhead', [['Insurance', 'F20'], ['Interest', 'F21'], ['Property tax', 'F29'], ['Utilities (electric, water)', 'F30'], ['Dues & memberships', 'F32'], ['Bank fees', 'F32'], ['Other expense', 'F32']]]
];
const INCG = [
  ['Cattle sales', [['Calf sales', 'I2'], ['Feeder / stocker sales', 'I2'], ['Cull cow sales', 'I47'], ['Cull bull sales', 'I47'], ['Bull sales', 'I2'], ['Bred heifers / pairs sold', 'I2'], ['Cattle bought & resold', 'I1']]],
  ['Other income', [['Hay & crop sales', 'I2'], ['Custom work done', 'I8'], ['Pasture rented out', 'I8'], ['Government payments (LFP, ELAP, CRP)', 'I4'], ['Insurance payments (PRF, LRP)', 'I8'], ['Co-op / patronage', 'I3'], ['Other income', 'I8']]]
];
// categories from the first HerdBook (and anything the farm typed) still group and total correctly
const LEGACY = { 'Feed / grain': ['Feed', 'F16'], 'Mineral / supplement': ['Feed', 'F16'], 'Vet / medicine': ['Vet & medicine', 'F31'], 'Breeding / semen': ['Breeding', 'F31'], 'Fuel': ['Fuel & vehicles', 'F19'], 'Repairs / equipment': ['Equipment & tools', 'F25'], 'Pasture rent': ['Pasture & hay ground', 'F24b'], 'Fencing': ['Fences, water & buildings', 'F25'], 'Fertilizer / seed': ['Pasture & hay ground', 'F17'], 'Trucking': ['Labor, hauling & hire', 'F18'], 'Sale barn fees': ['Marketing', 'F32'], 'Labor': ['Labor, hauling & hire', 'F22'], 'Feeder sales': ['Cattle sales', 'I2'] };
const CATINFO = {}; for (const [g, l] of [...EXPG, ...INCG]) for (const [c, line] of l) CATINFO[c.toLowerCase()] = { g, line };
function catInfo(cat, kind) { const k = (cat || '').toLowerCase(); if (CATINFO[k]) return CATINFO[k]; const l = LEGACY[cat]; if (l) return { g: l[0], line: l[1] }; return kind === 'Income' ? { g: 'Other income', line: 'I8' } : { g: 'My categories', line: 'F32' }; }
function catItems(kind) {
  const G = kind === 'Income' ? INCG : EXPG, out = [];
  for (const [g, l] of G) { out.push({ g }); l.forEach(([c, line]) => out.push({ v: c, s: 'tax line ' + TAXL[line] })); }
  const known = new Set(Object.keys(CATINFO)), set = S();
  const own = [...new Set([...(kind === 'Income' ? set.incomeCats : set.expenseCats), ...DB.money.filter(m => (m.kind === 'Income') === (kind === 'Income')).map(m => m.category)])].filter(c => c && !known.has(c.toLowerCase()) && !LEGACY[c]);
  if (own.length) { out.push({ g: 'My categories' }); own.sort(natCmp).forEach(c => out.push({ v: c })); }
  return out;
}
const payees = () => [...new Set(DB.money.map(m => m.payee).filter(Boolean))].sort(natCmp);
const PAY = ['Cash', 'Check', 'Card', 'On account', 'Other'];
const msum = l => l.reduce((s, m) => s + (+m.amount || 0), 0);

// one receipt = one or more lines (vaccine + tools + fencing off one farm-store ticket)
function actMoney(id, preset) {
  const first = id ? IX.money[id] : null;
  const lines = first ? (first.rid ? DB.money.filter(m => m.rid === first.rid) : [first]) : [];
  const t = first || Object.assign({ date: today(), kind: 'Expense' }, preset || {});
  let kind = t.kind === 'Income' ? 'Income' : 'Expense', receipt = (t.receipt || []).slice();
  const L = lines.length ? lines.map(m => ({ id: m.id, category: m.category, amount: m.amount, note: m.note, qty: m.qty })) : [{ category: t.category || '', amount: t.amount ?? '', note: t.note || '' }];
  const lineHtml = (l, i) => `<div class="mline" data-i="${i}"><div class="fld">${comboHtml('ml_c' + i, 'c', l.category || '', 'Category — tap ▾', () => catItems(kind))}</div>
    <div class="fld amt"><input class="ml_a" type="number" inputmode="decimal" step="0.01" placeholder="$ amount" value="${l.amount ?? ''}"></div>
    <div class="fld"><input class="ml_n" placeholder="What (e.g. 10 bags mineral)" value="${esc(l.note || '')}"></div>
    <button type="button" class="btn link ml_x" aria-label="Remove line">✕</button></div>`;
  const m = modal(`<h2>${id ? 'Edit' : 'Add'} ${kind === 'Income' ? 'income' : 'expense'}</h2>
   <div class="grid2"><div class="fld full">${segHtml('mk', 'kind', ['Expense', 'Income'], kind)}</div>
    <div class="fld"><label>Date</label><input type="date" id="m_d" value="${t.date || today()}"></div>
    <div class="fld"><label id="m_pl">${kind === 'Income' ? 'Paid by (buyer / sale barn)' : 'Paid to (store, vet, person)'}</label>${comboHtml('m_p', 'payee', t.payee || '', 'e.g. Tractor Supply', payees)}</div>
    <div class="fld full"><label>How paid</label>${segHtml('m_pay', 'pay', PAY, t.pay || '', 'toggle')}</div>
    <div class="fld" id="m_ckf"><label>Check #</label><input id="m_ck" inputmode="numeric" value="${esc(t.checkNo || '')}"></div>
    <div class="fld"><label>For</label><select id="m_for">${opts([['', 'The whole operation'], ...pastureOpts().map(([v, l]) => ['p:' + v, 'Pasture: ' + l])], t.pastureId ? 'p:' + t.pastureId : '', false)}</select></div>
    <div class="fld full"><label>Animal (optional)</label>${comboHtml('m_an', 'animal', t.animalId && AN(t.animalId) ? keyOf(AN(t.animalId)) : '', 'Only if it was for one animal', () => animalItems())}</div></div>
   <h3>What it was for</h3><div id="mlines">${L.map(lineHtml).join('')}</div>
   <p><button type="button" class="btn sm" id="m_add">+ Another line on this receipt</button> <b id="m_tot" style="float:right"></b></p>
   <div class="fld"><label>Receipt</label><div class="rcpts" id="m_rc"></div>${photoBtn('mReceipt(this.files)', '📷 Photo of the receipt', 'btn')}</div>
   <div class="err" id="m_e"></div>
   <div class="mfoot">${id ? '<button type="button" class="btn danger" id="m_del">Delete</button>' : ''}<span class="sp"></span><button class="btn" onclick="closeModal()">Cancel</button>${id ? '' : '<button class="btn" id="m_again">Save &amp; add another</button>'}<button class="btn primary" id="m_go">Save</button></div>`, { wide: true });
  const box = m.querySelector('#mlines');
  const drawR = () => { m.querySelector('#m_rc').innerHTML = receipt.map(p => `<figure><img data-pid="${p}" onclick="viewPhoto('${p}')" alt=""><button type="button" class="btn sm" data-rm="${p}">✕</button></figure>`).join(''); hydratePhotos(m.querySelector('#m_rc')); };
  window.mReceipt = async files => { try { for (const f of files) receipt.push(await photoFromFile(f)); drawR(); } catch (e) { alert('Could not add the photo: ' + e.message); } };
  m.querySelector('#m_rc').onclick = e => { const p = e.target.dataset.rm; if (p) { receipt = receipt.filter(x => x !== p); drawR(); } };
  const total = () => { const s = [...box.querySelectorAll('.ml_a')].reduce((s, el) => s + (parseFloat(el.value) || 0), 0); m.querySelector('#m_tot').textContent = box.children.length > 1 ? 'Total ' + usd(s) : ''; };
  const showCk = () => m.querySelector('#m_ckf').style.display = $('#m_pay').value === 'Check' ? '' : 'none';
  m.addEventListener('input', total); m.addEventListener('change', e => { if (e.target.id === 'm_pay') showCk(); if (e.target.id === 'mk') { kind = e.target.value; m.querySelector('h2').textContent = (id ? 'Edit ' : 'Add ') + (kind === 'Income' ? 'income' : 'expense'); m.querySelector('#m_pl').textContent = kind === 'Income' ? 'Paid by (buyer / sale barn)' : 'Paid to (store, vet, person)'; } });
  m.querySelector('#m_add').onclick = () => { box.insertAdjacentHTML('beforeend', lineHtml({}, Date.now() % 1e6)); box.lastElementChild.querySelector('input').focus(); };
  box.onclick = e => { if (e.target.closest('.ml_x') && box.children.length > 1) { e.target.closest('.mline').remove(); total(); } };
  drawR(); total(); showCk();
  const save = async again => {
    const date = $('#m_d').value, payee = $('#m_p').value.trim(), f = $('#m_for').value, an = $('#m_an').value.trim(), a = an ? findAnimal(an) : null;
    if (!date) return $('#m_e').textContent = 'Pick a date.';
    if (an && !a) return $('#m_e').textContent = 'No animal “' + an + '” in the herd.';
    const rows = [...box.querySelectorAll('.mline')].map((el, i) => ({ el, i, category: el.querySelector('[data-combo]').value.trim(), amount: parseFloat(el.querySelector('.ml_a').value), note: el.querySelector('.ml_n').value.trim() })).filter(r => r.category || !isNaN(r.amount) || r.note);
    if (!rows.length) return $('#m_e').textContent = 'Put in a category and an amount.';
    const bad = rows.find(r => !r.category || isNaN(r.amount)); if (bad) return $('#m_e').textContent = 'Each line needs a category and an amount.';
    const rid = rows.length > 1 || receipt.length ? (first && first.rid) || uid() : null, ops = [], keep = new Set();
    rows.forEach((r, i) => {
      const old = L[i] && L[i].id && i < L.length ? IX.money[L[i].id] : null;
      const d = Object.assign({}, old || {}, { date, kind, category: r.category, amount: Math.round(r.amount * 100) / 100, note: r.note || null, payee: payee || null, pay: $('#m_pay').value || null, checkNo: $('#m_pay').value === 'Check' ? $('#m_ck').value.trim() || null : null, pastureId: f.startsWith('p:') ? f.slice(2) : null, animalId: a ? a.id : null, rid, receipt: receipt.length ? receipt : null });
      if (old) keep.add(old.id); ops.push({ coll: 'money', data: d });
    });
    lines.forEach(l => { if (!keep.has(l.id)) ops.push({ coll: 'money', del: l.id }); });
    try { await saveMany(ops); closeModal(); refresh(); toast(kind + ' saved' + (rows.length > 1 ? ' — ' + usd(msum(rows)) : '')); if (again) actMoney(null, { kind, date, payee }); }
    catch (e) { $('#m_e').textContent = 'Could not save: ' + e.message; }
  };
  m.querySelector('#m_go').onclick = () => save(false);
  if (!id) m.querySelector('#m_again').onclick = () => save(true);
  if (id) m.querySelector('#m_del').onclick = async () => { if (!confirm(lines.length > 1 ? `Delete this whole receipt (${lines.length} lines)?` : 'Delete this entry?')) return; await saveMany(lines.map(l => ({ coll: 'money', del: l.id }))); closeModal(); refresh(); toast('Deleted'); };
}
function monthBars(list, y) {
  const inc = Array(12).fill(0), exp = Array(12).fill(0);
  list.forEach(m => { const i = +m.date.slice(5, 7) - 1; if (m.kind === 'Income') inc[i] += +m.amount || 0; else exp[i] += +m.amount || 0; });
  const mx = Math.max(1, ...inc, ...exp), W = 640, H = 170, bw = 18;
  const mn = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  return `<svg class="chart" viewBox="0 0 ${W} ${H + 20}" role="img" aria-label="Money by month">${mn.map((l, i) => { const x = 20 + i * 51, hi = inc[i] / mx * H, he = exp[i] / mx * H;
    return `<rect x="${x}" y="${H - hi}" width="${bw}" height="${hi}" rx="3" fill="#2f6d4a"><title>${l} income ${usd(inc[i])}</title></rect><rect x="${x + bw + 2}" y="${H - he}" width="${bw}" height="${he}" rx="3" fill="#b8b2a3"><title>${l} expenses ${usd(exp[i])}</title></rect><text x="${x + bw}" y="${H + 15}" text-anchor="middle">${l}</text>`; }).join('')}</svg>
    <div class="legend small"><span><i style="background:#2f6d4a"></i>Income</span><span><i style="background:#b8b2a3"></i>Expenses</span></div>`;
}
ROUTES.money = function (yy) {
  const y = yy || UI.my || thisYear(); UI.my = y;
  const tab = UI.mtab || 'overview';
  const years = [...new Set([thisYear(), ...DB.money.map(m => (m.date || '').slice(0, 4))])].filter(Boolean).sort().reverse();
  const all = DB.money.filter(m => (m.date || '').startsWith(y)).sort((a, b) => b.date.localeCompare(a.date) || (a.rid || '').localeCompare(b.rid || ''));
  const inc = all.filter(m => m.kind === 'Income'), exp = all.filter(m => m.kind !== 'Income');
  const cows = DB.animals.filter(a => typeOf(a) === 'Cow' && (isActive(a) || (a.saleDate || a.deathDate || '') >= y)).length;
  const groupT = (l, tot) => {
    const g = {}; l.forEach(m => { const ci = catInfo(m.category, m.kind), o = g[ci.g] || (g[ci.g] = { t: 0, c: {} }); o.t += +m.amount || 0; o.c[m.category || 'Other'] = (o.c[m.category || 'Other'] || 0) + (+m.amount || 0); });
    const rows = Object.entries(g).sort((a, b) => b[1].t - a[1].t);
    return rows.length ? `<div class="gtab">${rows.map(([n, o]) => `<details><summary><span>${esc(n)}</span><b>${usd(o.t)}</b><span class="muted small">${pct(o.t, tot)}</span></summary>${Object.entries(o.c).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="gsub"><a href="javascript:void 0" onclick="UI.mtab='entries';UI.mq='${esc(c).replace(/'/g, '')}';refresh()">${esc(c)}</a><span>${usd(v)}</span></div>`).join('')}</details>`).join('')}</div>` : empty('None yet.');
  };
  let body = '';
  if (tab === 'overview') {
    body = `<div class="kpis"><div class="kpi"><div class="kl">Income ${y}</div><div class="kv">${usd(msum(inc))}</div></div><div class="kpi"><div class="kl">Expenses ${y}</div><div class="kv">${usd(msum(exp))}</div></div><div class="kpi"><div class="kl">Net</div><div class="kv">${usd(msum(inc) - msum(exp))}</div></div><div class="kpi"><div class="kl">Cost per cow</div><div class="kv">${cows ? usd(msum(exp) / cows) : '—'}</div><div class="ks">${plural(cows, 'cow')}</div></div></div>
     ${card('By month', monthBars(all, y))}
     <div class="cols">${card('Where the money went', groupT(exp, msum(exp)))}${card('Where it came from', groupT(inc, msum(inc)))}</div>`;
  } else if (tab === 'entries') {
    const mons = [['', 'Every month'], ...['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(k => [k, new Date(2000, +k - 1, 1).toLocaleDateString(undefined, { month: 'long' })])];
    body = `<div class="toolbar"><input class="search" type="search" placeholder="Search store, category, note…" value="${esc(UI.mq || '')}" oninput="UI.mq=this.value;$('#mentries').innerHTML=moneyEntries()"><select onchange="UI.mm=this.value;$('#mentries').innerHTML=moneyEntries()">${opts(mons, UI.mm || '', false)}</select></div><div id="mentries">${moneyEntries()}</div>`;
  } else if (tab === 'vendors') {
    const v = {}; exp.forEach(m => { const k = m.payee || '(not filled in)', o = v[k] || (v[k] = { n: 0, t: 0, last: '' }); o.n++; o.t += +m.amount || 0; if (m.date > o.last) o.last = m.date; });
    body = table([{ h: 'Paid to', f: r => `<a href="javascript:void 0" onclick="UI.mtab='entries';UI.mq='${esc(r[0]).replace(/'/g, '')}';refresh()">${esc(r[0])}</a>` }, { h: 'Entries', f: r => r[1].n, cls: 'num' }, { h: 'Total', f: r => usd(r[1].t), cls: 'num' }, { h: 'Last', f: r => fmtD(r[1].last) }], Object.entries(v).sort((a, b) => b[1].t - a[1].t), { empty: 'No expenses yet.' });
  } else {
    const L = {}; all.forEach(m => { const ln = catInfo(m.category, m.kind).line; L[ln] = (L[ln] || 0) + (+m.amount || 0); });
    const rows = Object.entries(L).map(([k, v]) => ({ k, v, inc: k[0] === 'I' })).sort((a, b) => (a.inc ? 0 : 1) - (b.inc ? 0 : 1) || natCmp(TAXL[a.k], TAXL[b.k]));
    body = `<p class="muted small">Totals by IRS Schedule F line, so your tax preparer can copy them across. This is a guide — they decide where things really go (big equipment is usually depreciated; cattle bought are a cost, not an expense).</p>` +
      table([{ h: '', f: r => r.inc ? '<span class="chip green">Income</span>' : '<span class="chip">Expense</span>' }, { h: 'Schedule F line', f: r => esc(TAXL[r.k] || r.k) }, { h: 'Amount', f: r => usd(r.v), cls: 'num' }], rows, { empty: 'No money entries for ' + y + '.' });
  }
  const tabs = [['overview', 'Overview'], ['entries', 'Entries'], ['vendors', 'By store / vendor'], ['tax', 'Tax summary']];
  main(page('Money', `<select class="btn" onchange="location.hash='#/money/'+this.value">${opts(years, y, false)}</select><button class="btn" onclick="actMoney(null,{kind:'Income'})">+ Income</button><button class="btn primary" onclick="actMoney()">+ Expense</button>`,
    `<div class="tabs">${tabs.map(([k, l]) => `<a href="javascript:void 0" class="${tab === k ? 'on' : ''}" onclick="UI.mtab='${k}';refresh()">${l}</a>`).join('')}</div>${tab === 'overview' ? body : card('', body)}
     ${all.length ? `<p><button class="btn sm" onclick="exportMoney('${y}')">Export ${y} to a spreadsheet (CSV) for your accountant</button></p>` : ''}`,
    'Take a picture of the receipt when you add it. Cattle sold through “Sold / died” and cattle bought on an animal show up here on their own.'));
};
function moneyEntries() {
  const y = UI.my || thisYear(), q = (UI.mq || '').toLowerCase(), mon = UI.mm || '';
  const list = DB.money.filter(m => (m.date || '').startsWith(y) && (!mon || m.date.slice(5, 7) === mon) && (!q || [m.category, m.payee, m.note, catInfo(m.category, m.kind).g, m.checkNo].some(x => (x || '').toLowerCase().includes(q)))).sort((a, b) => b.date.localeCompare(a.date) || (a.rid || '').localeCompare(b.rid || ''));
  return `<p class="small muted">${plural(list.length, 'entry', 'entries')} · in ${usd(msum(list.filter(m => m.kind === 'Income')))} · out ${usd(msum(list.filter(m => m.kind !== 'Income')))}</p><div class="mlist">${list.map(m => `<a class="mrow" href="javascript:void 0" onclick="actMoney('${m.id}')"><span class="md">${fmtD(m.date).replace(/, \d{4}$/, '')}</span><span class="mt"><b>${esc(m.category)}</b><small>${esc([m.payee, m.note, m.pay ? m.pay + (m.checkNo ? ' #' + m.checkNo : '') : '', m.animalId && AN(m.animalId) ? keyOf(AN(m.animalId)) : '', m.pastureId ? pastureName(m.pastureId) : ''].filter(Boolean).join(' · '))}</small></span>${m.receipt ? '<span title="receipt">📎</span>' : ''}<span class="ma ${m.kind === 'Income' ? 'in' : ''}">${m.kind === 'Income' ? '+' : ''}${usd(m.amount)}</span></a>`).join('') || empty('No entries match.')}</div>`;
}
function exportMoney(y) {
  download('HerdBook money ' + y + '.csv', toCSV([['Date', 'Kind', 'Group', 'Category', 'Schedule F line', 'Amount', 'Paid to / from', 'How paid', 'Check #', 'Pasture', 'Animal', 'Note', 'Receipt #'],
    ...DB.money.filter(m => (m.date || '').startsWith(y)).sort(byDate).map(m => { const ci = catInfo(m.category, m.kind); return [m.date, m.kind, ci.g, m.category, TAXL[ci.line] || '', m.kind === 'Income' ? m.amount : -m.amount, m.payee, m.pay, m.checkNo, pastureName(m.pastureId), m.animalId && AN(m.animalId) ? keyOf(AN(m.animalId)) : '', m.note, m.rid ? m.rid.slice(-6) : '']; })]));
}

start();