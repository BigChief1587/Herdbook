'use strict';
/* HerdBook - cattle records. Records are kept on this device and synced through the
   farm's own Google Drive (see store.js). Works with no signal. */

const COLLS = ['animals','weights','treatments','breedings','pregchecks','moves','pastures','products','money','tasks','settings','obs','sessions','protocols'];
const DB = {}; COLLS.forEach(c => DB[c] = []);
let IX = {}, CHILD = {}, PROG = {}, WT = {}, TR = {}, OBS = {}, KEY2A = {}, A2KEY = {};
const SEL = new Set();
const UI = { af: { q: '', status: 'Active', type: '', pasture: '', year: '', breed: '' }, tab: {} };

// ---------------------------------------------------------------- utilities
const $ = s => document.querySelector(s);
const esc = s => (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 0) => v == null || v === '' || isNaN(v) ? '' : (+v).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
const usd = v => v == null || v === '' || isNaN(v) ? '' : (+v).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '';
const avg = l => { const v = l.filter(x => x != null && !isNaN(x)); return v.length ? v.reduce((s, x) => s + +x, 0) / v.length : null; };
const plural = (n, w, p) => n + ' ' + (n === 1 ? w : (p || w + 's'));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const z2 = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate());
const today = () => iso(new Date());
const parseD = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + Math.round(n)); return iso(d); };
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
const fmtD = s => s ? parseD(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
const byDate = (a, b) => (a.date || '').localeCompare(b.date || '');
const natCmp = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
const isPhone = () => matchMedia('(max-width:760px)').matches;
const thisYear = () => today().slice(0, 4);

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('on'), 2200); }

function download(name, text, type = 'text/csv') {
  const b = new Blob([text], { type }); const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function toCSV(rows) { return rows.map(r => r.map(v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n'); }
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}
function parseAnyDate(s) {
  s = (s || '').trim(); if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + z2(m[2]) + '-' + z2(m[3]);
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) { let y = +m[3]; if (y < 100) y += y > 50 ? 1900 : 2000; return y + '-' + z2(m[1]) + '-' + z2(m[2]); }
  const d = new Date(s); return isNaN(d) ? null : iso(d);
}

// ---------------------------------------------------------------- records (on this device; synced by store.js)
async function load() {
  await Store.open();
  const recs = await Store.allDocs();
  COLLS.forEach(c => DB[c] = []);
  for (const r of recs) if (!r.x && DB[r.c] && r.d) DB[r.c].push(r.d);
  reindex();
  if (DB.settings.length) Farms.upd(Store.name(), { name: S().farmName });
}
// ops: [{coll, data}] or [{coll, del:id}] - all saved together or not at all
async function saveMany(ops) {
  if (!ops.length) return;
  if (Sync.readOnly()) { toast('View only — the owner hasn’t let you change this farm'); throw new Error('You can only look at this farm. Ask the owner to change you to “Record”.'); }
  for (const o of ops) if (o.data && !o.data.id) o.data.id = uid();
  await Store.putDocs(ops.map(o => { const id = o.del || o.data.id, k = o.coll + '/' + id; return o.del ? { k, c: o.coll, id, d: null, x: 1, u: Store.nextU(k), dirty: 1 } : { k, c: o.coll, id, d: o.data, x: 0, u: Store.nextU(k), dirty: 1 }; }));
  Sync.st.pending += ops.length; renderSync(); Sync.soon(route().r === 'work' ? 45000 : 3000);   // at the chute: send in batches (and when the phone is put away)
  for (const o of ops) {
    const arr = DB[o.coll];
    if (o.del) { const i = arr.findIndex(x => x.id === o.del); if (i >= 0) arr.splice(i, 1); }
    else { const i = arr.findIndex(x => x.id === o.data.id); if (i >= 0) arr[i] = o.data; else arr.push(o.data); }
  }
  reindex();
}
const put1 = (coll, data) => saveMany([{ coll, data }]);
const del1 = (coll, id) => saveMany([{ coll, del: id }]);

// ---------------------------------------------------------------- settings
const DEF_SET = {
  id: 'main', farmName: 'My Herd', gestation: 283, defaultBW: 75,
  breeds: ['Angus', 'Red Angus', 'Hereford', 'Black Baldy', 'Red Baldy', 'Charolais', 'Simmental', 'SimAngus', 'Limousin', 'Shorthorn', 'Brangus', 'Gelbvieh', 'Crossbred'],
  colors: ['Black', 'Red', 'Black white face', 'Red white face', 'White', 'Gray', 'Smoky', 'Yellow', 'Brindle', 'Roan'],
  routes: ['SQ', 'IM', 'IV', 'Oral', 'Pour-on', 'Intranasal', 'Topical', 'Implant'],
  sites: ['Neck - left', 'Neck - right', 'Neck', 'Ear', 'Back (pour-on)', 'Mouth', 'Nose'],
  incomeCats: ['Calf sales', 'Cull cow sales', 'Bull sales', 'Feeder sales', 'Other income'],
  expenseCats: ['Hay', 'Feed / grain', 'Mineral / supplement', 'Vet / medicine', 'Breeding / semen', 'Cattle purchases', 'Fuel', 'Repairs / equipment', 'Pasture rent', 'Fencing', 'Fertilizer / seed', 'Trucking', 'Sale barn fees', 'Labor', 'Other expense']
};
const S = () => Object.assign({}, DEF_SET, DB.settings.find(s => s.id === 'main') || {});

// ---------------------------------------------------------------- indexes
function reindex() {
  IX = {}; for (const c of COLLS) { IX[c] = {}; for (const d of DB[c]) IX[c][d.id] = d; }
  CHILD = {}; PROG = {}; WT = {}; TR = {}; OBS = {};
  const push = (m, k, v) => { if (k) (m[k] || (m[k] = [])).push(v); };
  for (const a of DB.animals) { push(CHILD, a.damId, a); push(PROG, a.sireId, a); }
  for (const w of DB.weights) push(WT, w.animalId, w);
  for (const t of DB.treatments) push(TR, t.animalId, t);
  for (const o of DB.obs) push(OBS, o.animalId, o);
  Object.values(WT).forEach(l => l.sort(byDate)); Object.values(TR).forEach(l => l.sort(byDate)); Object.values(OBS).forEach(l => l.sort(byDate));
  Object.values(CHILD).forEach(l => l.sort((a, b) => (a.birthDate || '').localeCompare(b.birthDate || '')));
  // a unique key for every animal: its tag, plus the birth year when a tag is reused
  const base = a => (a.tag || a.name || 'no tag').trim();
  const cnt = {}; for (const a of DB.animals) { const b = base(a).toLowerCase(); cnt[b] = (cnt[b] || 0) + 1; }
  KEY2A = {}; A2KEY = {};
  const sorted = DB.animals.slice().sort((a, b) => (a.status === 'Active' ? 0 : 1) - (b.status === 'Active' ? 0 : 1));
  for (const a of sorted) {
    let k = base(a);
    if (cnt[k.toLowerCase()] > 1) k += ' (' + (a.birthDate ? a.birthDate.slice(0, 4) : 'no DOB') + ')';
    if (KEY2A[k.toLowerCase()]) k += ' #' + a.id.slice(-4);
    KEY2A[k.toLowerCase()] = a; A2KEY[a.id] = k;
  }
}
function findAnimal(text, filter) {
  const t = (text || '').trim().toLowerCase(); if (!t) return null;
  const a = KEY2A[t]; if (a && (!filter || filter(a))) return a;
  const m = DB.animals.filter(x => (x.tag || '').toLowerCase() === t || (x.name || '').toLowerCase() === t || (x.eid || '').toLowerCase() === t).filter(x => !filter || filter(x));
  if (!m.length) return null;
  m.sort((x, y) => (x.status === 'Active' ? 0 : 1) - (y.status === 'Active' ? 0 : 1) || (y.birthDate || '').localeCompare(x.birthDate || ''));
  return m[0];
}

// ---------------------------------------------------------------- animal logic
const AN = id => IX.animals[id];
const keyOf = a => a ? A2KEY[a.id] : '';
const aLink = id => { const a = AN(id); return a ? `<a href="#/animal/${a.id}">${esc(keyOf(a))}</a>` : ''; };
const isActive = a => !a.status || a.status === 'Active';
const ageDays = (a, asOf = today()) => a.birthDate ? daysBetween(a.birthDate, asOf) : null;
function ageStr(a, asOf) {
  const d = ageDays(a, asOf); if (d == null || d < 0) return '';
  if (d === 0) return 'newborn';
  if (d < 60) return d + ' d';
  const m = Math.floor(d / 30.4375); if (m < 24) return m + ' mo';
  const y = Math.floor(m / 12), r = m % 12; return y + ' yr' + (r ? ' ' + r + ' mo' : '');
}
const wOf = a => WT[a.id] || [];
const lastW = a => { const l = wOf(a); return l[l.length - 1] || null; };
const weanW = a => wOf(a).find(w => w.kind === 'Weaning') || null;
const yearlingW = a => wOf(a).find(w => w.kind === 'Yearling') || null;
const isWeaned = a => !!a.weanDate || !!weanW(a);
const calvesOf = a => CHILD[a.id] || [];
// The kind you pick on the animal wins. A calf you picked grows up on its own when it is weaned
// (or reaches 300 days); a heifer becomes a cow when a calf is recorded on her.
function typeOf(a) {
  const d = ageDays(a), k = a.kind;
  const calfAge = d != null && d < 300 && !isWeaned(a);
  const calf = k && /calf/.test(k) ? !isWeaned(a) && (d == null || d < 300) : (k ? false : calfAge);
  if (a.sex === 'F') { if (calvesOf(a).length || a.calvedBefore || k === 'Cow') return 'Cow'; return calf ? 'Heifer calf' : 'Heifer'; }
  if (a.sex === 'M') return calf ? 'Bull calf' : 'Bull';
  if (a.sex === 'S') return calf ? 'Steer calf' : 'Steer';
  return 'Unknown';
}
const TYPES = ['Cow', 'Heifer', 'Bull', 'Steer', 'Heifer calf', 'Bull calf', 'Steer calf'];
const KIND_SEX = { 'Cow': 'F', 'Heifer': 'F', 'Heifer calf': 'F', 'Bull': 'M', 'Bull calf': 'M', 'Steer': 'S', 'Steer calf': 'S' };
// write a picked kind onto an animal record (sex + kind + the old "has calved" flag)
function setKind(rec, kind) {
  if (!KIND_SEX[kind]) return rec;
  rec.sex = KIND_SEX[kind]; rec.kind = kind;
  if (kind === 'Cow') rec.calvedBefore = true; else if (rec.sex === 'F') rec.calvedBefore = false;
  return rec;
}
const isFemale = a => a.sex === 'F';
const isMale = a => a.sex === 'M';
const breedable = a => isActive(a) && a.sex === 'F' && (typeOf(a) === 'Cow' || (typeOf(a) === 'Heifer' && (ageDays(a) == null || ageDays(a) >= 300)));
const pastureName = id => id && IX.pastures[id] ? IX.pastures[id].name : '';
const lastCalving = a => { const c = calvesOf(a).map(x => x.birthDate).filter(Boolean); return c.length ? c[c.length - 1] : null; };
function parentText(id, name) { return id && AN(id) ? keyOf(AN(id)) : (name || ''); }
function parentLink(id, name) { return id && AN(id) ? aLink(id) : esc(name || ''); }
const sireText = o => parentText(o.sireId, o.sireName);
const damText = o => parentText(o.damId, o.damName);

// breeding status since the last calving
function repro(a) {
  const g = +S().gestation || 283;
  const lc = lastCalving(a);
  const br = DB.breedings.filter(b => b.femaleId === a.id && (!lc || b.date > lc)).sort(byDate);
  const pc = DB.pregchecks.filter(p => p.femaleId === a.id && (!lc || p.date > lc)).sort(byDate);
  const lastPc = pc[pc.length - 1] || null, lastBr = br[br.length - 1] || null;
  const r = { status: null, due: null, dueTo: null, sireId: null, sireName: null, bredDate: null, method: null, breedings: br, checks: pc, lastCheck: lastPc };
  if (!lastBr && !lastPc) { r.status = breedable(a) ? 'Not exposed' : null; return r; }
  const setSire = b => { if (b) { r.sireId = b.sireId || null; r.sireName = b.sireName || null; r.bredDate = b.date; r.method = b.method; } };
  if (lastPc && lastPc.result === 'Open' && (!lastBr || lastBr.date <= lastPc.date)) { r.status = 'Open'; return r; }
  if (lastPc && lastPc.result === 'Bred' && (!lastBr || lastBr.date <= lastPc.date)) {
    r.status = 'Bred';
    const before = br.filter(b => b.date <= lastPc.date);
    if (lastPc.dueDate) { r.due = lastPc.dueDate; setSire(before[before.length - 1]); }
    else if (lastPc.fetalDays) {
      const conc = addDays(lastPc.date, -lastPc.fetalDays); r.due = addDays(conc, g);
      // the service closest to the conception date gets the credit
      let best = null; for (const b of before) { const d = Math.abs(daysBetween(b.date, conc)); if (!best || d < best.d) best = { b, d }; }
      setSire(best && best.b);
    } else {
      const ai = before.filter(b => b.method !== 'Natural service');
      if (ai.length) { const b = ai[ai.length - 1]; r.due = addDays(b.date, g); setSire(b); }
      else if (before.length) { const b = before[before.length - 1]; r.due = addDays(b.date, g); r.dueTo = addDays(b.endDate || lastPc.date, g); setSire(b); }
    }
  } else {
    r.status = 'Exposed'; setSire(lastBr);
    r.due = addDays(lastBr.date, g);
    if (lastBr.method === 'Natural service') r.dueTo = lastBr.endDate ? addDays(lastBr.endDate, g) : null;
  }
  const late = r.dueTo || r.due;
  if (late && daysBetween(late, today()) > 30) r.status = r.status === 'Bred' ? 'Overdue' : 'Exposed - no calf';
  return r;
}
function reproChip(r) {
  if (!r || !r.status) return '';
  const cls = { 'Bred': 'green', 'Open': 'red', 'Overdue': 'red', 'Exposed': 'blue', 'Exposed - no calf': 'amber', 'Not exposed': '' }[r.status] || '';
  let t = r.status; if ((r.status === 'Bred' || r.status === 'Exposed') && r.due) {
    const dd = daysBetween(today(), r.due); if (dd <= 30 && dd >= -30) t += ' · due ' + fmtD(r.due).replace(/, \d{4}$/, '');
  }
  return `<span class="chip ${cls}">${esc(t)}</span>`;
}
function withdrawalUntil(a) { let m = null; for (const t of TR[a.id] || []) if (t.withdrawalDate && t.withdrawalDate >= today() && (!m || t.withdrawalDate > m)) m = t.withdrawalDate; return m; }

// dam age the BIF way: calf's birth year minus the dam's birth year
const damAgeAt = (dam, date) => dam && dam.birthDate && date ? +date.slice(0, 4) - +dam.birthDate.slice(0, 4) : null;
// adjusted 205-day weaning weight (BIF standard, with age-of-dam adjustment)
function adj205(c) {
  const ww = weanW(c); if (!ww || !c.birthDate) return null;
  const age = daysBetween(c.birthDate, ww.date);
  const out = { ww: ww.weight, wdate: ww.date, age, adj: null, damAge: null };
  if (age < 160 || age > 250 || !ww.weight) return out;
  const bw = c.birthWeight || +S().defaultBW || 75;
  let adj = (ww.weight - bw) / age * 205 + bw;
  const dam = AN(c.damId);
  if (dam && dam.birthDate) {
    const da = damAgeAt(dam, c.birthDate); out.damAge = da;
    const male = c.sex !== 'F';
    if (da <= 2) adj += male ? 60 : 54; else if (da === 3) adj += male ? 40 : 36; else if (da === 4) adj += male ? 20 : 18; else if (da >= 11) adj += male ? 20 : 18;
  }
  out.adj = Math.round(adj);
  return out;
}
// ratio of each calf's adjusted 205 to the average of its year + sex group
function ratioMap() {
  const groups = {}, res = {};
  for (const c of DB.animals) { const r = adj205(c); if (!r || !r.adj) continue; const k = (c.birthDate || '').slice(0, 4) + (c.sex === 'F' ? 'F' : 'M'); (groups[k] || (groups[k] = [])).push([c.id, r.adj]); }
  for (const l of Object.values(groups)) { const m = avg(l.map(x => x[1])); for (const [id, v] of l) res[id] = Math.round(v / m * 100); }
  return res;
}
function adgBetween(w1, w2) { const d = daysBetween(w1.date, w2.date); return d > 0 ? (w2.weight - w1.weight) / d : null; }

// ---------------------------------------------------------------- router
const ROUTES = {};
const NAV = [['dashboard', 'Home'], ['animals', 'Animals'], ['work', 'Work cattle'], ['calving', 'Calving'], ['breeding', 'Breeding'], ['health', 'Health'], ['weights', 'Weights'], ['pastures', 'Pastures'], ['money', 'Money'], ['tasks', 'Tasks'], ['reports', 'Reports'], ['settings', 'Settings']];
function route() { const [r, ...rest] = location.hash.replace(/^#\/?/, '').split('/'); return { r: ROUTES[r] ? r : 'dashboard', args: rest.map(decodeURIComponent) }; }
function renderNav(cur) {
  $('#nav').innerHTML = `${CHANNEL === 'test' ? '<div class="testbar">TEST COPY — not your real herd</div>' : ''}<div class="brand"><img src="icon.svg" alt=""><div><button class="farmbtn" onclick="farmMenu()" title="Switch farms">${esc(S().farmName)} <span>▾</span></button>${Sync.readOnly() ? '<span class="rochip">view only</span>' : ''}<button id="sync" class="sync" onclick="tapSync()"></button></div><button class="menu" onclick="document.body.classList.toggle('navopen')" aria-label="Menu">&#9776;</button></div>
  <nav>${NAV.map(([k, l]) => `<a href="#/${k}" class="${cur === k || (cur === 'animal' && k === 'animals') ? 'on' : ''}" onclick="document.body.classList.remove('navopen')">${l}</a>`).join('')}</nav>`;
  // phone: tabs along the bottom, in thumb reach
  let bn = $('#bnav'); if (!bn) { bn = document.createElement('div'); bn.id = 'bnav'; document.body.appendChild(bn); }
  const tabs = [['dashboard', 'Home', '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'], ['animals', 'Animals', '<path d="M4 8c2-3 5-3 8-3s6 0 8 3l-2 3v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6z"/><path d="M4 8L2 6M20 8l2-2"/>'], ['work', 'Work', '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>'], ['money', 'Money', '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'], ['more', 'More', '<path d="M4 6h16M4 12h16M4 18h16"/>']];
  const inMain = ['dashboard', 'animals', 'animal', 'work', 'money'].includes(cur);
  bn.innerHTML = tabs.map(([k, l, p]) => `<a ${k === 'more' ? `href="javascript:void 0" onclick="document.body.classList.toggle('navopen');window.scrollTo(0,0)"` : `href="#/${k}"`} class="${(k === cur || (k === 'animals' && cur === 'animal') || (k === 'more' && !inMain)) ? 'on' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>${l}</a>`).join('');
  renderSync();
}
// the little sync line under the farm name
function syncLabel() {
  const s = Sync.st, p = s.pending, ch = p ? plural(p, 'change') + ' not backed up yet' : '';
  const t = s.last ? new Date(s.last) : null, when = !t ? '' : t.toDateString() === new Date().toDateString() ? t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : t.toLocaleDateString([], { month: 'short', day: 'numeric' });
  if (!s.account) return ['warn', 'Only on this device — tap to sign in'];
  if (s.state === 'syncing') return ['busy', 'Syncing…'];
  if (s.state === 'offline') return [p ? 'warn' : 'ok', p ? 'No signal — ' + plural(p, 'change') + ' saved here' : 'No signal' + (when ? ' — synced ' + when : '')];
  if (s.state === 'signin') return ['warn', (ch || 'Not synced lately') + ' — tap to sync'];
  if (s.state === 'error') return ['bad', 'Sync problem — tap for details'];
  return [p ? 'warn' : 'ok', p ? ch : 'Synced' + (when ? ' ' + when : '')];
}
function renderSync() {
  const el = $('#sync'); if (!el) return;
  const [cls, txt] = syncLabel(); el.className = 'sync ' + cls; el.innerHTML = '<i></i>' + esc(txt);
}
async function tapSync() {
  const s = Sync.st;
  if (!s.account) { document.body.classList.remove('navopen'); location.hash = '#/settings'; return; }
  if (s.state === 'error') { alert('HerdBook could not sync:\n\n' + s.msg + '\n\nYour records are still saved on this device. It will try again on its own.'); }
  try { await Sync.run(true); } catch (e) { alert(e.message); }
  if (Sync.st.msg && Sync.st.state === 'signin') toast(Sync.st.msg);
}
function main(html) { $('#main').innerHTML = html; hydratePhotos(); }
// photos are drawn as <img data-pid> and filled in from this device (or Google Drive)
function hydratePhotos(root = document) {
  root.querySelectorAll('img[data-pid]').forEach(img => {
    const pid = img.dataset.pid; img.removeAttribute('data-pid');
    Sync.photoUrl(pid).then(u => { if (u) img.src = u; else img.classList.add('nophoto'); });
  });
}
function viewPhoto(pid) { Sync.photoUrl(pid).then(u => { if (!u) return; const m = modal(`<img src="${u}" style="width:100%;border-radius:8px"><div class="mfoot"><span class="sp"></span><button class="btn" onclick="closeModal()">Close</button></div>`, { wide: true }); }); }
function refresh() { const { r, args } = route(); renderNav(r); ROUTES[r](...args); }
window.addEventListener('hashchange', () => { refresh(); window.scrollTo(0, 0); });
const page = (title, actions, body, sub) => `<div class="phead"><h1>${title}</h1><div class="pact">${actions || ''}</div></div>${sub ? `<p class="sub">${sub}</p>` : ''}${body}`;
const card = (title, body, extra = '') => `<section class="card" ${extra}>${title ? `<h2>${title}</h2>` : ''}${body}</section>`;
const empty = t => `<div class="empty">${t}</div>`;

// table builder: cols [{h, f:row=>html, c:row=>csvValue, cls}]
function table(cols, rows, opt = {}) {
  if (!rows.length) return empty(opt.empty || 'Nothing to show.');
  return `<div class="tscroll"><table class="t ${opt.cls || ''}"><thead><tr>${cols.map(c => `<th class="${c.cls || ''}">${c.h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(r => `<tr${opt.rowAttr ? ' ' + opt.rowAttr(r) : ''}>${cols.map(c => `<td class="${c.cls || ''}">${c.f(r) ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
  ${opt.foot ? `<tfoot><tr>${opt.foot.map((v, i) => `<td class="${cols[i] && cols[i].cls || ''}">${v ?? ''}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
}
function tableCSV(cols, rows) { return toCSV([cols.map(c => c.h.replace(/<[^>]+>/g, '')), ...rows.map(r => cols.map(c => c.c ? c.c(r) : String(c.f(r) ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')))]); }

// ---------------------------------------------------------------- modal + forms
function modal(html, opt = {}) {
  $('#modal-root').innerHTML = `<div class="mback"><div class="modal${opt.wide ? ' wide' : ''}" role="dialog">${html}</div></div>`;
  document.body.classList.add('noscroll');
  return $('#modal-root .modal');
}
function closeModal() { $('#modal-root').innerHTML = ''; document.body.classList.remove('noscroll'); if (UI.stale) { UI.stale = false; refresh(); } }
// Escape closes a form only when you aren't typing in it (so a half-typed receipt isn't lost)
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal-root').innerHTML && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) closeModal(); });

function opts(list, val, blank = true) {
  return (blank ? '<option value=""></option>' : '') + list.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(v) === String(val ?? '') ? ' selected' : ''}>${esc(l)}</option>`; }).join('');
}
// every animal as a pick-list item: value = its tag key, with kind / name / status underneath
function animalItems(filter) {
  return DB.animals.filter(a => !filter || filter(a)).sort((a, b) => (isActive(a) ? 0 : 1) - (isActive(b) ? 0 : 1) || natCmp(keyOf(a), keyOf(b)))
    .map(a => ({ v: keyOf(a), s: [typeOf(a), a.name && a.name !== a.tag ? a.name : '', a.breed, pastureName(a.pastureId), isActive(a) ? '' : a.status].filter(Boolean).join(' · ') }));
}

// ---------------- pick box: type to narrow it down, or tap ▾ to scroll the WHOLE list (phones cut datalists short)
const COMBO = {};
let CB = null;
function comboHtml(id, name, val, ph, items, cls = '') {
  COMBO[id] = typeof items === 'function' ? items : () => items;
  return `<div class="combo"><input id="${id}" name="${name}" class="${cls}" value="${esc(val)}" autocomplete="off" autocapitalize="words" placeholder="${esc(ph || '')}" data-combo="1"><button type="button" class="cbtn" tabindex="-1" aria-label="Show the whole list" data-for="${id}">▾</button></div>`;
}
const comboItem = o => typeof o === 'string' ? { v: o } : Array.isArray(o) ? { v: o[0], l: o[1] } : o;
function comboOpen(inp, all) {
  if (CB && CB.inp === inp) { CB.all = all; return comboDraw(); }
  comboClose(); if (!COMBO[inp.id]) return;
  const panel = document.createElement('div'); panel.className = 'cpanel';
  panel.addEventListener('mousedown', e => e.preventDefault());
  inp.parentNode.appendChild(panel); CB = { inp, panel, all, hi: -1, items: [] }; comboDraw();
}
function comboClose() { if (CB) { CB.panel.remove(); CB = null; } }
function comboDraw() {
  const { inp, panel } = CB, q = CB.all ? '' : inp.value.trim().toLowerCase();
  let items = COMBO[inp.id]().map(comboItem);
  if (q) {
    items = items.filter(o => !o.g && (o.v + ' ' + (o.l || '') + ' ' + (o.s || '')).toLowerCase().includes(q));
    items.sort((a, b) => (String(a.v).toLowerCase().startsWith(q) ? 0 : 1) - (String(b.v).toLowerCase().startsWith(q) ? 0 : 1));
  }
  CB.items = items;
  const cur = inp.value.trim().toLowerCase();
  panel.innerHTML = (items.length ? items.map((o, i) => o.g ? `<div class="cgrp">${esc(o.g)}</div>` : `<div class="copt${i === CB.hi ? ' hi' : ''}${String(o.v).toLowerCase() === cur ? ' cur' : ''}" data-i="${i}"><b>${esc(o.l || o.v)}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</div>`).join('')
    : `<div class="cnone">Nothing in the list matches — what you typed will be used.</div>`) + `<div class="cclose" data-close="1">Close list</div>`;
  if (CB.all) { const c = panel.querySelector('.cur'); if (c) c.scrollIntoView({ block: 'nearest' }); }
}
function comboPick(i) {
  const o = CB && CB.items[i]; if (!o || o.g) return;
  const inp = CB.inp; inp.value = o.v; comboClose();
  inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
}
document.addEventListener('focusin', e => { const t = e.target; if (t.dataset && t.dataset.combo) comboOpen(t, true); else if (CB && !t.closest('.combo')) comboClose(); });
document.addEventListener('input', e => { if (CB && e.target === CB.inp && e.isTrusted) { CB.all = false; CB.hi = -1; comboDraw(); } });
document.addEventListener('click', e => {
  const b = e.target.closest('.cbtn');
  if (b) { const inp = document.getElementById(b.dataset.for); if (CB && CB.inp === inp && CB.all) comboClose(); else comboOpen(inp, true); return; }
  const o = e.target.closest('.copt'); if (o && CB) return comboPick(+o.dataset.i);
  if (e.target.closest('[data-close]')) return comboClose();
  if (CB && !e.target.closest('.combo')) comboClose();
});
document.addEventListener('keydown', e => {
  if (!CB || e.target !== CB.inp) return;
  const sel = () => CB.items.map((o, i) => o.g ? -1 : i).filter(i => i >= 0);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); const l = sel(); if (!l.length) return;
    let p = l.indexOf(CB.hi); p = e.key === 'ArrowDown' ? Math.min(l.length - 1, p + 1) : Math.max(0, p - 1); CB.hi = l[p]; comboDraw();
    const h = CB.panel.querySelector('.hi'); if (h) h.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && CB.hi >= 0) { e.preventDefault(); comboPick(CB.hi); }
  else if (e.key === 'Escape') { e.stopPropagation(); comboClose(); }
  else if (e.key === 'Tab') comboClose();
}, true);

// big tap buttons for short choices (kind, yes/no, scores)
function segHtml(id, name, list, val, cls = '') {
  return `<input type="hidden" id="${id}" name="${name}" value="${esc(val ?? '')}"><div class="seg ${cls}" data-for="${id}">${list.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<button type="button" data-v="${esc(v)}" class="${String(v) === String(val ?? '') ? 'on' : ''}">${esc(l)}</button>`; }).join('')}</div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('.seg button'); if (!b) return;
  const seg = b.parentNode, inp = seg.dataset.for && document.getElementById(seg.dataset.for);
  if (!inp) return;
  const v = seg.classList.contains('toggle') && b.classList.contains('on') ? '' : b.dataset.v;
  seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b && v !== ''));
  inp.value = v; inp.dispatchEvent(new Event('change', { bubbles: true }));
});
function fieldHtml(f, v) {
  const id = 'f_' + f.k, val = v == null ? '' : v, big = f.big ? ' big' : '';
  let inp;
  switch (f.type) {
    case 'select': inp = `<select id="${id}" name="${f.k}">${opts(f.options, val, f.blank !== false)}</select>`; break;
    case 'buttons': inp = segHtml(id, f.k, f.options, val); break;
    case 'textarea': inp = `<textarea id="${id}" name="${f.k}" rows="${f.rows || 3}">${esc(val)}</textarea>`; break;
    case 'check': inp = `<label class="chk"><input type="checkbox" id="${id}" name="${f.k}"${val ? ' checked' : ''}> ${esc(f.text || '')}</label>`; break;
    case 'photo': inp = `<label class="btn photobtn">📷 Take or pick a photo<input type="file" accept="image/*" multiple id="${id}" name="${f.k}" style="display:none" onchange="this.closest('.fld').querySelector('.hint').textContent=this.files.length?plural(this.files.length,'photo')+' ready — saved with the animal':''"></label>`; f.hint = f.hint || ' '; break;
    case 'animal': inp = comboHtml(id, f.k, val, f.ph || 'Type a tag, or tap ▾', () => animalItems(f.filter), big); break;
    case 'list': inp = comboHtml(id, f.k, val, f.ph || 'Type, or tap ▾ for the list', f.options, big); break;
    case 'number': inp = `<input id="${id}" name="${f.k}" class="${big}" type="number" step="any" inputmode="decimal" value="${esc(val)}" placeholder="${esc(f.ph || '')}">`; break;
    default: inp = `<input id="${id}" name="${f.k}" class="${big}" type="${f.type || 'text'}" value="${esc(val)}" placeholder="${esc(f.ph || '')}"${f.type === 'date' ? '' : ' autocomplete="off"'}>`;
  }
  return `<div class="fld${f.full ? ' full' : ''}"><label for="${id}">${esc(f.label)}${f.req ? ' <span class="req">*</span>' : ''}</label>${inp}${f.hint ? `<div class="hint">${f.hint}</div>` : ''}</div>`;
}
function openForm(o) {
  const m = modal(`<h2>${esc(o.title)}</h2>${o.intro ? `<p class="muted small">${o.intro}</p>` : ''}
  <form id="mf" novalidate><div class="grid2">${o.fields.map(f => f.type === 'section' ? `<h3>${esc(f.label)}</h3>` : fieldHtml(f, o.values ? o.values[f.k] : null)).join('')}</div>
  ${o.extra || ''}<div class="err" id="mferr"></div>
  <div class="mfoot">${o.del ? '<button type="button" class="btn danger" id="mfdel">Delete</button>' : ''}<span class="sp"></span>
  <button type="button" class="btn" onclick="closeModal()">Cancel</button>${o.saveAnother ? '<button type="button" class="btn" id="mfagain">Save &amp; add another</button>' : ''}<button class="btn primary" type="submit">${esc(o.saveText || 'Save')}</button></div></form>`, { wide: o.wide });
  const form = m.querySelector('#mf');
  if (o.onChange) { form.addEventListener('change', e => o.onChange(form, e)); form.addEventListener('input', e => o.onChange(form, e)); o.onChange(form, null); }
  let again = false;
  if (o.saveAnother) m.querySelector('#mfagain').onclick = () => { again = true; form.requestSubmit ? form.requestSubmit() : form.onsubmit(new Event('submit')); };
  form.onsubmit = async e => {
    e.preventDefault();
    const ctx = { again }; again = false;
    const v = {}, errs = [];
    for (const f of o.fields) {
      if (f.type === 'section') continue;
      const el = form.elements[f.k]; if (!el) continue;
      let x;
      if (f.type === 'check') x = el.checked;
      else if (f.type === 'photo') x = [...el.files];
      else {
        x = el.value.trim();
        if (f.type === 'number') { if (x === '') x = null; else { x = parseFloat(x); if (isNaN(x)) errs.push(f.label + ' must be a number'); } }
        if (f.type === 'animal') {
          v[f.k + 'Text'] = x;
          const a = findAnimal(x, f.filter);
          if (x && !a && f.strict) errs.push(`${f.label}: no animal "${x}" in the herd`);
          x = a ? a.id : null;
        }
        if (x === '') x = null;
      }
      if (f.req && x == null && !(f.type === 'animal' && v[f.k + 'Text'] && f.strict)) errs.push(f.label + ' is required');
      v[f.k] = x;
    }
    if (o.validate) { const e2 = o.validate(v); if (e2) errs.push(e2); }
    if (errs.length) { form.querySelector('#mferr').textContent = errs.join(' · '); return; }
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    try { await o.save(v, ctx); closeModal(); refresh(); toast(o.toastText || 'Saved'); if (ctx.again && o.again) o.again(); }
    catch (err) { form.querySelector('#mferr').textContent = 'Could not save: ' + err.message; btn.disabled = false; }
  };
  if (o.del) m.querySelector('#mfdel').onclick = async () => {
    if (!confirm(o.delConfirm || 'Delete this record?')) return;
    try { await o.del(); closeModal(); refresh(); toast('Deleted'); } catch (err) { form.querySelector('#mferr').textContent = 'Could not delete: ' + err.message; }
  };
  if (!isPhone()) { const f1 = form.querySelector('input:not([type=checkbox]),select,textarea'); if (f1) f1.focus(); }
  return form;
}
const pastureOpts = () => DB.pastures.filter(p => !p.retired).sort((a, b) => natCmp(a.name, b.name)).map(p => [p.id, p.name]);

// choose a group of animals: a pasture, typed tags, or the Animals-page selection
function pickThen(title, filter, next, hint) {
  const inP = p => DB.animals.filter(a => isActive(a) && a.pastureId === p && (!filter || filter(a)));
  const selN = [...SEL].filter(id => AN(id) && (!filter || filter(AN(id)))).length;
  const m = modal(`<h2>${esc(title)} — which animals?</h2>${hint ? `<p class="muted small">${hint}</p>` : ''}
   <div class="grid2">
    <div class="fld full"><label>Everything in a pasture</label><select id="pk_p"><option value="">—</option>${DB.pastures.filter(p => !p.retired).map(p => `<option value="${p.id}">${esc(p.name)} (${inP(p.id).length} hd)</option>`).join('')}</select></div>
    <div class="fld full"><label>And/or type tags — spaces or commas between</label><textarea id="pk_t" rows="3" placeholder="e.g. 12 15 102 Y7"></textarea></div>
   </div>
   ${selN ? `<p><label class="chk"><input type="checkbox" id="pk_s" checked> The ${plural(selN, 'animal')} ticked on the Animals page</label></p>` : ''}
   <div class="err" id="pk_e"></div>
   <div class="mfoot"><span class="sp"></span><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" id="pk_go">Next</button></div>`);
  m.querySelector('#pk_go').onclick = () => {
    const ids = new Set(), miss = [];
    const p = $('#pk_p').value; if (p) inP(p).forEach(a => ids.add(a.id));
    for (const t of $('#pk_t').value.split(/[\s,;]+/).filter(Boolean)) { const a = findAnimal(t, filter); if (a) ids.add(a.id); else miss.push(t); }
    if ($('#pk_s') && $('#pk_s').checked) [...SEL].forEach(id => { if (AN(id) && (!filter || filter(AN(id)))) ids.add(id); });
    if (miss.length) { $('#pk_e').textContent = 'Not found' + (filter ? ' (or not the right kind of animal)' : '') + ': ' + miss.join(', '); return; }
    if (!ids.size) { $('#pk_e').textContent = 'Pick at least one animal.'; return; }
    closeModal(); next([...ids]);
  };
}

// ---------------------------------------------------------------- actions: animals
function actEditAnimal(id, preset) {
  const a = id ? AN(id) : Object.assign({ status: 'Active', sex: 'F', kind: 'Cow' }, preset || {});
  const set = S();
  openForm({
    title: id ? 'Edit ' + keyOf(a) : 'Add an animal', wide: true,
    values: Object.assign({}, a, { dam: damText(a), sire: sireText(a), kindPick: id ? typeOf(a) : (a.kind || 'Cow') }),
    saveAnother: !id,
    fields: [
      { k: 'tag', label: 'Ear tag', ph: 'e.g. 214', big: true }, { k: 'name', label: 'Name' },
      { k: 'kindPick', label: 'Kind', type: 'buttons', options: TYPES, req: true, full: true, hint: 'Pick what it is now. Calves grow up on their own when weaned; a heifer becomes a cow when you record her calf.' },
      { k: 'birthDate', label: 'Birth date', type: 'date' }, { k: 'photo', label: 'Photo', type: 'photo' },
      { k: 'breed', label: 'Breed', type: 'list', options: set.breeds }, { k: 'color', label: 'Color / markings', type: 'list', options: set.colors },
      { k: 'pastureId', label: 'Pasture', type: 'select', options: pastureOpts() }, { k: 'status', label: 'Status', type: 'select', options: ['Active', 'Sold', 'Dead', 'Reference'], blank: false, hint: 'Reference = a sire or dam you keep only for pedigree (an AI bull, a cow you never owned).' },
      { type: 'section', label: 'Parents' },
      { k: 'dam', label: 'Dam (mother)', type: 'animal', filter: isFemale, hint: 'A tag in the herd, or type a name if she isn’t.' },
      { k: 'sire', label: 'Sire (father)', type: 'animal', filter: isMale, hint: 'A herd bull’s tag, or an AI bull’s name.' },
      { type: 'section', label: 'Identification & description' },
      { k: 'eid', label: 'EID / RFID tag' }, { k: 'regNo', label: 'Registration #' },
      { k: 'brand', label: 'Brand / tattoo' }, { k: 'horn', label: 'Horns', type: 'select', options: ['Polled', 'Horned', 'Scurred', 'Dehorned'] },
      { k: 'birthWeight', label: 'Birth weight (lb)', type: 'number' }, { k: 'calvingEase', label: 'Calving ease', type: 'select', options: EASE },
      { k: 'cull', label: 'Cull', type: 'check', text: 'Marked to cull' },
      { type: 'section', label: 'Purchase' },
      { k: 'purchaseDate', label: 'Bought on', type: 'date' }, { k: 'purchasePrice', label: 'Price paid ($)', type: 'number' },
      { k: 'purchasedFrom', label: 'Bought from', full: true },
      { k: 'notes', label: 'Notes', type: 'textarea', full: true }
    ],
    validate: v => {
      if (!v.tag && !v.name) return 'Give it an ear tag or a name';
      // common-sense age checks (a typo in the year is the usual cause)
      const age = v.birthDate ? daysBetween(v.birthDate, today()) : null;
      if (age != null && age < 0) return 'The birth date is in the future';
      if (age != null && v.kindPick === 'Cow' && age < 450 && !confirm(`A cow only ${ageStr({ birthDate: v.birthDate })} old? Check the birth date.\n\nSave anyway?`)) return 'Check the birth date or the kind';
      if (age != null && /calf/.test(v.kindPick || '') && age > 400 && !confirm(`${ageStr({ birthDate: v.birthDate })} old is past calf age — it will show as a ${v.kindPick.replace(' calf', '').replace('Bull', 'Bull').toLowerCase()}.\n\nSave anyway?`)) return 'Check the birth date or the kind';
      if (v.dam && v.dam === id) return 'An animal can’t be its own dam';
      if (v.tag && !v._dupOk) { const d = DB.animals.find(x => x.id !== id && isActive(x) && (x.tag || '').toLowerCase() === v.tag.toLowerCase()); if (d && !confirm(`Tag ${v.tag} is already on an active ${typeOf(d).toLowerCase()}. Save another animal with the same tag?`)) return 'Change the tag, or save again'; }
      return null;
    },
    save: async (v, ctx) => {
      const photos = v.photo || []; delete v.photo;
      Object.assign(UI, { lastKind: v.kindPick, lastBreed: v.breed, lastPasture: v.pastureId, lastBought: v.purchaseDate, lastFrom: v.purchasedFrom });
      const rec = Object.assign({}, a, v);
      setKind(rec, v.kindPick); delete rec.kindPick;
      rec.damId = v.dam; rec.damName = v.dam ? null : v.damText || null;
      rec.sireId = v.sire; rec.sireName = v.sire ? null : v.sireText || null;
      delete rec.dam; delete rec.sire; delete rec.damText; delete rec.sireText;
      if (photos.length) { rec.photos = rec.photos ? rec.photos.slice() : []; for (const f of photos) rec.photos.push(await photoFromFile(f)); }
      if (rec.damId && rec.damId === rec.id) throw new Error('An animal can’t be its own dam');
      const ops = [{ coll: 'animals', data: rec }];
      if (!id && rec.purchaseDate && rec.purchasePrice) ops.push({ coll: 'money', data: { date: rec.purchaseDate, kind: 'Expense', category: 'Cattle purchases', amount: rec.purchasePrice, animalId: null, note: 'Bought ' + (rec.tag || rec.name) + (rec.purchasedFrom ? ' from ' + rec.purchasedFrom : '') } });
      if (!id && rec.pastureId) ops.push({ coll: 'moves', data: { animalId: null, pastureId: rec.pastureId, date: rec.purchaseDate || rec.birthDate || today(), note: 'Added' } });
      if (!rec.id) rec.id = uid();
      ops.forEach(o => { if (o.coll !== 'animals' && 'animalId' in o.data) o.data.animalId = rec.id; });
      await saveMany(ops);
      if (!id && !(ctx && ctx.again)) location.hash = '#/animal/' + rec.id;
    },
    again: () => actEditAnimal(null, { kind: (UI.lastKind || 'Cow'), breed: UI.lastBreed, pastureId: UI.lastPasture, purchaseDate: UI.lastBought, purchasedFrom: UI.lastFrom }),
    del: id ? async () => {
      const ops = [{ coll: 'animals', del: id }];
      for (const c of ['weights', 'treatments', 'moves', 'obs']) DB[c].filter(x => x.animalId === id).forEach(x => ops.push({ coll: c, del: x.id }));
      for (const c of ['breedings', 'pregchecks']) DB[c].filter(x => x.femaleId === id).forEach(x => ops.push({ coll: c, del: x.id }));
      for (const k of calvesOf(a)) ops.push({ coll: 'animals', data: Object.assign({}, k, { damId: null, damName: keyOf(a) }) });
      for (const k of PROG[id] || []) ops.push({ coll: 'animals', data: Object.assign({}, k, { sireId: null, sireName: keyOf(a) }) });
      await saveMany(ops); location.hash = '#/animals';
    } : null,
    delConfirm: 'Delete this animal and every weight, treatment and breeding record on it? Its calves keep its tag as a name.\n\nIf it was sold or died, use "Sold / died" instead so the history stays.'
  });
}
const EASE = [['1', '1 – No assistance'], ['2', '2 – Easy pull'], ['3', '3 – Hard pull'], ['4', '4 – C-section'], ['5', '5 – Abnormal presentation']];

function actMove(ids) {
  openForm({
    title: `Move ${plural(ids.length, 'animal')}`,
    fields: [{ k: 'pastureId', label: 'To pasture', type: 'select', options: pastureOpts(), req: true }, { k: 'date', label: 'Date', type: 'date', req: true }],
    values: { date: today() },
    intro: DB.pastures.length ? '' : 'Add your pastures on the Pastures page first.',
    save: async v => {
      const ops = [];
      for (const id of ids) {
        const a = AN(id); if (a.pastureId === v.pastureId) continue;
        ops.push({ coll: 'moves', data: { animalId: id, pastureId: v.pastureId, fromId: a.pastureId || null, date: v.date } });
        ops.push({ coll: 'animals', data: Object.assign({}, a, { pastureId: v.pastureId }) });
      }
      await saveMany(ops);
    }, toastText: 'Moved'
  });
}

function actSell(ids) {
  openForm({
    title: `Sold / died — ${plural(ids.length, 'animal')}`,
    fields: [
      { k: 'outcome', label: 'What happened', type: 'select', options: ['Sold', 'Dead'], blank: false, req: true }, { k: 'date', label: 'Date', type: 'date', req: true },
      { k: 'price', label: 'Price per head ($)', type: 'number', hint: 'Or fill in the total' }, { k: 'total', label: 'Total check ($)', type: 'number' },
      { k: 'weight', label: 'Sale weight per head (lb)', type: 'number' }, { k: 'buyer', label: 'Buyer / sale barn', type: 'text' },
      { k: 'cause', label: 'Cause of death', full: true },
      { k: 'income', label: 'Money', type: 'check', text: 'Put the sale in Money as income', full: true }
    ],
    values: { outcome: 'Sold', date: today(), income: true },
    onChange: f => { const dead = f.elements.outcome.value === 'Dead'; ['price', 'total', 'weight', 'buyer', 'income'].forEach(k => f.elements[k].closest('.fld').style.display = dead ? 'none' : ''); f.elements.cause.closest('.fld').style.display = dead ? '' : 'none'; },
    validate: v => {
      if (v.outcome !== 'Sold') return null;
      const wd = ids.filter(id => withdrawalUntil(AN(id)));
      if (wd.length && !confirm(`${wd.map(id => keyOf(AN(id))).join(', ')} ${wd.length > 1 ? 'are' : 'is'} still in slaughter withdrawal (until ${fmtD(withdrawalUntil(AN(wd[0])))}). Don't sell for meat before then.\n\nRecord the sale anyway?`)) return 'Sale not saved — in withdrawal';
      return null;
    },
    save: async v => {
      const ops = [], n = ids.length;
      const each = v.price != null ? v.price : (v.total != null ? v.total / n : null);
      for (const id of ids) {
        const a = Object.assign({}, AN(id), { status: v.outcome });
        if (v.outcome === 'Sold') Object.assign(a, { saleDate: v.date, salePrice: each, saleWeight: v.weight, buyer: v.buyer });
        else Object.assign(a, { deathDate: v.date, deathCause: v.cause });
        ops.push({ coll: 'animals', data: a });
        if (v.outcome === 'Sold' && v.weight) ops.push({ coll: 'weights', data: { animalId: id, date: v.date, weight: v.weight, kind: 'Sale' } });
      }
      if (v.outcome === 'Sold' && v.income && each != null) {
        const types = {}; ids.forEach(id => { const t = typeOf(AN(id)); types[t] = (types[t] || 0) + 1; });
        const cat = Object.keys(types).every(t => t === 'Cow') ? 'Cull cow sales' : Object.keys(types).every(t => t === 'Bull') ? 'Bull sales' : 'Calf sales';
        ops.push({ coll: 'money', data: { date: v.date, kind: 'Income', category: cat, amount: Math.round(each * n * 100) / 100, payee: v.buyer, note: 'Sold ' + plural(n, 'head', 'head') + ': ' + ids.map(i => keyOf(AN(i))).join(', ') } });
      }
      await saveMany(ops); SEL.clear();
    }
  });
}

// ---------------------------------------------------------------- actions: health
function actTreat(ids) {
  const set = S();
  const prods = DB.products.slice().sort((a, b) => natCmp(a.name, b.name));
  openForm({
    title: `Treatment — ${plural(ids.length, 'animal')}`, wide: ids.length > 1,
    intro: ids.length > 1 ? 'One record goes on each animal: ' + esc(ids.slice(0, 30).map(i => keyOf(AN(i))).join(', ')) + (ids.length > 30 ? ' …' : '') : esc(keyOf(AN(ids[0]))),
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true }, { k: 'product', label: 'Product', type: 'list', options: productItems, req: true, ph: 'Vaccine, wormer, antibiotic… or tap ▾' },
      { k: 'dose', label: 'Dose', ph: 'e.g. 2 cc' }, { k: 'route', label: 'Route', type: 'list', options: set.routes },
      { k: 'site', label: 'Injection site', type: 'list', options: set.sites }, { k: 'lot', label: 'Lot / serial #' },
      { k: 'withdrawalDays', label: 'Slaughter withdrawal (days)', type: 'number', hint: 'From the label. 0 = none.' }, { k: 'boosterDays', label: 'Booster in (days)', type: 'number', hint: 'Leave blank if no booster.' },
      { k: 'reason', label: 'Reason', ph: 'e.g. spring shots, pinkeye, foot rot' }, { k: 'by', label: 'Given by' },
      { k: 'note', label: 'Notes', type: 'textarea', full: true, rows: 2 },
      { k: 'remember', label: 'Product list', type: 'check', text: 'Remember this product’s dose, route and withdrawal for next time', full: true }
    ],
    values: { date: today(), remember: true },
    onChange: (f, e) => {
      if (!e || e.target.name !== 'product') return;
      const p = productByName(f.elements.product.value); if (!p) return;
      const w = ids.length === 1 ? lwOf(AN(ids[0])) : null;
      f.elements.dose.value = doseText(p, w) || '';
      for (const k of ['route', 'site', 'withdrawalDays', 'boosterDays']) if (p[k] != null && p[k] !== '') f.elements[k].value = p[k];
    },
    save: async v => {
      const batch = uid(), ops = [];
      for (const id of ids) ops.push({ coll: 'treatments', data: {
        animalId: id, date: v.date, product: v.product, dose: v.dose, route: v.route, site: v.site, lot: v.lot, reason: v.reason, by: v.by, note: v.note,
        withdrawalDays: v.withdrawalDays, withdrawalDate: v.withdrawalDays ? addDays(v.date, v.withdrawalDays) : null,
        boosterDate: v.boosterDays ? addDays(v.date, v.boosterDays) : null, batch } });
      if (v.remember) {
        const p = DB.products.find(p => p.name.toLowerCase() === v.product.toLowerCase()), base = p || catalogProduct(v.product) || {};
        ops.push({ coll: 'products', data: Object.assign({}, base, { name: base.name || v.product, route: v.route, site: v.site, withdrawalDays: v.withdrawalDays, boosterDays: v.boosterDays }, base.mlPer ? {} : { dose: v.dose }) });
      }
      await saveMany(ops);
    }, toastText: `Treatment saved on ${plural(ids.length, 'animal')}`
  });
}
function actEditTreatment(id) {
  const t = IX.treatments[id], set = S();
  openForm({
    title: 'Treatment on ' + keyOf(AN(t.animalId)), values: t,
    fields: [
      { k: 'date', label: 'Date', type: 'date', req: true }, { k: 'product', label: 'Product', type: 'list', options: DB.products.map(p => p.name), req: true },
      { k: 'dose', label: 'Dose' }, { k: 'route', label: 'Route', type: 'list', options: set.routes },
      { k: 'site', label: 'Injection site', type: 'list', options: set.sites }, { k: 'lot', label: 'Lot / serial #' },
      { k: 'withdrawalDays', label: 'Withdrawal (days)', type: 'number' }, { k: 'boosterDate', label: 'Booster due', type: 'date' },
      { k: 'reason', label: 'Reason' }, { k: 'by', label: 'Given by' }, { k: 'note', label: 'Notes', type: 'textarea', full: true, rows: 2 }
    ],
    save: v => put1('treatments', Object.assign({}, t, v, { withdrawalDate: v.withdrawalDays ? addDays(v.date, v.withdrawalDays) : null })),
    del: () => del1('treatments', id)
  });
}

// ---------------------------------------------------------------- actions: weights
function actWeigh(ids) {
  const rows = ids.map(AN).sort((a, b) => natCmp(keyOf(a), keyOf(b)));
  const allCalves = rows.every(a => { const d = ageDays(a); return d != null && d >= 120 && d <= 300 && !isWeaned(a); });
  const m = modal(`<h2>Record weights — ${plural(rows.length, 'head', 'head')}</h2>
   <div class="grid3"><div class="fld"><label>Date</label><input type="date" id="w_d" value="${today()}"></div>
   <div class="fld"><label>Kind of weight</label><select id="w_k">${opts(['Weaning', 'Yearling', 'Sale', 'Other'], allCalves ? 'Weaning' : 'Other', false)}</select></div>
   <div class="fld"><label>&nbsp;</label><div class="hint">Enter jumps to the next animal. Leave a weight blank to skip it.</div></div></div>
   <div class="tscroll" style="max-height:55vh;margin-top:10px"><table class="t"><thead><tr><th>Tag</th><th class="hide-sm">Type</th><th class="hide-sm">Age</th><th class="hide-sm">Last weight</th><th>Weight (lb)</th><th>BCS 1-9</th><th class="hide-sm">Note</th></tr></thead><tbody>
   ${rows.map((a, i) => { const lw = lastW(a); return `<tr data-id="${a.id}"><td><b>${esc(keyOf(a))}</b></td><td class="hide-sm">${typeOf(a)}</td><td class="hide-sm">${ageStr(a)}</td><td class="hide-sm">${lw ? num(lw.weight) + ' <span class="muted small">' + fmtD(lw.date) + '</span>' : ''}</td>
   <td><input class="w_w" type="number" inputmode="decimal" step="any" data-i="${i}"></td><td><input class="w_b" type="number" inputmode="decimal" step="0.5" min="1" max="9"></td><td class="hide-sm"><input class="w_n"></td></tr>`; }).join('')}
   </tbody></table></div><div class="err" id="w_e"></div>
   <div class="mfoot"><span class="sp"></span><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" id="w_go">Save weights</button></div>`, { wide: true });
  m.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('w_w')) { e.preventDefault(); const n = m.querySelectorAll('.w_w')[+e.target.dataset.i + 1]; (n || m.querySelector('#w_go')).focus(); }
  });
  if (!isPhone()) m.querySelector('.w_w').focus();
  m.querySelector('#w_go').onclick = async () => {
    const date = $('#w_d').value, kind = $('#w_k').value, ops = [];
    if (!date) { $('#w_e').textContent = 'Pick a date.'; return; }
    for (const tr of m.querySelectorAll('tbody tr')) {
      const w = parseFloat(tr.querySelector('.w_w').value), b = parseFloat(tr.querySelector('.w_b').value), note = tr.querySelector('.w_n').value.trim();
      if (isNaN(w) && isNaN(b)) continue;
      const a = AN(tr.dataset.id);
      ops.push({ coll: 'weights', data: { animalId: a.id, date, weight: isNaN(w) ? null : w, bcs: isNaN(b) ? null : b, kind, note: note || null } });
      if (kind === 'Weaning' && !a.weanDate) ops.push({ coll: 'animals', data: Object.assign({}, a, { weanDate: date }) });
    }
    if (!ops.length) { $('#w_e').textContent = 'No weights entered.'; return; }
    try { await saveMany(ops); closeModal(); refresh(); toast(plural(ops.filter(o => o.coll === 'weights').length, 'weight') + ' saved'); }
    catch (err) { $('#w_e').textContent = 'Could not save: ' + err.message; }
  };
}
function actEditWeight(id) {
  const w = IX.weights[id];
  openForm({
    title: 'Weight on ' + keyOf(AN(w.animalId)), values: w,
    fields: [{ k: 'date', label: 'Date', type: 'date', req: true }, { k: 'kind', label: 'Kind', type: 'select', options: ['Weaning', 'Yearling', 'Sale', 'Other'], blank: false },
      { k: 'weight', label: 'Weight (lb)', type: 'number' }, { k: 'bcs', label: 'Body condition (1-9)', type: 'number' }, { k: 'note', label: 'Note', full: true }],
    save: v => put1('weights', Object.assign({}, w, v)), del: () => del1('weights', id)
  });
}

// ---------------------------------------------------------------- actions: breeding / calving
function actBreed(ids) {
  openForm({
    title: `Breeding — ${plural(ids.length, 'female')}`,
    intro: esc(ids.slice(0, 40).map(i => keyOf(AN(i))).join(', ')) + (ids.length > 40 ? ' …' : ''),
    fields: [
      { k: 'method', label: 'Method', type: 'select', options: ['AI', 'Natural service', 'Embryo transfer'], blank: false },
      { k: 'date', label: 'Date (bull in, for natural service)', type: 'date', req: true },
      { k: 'endDate', label: 'Bull out (natural service)', type: 'date', hint: 'Leave blank while the bull is still with them.' },
      { k: 'sire', label: 'Sire', type: 'animal', filter: isMale, hint: 'Herd bull’s tag, or the AI sire’s name.' },
      { k: 'tech', label: 'Technician' }, { k: 'note', label: 'Notes' }
    ],
    values: { method: 'AI', date: today() },
    onChange: f => { f.elements.endDate.closest('.fld').style.display = f.elements.method.value === 'Natural service' ? '' : 'none'; f.elements.tech.closest('.fld').style.display = f.elements.method.value === 'Natural service' ? 'none' : ''; },
    save: async v => {
      const batch = uid();
      await saveMany(ids.map(id => ({ coll: 'breedings', data: { femaleId: id, method: v.method, date: v.date, endDate: v.method === 'Natural service' ? v.endDate : null, sireId: v.sire, sireName: v.sire ? null : v.sireText, tech: v.tech, note: v.note, batch } })));
    }, toastText: 'Breeding saved'
  });
}
function actTurnIn() {
  const inP = p => DB.animals.filter(a => a.pastureId === p && breedable(a));
  openForm({
    title: 'Bull turn-in',
    intro: 'Puts a natural-service exposure on every breeding-age female in the pasture.',
    fields: [
      { k: 'bull', label: 'Bull', type: 'animal', filter: a => isMale(a) && isActive(a), req: true, strict: true },
      { k: 'pastureId', label: 'Pasture', type: 'select', options: pastureOpts(), req: true },
      { k: 'date', label: 'Bull in', type: 'date', req: true }, { k: 'endDate', label: 'Bull out', type: 'date', hint: 'Leave blank; use “Pull bull” later.' }
    ],
    values: { date: today() },
    onChange: f => { const p = f.elements.pastureId.value; f.querySelector('#mferr').textContent = ''; f.elements.pastureId.closest('.fld').querySelector('.hint')?.remove(); if (p) f.elements.pastureId.insertAdjacentHTML('afterend', `<div class="hint">${plural(inP(p).length, 'female')} will be exposed</div>`); },
    save: async v => {
      const fem = inP(v.pastureId); if (!fem.length) throw new Error('No breeding-age females in that pasture');
      const batch = uid();
      await saveMany(fem.map(a => ({ coll: 'breedings', data: { femaleId: a.id, method: 'Natural service', date: v.date, endDate: v.endDate, sireId: v.bull, batch, note: 'Turn-in, ' + pastureName(v.pastureId) } })));
    }, toastText: 'Turn-in saved'
  });
}
function actPullBull() {
  openForm({
    title: 'Pull bull',
    intro: 'Sets the bull-out date on every open exposure for this bull.',
    fields: [{ k: 'bull', label: 'Bull', type: 'animal', filter: isMale, req: true, strict: true }, { k: 'date', label: 'Bull out', type: 'date', req: true }],
    values: { date: today() },
    save: async v => {
      const l = DB.breedings.filter(b => b.sireId === v.bull && b.method === 'Natural service' && !b.endDate && b.date <= v.date);
      if (!l.length) throw new Error('That bull has no open exposures');
      await saveMany(l.map(b => ({ coll: 'breedings', data: Object.assign({}, b, { endDate: v.date }) })));
    }, toastText: 'Bull-out date saved'
  });
}
function actEditBreeding(id) {
  const b = IX.breedings[id];
  openForm({
    title: 'Breeding on ' + keyOf(AN(b.femaleId)), values: Object.assign({}, b, { sire: sireText(b) }),
    fields: [{ k: 'method', label: 'Method', type: 'select', options: ['AI', 'Natural service', 'Embryo transfer'], blank: false }, { k: 'date', label: 'Date / bull in', type: 'date', req: true },
      { k: 'endDate', label: 'Bull out', type: 'date' }, { k: 'sire', label: 'Sire', type: 'animal', filter: isMale }, { k: 'tech', label: 'Technician' }, { k: 'note', label: 'Notes' }],
    save: v => { const r = Object.assign({}, b, v, { sireId: v.sire, sireName: v.sire ? null : v.sireText }); delete r.sire; delete r.sireText; return put1('breedings', r); },
    del: () => del1('breedings', id)
  });
}
function actPreg(ids) {
  const rows = ids.map(AN).sort((a, b) => natCmp(keyOf(a), keyOf(b)));
  const m = modal(`<h2>Pregnancy check — ${plural(rows.length, 'female')}</h2>
   <div class="grid3"><div class="fld"><label>Date</label><input type="date" id="p_d" value="${today()}"></div>
   <div class="fld"><label>Method</label><select id="p_m">${opts(['Palpation', 'Ultrasound', 'Blood test'], 'Palpation', false)}</select></div>
   <div class="fld"><label>By</label><input id="p_by" placeholder="Vet"></div></div>
   <p class="hint">Fetal age is optional; with it HerdBook works out the due date. Rows left blank are skipped.</p>
   <div class="tscroll" style="max-height:55vh"><table class="t"><thead><tr><th>Tag</th><th class="hide-sm">Exposed</th><th>Result</th><th>Fetal age (days)</th><th class="hide-sm">Note</th></tr></thead><tbody>
   ${rows.map(a => { const r = repro(a); return `<tr data-id="${a.id}"><td><b>${esc(keyOf(a))}</b></td><td class="hide-sm small">${r.bredDate ? esc(r.method + ' ' + fmtD(r.bredDate)) + (sireText(r) ? ' · ' + esc(sireText(r)) : '') : '<span class="muted">no record</span>'}</td>
   <td><select class="p_r">${opts(['Bred', 'Open'], '')}</select></td><td><input class="p_f" type="number" inputmode="numeric"></td><td class="hide-sm"><input class="p_n"></td></tr>`; }).join('')}
   </tbody></table></div><div class="err" id="p_e"></div>
   <div class="mfoot"><button class="btn" id="p_all">Mark all bred</button><span class="sp"></span><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" id="p_go">Save</button></div>`, { wide: true });
  m.querySelector('#p_all').onclick = () => m.querySelectorAll('.p_r').forEach(s => { if (!s.value) s.value = 'Bred'; });
  m.querySelector('#p_go').onclick = async () => {
    const date = $('#p_d').value, method = $('#p_m').value, by = $('#p_by').value.trim(), ops = [];
    for (const tr of m.querySelectorAll('tbody tr')) {
      const res = tr.querySelector('.p_r').value; if (!res) continue;
      const fd = parseInt(tr.querySelector('.p_f').value);
      ops.push({ coll: 'pregchecks', data: { femaleId: tr.dataset.id, date, method, by: by || null, result: res, fetalDays: res === 'Bred' && !isNaN(fd) ? fd : null, note: tr.querySelector('.p_n').value.trim() || null } });
    }
    if (!ops.length) { $('#p_e').textContent = 'No results entered.'; return; }
    try { await saveMany(ops); closeModal(); refresh(); toast(plural(ops.length, 'result') + ' saved'); } catch (err) { $('#p_e').textContent = 'Could not save: ' + err.message; }
  };
}
function actEditPreg(id) {
  const p = IX.pregchecks[id];
  openForm({
    title: 'Pregnancy check on ' + keyOf(AN(p.femaleId)), values: p,
    fields: [{ k: 'date', label: 'Date', type: 'date', req: true }, { k: 'result', label: 'Result', type: 'select', options: ['Bred', 'Open'], blank: false },
      { k: 'fetalDays', label: 'Fetal age (days)', type: 'number' }, { k: 'dueDate', label: 'Due date (override)', type: 'date' },
      { k: 'method', label: 'Method', type: 'select', options: ['Palpation', 'Ultrasound', 'Blood test'] }, { k: 'by', label: 'By' }, { k: 'note', label: 'Note', full: true }],
    save: v => put1('pregchecks', Object.assign({}, p, v)), del: () => del1('pregchecks', id)
  });
}
function actCalving(damId) {
  const set = S(), dam = damId ? AN(damId) : null;
  openForm({
    title: 'Record a calving', wide: true,
    values: { dam: dam ? keyOf(dam) : '', date: today(), outcome: 'Alive', ease: '1', sex: '' },
    fields: [
      { k: 'dam', label: 'Dam (cow / heifer)', type: 'animal', filter: a => isFemale(a) && !/calf/.test(typeOf(a)), req: true, strict: true },
      { k: 'date', label: 'Birth date', type: 'date', req: true },
      { k: 'tag', label: 'Calf ear tag', hint: 'Can be added later.' }, { k: 'sex', label: 'Calf sex', type: 'select', options: [['F', 'Heifer calf'], ['M', 'Bull calf'], ['S', 'Steer calf']], req: true },
      { k: 'birthWeight', label: 'Birth weight (lb)', type: 'number' }, { k: 'ease', label: 'Calving ease', type: 'select', options: EASE, blank: false },
      { k: 'outcome', label: 'Calf', type: 'select', options: ['Alive', 'Born dead', 'Died soon after birth'], blank: false },
      { k: 'sire', label: 'Sire', type: 'animal', filter: isMale, hint: 'Blank = from the dam’s breeding record.' },
      { k: 'breed', label: 'Breed', type: 'list', options: set.breeds, hint: 'Blank = same as the dam.' }, { k: 'color', label: 'Color / markings', type: 'list', options: set.colors },
      { k: 'eid', label: 'EID / RFID' }, { k: 'name', label: 'Name' },
      { k: 'note', label: 'Notes', type: 'textarea', full: true, rows: 2 }
    ],
    onChange: (f, e) => {
      if (e && e.target.name !== 'dam') return;
      const d = findAnimal(f.elements.dam.value, a => isFemale(a) && !/calf/.test(typeOf(a))); const h = f.elements.sire.closest('.fld').querySelector('.hint');
      if (!d) { h.textContent = 'Blank = from the dam’s breeding record.'; return; }
      const r = repro(d); h.textContent = sireText(r) ? 'Blank = ' + sireText(r) + ' (from her breeding record)' : 'No sire on her breeding records.';
    },
    save: async v => {
      const d = AN(v.dam), r = repro(d);
      const calf = { id: uid(), tag: v.tag, name: v.name, eid: v.eid, sex: v.sex, birthDate: v.date, birthWeight: v.birthWeight, calvingEase: v.ease, damId: d.id,
        sireId: v.sire || (v.sireText ? null : r.sireId), sireName: v.sire ? null : (v.sireText || (r.sireId ? null : r.sireName)),
        breed: v.breed || d.breed, color: v.color, pastureId: d.pastureId, status: v.outcome === 'Alive' ? 'Active' : 'Dead', notes: v.note };
      if (v.outcome !== 'Alive') { calf.deathDate = v.date; calf.deathCause = v.outcome; }
      await put1('animals', calf);
    }, toastText: 'Calf recorded'
  });
}

// ---------------------------------------------------------------- actions: misc
function actPasture(id) {
  const p = id ? IX.pastures[id] : {};
  openForm({
    title: id ? p.name : 'Add a pasture', values: p,
    fields: [{ k: 'name', label: 'Name', req: true }, { k: 'acres', label: 'Acres', type: 'number' }, { k: 'kind', label: 'Kind', type: 'list', options: ['Pasture', 'Pen / lot', 'Trap', 'Hay field', 'Rented'] },
      { k: 'water', label: 'Water', ph: 'pond, tank, creek…' }, { k: 'notes', label: 'Notes', type: 'textarea', full: true, rows: 2 },
      { k: 'retired', label: 'No longer used', type: 'check', text: 'Hide from pickers', full: true }],
    save: v => put1('pastures', Object.assign({}, p, v)),
    del: id ? async () => { if (DB.animals.some(a => a.pastureId === id && isActive(a))) throw new Error('Move the cattle out first'); await del1('pastures', id); } : null
  });
}
function actTask(id, preset) {
  const t = id ? IX.tasks[id] : Object.assign({ date: today() }, preset || {});
  openForm({
    title: id ? 'Edit task' : 'Add a task', values: Object.assign({}, t, { animal: t.animalId ? keyOf(AN(t.animalId)) : '' }),
    fields: [{ k: 'title', label: 'What', req: true, full: true }, { k: 'date', label: 'Due', type: 'date', req: true }, { k: 'animal', label: 'Animal (optional)', type: 'animal', strict: true },
      { k: 'note', label: 'Notes', type: 'textarea', full: true, rows: 2 }, { k: 'done', label: 'Done', type: 'check', text: 'Done' }],
    save: v => { const r = Object.assign({}, t, v, { animalId: v.animal }); delete r.animal; delete r.animalText; return put1('tasks', r); },
    del: id ? () => del1('tasks', id) : null
  });
}
// notes and scores (docility, scrotal, udder, BSE…) on one animal
const obsText = o => [o.value != null && o.value !== '' ? o.value + (o.unit ? ' ' + o.unit : '') : '', o.note].filter(Boolean).join(' · ');
function actNote(id) {
  openForm({
    title: 'Note on ' + keyOf(AN(id)), values: { date: today() },
    fields: [{ k: 'date', label: 'Date', type: 'date', req: true }, { k: 'note', label: 'Note', type: 'textarea', full: true, rows: 4, req: true, ph: 'e.g. limping right hind, bad bag, wild, lost tag…' },
      { k: 'flag', label: 'Also', type: 'check', text: 'Put it on my task list to check back', full: true }],
    save: async v => {
      const ops = [{ coll: 'obs', data: { animalId: id, date: v.date, kind: 'Note', note: v.note } }];
      if (v.flag) ops.push({ coll: 'tasks', data: { title: 'Check ' + keyOf(AN(id)) + ': ' + v.note.slice(0, 60), date: addDays(v.date, 7), animalId: id } });
      await saveMany(ops);
    }, toastText: 'Note saved'
  });
}
function actEditObs(id) {
  const o = IX.obs[id];
  openForm({
    title: o.kind + ' — ' + keyOf(AN(o.animalId)), values: o,
    fields: [{ k: 'date', label: 'Date', type: 'date', req: true }, { k: 'value', label: 'Value / score' }, { k: 'note', label: 'Note', type: 'textarea', full: true, rows: 3 }],
    save: v => put1('obs', Object.assign({}, o, v)), del: () => del1('obs', id)
  });
}
async function toggleTask(id) { const t = IX.tasks[id]; await put1('tasks', Object.assign({}, t, { done: !t.done })); refresh(); }

// "show these animals" links: the id list is parked here and the button carries its number
const LISTS = [];
const listRef = ids => { LISTS.push(ids); return LISTS.length - 1; };
function showList(i) { SEL.clear(); (LISTS[i] || []).forEach(id => SEL.add(id)); UI.onlySel = true; location.hash = '#/animals'; refresh(); }

// big "type a tag" box that jumps straight to the animal
function findAnimalBox() {
  const m = modal(`<h2>Find an animal</h2><div class="fld">${comboHtml('fa_t', 'fa', '', 'Tag, name or EID', () => animalItems(), 'big')}</div><div class="err" id="fa_e"></div>
   <div class="mfoot"><span class="sp"></span><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" id="fa_go">Open</button></div>`);
  const go = () => { const a = findAnimal($('#fa_t').value); if (!a) { $('#fa_e').textContent = 'No animal with that tag.'; return; } closeModal(); location.hash = '#/animal/' + a.id; };
  m.querySelector('#fa_go').onclick = go;
  $('#fa_t').addEventListener('change', () => { if (findAnimal($('#fa_t').value)) go(); });
  $('#fa_t').addEventListener('keydown', e => { if (e.key === 'Enter' && !(CB && CB.hi >= 0)) { e.preventDefault(); go(); } });
  setTimeout(() => $('#fa_t') && $('#fa_t').focus(), 50);
}
// group actions on the Animals-page selection
const selIds = filter => [...SEL].filter(id => AN(id) && (!filter || filter(AN(id))));
function groupAct(kind) {
  const ids = selIds();
  if (!ids.length) return;
  if (kind === 'move') actMove(ids);
  if (kind === 'kind') actKind(ids);
  if (kind === 'treat') actTreat(ids);
  if (kind === 'weigh') actWeigh(ids);
  if (kind === 'sell') actSell(ids);
  if (kind === 'breed' || kind === 'preg') { const f = selIds(breedable); if (!f.length) return alert('None of the ticked animals are breeding-age cows or heifers.'); if (f.length < selIds().length) toast(plural(selIds().length - f.length, 'animal') + ' left out — not breeding-age females'); kind === 'breed' ? actBreed(f) : actPreg(f); }
  if (kind === 'csv') exportAnimals(ids.map(AN));
}

// ---------------------------------------------------------------- reminders + events
function reminders() {
  const out = [], t = today(), soon = addDays(t, 14);
  // boosters due, grouped by product + date
  const boost = {};
  for (const tr of DB.treatments) {
    if (!tr.boosterDate || tr.boosterDate > soon) continue;
    const a = AN(tr.animalId); if (!a || !isActive(a)) continue;
    if ((TR[a.id] || []).some(x => x.date > tr.date && (x.product || '').toLowerCase() === (tr.product || '').toLowerCase())) continue;
    const k = tr.boosterDate + '|' + tr.product; (boost[k] || (boost[k] = [])).push(a.id);
  }
  for (const [k, ids] of Object.entries(boost)) { const [d, p] = k.split('|'); out.push({ date: d, cls: d < t ? 'red' : 'amber', text: `Booster due: <b>${esc(p)}</b> — ${plural(ids.length, 'head', 'head')}`, ids }); }
  const due = DB.animals.filter(breedable).map(a => [a, repro(a)]).filter(([a, r]) => r.due && (r.status === 'Bred' || r.status === 'Exposed' || r.status === 'Overdue') && r.due <= addDays(t, 21));
  if (due.length) out.push({ date: due.map(x => x[1].due).sort()[0], cls: 'amber', text: `<b>${plural(due.length, 'female')}</b> due to calve in the next 3 weeks${due.some(x => x[1].due < t) ? ' (some past due)' : ''}`, href: '#/breeding' });
  const wean = DB.animals.filter(a => isActive(a) && /calf/.test(typeOf(a)) && ageDays(a) >= 200);
  if (wean.length) out.push({ date: t, cls: '', text: `<b>${plural(wean.length, 'calf', 'calves')}</b> are 200+ days old and not weaned`, ids: wean.map(a => a.id) });
  const wd = DB.animals.filter(a => isActive(a) && withdrawalUntil(a));
  if (wd.length) out.push({ date: t, cls: 'amber', text: `<b>${plural(wd.length, 'animal')}</b> in slaughter withdrawal — don’t sell for meat`, href: '#/health' });
  for (const k of DB.tasks) if (!k.done && k.date <= addDays(t, 7)) out.push({ date: k.date, cls: k.date < t ? 'red' : '', text: `<a href="javascript:void 0" onclick="actTask('${k.id}')">${esc(k.title)}</a>${k.animalId ? ' — ' + aLink(k.animalId) : ''}`, task: k.id });
  return out.sort(byDate);
}
function remHtml(list) {
  if (!list.length) return '<p class="muted">Nothing due right now.</p>';
  return `<ul class="rem">${list.map(r => `<li><span class="when">${r.date < today() ? '<span class="chip red">past due</span>' : fmtD(r.date)}</span><span>${r.href ? `<a href="${r.href}">${r.text}</a>` : r.text}
   ${r.ids ? ` <button class="btn link sm" onclick="showList(${listRef(r.ids)})">show</button>` : ''}
   ${r.task ? ` <button class="btn link sm" onclick="toggleTask('${r.task}')">mark done</button>` : ''}</span></li>`).join('')}</ul>`;
}
function eventsFor(a) {
  const ev = [], E = (date, kind, text, edit) => date && ev.push({ date, kind, text, edit });
  if (a.birthDate) E(a.birthDate, 'Born', [a.birthWeight ? num(a.birthWeight) + ' lb' : '', a.calvingEase ? 'ease ' + a.calvingEase : '', damText(a) ? 'dam ' + parentLink(a.damId, a.damName) : '', sireText(a) ? 'sire ' + parentLink(a.sireId, a.sireName) : ''].filter(Boolean).join(' · '));
  if (a.purchaseDate) E(a.purchaseDate, 'Bought', [a.purchasedFrom, a.purchasePrice ? usd(a.purchasePrice) : ''].filter(Boolean).map(esc).join(' · '));
  for (const w of wOf(a)) E(w.date, w.kind === 'Other' ? 'Weighed' : w.kind + ' weight', [w.weight ? num(w.weight) + ' lb' : '', w.bcs ? 'BCS ' + w.bcs : '', esc(w.note)].filter(Boolean).join(' · '), `actEditWeight('${w.id}')`);
  for (const t of TR[a.id] || []) E(t.date, 'Treated', [`<b>${esc(t.product)}</b>`, esc(t.dose), esc(t.route), esc(t.reason), t.withdrawalDate ? 'withdrawal to ' + fmtD(t.withdrawalDate) : ''].filter(Boolean).join(' · '), `actEditTreatment('${t.id}')`);
  for (const b of DB.breedings.filter(b => b.femaleId === a.id)) E(b.date, b.method === 'Natural service' ? 'Exposed' : b.method, [sireText(b) ? parentLink(b.sireId, b.sireName) : '', b.endDate ? 'bull out ' + fmtD(b.endDate) : ''].filter(Boolean).join(' · '), `actEditBreeding('${b.id}')`);
  for (const p of DB.pregchecks.filter(p => p.femaleId === a.id)) E(p.date, 'Preg check', `<b>${esc(p.result)}</b>${p.fetalDays ? ' · ' + p.fetalDays + ' days' : ''}${p.note ? ' · ' + esc(p.note) : ''}`, `actEditPreg('${p.id}')`);
  for (const c of calvesOf(a)) E(c.birthDate, 'Calved', `${aLink(c.id)} · ${typeOf(c).toLowerCase()}${c.birthWeight ? ' · ' + num(c.birthWeight) + ' lb' : ''}${c.status === 'Dead' ? ' · <span class="chip red">dead</span>' : ''}`);
  for (const m of DB.moves.filter(m => m.animalId === a.id)) E(m.date, 'Moved', 'to ' + esc(pastureName(m.pastureId)));
  for (const o of OBS[a.id] || []) E(o.date, o.kind, esc(obsText(o)), `actEditObs('${o.id}')`);
  if (a.saleDate) E(a.saleDate, 'Sold', [esc(a.buyer), a.salePrice ? usd(a.salePrice) : '', a.saleWeight ? num(a.saleWeight) + ' lb' : ''].filter(Boolean).join(' · '));
  if (a.deathDate) E(a.deathDate, 'Died', esc(a.deathCause));
  if (a.weanDate && !weanW(a)) E(a.weanDate, 'Weaned', '');
  return ev.sort((x, y) => y.date.localeCompare(x.date));
}
function recentEvents(n) {
  const ev = [], E = (date, kind, id, text) => ev.push({ date, kind, id, text });
  for (const a of DB.animals) { if (a.birthDate && (a.damId || a.damName)) E(a.birthDate, 'Born', a.id, damText(a) ? 'to ' + parentLink(a.damId, a.damName) : ''); if (a.saleDate) E(a.saleDate, 'Sold', a.id, esc(a.buyer)); if (a.deathDate) E(a.deathDate, 'Died', a.id, esc(a.deathCause)); }
  const batches = {};
  const grp = (date, kind, batch, id, text) => { if (!batch) return E(date, kind, id, text); const k = kind + batch; if (batches[k]) batches[k].n++; else { batches[k] = { date, kind, id, text, n: 1 }; ev.push(batches[k]); } };
  for (const t of DB.treatments) grp(t.date, 'Treated', t.batch, t.animalId, `<b>${esc(t.product)}</b>`);
  for (const w of DB.weights) grp(w.date, w.kind === 'Other' ? 'Weighed' : w.kind + ' weight', w.date + w.kind, w.animalId, w.weight ? num(w.weight) + ' lb' : '');
  for (const b of DB.breedings) grp(b.date, b.method === 'Natural service' ? 'Exposed' : b.method, b.batch, b.femaleId, sireText(b) ? 'to ' + parentLink(b.sireId, b.sireName) : '');
  for (const p of DB.pregchecks) grp(p.date, 'Preg check', p.date, p.femaleId, '');
  return ev.sort((x, y) => y.date.localeCompare(x.date)).slice(0, n);
}

// ================================================================ VIEWS
ROUTES.dashboard = function () {
  const act = DB.animals.filter(isActive);
  const cnt = t => act.filter(a => typeOf(a) === t).length;
  const calves = act.filter(a => /calf/.test(typeOf(a))).length;
  const y = thisYear(), cs = calvingStats(y);
  if (!DB.animals.length) {
    return main(page('Welcome to HerdBook', '', card('Get started', `<p>HerdBook keeps every animal’s records: calving, breeding, weights, health, pastures, sales and money — no subscription. It works in the pasture with no signal and catches up when it gets one.</p>
     <ol>${Sync.st.account ? '' : `<li><b><a href="#/settings">Sign in with your Google account</a></b> so your phone and computer share the same herd and it is backed up. If you already use HerdBook on another phone or computer, sign in with the same Google account and your herd comes down.</li>`}
     <li><a href="#/pastures">Add your pastures</a> (optional, but handy for moving and working groups).</li>
     <li><a href="javascript:void 0" onclick="actEditAnimal()">Add animals one at a time</a>, or bring in a spreadsheet from <a href="#/settings">Settings → Import animals</a>.</li>
     <li>Put HerdBook on your phone’s home screen — see <a href="#/settings">Settings → Install</a>.</li></ol>
     <p><button class="btn primary" onclick="actEditAnimal()">Add the first animal</button> <button class="btn" onclick="location.hash='#/settings'">Import a spreadsheet</button></p>`)));
  }
  const k = (label, v, type, sub) => `<a class="kpi" onclick="UI.af=Object.assign(UI.af,{type:'${type}',status:'Active',q:'',pasture:'',year:'',breed:''});UI.onlySel=false;location.hash='#/animals'"><div class="kl">${label}</div><div class="kv">${num(v)}</div>${sub ? `<div class="ks">${sub}</div>` : ''}</a>`;
  const ev = recentEvents(12);
  main(page('Home', '',
    `${workResumeCard()}<div class="quick">
      <a href="#/work/new" class="qb primary"><b>Work cattle</b><span>shots, weigh, preg, castrate…</span></a>
      <a href="javascript:void 0" onclick="actCalving()" class="qb"><b>New calf</b><span>record a calving</span></a>
      <a href="javascript:void 0" onclick="actEditAnimal()" class="qb"><b>Add animal</b><span>bought or new</span></a>
      <a href="javascript:void 0" onclick="actMoney()" class="qb"><b>Expense</b><span>receipt, vet, feed, tools</span></a>
      <a href="javascript:void 0" onclick="findAnimalBox()" class="qb"><b>Find a tag</b><span>open an animal</span></a>
      <a href="javascript:void 0" onclick="pickThen('Move',null,actMove)" class="qb"><b>Move cattle</b><span>to another pasture</span></a>
     </div>
    <div class="kpis">${k('Head on hand', act.length, '')}${k('Cows', cnt('Cow'), 'Cow')}${k('Heifers', cnt('Heifer'), 'Heifer')}${k('Bulls', cnt('Bull'), 'Bull')}${k('Steers', cnt('Steer'), 'Steer')}${k('Calves', calves, 'calves', 'on the cow')}</div>
    <div class="cols">${card('Needs attention', remHtml(reminders()))}${card(y + ' calving', calvingSummary(cs) + `<p><a href="#/calving">Calving page →</a></p>`)}</div><div style="height:16px"></div>
    ${card('Recent work', ev.length ? table([{ h: 'Date', f: e => fmtD(e.date) }, { h: 'What', f: e => esc(e.kind) }, { h: 'Animal', f: e => e.n > 1 ? plural(e.n, 'head', 'head') : aLink(e.id) }, { h: '', f: e => e.text }], ev) : '<p class="muted">Nothing recorded yet.</p>')}`));
};

// ---------------- animals list
function animalFilter() {
  const f = UI.af, q = f.q.trim().toLowerCase();
  return DB.animals.filter(a => {
    if (UI.onlySel) return SEL.has(a.id);
    if (f.status && (a.status || 'Active') !== f.status) return false;
    const ty = typeOf(a);
    if (f.type === 'calves') { if (!/calf/.test(ty)) return false; }
    else if (f.type === 'females') { if (a.sex !== 'F' || /calf/.test(ty)) return false; }
    else if (f.type === 'cull') { if (!a.cull) return false; }
    else if (f.type === 'open') { if (!breedable(a) || repro(a).status !== 'Open') return false; }
    else if (f.type === 'bred') { if (!breedable(a) || repro(a).status !== 'Bred') return false; }
    else if (f.type && ty !== f.type) return false;
    if (f.pasture === '-') { if (a.pastureId) return false; } else if (f.pasture && a.pastureId !== f.pasture) return false;
    if (f.year && (a.birthDate || '').slice(0, 4) !== f.year) return false;
    if (f.breed && (a.breed || '') !== f.breed) return false;
    if (q && ![a.tag, a.name, a.eid, a.regNo, a.color, a.breed, a.notes, damText(a), sireText(a)].some(x => (x || '').toLowerCase().includes(q))) return false;
    return true;
  }).sort(ANSORT[UI.asort] ? ANSORT[UI.asort].f : ANSORT.tag.f);
}
const lwOf = a => { const w = lastW(a); return w && w.weight ? +w.weight : null; };
const ANSORT = {
  tag: { l: 'Tag', f: (a, b) => natCmp(a.tag || a.name, b.tag || b.name) || (b.birthDate || '').localeCompare(a.birthDate || '') },
  tagd: { l: 'Tag, high to low', f: (a, b) => natCmp(b.tag || b.name, a.tag || a.name) },
  young: { l: 'Youngest first', f: (a, b) => (b.birthDate || '').localeCompare(a.birthDate || '') },
  old: { l: 'Oldest first', f: (a, b) => (a.birthDate || '9').localeCompare(b.birthDate || '9') },
  kind: { l: 'Kind', f: (a, b) => TYPES.indexOf(typeOf(a)) - TYPES.indexOf(typeOf(b)) || natCmp(a.tag, b.tag) },
  pasture: { l: 'Pasture', f: (a, b) => natCmp(pastureName(a.pastureId) || '~', pastureName(b.pastureId) || '~') || natCmp(a.tag, b.tag) },
  heavy: { l: 'Heaviest first', f: (a, b) => (lwOf(b) ?? -1) - (lwOf(a) ?? -1) },
  light: { l: 'Lightest first', f: (a, b) => (lwOf(a) ?? 1e9) - (lwOf(b) ?? 1e9) },
  due: { l: 'Due to calve', f: (a, b) => ((breedable(a) && repro(a).due) || '9').localeCompare((breedable(b) && repro(b).due) || '9') }
};
ROUTES.animals = function () {
  const f = UI.af;
  const years = [...new Set(DB.animals.map(a => (a.birthDate || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  const breeds = [...new Set(DB.animals.map(a => a.breed).filter(Boolean))].sort();
  const sel = (k, list, label) => `<select onchange="UI.af.${k}=this.value;UI.onlySel=false;drawAnimals()">${opts([['', label], ...list], f[k], false)}</select>`;
  main(page('Animals', `<button class="btn hide-sm" onclick="exportAnimals(animalFilter())">Export CSV</button><button class="btn primary" onclick="actEditAnimal()">+ Add animal</button>`,
    `<div class="toolbar afilters"><input class="search" type="search" placeholder="Search tag, name, EID, dam, sire…" value="${esc(f.q)}" oninput="UI.af.q=this.value;UI.onlySel=false;drawAnimals()">
     ${sel('type', [...TYPES, ['calves', 'All calves'], ['females', 'Cows + heifers'], ['bred', 'Bred'], ['open', 'Open'], ['cull', 'Marked to cull']], 'All kinds')}${sel('status', ['Active', 'Sold', 'Dead', 'Reference'], 'Any status')}${sel('pasture', [...pastureOpts(), ['-', '(no pasture)']], 'All pastures')}${sel('year', years, 'Any birth year')}${breeds.length > 1 ? sel('breed', breeds, 'All breeds') : ''}
     <select onchange="UI.asort=this.value;drawAnimals()" aria-label="Sort">${opts(Object.entries(ANSORT).map(([k, s]) => [k, 'Sort: ' + s.l]), UI.asort || 'tag', false)}</select></div>
     <div id="selbar"></div><div class="card" style="padding:0" id="alist"></div>`));
  drawAnimals();
};
// phone: one tappable row per animal instead of a wide table
function animalRows(list) {
  if (!list.length) return empty(DB.animals.length ? 'No animals match.' : 'No animals yet. Tap “+ Add animal”.');
  const shown = list.slice(0, UI.aLimit || 300);
  return `<div class="alist">${shown.map(a => {
    const lw = lastW(a), r = breedable(a) ? repro(a) : null;
    return `<div class="arow${SEL.has(a.id) ? ' sel' : ''}"><label class="atick"><input type="checkbox" ${SEL.has(a.id) ? 'checked' : ''} onclick="toggleSel('${a.id}',this.checked,event)"></label>
     <a class="amain" href="#/animal/${a.id}">${(a.photos || [])[0] ? `<img data-pid="${a.photos[0]}" alt="">` : `<span class="noimg">${esc((typeOf(a)[0] || '?'))}</span>`}
      <span class="atxt"><b>${esc(keyOf(a))}</b>${a.name && a.name !== a.tag ? ' <span class="muted">' + esc(a.name) + '</span>' : ''}
      <small>${[typeOf(a), ageStr(a), a.breed, pastureName(a.pastureId), lw && lw.weight ? num(lw.weight) + ' lb' : ''].filter(Boolean).map(esc).join(' · ')}</small>
      <span>${isActive(a) ? '' : `<span class="chip ${a.status === 'Dead' ? 'red' : ''}">${esc(a.status)}</span>`}${r ? reproChip(r) : ''}${withdrawalUntil(a) ? '<span class="chip amber">withdrawal</span>' : ''}${a.cull ? '<span class="chip amber">cull</span>' : ''}</span></span></a></div>`;
  }).join('')}</div>${list.length > shown.length ? `<p style="text-align:center"><button class="btn" onclick="UI.aLimit=(UI.aLimit||300)+300;drawAnimals()">Show more (${list.length - shown.length} left)</button></p>` : ''}`;
}
function drawAnimals() {
  const list = animalFilter(), rm = {};
  const showRepro = list.some(breedable);
  const cols = [
    { h: `<input type="checkbox" onclick="toggleAll(this.checked)" ${list.length && list.every(a => SEL.has(a.id)) ? 'checked' : ''}>`, cls: 'chk', f: a => `<input type="checkbox" ${SEL.has(a.id) ? 'checked' : ''} onclick="toggleSel('${a.id}',this.checked,event)">` },
    { h: 'Tag', f: a => `<a href="#/animal/${a.id}"><b>${esc(keyOf(a))}</b></a>${a.name && a.name !== a.tag ? ' <span class="muted">' + esc(a.name) + '</span>' : ''}` },
    { h: 'Kind', f: a => typeOf(a) }, { h: 'Age', f: a => ageStr(a) }, { h: 'Breed', f: a => esc(a.breed), cls: 'hide-sm' },
    { h: 'Pasture', f: a => esc(pastureName(a.pastureId)), cls: 'hide-sm' }, { h: 'Dam', f: a => parentLink(a.damId, a.damName), cls: 'hide-sm' }, { h: 'Sire', f: a => parentLink(a.sireId, a.sireName), cls: 'hide-sm' },
    { h: 'Last weight', f: a => { const w = lastW(a); return w && w.weight ? num(w.weight) : ''; }, cls: 'num hide-sm' },
    { h: 'Status', f: a => (isActive(a) ? '' : `<span class="chip ${a.status === 'Dead' ? 'red' : ''}">${esc(a.status)}</span>`) + (showRepro && breedable(a) ? reproChip(repro(a)) : '') + (withdrawalUntil(a) ? '<span class="chip amber">withdrawal</span>' : '') }
  ];
  $('#alist').innerHTML = `<div style="padding:10px 14px" class="muted small">${plural(list.length, 'animal')}${list.length ? ` · <a href="javascript:void 0" onclick="toggleAll(true)">tick all</a>` : ''}${UI.onlySel ? ' (just the ticked ones — <a href="javascript:void 0" onclick="UI.onlySel=false;drawAnimals()">show all</a>)' : ''}</div>` +
    (isPhone() ? animalRows(list) : table(cols, list, { empty: DB.animals.length ? 'No animals match.' : 'No animals yet.', rowAttr: a => SEL.has(a.id) ? 'class="sel"' : '' }));
  hydratePhotos($('#alist'));
  drawSelbar();
}
function drawSelbar() {
  const el = $('#selbar'); if (!el) return;
  const n = selIds().length;
  el.innerHTML = n ? `<div class="selbar"><b>${plural(n, 'animal')} ticked</b>
   <button class="btn sm primary" onclick="startWork(selIds())">Work these</button><button class="btn sm" onclick="groupAct('kind')">Change kind</button>
   <button class="btn sm" onclick="groupAct('move')">Move</button><button class="btn sm" onclick="groupAct('treat')">Treat</button><button class="btn sm" onclick="groupAct('weigh')">Weigh</button>
   <button class="btn sm" onclick="groupAct('breed')">Breed</button><button class="btn sm" onclick="groupAct('preg')">Preg check</button><button class="btn sm" onclick="groupAct('sell')">Sold / died</button>
   <button class="btn sm" onclick="groupAct('csv')">Export</button><span class="sp"></span><button class="btn link sm" onclick="SEL.clear();UI.onlySel=false;drawAnimals()">Clear</button></div>` : '';
}
function toggleSel(id, on, e) { if (e) e.stopPropagation(); on ? SEL.add(id) : SEL.delete(id); const tr = e && e.target.closest('tr,.arow'); if (tr) tr.classList.toggle('sel', on); drawSelbar(); }
function toggleAll(on) { for (const a of animalFilter()) on ? SEL.add(a.id) : SEL.delete(a.id); drawAnimals(); }

// ---------------- one animal
ROUTES.animal = function (id) {
  const a = AN(id);
  if (!a) return main(page('Not found', '', empty('That animal isn’t in the herd. <a href="#/animals">Back to Animals</a>')));
  const tab = UI.tab[id] || 'history', t = typeOf(a), fem = isFemale(a), r = fem ? repro(a) : null;
  const photo = (a.photos || [])[0];
  const wd = withdrawalUntil(a);
  const kindChip = `<button class="chip ${isActive(a) ? 'green' : ''} chipbtn" onclick="actKind(['${id}'])" title="Change what it is">${esc(t)} ✎</button>`;
  const chips = [(isActive(a) ? kindChip : `<span class="chip ${a.status === 'Dead' ? 'red' : ''}">${esc(a.status)}</span> ${kindChip}`), r && breedable(a) ? reproChip(r) : '', wd ? `<span class="chip amber">withdrawal to ${fmtD(wd)}</span>` : '', a.cull ? '<span class="chip amber">cull</span>' : ''].join(' ');
  const det = (l, v) => v != null && v !== '' ? `<div><span>${l}</span><b>${v}</b></div>` : '';
  const lw = lastW(a), adj = adj205(a);
  const tabs = [['history', 'History'], ['weights', 'Weights'], ['health', 'Health'], ...(fem ? [['repro', 'Breeding & calves']] : []), ...(isMale(a) ? [['progeny', 'Calves sired']] : []), ['notes', 'Notes & scores'], ['pedigree', 'Pedigree'], ['photos', 'Photos' + ((a.photos || []).length ? ' (' + a.photos.length + ')' : '')]];
  let body = '';
  if (tab === 'history') { const ev = eventsFor(a); body = ev.length ? table([{ h: 'Date', f: e => fmtD(e.date) }, { h: 'What', f: e => esc(e.kind) }, { h: '', f: e => e.text }, { h: '', f: e => e.edit ? `<button class="btn link sm" onclick="${e.edit}">edit</button>` : '', cls: 'noprint' }], ev) : empty('No records yet.'); }
  if (tab === 'weights') {
    const l = wOf(a).filter(w => w.weight);
    const pts = [...(a.birthDate && a.birthWeight ? [{ x: a.birthDate, y: +a.birthWeight }] : []), ...l.map(w => ({ x: w.date, y: +w.weight }))];
    body = `<p><button class="btn primary" onclick="actWeigh(['${id}'])">Add weight</button></p>${pts.length > 1 ? lineChart(pts) : ''}
    ${table([{ h: 'Date', f: w => fmtD(w.date) }, { h: 'Kind', f: w => esc(w.kind) }, { h: 'Weight', f: w => num(w.weight), cls: 'num' }, { h: 'Age', f: w => ageStr(a, w.date) }, { h: 'Gain/day since last', f: (w, i) => '', cls: 'num' }, { h: 'BCS', f: w => w.bcs ?? '' }, { h: 'Note', f: w => esc(w.note) }, { h: '', f: w => `<button class="btn link sm" onclick="actEditWeight('${w.id}')">edit</button>` }],
      wOf(a).slice().reverse(), { empty: 'No weights yet.' })}
    ${adj && adj.adj ? `<p class="muted small">Adjusted 205-day weight: <b>${num(adj.adj)} lb</b> (weaned at ${adj.age} days, ${num(adj.ww)} lb${adj.damAge ? ', dam ' + adj.damAge + ' yr old' : ''}).</p>` : ''}`;
    // fill the gain column
    setTimeout(() => { const rows = document.querySelectorAll('#atab tbody tr'); const l2 = wOf(a).slice().reverse(); rows.forEach((tr, i) => { const w = l2[i], p = l2.slice(i + 1).find(x => x.weight); const g = w && w.weight && p ? adgBetween(p, w) : (w && w.weight && a.birthWeight && a.birthDate && i === l2.length - 1 ? adgBetween({ date: a.birthDate, weight: a.birthWeight }, w) : null); if (tr.cells[4]) tr.cells[4].textContent = g != null ? g.toFixed(2) + ' lb' : ''; }); });
  }
  if (tab === 'health') body = `<p><button class="btn primary" onclick="actTreat(['${id}'])">Add treatment</button></p>` + table([{ h: 'Date', f: t => fmtD(t.date) }, { h: 'Product', f: t => `<b>${esc(t.product)}</b>` }, { h: 'Dose', f: t => esc(t.dose) }, { h: 'Route', f: t => esc(t.route) }, { h: 'Site', f: t => esc(t.site) }, { h: 'Lot', f: t => esc(t.lot) }, { h: 'Withdrawal to', f: t => t.withdrawalDate ? (t.withdrawalDate >= today() ? `<span class="chip amber">${fmtD(t.withdrawalDate)}</span>` : fmtD(t.withdrawalDate)) : '' }, { h: 'Reason', f: t => esc(t.reason) }, { h: '', f: t => `<button class="btn link sm" onclick="actEditTreatment('${t.id}')">edit</button>` }], (TR[id] || []).slice().reverse(), { empty: 'No treatments recorded.' });
  if (tab === 'repro') {
    const rm = ratioMap(), cv = calvesOf(a).slice().reverse();
    const ints = []; const cd = calvesOf(a).map(c => c.birthDate).filter(Boolean); for (let i = 1; i < cd.length; i++) if (daysBetween(cd[i - 1], cd[i]) > 200) ints.push(daysBetween(cd[i - 1], cd[i]));
    body = `<p><button class="btn primary" onclick="actCalving('${id}')">Record calving</button> <button class="btn" onclick="actBreed(['${id}'])">Add breeding</button> <button class="btn" onclick="actPreg(['${id}'])">Preg check</button></p>
    <div class="dl" style="margin-bottom:14px">${det('This season', r.status ? reproChip(r) : '—')}${det('Bred', r.bredDate ? esc(r.method) + ' ' + fmtD(r.bredDate) : '')}${det('Sire', sireText(r) ? parentLink(r.sireId, r.sireName) : '')}${det('Due', r.due ? fmtD(r.due) + (r.dueTo ? ' – ' + fmtD(r.dueTo) : '') : '')}
     ${det('Calves', cv.length)}${det('Avg calving interval', ints.length ? Math.round(avg(ints)) + ' days' : '')}${det('Avg weaning ratio', avg(cv.map(c => rm[c.id])) ? Math.round(avg(cv.map(c => rm[c.id]))) : '')}</div>
    <h3>Calves</h3>${table([{ h: 'Calf', f: c => aLink(c.id) }, { h: 'Born', f: c => fmtD(c.birthDate) }, { h: 'Sex', f: c => typeOf(c) }, { h: 'Sire', f: c => parentLink(c.sireId, c.sireName) }, { h: 'Birth wt', f: c => num(c.birthWeight), cls: 'num' }, { h: 'Ease', f: c => c.calvingEase || '', cls: 'num' }, { h: 'Wean wt', f: c => { const x = adj205(c); return x ? num(x.ww) : ''; }, cls: 'num' }, { h: 'Adj 205', f: c => { const x = adj205(c); return x && x.adj ? num(x.adj) : ''; }, cls: 'num' }, { h: 'Ratio', f: c => rm[c.id] || '', cls: 'num' }, { h: 'Status', f: c => isActive(c) ? '' : esc(c.status) }], cv, { empty: 'No calves recorded.' })}
    <h3>Breeding records</h3>${table([{ h: 'Date', f: b => fmtD(b.date) }, { h: 'Method', f: b => esc(b.method) }, { h: 'Sire', f: b => parentLink(b.sireId, b.sireName) }, { h: 'Bull out', f: b => fmtD(b.endDate) }, { h: '', f: b => `<button class="btn link sm" onclick="actEditBreeding('${b.id}')">edit</button>` }], DB.breedings.filter(b => b.femaleId === id).sort(byDate).reverse(), { empty: 'None.' })}
    <h3>Pregnancy checks</h3>${table([{ h: 'Date', f: p => fmtD(p.date) }, { h: 'Result', f: p => `<span class="chip ${p.result === 'Bred' ? 'green' : 'red'}">${esc(p.result)}</span>` }, { h: 'Fetal age', f: p => p.fetalDays ? p.fetalDays + ' d' : '' }, { h: 'Method', f: p => esc(p.method) }, { h: '', f: p => `<button class="btn link sm" onclick="actEditPreg('${p.id}')">edit</button>` }], DB.pregchecks.filter(p => p.femaleId === id).sort(byDate).reverse(), { empty: 'None.' })}`;
  }
  if (tab === 'progeny') {
    const rm = ratioMap(), pr = (PROG[id] || []).slice().sort((x, y) => (y.birthDate || '').localeCompare(x.birthDate || ''));
    const bred = DB.breedings.filter(b => b.sireId === id);
    body = `<div class="dl" style="margin-bottom:14px">${det('Calves sired', pr.length)}${det('Avg birth weight', avg(pr.map(c => c.birthWeight)) ? num(avg(pr.map(c => c.birthWeight))) + ' lb' : '')}${det('Assisted births', pr.length ? pct(pr.filter(c => +c.calvingEase >= 2).length, pr.filter(c => c.calvingEase).length) : '')}${det('Avg weaning ratio', avg(pr.map(c => rm[c.id])) ? Math.round(avg(pr.map(c => rm[c.id]))) : '')}${det('Females bred / exposed', bred.length)}</div>` +
      table([{ h: 'Calf', f: c => aLink(c.id) }, { h: 'Born', f: c => fmtD(c.birthDate) }, { h: 'Sex', f: c => typeOf(c) }, { h: 'Dam', f: c => parentLink(c.damId, c.damName) }, { h: 'Birth wt', f: c => num(c.birthWeight), cls: 'num' }, { h: 'Ease', f: c => c.calvingEase || '', cls: 'num' }, { h: 'Adj 205', f: c => { const x = adj205(c); return x && x.adj ? num(x.adj) : ''; }, cls: 'num' }, { h: 'Ratio', f: c => rm[c.id] || '', cls: 'num' }], pr, { empty: 'No calves recorded for this bull.' });
  }
  if (tab === 'pedigree') {
    const box = (lbl, id2, name, cls) => { const x = id2 && AN(id2); return `<div class="pb ${cls}"><small>${lbl}</small>${x ? aLink(x.id) + (x.regNo ? ' <span class="muted small">' + esc(x.regNo) + '</span>' : '') + (x.breed ? '<div class="muted small">' + esc(x.breed) + '</div>' : '') : esc(name || '—')}</div>`; };
    const s = AN(a.sireId), d = AN(a.damId);
    body = `<div class="ped">${box('Animal', a.id, '', 'g0')}${box('Sire', a.sireId, a.sireName, 'g1')}${box('Sire’s sire', s && s.sireId, s && s.sireName, '')}${box('Sire’s dam', s && s.damId, s && s.damName, '')}${box('Dam', a.damId, a.damName, 'g1')}${box('Dam’s sire', d && d.sireId, d && d.sireName, '')}${box('Dam’s dam', d && d.damId, d && d.damName, '')}</div>
     <p class="muted small">Parents come from the Edit screen. Animals you never owned (AI sires, a bought cow’s mother) can be added with status “Reference”, or just typed as a name.</p>`;
  }
  if (tab === 'notes') {
    const ob = (OBS[id] || []).slice().reverse();
    body = `<p><button class="btn primary" onclick="actNote('${id}')">Add a note</button></p>` + table([{ h: 'Date', f: o => fmtD(o.date) }, { h: 'What', f: o => esc(o.kind) }, { h: '', f: o => esc(obsText(o)) }, { h: '', f: o => `<button class="btn link sm" onclick="actEditObs('${o.id}')">edit</button>` }], ob, { empty: 'No notes or scores yet. Scores (docility, scrotal, udder…) recorded while working cattle show here too.' });
  }
  if (tab === 'photos') body = `<p>${photoBtn(`addPhoto('${id}',this.files)`, '📷 Take or add photos', 'btn primary')}</p>
    ${(a.photos || []).length ? `<div class="photos">${a.photos.map((p, i) => `<figure><img data-pid="${p}" alt="" onclick="viewPhoto('${p}')"><button class="btn sm" onclick="removePhoto('${id}','${p}')" aria-label="Delete photo">✕</button>${i ? `<button class="btn sm star" onclick="mainPhoto('${id}','${p}')">Make main</button>` : '<span class="chip green star">Main photo</span>'}</figure>`).join('')}</div>` : empty('No photos yet. On a phone the button opens the camera or your photos.')}`;

  main(`<div class="phead noprint"><a href="#/animals" class="back">← Animals</a><div class="pact">
    <button class="btn" onclick="actEditAnimal('${id}')">Edit</button>${photoBtn(`addPhoto('${id}',this.files)`, '📷 Photo')}<button class="btn" onclick="actNote('${id}')">Note</button>${isActive(a) ? `<button class="btn" onclick="actWeigh(['${id}'])">Weigh</button><button class="btn" onclick="actTreat(['${id}'])">Treat</button><button class="btn" onclick="actMove(['${id}'])">Move</button>${fem ? `<button class="btn" onclick="actCalving('${id}')">Calving</button>` : ''}<button class="btn" onclick="actSell(['${id}'])">Sold / died</button>` : ''}</div></div>
   <section class="card"><div class="ahead">${photo ? `<img class="photo" data-pid="${photo}" alt="" onclick="viewPhoto('${photo}')">` : `<label class="ph addph">📷<span>Add photo</span><input type="file" accept="image/*" multiple style="display:none" onchange="addPhoto('${id}',this.files)"></label>`}
    <div style="flex:1;min-width:220px"><h1>${esc(a.tag || a.name || 'no tag')}${a.tag && a.name ? ' <span class="muted" style="font-weight:400">' + esc(a.name) + '</span>' : ''}</h1>
    <div class="meta">${[ageStr(a) ? ageStr(a) + ' old' : '', a.breed, a.color, pastureName(a.pastureId)].filter(Boolean).map(esc).join(' · ')}</div><div style="margin-top:6px">${chips}</div></div></div>
    <div class="dl" style="margin-top:16px">${det('Born', fmtD(a.birthDate))}${det('Dam', parentLink(a.damId, a.damName))}${det('Sire', parentLink(a.sireId, a.sireName))}${det('Birth weight', a.birthWeight ? num(a.birthWeight) + ' lb' : '')}${det('Calving ease', a.calvingEase)}
     ${det('Last weight', lw && lw.weight ? num(lw.weight) + ' lb · ' + fmtD(lw.date) : '')}${det('Weaning weight', adj ? num(adj.ww) + ' lb' + (adj.adj ? ' (adj ' + num(adj.adj) + ')' : '') : '')}${det('EID', esc(a.eid))}${det('Registration', esc(a.regNo))}${det('Brand / tattoo', esc(a.brand))}${det('Horns', esc(a.horn))}
     ${det('Bought', a.purchaseDate ? fmtD(a.purchaseDate) + (a.purchasedFrom ? ' from ' + esc(a.purchasedFrom) : '') + (a.purchasePrice ? ' · ' + usd(a.purchasePrice) : '') : '')}${det('Sold', a.saleDate ? fmtD(a.saleDate) + (a.buyer ? ' to ' + esc(a.buyer) : '') + (a.salePrice ? ' · ' + usd(a.salePrice) : '') : '')}${det('Died', a.deathDate ? fmtD(a.deathDate) + (a.deathCause ? ' · ' + esc(a.deathCause) : '') : '')}</div>
    ${a.notes ? `<p style="white-space:pre-wrap;margin-bottom:0">${esc(a.notes)}</p>` : ''}</section>
   <div class="tabs">${tabs.map(([k, l]) => `<a href="javascript:void 0" class="${tab === k ? 'on' : ''}" onclick="UI.tab['${id}']='${k}';refresh()">${l}</a>`).join('')}</div>
   <section class="card" id="atab">${body}</section>`);
};
function lineChart(pts) {
  const W = 640, H = 200, L = 44, B = 22;
  const xs = pts.map(p => parseD(p.x).getTime()), ys = pts.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs); let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.12 || 20; y0 = Math.max(0, y0 - pad); y1 += pad;
  const X = t => L + (t - x0) / (x1 - x0 || 1) * (W - L - 14), Y = v => H - B - (v - y0) / (y1 - y0 || 1) * (H - B - 10);
  const ticks = [0, 1, 2, 3].map(i => y0 + (y1 - y0) * i / 3);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight over time">
   ${ticks.map(v => `<line x1="${L}" x2="${W - 10}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e7e3da"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${num(v)}</text>`).join('')}
   <path d="${pts.map((p, i) => (i ? 'L' : 'M') + X(xs[i]).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ')}" fill="none" stroke="#2f6d4a" stroke-width="2.5" stroke-linejoin="round"/>
   ${pts.map((p, i) => `<circle cx="${X(xs[i]).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="4" fill="#fff" stroke="#2f6d4a" stroke-width="2"><title>${fmtD(p.x)}: ${num(p.y)} lb</title></circle>`).join('')}
   <text x="${L}" y="${H - 4}">${fmtD(pts[0].x)}</text><text x="${W - 10}" y="${H - 4}" text-anchor="end">${fmtD(pts[pts.length - 1].x)}</text></svg>`;
}
// shrink a camera picture (phones take 4-12 MB ones) and keep it; returns its photo id
async function photoFromFile(file) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Not a picture HerdBook can read')); i.src = URL.createObjectURL(file); });
  const sc = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
  c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
  const pid = uid(); await Sync.addPhoto(pid, blob); return pid;
}
// the camera / photo button: no "capture" so phones offer camera OR the photo library
const photoBtn = (onchange, label = '📷 Add photo', cls = 'btn') => `<label class="${cls}">${label}<input type="file" accept="image/*" multiple style="display:none" onchange="${onchange}"></label>`;
async function addPhoto(id, files) {
  files = files && files.length != null ? [...files] : files ? [files] : [];
  if (!files.length) return;
  try {
    const pids = []; for (const f of files) pids.push(await photoFromFile(f));
    const a = AN(id); await put1('animals', Object.assign({}, a, { photos: [...(a.photos || []), ...pids] })); refresh(); toast(plural(pids.length, 'photo') + ' added');
  } catch (e) { alert('Could not add the photo: ' + e.message); }
}
async function mainPhoto(id, pid) { const a = AN(id); await put1('animals', Object.assign({}, a, { photos: [pid, ...(a.photos || []).filter(p => p !== pid)] })); refresh(); toast('Main photo set'); }
async function removePhoto(id, pid) {
  if (!confirm('Delete this photo?')) return;
  const a = AN(id); await put1('animals', Object.assign({}, a, { photos: (a.photos || []).filter(p => p !== pid) }));
  await Sync.removePhoto(pid); refresh();
}
// quick "what is it now" change, from the kind chip on the animal page or the ticked animals
function actKind(ids) {
  const one = ids.length === 1 ? AN(ids[0]) : null;
  const m = modal(`<h2>${one ? 'What is ' + esc(keyOf(one)) + ' now?' : 'Change kind — ' + plural(ids.length, 'animal')}</h2>
   <div class="seg col" id="kd">${TYPES.map(t => `<button type="button" class="${one && typeOf(one) === t ? 'on' : ''}" data-k="${t}">${t}</button>`).join('')}</div>
   <p class="muted small">Picking Cow on a heifer with no calf records marks her as a cow. Bull → Steer records a castration.</p>
   <div class="mfoot"><span class="sp"></span><button class="btn" onclick="closeModal()">Cancel</button></div>`);
  m.querySelector('#kd').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.k;
    await saveMany(ids.map(id => ({ coll: 'animals', data: setKind(Object.assign({}, AN(id)), k) })));
    closeModal(); refresh(); toast(ids.length > 1 ? plural(ids.length, 'animal') + ' set to ' + k : 'Now a ' + k.toLowerCase());
  };
}

// ---------------- calving
function calvesBorn(y) { return DB.animals.filter(a => (a.birthDate || '').startsWith(y) && (a.damId || a.damName || a.calvingEase || a.birthWeight) && !a.purchaseDate).sort((a, b) => a.birthDate.localeCompare(b.birthDate)); }
function calvingStats(y) {
  const c = calvesBorn(y), n = c.length;
  const s = { y, list: c, n, F: c.filter(a => a.sex === 'F').length, M: c.filter(a => a.sex !== 'F').length, dead: c.filter(a => a.status === 'Dead' && a.deathDate && daysBetween(a.birthDate, a.deathDate) <= 2).length,
    bw: avg(c.map(a => a.birthWeight)), easeN: c.filter(a => a.calvingEase).length, assisted: c.filter(a => +a.calvingEase >= 2).length, periods: [] };
  if (n) { const first = c[0].birthDate; s.first = first; s.last = c[n - 1].birthDate; for (const a of c) { const p = Math.floor(daysBetween(first, a.birthDate) / 21); s.periods[p] = (s.periods[p] || 0) + 1; } }
  return s;
}
function calvingSummary(s) {
  if (!s.n) return '<p class="muted">No calves recorded yet this year.</p>';
  const mx = Math.max(...s.periods.filter(Boolean));
  return `<div class="dl"><div><span>Calves born</span><b class="big">${s.n}</b></div><div><span>Heifers / bulls+steers</span><b>${s.F} / ${s.M}</b></div><div><span>Avg birth weight</span><b>${s.bw ? num(s.bw) + ' lb' : '—'}</b></div><div><span>Assisted</span><b>${s.easeN ? s.assisted + ' (' + pct(s.assisted, s.easeN) + ')' : '—'}</b></div><div><span>Dead at birth</span><b>${s.dead}</b></div><div><span>First / last</span><b>${fmtD(s.first).replace(/, \d{4}/, '')} – ${fmtD(s.last).replace(/, \d{4}/, '')}</b></div></div>
   <h3>Calving distribution (21-day periods from the first calf)</h3><div class="bars">${[...s.periods].map((v, i) => `<div class="row"><span>${['1st', '2nd', '3rd'][i] || (i + 1) + 'th'} · ${fmtD(addDays(s.first, i * 21)).replace(/, \d{4}/, '')}</span><div class="bar"><span style="width:${(v || 0) / mx * 100}%"></span></div><span class="num">${v || 0} · ${pct(v || 0, s.n)}</span></div>`).join('')}</div>`;
}
ROUTES.calving = function (yy) {
  const y = yy || UI.cy || thisYear(); UI.cy = y;
  const years = [...new Set([thisYear(), ...DB.animals.map(a => (a.birthDate || '').slice(0, 4)).filter(Boolean)])].sort().reverse();
  const s = calvingStats(y);
  const due = DB.animals.filter(breedable).map(a => ({ a, r: repro(a) })).filter(x => x.r.due && ['Bred', 'Exposed', 'Overdue'].includes(x.r.status)).sort((p, q) => p.r.due.localeCompare(q.r.due));
  main(page('Calving', `<select class="btn" onchange="location.hash='#/calving/'+this.value">${opts(years, y, false)}</select><button class="btn primary" onclick="actCalving()">Record calving</button>`,
    `<div class="cols">${card(y + ' season', calvingSummary(s))}${card('Still to calve', due.length ? table([{ h: 'Female', f: x => aLink(x.a.id) }, { h: 'Due', f: x => (x.r.due < today() ? '<span class="chip red">' + fmtD(x.r.due) + '</span>' : fmtD(x.r.due)) + (x.r.dueTo ? ' – ' + fmtD(x.r.dueTo) : '') }, { h: 'Sire', f: x => parentLink(x.r.sireId, x.r.sireName) }, { h: '', f: x => `<button class="btn sm" onclick="actCalving('${x.a.id}')">Calved</button>` }], due) : '<p class="muted">No bred or exposed females on record.</p>')}</div><div style="height:16px"></div>
    ${card('Calves born in ' + y, table([{ h: 'Calf', f: c => aLink(c.id) }, { h: 'Born', f: c => fmtD(c.birthDate) }, { h: 'Sex', f: c => typeOf(c) }, { h: 'Dam', f: c => parentLink(c.damId, c.damName) }, { h: 'Sire', f: c => parentLink(c.sireId, c.sireName), cls: 'hide-sm' }, { h: 'Birth wt', f: c => num(c.birthWeight), cls: 'num' }, { h: 'Ease', f: c => c.calvingEase || '', cls: 'num' }, { h: 'Status', f: c => isActive(c) ? '' : `<span class="chip ${c.status === 'Dead' ? 'red' : ''}">${esc(c.status)}</span>` }], s.list.slice().reverse(), { empty: 'No calves recorded for ' + y + '.' }))}`));
};

// ---------------- breeding
ROUTES.breeding = function () {
  const tab = UI.btab || 'status';
  const fem = DB.animals.filter(breedable).map(a => ({ a, r: repro(a) }));
  const cnt = st => fem.filter(x => x.r.status === st).length;
  let body;
  if (tab === 'status') {
    const order = { 'Overdue': 0, 'Bred': 1, 'Exposed': 2, 'Exposed - no calf': 3, 'Open': 4, 'Not exposed': 5 };
    const f = UI.bstat || '';
    const list = fem.filter(x => !f || x.r.status === f).sort((p, q) => (order[p.r.status] ?? 9) - (order[q.r.status] ?? 9) || (p.r.due || '9').localeCompare(q.r.due || '9') || natCmp(keyOf(p.a), keyOf(q.a)));
    body = `<div class="toolbar"><select onchange="UI.bstat=this.value;refresh()">${opts([['', 'Every female (' + fem.length + ')'], ...['Bred', 'Exposed', 'Open', 'Not exposed', 'Overdue', 'Exposed - no calf'].map(s => [s, s + ' (' + cnt(s) + ')'])], f, false)}</select>
     <button class="btn" onclick="showList(${listRef(list.map(x => x.a.id))})">Tick these on Animals</button></div>` +
      table([{ h: 'Female', f: x => aLink(x.a.id) }, { h: 'Kind', f: x => typeOf(x.a) }, { h: 'Age', f: x => ageStr(x.a) }, { h: 'Pasture', f: x => esc(pastureName(x.a.pastureId)), cls: 'hide-sm' }, { h: 'Status', f: x => reproChip(x.r) }, { h: 'Bred', f: x => x.r.bredDate ? esc(x.r.method === 'Natural service' ? 'Bull in' : x.r.method) + ' ' + fmtD(x.r.bredDate) : '' }, { h: 'Sire', f: x => parentLink(x.r.sireId, x.r.sireName) }, { h: 'Due', f: x => x.r.due ? fmtD(x.r.due) + (x.r.dueTo ? ' – ' + fmtD(x.r.dueTo) : '') : '' }, { h: 'Last calf', f: x => fmtD(lastCalving(x.a)), cls: 'hide-sm' }], list, { empty: 'No breeding-age females.' });
  } else {
    const ev = [...DB.breedings.map(b => ({ date: b.date, a: b.femaleId, what: b.method === 'Natural service' ? 'Exposed (bull in)' : b.method, det: [sireText(b) ? parentLink(b.sireId, b.sireName) : '', b.endDate ? 'bull out ' + fmtD(b.endDate) : '', esc(b.tech)].filter(Boolean).join(' · '), edit: `actEditBreeding('${b.id}')` })),
      ...DB.pregchecks.map(p => ({ date: p.date, a: p.femaleId, what: 'Preg check', det: `<span class="chip ${p.result === 'Bred' ? 'green' : 'red'}">${esc(p.result)}</span>${p.fetalDays ? ' ' + p.fetalDays + ' days' : ''}`, edit: `actEditPreg('${p.id}')` }))].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 500);
    body = table([{ h: 'Date', f: e => fmtD(e.date) }, { h: 'Female', f: e => aLink(e.a) }, { h: 'What', f: e => esc(e.what) }, { h: '', f: e => e.det }, { h: '', f: e => `<button class="btn link sm" onclick="${e.edit}">edit</button>` }], ev, { empty: 'No breeding records yet.' });
  }
  main(page('Breeding', `<button class="btn" onclick="actTurnIn()">Bull turn-in</button><button class="btn" onclick="actPullBull()">Pull bull</button><button class="btn" onclick="pickThen('AI / breeding',breedable,actBreed)">AI / breeding</button><button class="btn primary" onclick="pickThen('Pregnancy check',breedable,actPreg)">Preg check</button>`,
    `<div class="kpis">${['Bred', 'Exposed', 'Open', 'Not exposed'].map(s => `<a class="kpi" onclick="UI.btab='status';UI.bstat='${s}';refresh()"><div class="kl">${s}</div><div class="kv">${cnt(s)}</div></a>`).join('')}</div>
     <div class="tabs"><a href="javascript:void 0" class="${tab === 'status' ? 'on' : ''}" onclick="UI.btab='status';refresh()">This season</a><a href="javascript:void 0" class="${tab === 'log' ? 'on' : ''}" onclick="UI.btab='log';refresh()">All records</a></div>${card('', body)}`,
    `Due dates use a ${S().gestation}-day gestation (change it in Settings). A calving closes the season for that female.`));
};

// ---------------- health
ROUTES.health = function () {
  const tab = UI.htab || 'log';
  let body;
  if (tab === 'log') {
    const f = UI.hf || (UI.hf = { from: addDays(today(), -365), to: '', product: '' });
    const list = DB.treatments.filter(t => (!f.from || t.date >= f.from) && (!f.to || t.date <= f.to) && (!f.product || t.product === f.product)).sort((a, b) => b.date.localeCompare(a.date));
    const prods = [...new Set(DB.treatments.map(t => t.product).filter(Boolean))].sort(natCmp);
    body = `<div class="toolbar"><label class="small">From <input type="date" value="${f.from}" onchange="UI.hf.from=this.value;refresh()"></label><label class="small">to <input type="date" value="${f.to}" onchange="UI.hf.to=this.value;refresh()"></label><select onchange="UI.hf.product=this.value;refresh()">${opts([['', 'All products'], ...prods], f.product, false)}</select></div>` +
      table([{ h: 'Date', f: t => fmtD(t.date) }, { h: 'Animal', f: t => aLink(t.animalId) }, { h: 'Product', f: t => `<b>${esc(t.product)}</b>` }, { h: 'Dose', f: t => esc(t.dose) }, { h: 'Route', f: t => esc(t.route), cls: 'hide-sm' }, { h: 'Site', f: t => esc(t.site), cls: 'hide-sm' }, { h: 'Lot', f: t => esc(t.lot), cls: 'hide-sm' }, { h: 'Withdrawal to', f: t => t.withdrawalDate ? fmtD(t.withdrawalDate) : '' }, { h: 'Reason', f: t => esc(t.reason), cls: 'hide-sm' }, { h: '', f: t => `<button class="btn link sm" onclick="actEditTreatment('${t.id}')">edit</button>` }], list.slice(0, UI.hLimit || 300), { empty: 'No treatments in this range.' }) + (list.length > (UI.hLimit || 300) ? `<p style="text-align:center"><button class="btn" onclick="UI.hLimit=(UI.hLimit||300)+500;refresh()">Show more (${list.length - (UI.hLimit || 300)} older)</button></p>` : '');
  } else if (tab === 'wd') {
    const list = DB.animals.filter(a => isActive(a) && withdrawalUntil(a)).map(a => ({ a, d: withdrawalUntil(a), t: (TR[a.id] || []).filter(t => t.withdrawalDate >= today()) })).sort((x, y) => y.d.localeCompare(x.d));
    body = `<p class="muted small">Animals that must not go to slaughter yet. Always check the product label.</p>` + table([{ h: 'Animal', f: x => aLink(x.a.id) }, { h: 'Kind', f: x => typeOf(x.a) }, { h: 'Clear on', f: x => `<span class="chip amber">${fmtD(addDays(x.d, 1))}</span>` }, { h: 'Products', f: x => x.t.map(t => esc(t.product) + ' (' + fmtD(t.date) + ')').join(', ') }], list, { empty: 'Nothing is in withdrawal.' });
  } else {
    const list = DB.products.slice().sort((a, b) => natCmp(a.name, b.name));
    body = `<p><button class="btn primary" onclick="actProduct()">Add product</button></p>` + table([{ h: 'Product', f: p => `<a href="javascript:void 0" onclick="actProduct('${p.id}')"><b>${esc(p.name)}</b></a>` }, { h: 'Kind', f: p => esc(p.group || p.kind) }, { h: 'Dose', f: p => esc(doseText(p)) }, { h: 'Route', f: p => esc(p.route) }, { h: 'Withdrawal', f: p => p.withdrawalDays != null ? p.withdrawalDays + ' days' : '' }, { h: 'Booster', f: p => p.boosterDays ? p.boosterDays + ' days' : '' }, { h: 'Times used', f: p => DB.treatments.filter(t => t.product === p.name).length, cls: 'num' }], list, { empty: 'No products yet. They are added here, or remembered the first time you use one.' });
  }
  const wdN = DB.animals.filter(a => isActive(a) && withdrawalUntil(a)).length;
  main(page('Health', `<button class="btn primary" onclick="pickThen('Treatment',null,actTreat)">Record treatment</button>`,
    `<div class="tabs"><a href="javascript:void 0" class="${tab === 'log' ? 'on' : ''}" onclick="UI.htab='log';refresh()">Treatment log</a><a href="javascript:void 0" class="${tab === 'wd' ? 'on' : ''}" onclick="UI.htab='wd';refresh()">In withdrawal (${wdN})</a><a href="javascript:void 0" class="${tab === 'prod' ? 'on' : ''}" onclick="UI.htab='prod';refresh()">Products</a></div>${card('', body)}`));
};

// ---------------- weights
ROUTES.weights = function () {
  const list = DB.weights.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 400);
  main(page('Weights', `<button class="btn primary" onclick="pickThen('Weights',null,actWeigh)">Record weights</button>`,
    card('Recent weights', table([{ h: 'Date', f: w => fmtD(w.date) }, { h: 'Animal', f: w => aLink(w.animalId) }, { h: 'Kind', f: w => esc(w.kind) }, { h: 'Weight', f: w => num(w.weight), cls: 'num' }, { h: 'BCS', f: w => w.bcs ?? '', cls: 'num' }, { h: 'Age', f: w => AN(w.animalId) ? ageStr(AN(w.animalId), w.date) : '' }, { h: '', f: w => `<button class="btn link sm" onclick="actEditWeight('${w.id}')">edit</button>` }], list, { empty: 'No weights yet.' })),
    'Weaning weights give each calf an adjusted 205-day weight and a ratio — see Reports → Weaning.'));
};

// ---------------- pastures
ROUTES.pastures = function (pid) {
  if (pid) {
    const p = IX.pastures[pid]; if (!p) return main(empty('Pasture not found.'));
    const list = DB.animals.filter(a => isActive(a) && a.pastureId === pid).sort((a, b) => natCmp(keyOf(a), keyOf(b)));
    const hist = DB.moves.filter(m => m.pastureId === pid || m.fromId === pid).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200);
    return main(page(esc(p.name), `<button class="btn" onclick="actPasture('${pid}')">Edit</button><button class="btn" onclick="showList(${listRef(list.map(a => a.id))})">Work these cattle</button>`,
      card(plural(list.length, 'head', 'head') + ' here now', table([{ h: 'Tag', f: a => aLink(a.id) }, { h: 'Kind', f: a => typeOf(a) }, { h: 'Age', f: a => ageStr(a) }, { h: 'Breed', f: a => esc(a.breed) }, { h: 'Status', f: a => breedable(a) ? reproChip(repro(a)) : '' }], list, { empty: 'Empty.' })) +
      card('Moves', table([{ h: 'Date', f: m => fmtD(m.date) }, { h: 'Animal', f: m => aLink(m.animalId) }, { h: '', f: m => m.pastureId === pid ? 'in from ' + esc(pastureName(m.fromId) || '—') : 'out to ' + esc(pastureName(m.pastureId)) }], hist, { empty: 'No moves recorded.' })),
      [p.acres ? num(p.acres, 1) + ' acres' : '', p.kind, p.water ? 'water: ' + p.water : '', p.notes].filter(Boolean).map(esc).join(' · ') + ' &nbsp; <a href="#/pastures">← all pastures</a>'));
  }
  const unas = DB.animals.filter(a => isActive(a) && !a.pastureId).length;
  const cardsHtml = DB.pastures.filter(p => !p.retired || UI.showRetired).sort((a, b) => natCmp(a.name, b.name)).map(p => {
    const here = DB.animals.filter(a => isActive(a) && a.pastureId === p.id), by = {};
    here.forEach(a => { const t = typeOf(a); by[t] = (by[t] || 0) + 1; });
    return `<div class="card" onclick="location.hash='#/pastures/${p.id}'"><h2>${esc(p.name)}${p.retired ? ' <span class="chip">not used</span>' : ''}</h2><div class="big">${here.length} <span class="muted small" style="font-weight:400">head${p.acres ? ' · ' + num(p.acres, 1) + ' ac' + (here.length ? ' · ' + num(p.acres / here.length, 1) + ' ac/hd' : '') : ''}</span></div>
     <div style="margin-top:6px">${TYPES.filter(t => by[t]).map(t => `<span class="chip">${by[t]} ${t.toLowerCase()}</span>`).join('')}</div></div>`;
  }).join('');
  main(page('Pastures', `<button class="btn primary" onclick="actPasture()">Add pasture</button>`,
    (DB.pastures.length ? `<div class="pcards">${cardsHtml}</div>` : card('', empty('No pastures yet. Add the pastures, pens and traps you keep cattle in.'))) +
    `<p class="muted small" style="margin-top:14px">${unas ? `${plural(unas, 'active animal')} not in any pasture. ` : ''}<label><input type="checkbox" ${UI.showRetired ? 'checked' : ''} onchange="UI.showRetired=this.checked;refresh()"> show pastures no longer used</label></p>`));
};

// ---------------- tasks
ROUTES.tasks = function () {
  const open = DB.tasks.filter(t => !t.done).sort(byDate), done = DB.tasks.filter(t => t.done).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);
  const cols = [{ h: '', cls: 'chk', f: t => `<input type="checkbox" ${t.done ? 'checked' : ''} onclick="toggleTask('${t.id}')">` }, { h: 'Due', f: t => !t.done && t.date < today() ? `<span class="chip red">${fmtD(t.date)}</span>` : fmtD(t.date) }, { h: 'What', f: t => `<a href="javascript:void 0" onclick="actTask('${t.id}')">${esc(t.title)}</a>${t.note ? '<div class="muted small">' + esc(t.note) + '</div>' : ''}` }, { h: 'Animal', f: t => t.animalId ? aLink(t.animalId) : '' }];
  main(page('Tasks', `<button class="btn primary" onclick="actTask()">Add task</button>`,
    `<div class="cols">${card('To do', table(cols, open, { empty: 'Nothing on the list.' }))}${card('Reminders HerdBook works out for you', remHtml(reminders().filter(r => !r.task)))}</div><div style="height:16px"></div>${card('Done lately', table(cols, done, { empty: 'Nothing done yet.' }))}`));
};

// ---------------- reports
const REPORTS = [
  ['inventory', 'Herd inventory', 'Head count by kind and pasture'],
  ['calving', 'Calving report', 'Every calf born in a year, with totals'],
  ['weaning', 'Weaning report', 'Adjusted 205-day weights and ratios'],
  ['cows', 'Cow performance', 'Each cow’s calves, interval and ratio — for culling'],
  ['due', 'Due-to-calve list', 'Bred and exposed females by due date'],
  ['open', 'Open & problem cows', 'Open, overdue, exposed with no calf'],
  ['health', 'Treatment log (BQA)', 'Every treatment in a date range'],
  ['withdrawal', 'Withdrawal list', 'Animals not clear for slaughter'],
  ['sales', 'Sales & death loss', 'Animals sold or lost in a year'],
  ['pl', 'Profit & loss', 'Income and expenses by category'],
  ['sheet', 'Chute sheet (print)', 'Blank worksheet for working cattle']
];
ROUTES.reports = function (rid) {
  rid = rid || UI.rep || 'inventory'; UI.rep = rid;
  const R = buildReport(rid);
  main(page('Reports', `<button class="btn" onclick="window.print()">Print</button>${R.csv ? `<button class="btn" onclick="download(${esc(JSON.stringify(R.title + '.csv'))},REPCSV())">Export CSV</button>` : ''}`,
    `<div class="rlist">${REPORTS.map(([k, t, d]) => `<button class="${k === rid ? 'on' : ''}" onclick="location.hash='#/reports/${k}'"><b>${t}</b><span>${d}</span></button>`).join('')}</div>
     <section class="card"><div class="printhead"><b>${esc(S().farmName)}</b> — printed ${fmtD(today())}</div><div class="phead" style="margin-bottom:10px"><h2 style="margin:0">${esc(R.title)}</h2><div class="pact noprint">${R.filters || ''}</div></div>${R.html}</section>`));
  window.REPCSV = () => R.csv;
};
function yearSel(cur, list) { return `<select onchange="UI.ry=this.value;refresh()">${opts([...new Set([thisYear(), ...list])].filter(Boolean).sort().reverse(), cur, false)}</select>`; }
function buildReport(rid) {
  const y = UI.ry || thisYear(), birthYears = DB.animals.map(a => (a.birthDate || '').slice(0, 4));
  const T = (cols, rows, opt) => ({ html: table(cols, rows, opt), csv: rows.length ? tableCSV(cols, rows) : null });
  if (rid === 'inventory') {
    const act = DB.animals.filter(isActive), ps = [...DB.pastures.filter(p => act.some(a => a.pastureId === p.id)).sort((a, b) => natCmp(a.name, b.name)), ...(act.some(a => !a.pastureId) ? [{ id: null, name: '(no pasture)' }] : [])];
    const rows = TYPES.map(t => ({ t, c: ps.map(p => act.filter(a => typeOf(a) === t && (a.pastureId || null) === p.id).length) })).filter(r => r.c.some(Boolean));
    const cols = [{ h: 'Kind', f: r => r.t }, ...ps.map((p, i) => ({ h: esc(p.name), f: r => r.c[i] || '', cls: 'num' })), { h: 'Total', f: r => '<b>' + r.c.reduce((s, x) => s + x, 0) + '</b>', cls: 'num' }];
    return Object.assign({ title: 'Herd inventory ' + fmtD(today()) }, T(cols, rows, { foot: ['Total', ...ps.map((p, i) => rows.reduce((s, r) => s + r.c[i], 0)), act.length], empty: 'No active animals.' }));
  }
  if (rid === 'calving') {
    const s = calvingStats(y);
    const cols = [{ h: 'Calf', f: c => aLink(c.id), c: c => keyOf(c) }, { h: 'Born', f: c => fmtD(c.birthDate), c: c => c.birthDate }, { h: 'Sex', f: c => typeOf(c) }, { h: 'Dam', f: c => parentLink(c.damId, c.damName), c: c => damText(c) }, { h: 'Dam age', f: c => damAgeAt(AN(c.damId), c.birthDate) ?? '', cls: 'num' }, { h: 'Sire', f: c => parentLink(c.sireId, c.sireName), c: c => sireText(c) }, { h: 'Birth wt', f: c => num(c.birthWeight), c: c => c.birthWeight, cls: 'num' }, { h: 'Ease', f: c => c.calvingEase || '', cls: 'num' }, { h: 'Status', f: c => isActive(c) ? 'Alive' : esc(c.status) + (c.deathCause ? ' – ' + esc(c.deathCause) : '') }];
    const t = T(cols, s.list);
    return { title: 'Calving report ' + y, filters: yearSel(y, birthYears), html: calvingSummary(s) + '<div style="height:12px"></div>' + t.html, csv: t.csv };
  }
  if (rid === 'weaning') {
    const rm = ratioMap();
    const list = calvesBorn(y).map(c => ({ c, x: adj205(c) })).filter(r => r.x).sort((a, b) => (a.c.sex === 'F' ? 0 : 1) - (b.c.sex === 'F' ? 0 : 1) || (b.x.adj || 0) - (a.x.adj || 0));
    const cols = [{ h: 'Calf', f: r => aLink(r.c.id), c: r => keyOf(r.c) }, { h: 'Sex', f: r => r.c.sex === 'F' ? 'Heifer' : r.c.sex === 'M' ? 'Bull' : 'Steer' }, { h: 'Dam', f: r => parentLink(r.c.damId, r.c.damName), c: r => damText(r.c) }, { h: 'Dam age', f: r => r.x.damAge ?? '', cls: 'num' }, { h: 'Sire', f: r => parentLink(r.c.sireId, r.c.sireName), c: r => sireText(r.c) }, { h: 'Birth wt', f: r => num(r.c.birthWeight), c: r => r.c.birthWeight, cls: 'num' }, { h: 'Weaned', f: r => fmtD(r.x.wdate), c: r => r.x.wdate }, { h: 'Age (d)', f: r => r.x.age, cls: 'num' }, { h: 'Wean wt', f: r => num(r.x.ww), c: r => r.x.ww, cls: 'num' }, { h: 'Gain/day', f: r => r.c.birthWeight || S().defaultBW ? ((r.x.ww - (r.c.birthWeight || S().defaultBW)) / r.x.age).toFixed(2) : '', cls: 'num' }, { h: 'Adj 205', f: r => r.x.adj ? num(r.x.adj) : '<span class="muted small">age out of 160–250</span>', c: r => r.x.adj, cls: 'num' }, { h: 'Ratio', f: r => rm[r.c.id] || '', cls: 'num' }];
    const sx = l => avg(l.map(r => r.x.adj));
    const hf = list.filter(r => r.c.sex === 'F'), ml = list.filter(r => r.c.sex !== 'F');
    const t = T(cols, list, { empty: 'No weaning weights for calves born in ' + y + '. Record them on the Weights page with kind “Weaning”.' });
    return { title: 'Weaning report — calves born ' + y, filters: yearSel(y, birthYears), csv: t.csv,
      html: `<div class="dl" style="margin-bottom:12px"><div><span>Calves weaned</span><b>${list.length}</b></div><div><span>Avg adj 205 — heifers</span><b>${sx(hf) ? num(sx(hf)) + ' lb' : '—'}</b></div><div><span>Avg adj 205 — bulls & steers</span><b>${sx(ml) ? num(sx(ml)) + ' lb' : '—'}</b></div><div><span>Avg actual wean wt</span><b>${list.length ? num(avg(list.map(r => r.x.ww))) + ' lb' : '—'}</b></div></div>${t.html}
       <p class="muted small">Adjusted 205 = (weaning wt − birth wt) ÷ age × 205 + birth wt, plus the BIF age-of-dam allowance (2-yr-old dams +60 bulls/+54 heifers, 3 +40/+36, 4 +20/+18, 11+ +20/+18). Missing birth weights use ${S().defaultBW} lb. Dam age = calf’s birth year − dam’s birth year. Ratio = the calf ÷ the average of the heifers (or of the bulls + steers) born that year × 100.</p>` };
  }
  if (rid === 'cows') {
    const rm = ratioMap();
    const rows = DB.animals.filter(a => isActive(a) && typeOf(a) === 'Cow').map(a => {
      const cv = calvesOf(a), cd = cv.map(c => c.birthDate).filter(Boolean), ints = [];
      for (let i = 1; i < cd.length; i++) if (daysBetween(cd[i - 1], cd[i]) > 200) ints.push(daysBetween(cd[i - 1], cd[i]));
      return { a, n: cv.length, lost: cv.filter(c => c.status === 'Dead' && c.deathDate && daysBetween(c.birthDate, c.deathDate) < 120).length, bw: avg(cv.map(c => c.birthWeight)), ratio: avg(cv.map(c => rm[c.id])), intv: avg(ints), last: cd[cd.length - 1], r: repro(a) };
    }).sort((p, q) => (p.ratio ?? 999) - (q.ratio ?? 999));
    const cols = [{ h: 'Cow', f: r => aLink(r.a.id), c: r => keyOf(r.a) }, { h: 'Age', f: r => ageStr(r.a) }, { h: 'Breed', f: r => esc(r.a.breed) }, { h: 'Calves', f: r => r.n, cls: 'num' }, { h: 'Calves lost', f: r => r.lost || '', cls: 'num' }, { h: 'Avg calf BW', f: r => r.bw ? num(r.bw) : '', cls: 'num' }, { h: 'Avg wean ratio', f: r => r.ratio ? Math.round(r.ratio) : '', cls: 'num' }, { h: 'Avg interval (d)', f: r => r.intv ? Math.round(r.intv) : '', cls: 'num' }, { h: 'Last calf', f: r => fmtD(r.last), c: r => r.last }, { h: 'This season', f: r => reproChip(r.r), c: r => r.r.status }];
    const t = T(cols, rows, { empty: 'No cows.' });
    return { title: 'Cow performance', html: '<p class="muted small">Lowest weaning ratio first. A ratio under 100 means her calves weaned lighter than the herd average; an interval over 365 days means she is slipping later.</p>' + t.html, csv: t.csv };
  }
  if (rid === 'due' || rid === 'open') {
    const want = rid === 'due' ? ['Bred', 'Exposed', 'Overdue'] : ['Open', 'Overdue', 'Exposed - no calf'];
    const rows = DB.animals.filter(breedable).map(a => ({ a, r: repro(a) })).filter(x => want.includes(x.r.status)).sort((p, q) => (p.r.due || '9').localeCompare(q.r.due || '9'));
    const cols = [{ h: 'Female', f: x => aLink(x.a.id), c: x => keyOf(x.a) }, { h: 'Kind', f: x => typeOf(x.a) }, { h: 'Age', f: x => ageStr(x.a) }, { h: 'Pasture', f: x => esc(pastureName(x.a.pastureId)) }, { h: 'Status', f: x => reproChip(x.r), c: x => x.r.status }, { h: 'Bred', f: x => x.r.bredDate ? esc(x.r.method) + ' ' + fmtD(x.r.bredDate) : '', c: x => x.r.bredDate }, { h: 'Sire', f: x => parentLink(x.r.sireId, x.r.sireName), c: x => sireText(x.r) }, { h: 'Due', f: x => x.r.due ? fmtD(x.r.due) + (x.r.dueTo ? ' – ' + fmtD(x.r.dueTo) : '') : '', c: x => x.r.due }, { h: 'Last calf', f: x => fmtD(lastCalving(x.a)), c: x => lastCalving(x.a) }];
    return Object.assign({ title: rid === 'due' ? 'Due to calve' : 'Open & problem cows' }, T(cols, rows, { empty: 'None.' }));
  }
  if (rid === 'health') {
    const f = UI.hf || (UI.hf = { from: addDays(today(), -365), to: '', product: '' });
    const rows = DB.treatments.filter(t => (!f.from || t.date >= f.from) && (!f.to || t.date <= f.to)).sort(byDate);
    const cols = [{ h: 'Date', f: t => fmtD(t.date), c: t => t.date }, { h: 'Animal', f: t => aLink(t.animalId), c: t => keyOf(AN(t.animalId)) }, { h: 'Product', f: t => esc(t.product) }, { h: 'Dose', f: t => esc(t.dose) }, { h: 'Route', f: t => esc(t.route) }, { h: 'Site', f: t => esc(t.site) }, { h: 'Lot', f: t => esc(t.lot) }, { h: 'Withdrawal to', f: t => fmtD(t.withdrawalDate), c: t => t.withdrawalDate }, { h: 'Reason', f: t => esc(t.reason) }, { h: 'By', f: t => esc(t.by) }];
    return Object.assign({ title: 'Treatment log', filters: `<input type="date" value="${f.from}" onchange="UI.hf.from=this.value;refresh()"> to <input type="date" value="${f.to}" onchange="UI.hf.to=this.value;refresh()">` }, T(cols, rows, { empty: 'No treatments in this range.' }));
  }
  if (rid === 'withdrawal') {
    const rows = DB.animals.filter(a => isActive(a) && withdrawalUntil(a)).map(a => ({ a, d: withdrawalUntil(a) })).sort((x, y2) => y2.d.localeCompare(x.d));
    return Object.assign({ title: 'Withdrawal list ' + fmtD(today()) }, T([{ h: 'Animal', f: x => aLink(x.a.id), c: x => keyOf(x.a) }, { h: 'Kind', f: x => typeOf(x.a) }, { h: 'Clear for slaughter on', f: x => fmtD(addDays(x.d, 1)), c: x => addDays(x.d, 1) }, { h: 'Products', f: x => (TR[x.a.id] || []).filter(t => t.withdrawalDate >= today()).map(t => esc(t.product)).join(', ') }], rows, { empty: 'Nothing is in withdrawal.' }));
  }
  if (rid === 'sales') {
    const rows = DB.animals.filter(a => (a.saleDate || '').startsWith(y) || (a.deathDate || '').startsWith(y)).sort((a, b) => (a.saleDate || a.deathDate).localeCompare(b.saleDate || b.deathDate));
    const sold = rows.filter(a => a.status === 'Sold'), dead = rows.filter(a => a.status === 'Dead');
    const t = T([{ h: 'Animal', f: a => aLink(a.id), c: a => keyOf(a) }, { h: 'Kind', f: a => typeOf(a) }, { h: 'Date', f: a => fmtD(a.saleDate || a.deathDate), c: a => a.saleDate || a.deathDate }, { h: 'What', f: a => esc(a.status) }, { h: 'Weight', f: a => num(a.saleWeight), c: a => a.saleWeight, cls: 'num' }, { h: 'Price', f: a => usd(a.salePrice), c: a => a.salePrice, cls: 'num' }, { h: '$/cwt', f: a => a.salePrice && a.saleWeight ? usd(a.salePrice / a.saleWeight * 100) : '', cls: 'num' }, { h: 'Buyer / cause', f: a => esc(a.buyer || a.deathCause) }], rows, { empty: 'No sales or deaths in ' + y + '.' });
    return { title: 'Sales & death loss ' + y, filters: yearSel(y, DB.animals.map(a => (a.saleDate || a.deathDate || '').slice(0, 4))), csv: t.csv,
      html: `<div class="dl" style="margin-bottom:12px"><div><span>Sold</span><b>${sold.length} head · ${usd(sold.reduce((s, a) => s + (+a.salePrice || 0), 0))}</b></div><div><span>Died</span><b>${dead.length} head</b></div></div>${t.html}` };
  }
  if (rid === 'pl') {
    const list = DB.money.filter(m => (m.date || '').startsWith(y));
    const cats = {}; list.forEach(m => { const k = (m.kind === 'Income' ? 'Income' : 'Expense') + '|' + (m.category || 'Other'); cats[k] = (cats[k] || 0) + (+m.amount || 0); });
    const rows = Object.entries(cats).map(([k, v]) => ({ kind: k.split('|')[0], cat: k.split('|')[1], v })).sort((a, b) => (a.kind === 'Income' ? 0 : 1) - (b.kind === 'Income' ? 0 : 1) || b.v - a.v);
    const inc = rows.filter(r => r.kind === 'Income').reduce((s, r) => s + r.v, 0), exp = rows.filter(r => r.kind !== 'Income').reduce((s, r) => s + r.v, 0);
    return Object.assign({ title: 'Profit & loss ' + y, filters: yearSel(y, DB.money.map(m => (m.date || '').slice(0, 4))) },
      T([{ h: 'Kind', f: r => r.kind }, { h: 'Category', f: r => esc(r.cat) }, { h: 'Amount', f: r => r.kind === 'Income' ? usd(r.v) : '(' + usd(r.v) + ')', c: r => r.kind === 'Income' ? r.v : -r.v, cls: 'num' }], rows, { foot: ['Net', `Income ${usd(inc)} − expenses ${usd(exp)}`, '<b>' + usd(inc - exp) + '</b>'], empty: 'No money entries for ' + y + '.' }));
  }
  if (rid === 'sheet') {
    const p = UI.sp || '';
    const rows = DB.animals.filter(a => isActive(a) && (!p || a.pastureId === p)).sort((a, b) => natCmp(keyOf(a), keyOf(b)));
    const blank = { f: () => '', cls: 'blank' };
    return { title: 'Chute sheet' + (p ? ' — ' + pastureName(p) : ''), filters: `<select onchange="UI.sp=this.value;refresh()">${opts([['', 'All active cattle'], ...pastureOpts()], p, false)}</select>`,
      html: table([{ h: 'Tag', f: a => '<b>' + esc(keyOf(a)) + '</b>' }, { h: 'Kind', f: a => typeOf(a) }, { h: 'Age', f: a => ageStr(a) }, { h: 'Last wt', f: a => { const w = lastW(a); return w && w.weight ? num(w.weight) : ''; }, cls: 'num' }, Object.assign({ h: 'Weight' }, blank), Object.assign({ h: 'Shots / treatment' }, blank), Object.assign({ h: 'Preg' }, blank), Object.assign({ h: 'Notes' }, blank)], rows, { cls: 'sheet', empty: 'No cattle.' }),
      csv: toCSV([['Tag', 'Kind', 'Age', 'Last weight', 'Weight', 'Treatment', 'Preg', 'Notes'], ...rows.map(a => [keyOf(a), typeOf(a), ageStr(a), lastW(a) ? lastW(a).weight : '', '', '', '', ''])]) };
  }
  return { title: 'Unknown report', html: '' };
}

// ---------------- settings, import, export, backup
ROUTES.settings = function () {
  const s = S();
  main(page('Settings', '', `<div class="cols">
   ${card('Farm', `<div class="grid2"><div class="fld full"><label>Farm / herd name</label><input id="s_name" value="${esc(s.farmName)}"></div>
     <div class="fld"><label>Gestation (days)</label><input id="s_g" type="number" value="${s.gestation}"></div><div class="fld"><label>Birth weight to use when missing (lb)</label><input id="s_bw" type="number" value="${s.defaultBW}"></div></div>
     <p><button class="btn primary" onclick="saveSettings()">Save</button></p>`)}
   ${card('Sync and sign-in', syncCard(), 'id="synccard"')}
   </div><div style="height:16px"></div>
   ${card('People on this farm', peopleCard(), 'id="peoplecard"')}
   <div class="cols">
   ${card('Backups', `<p>${Sync.st.account ? 'Every day HerdBook syncs, it keeps a copy of your herd in your Google account (the last 30 days), plus a copy before every HerdBook update.' : 'Sign in with Google and HerdBook keeps daily copies of your herd in your Google account.'} You can also save a copy to this device:</p>
     <p><button class="btn primary" onclick="downloadBackup()">Download a backup file</button> ${Sync.st.account ? '<button class="btn" onclick="showDriveBackups()">Restore an earlier day…</button>' : ''}</p>
     <p class="muted small">To restore from a file, pick it here. Everything in HerdBook is replaced by what is in the file, on every phone and computer signed in to this herd.${Sync.st.account ? ' A copy of the herd as it is now is kept in Google first.' : ''} The file does not include photos.</p>
     <p><label class="btn">Restore from a backup file…<input type="file" accept=".json,application/json" style="display:none" onchange="restoreBackup(this.files[0])"></label></p>`)}
   ${card('Install on this phone or computer', installCard())}
   </div><div style="height:16px"></div><div class="cols">
   ${card('Spreadsheets', `<p><b>Import animals</b> from a CSV file (save your Excel sheet as CSV). Columns HerdBook understands: Tag, Name, EID, Sex (or Cow/Heifer/Bull/Steer), Birth Date, Breed, Color, Dam, Sire, Pasture, Birth Weight, Reg No, Brand, Status, Notes. Dams and sires are matched by tag.</p>
     <p><label class="btn primary">Import animals from CSV…<input type="file" accept=".csv,text/csv" style="display:none" onchange="importAnimals(this.files[0])"></label> <button class="btn" onclick="exportAnimals(DB.animals)">Export all animals</button></p>`)}
   </div><div style="height:16px"></div>
   ${card('Pick lists', `<p class="muted small">One per line. These fill the drop-downs; you can always type something else.</p><div class="grid3">
     ${[['breeds', 'Breeds'], ['colors', 'Colors / markings'], ['routes', 'Treatment routes'], ['sites', 'Injection sites'], ['incomeCats', 'Income categories'], ['expenseCats', 'Expense categories']].map(([k, l]) => `<div class="fld"><label>${l}</label><textarea id="s_${k}" rows="8">${esc(s[k].join('\n'))}</textarea></div>`).join('')}</div>
     <p><button class="btn primary" onclick="saveSettings()">Save lists</button></p>`)}`));
  drawPeople();
};
// ---------------- farms on this device + the people on a farm
const farmLabel = f => f.name || (f.db === Farms.BASE ? 'My herd' : 'Farm');
function farmWhose(f) { return !f.folder || f.role === 'owner' ? (f.folder ? 'Yours · shared with others' : 'Yours') : (f.role === 'reader' ? 'View only' : 'You can record') + (f.owner ? ' · ' + f.owner + '’s farm' : ''); }
function farmMenu() {
  const l = Farms.get(), cur = Farms.cur();
  document.body.classList.remove('navopen');
  modal(`<h2>Farms</h2><p class="muted small">Tap a farm to work on it. Each farm keeps its own herd, money and records.</p>
   <div class="farms">${l.map(f => `<div class="farm${f.db === cur.db ? ' on' : ''}"><button type="button" class="fbtn" onclick="pickFarm('${f.db}')"><b>${esc(farmLabel(f))}</b><small>${esc(farmWhose(f))}</small>${f.db === cur.db ? '<span class="chip blue">open</span>' : ''}</button>${f.db !== Farms.BASE ? `<button class="btn link sm" onclick="leaveFarmUI('${f.db}')">remove from this ${isPhone() ? 'phone' : 'device'}</button>` : ''}</div>`).join('')}</div>
   <p><button class="btn primary" onclick="joinFarmUI()">+ Join a farm shared with me</button></p>
   <p class="muted small">The farm’s owner invites your Gmail first, from their Settings → People on this farm.</p>
   <div class="mfoot"><span class="sp"></span><button class="btn" onclick="closeModal()">Close</button></div>`);
}
async function pickFarm(db) {
  closeModal(); if (db === Farms.cur().db) return;
  if (UI.busy && !confirm('Leave what you were doing without saving?')) return;
  try { await Sync.switchFarm(db); UI.ch = null; UI.wd = null; SEL.clear(); location.hash = '#/'; refresh(); toast('Now on ' + farmLabel(Farms.cur())); } catch (e) { alert('Could not switch: ' + e.message); }
}
async function joinFarmUI() {
  if (!Sync.st.account) { closeModal(); location.hash = '#/settings'; return alert('Sign in with Google first — with the Gmail address the farm owner invited.'); }
  try { const fo = await Sync.joinFarm(); closeModal(); if (fo && fo.none) return alert('No farm shared with you was found.\n\nWhat HerdBook can see:\n\n' + fo.report + '\n\nSend this to whoever set up HerdBook.'); if (!fo) return alert('No new farm shared with ' + (Sync.st.account.email || 'you') + ' was found.\n\n1. Check the farm owner’s Settings → People on this farm lists exactly this Gmail. If not, they need to type it and tap Send invite.\n2. Farms already on this phone aren’t listed again — tap the farm name at the top to see them.'); location.hash = '#/'; refresh(); toast('Joined ' + farmLabel(Farms.cur())); }
  catch (e) { alert('Could not join the farm: ' + e.message); }
}
async function leaveFarmUI(db) {
  const f = Farms.get().find(x => x.db === db);
  if (!confirm(`Take “${farmLabel(f)}” off this ${isPhone() ? 'phone' : 'device'}?\n\nIts records stay safe with the owner. You can join it again any time they still share it.`)) return;
  try { await Sync.leaveFarm(db); closeModal(); refresh(); toast('Removed from this device'); } catch (e) { alert(e.message); }
}
Sync.setChooser(list => new Promise(res => {
  const m = modal(`<h2>Which farm?</h2><div class="farms">${list.map((f, i) => `<div class="farm"><button type="button" class="fbtn" data-i="${i}"><b>${esc(f.name.replace(/^HerdBook – /, ''))}</b><small>${esc(f.owners && f.owners[0] ? 'from ' + (f.owners[0].displayName || f.owners[0].emailAddress) : '')}</small></button></div>`).join('')}</div><div class="mfoot"><span class="sp"></span><button class="btn" id="ch_cancel">Cancel</button></div>`);
  m.onclick = e => { const b = e.target.closest('.fbtn'); if (b) res(list[+b.dataset.i].id); else if (e.target.id === 'ch_cancel') res(null); };
}));
function peopleCard() {
  const s = Sync.st, f = Farms.cur();
  if (!s.account) return '<p>Sign in with Google first. Then you can invite your wife, family or hired help to record on this farm from their own phone, with their own Gmail.</p>';
  if (f.folder && f.role !== 'owner') return `<p>This is <b>${esc(f.owner || 'someone else')}</b>’s farm. ${f.role === 'reader' ? 'You can look but not change anything.' : 'You can record on it.'} Only the owner can invite or remove people.</p><div id="ppl"></div>`;
  return `<p>Let your wife, family or hired help record on this farm from their own phone with their own Gmail. You stay in charge — you can change what they can do, or remove them, any time.</p>
   <div id="ppl">${f.folder ? '<p class="muted">Loading…</p>' : '<p><b>Right now only you use this farm.</b></p>'}</div>
   <div class="grid2"><div class="fld"><label>Their Gmail address</label><input id="inv_e" type="email" autocomplete="off" autocapitalize="off" placeholder="name@gmail.com"></div><div class="fld"><label>They can</label>${segHtml('inv_r', 'role', [['writer', 'Record'], ['reader', 'Only look']], 'writer')}</div></div>
   <p><button class="btn primary" onclick="doInvite()">Send invite</button></p>
   <p class="muted small">${f.folder ? '' : `The first invite moves this herd into a folder called “HerdBook – ${esc(S().farmName)}” in your Google Drive, so it can be shared. Don’t delete or move that folder. `}Google emails them the invite with the steps. While HerdBook is a private app, their Gmail also has to be on the test-users list in Google Cloud (see SETUP GUIDE).</p>`;
}
async function drawPeople() {
  const el = $('#ppl'), f = Farms.cur(); if (!el || !f.folder || !Sync.st.account) return;
  try {
    const l = (await Sync.people()).filter(p => p.type === 'user'), owner = f.role === 'owner';
    const me = (Sync.st.account.email || '').toLowerCase();
    el.innerHTML = table([{ h: 'Person', f: p => `<b>${esc(p.displayName || p.emailAddress)}</b>${(p.emailAddress || '').toLowerCase() === me ? ' <span class="chip">you</span>' : ''}<div class="muted small">${esc(p.emailAddress || '')}</div>` },
      { h: 'Can', f: p => p.role === 'owner' ? '<span class="chip green">Owner</span>' : owner ? `<select onchange="changeRole('${p.id}',this.value)">${opts([['writer', 'Record'], ['reader', 'Only look']], p.role === 'reader' ? 'reader' : 'writer', false)}</select>` : (p.role === 'reader' ? 'Only look' : 'Record') },
      { h: '', f: p => owner && p.role !== 'owner' ? `<button class="btn sm" onclick="removePerson('${p.id}','${esc(p.emailAddress || '').replace(/'/g, '')}')">Remove</button>` : '' }], l, { empty: 'Nobody yet.' });
  } catch (e) { el.innerHTML = `<p class="err">${esc(e.needSignIn ? 'Tap “Sync now” above to see who is on this farm.' : e.message)}</p>`; }
}
async function doInvite() {
  const e = $('#inv_e').value.trim(), r = $('#inv_r').value || 'writer';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return alert('Type their whole Gmail address, like name@gmail.com.');
  if (e.toLowerCase() === (Sync.st.account.email || '').toLowerCase()) return alert('That’s your own address.');
  const first = !Farms.cur().folder;
  if (first && !confirm(`To share, HerdBook moves this herd into a folder called “HerdBook – ${S().farmName}” in your Google Drive. Your other phones and computers follow it on their own.\n\nGo ahead and invite ${e}?`)) return;
  try { await Sync.invite(e, r, S().farmName); toast('Invite sent to ' + e); ROUTES.settings(); } catch (x) { alert('Could not send the invite: ' + x.message); }
}
async function changeRole(pid, r) { try { await Sync.setRole(pid, r); toast(r === 'reader' ? 'Now: only look' : 'Now: can record'); } catch (e) { alert(e.message); drawPeople(); } }
async function removePerson(pid, email) {
  if (!confirm(`Remove ${email} from this farm?\n\nThey won’t be able to see or change it any more.`)) return;
  try { await Sync.remove(pid); toast('Removed ' + email); drawPeople(); } catch (e) { alert(e.message); }
}
function syncCard() {
  const s = Sync.st, [cls, txt] = syncLabel(), det = (l, v) => `<div><span>${l}</span><b>${v}</b></div>`;
  if (!s.account) return `<p>Right now this herd is <b>only on this device</b>. Sign in with your Google account and HerdBook:</p>
    <ul><li>keeps your phone and computer on the same herd — record at the chute, see it at the house;</li><li>backs up every day into your own Google account (a hidden HerdBook folder only HerdBook can open — it can’t see your other files);</li><li>still works with no signal and catches up when it gets one.</li></ul>
    <p><button class="btn primary" onclick="doSignIn()">Sign in with Google</button></p>
    <p class="muted small">Use the same Google account on every phone and computer for this herd. Each family uses its own Google account, so nobody sees anyone else’s herd.</p>`;
  return `<p><span class="chip ${cls === 'ok' ? 'green' : cls === 'bad' ? 'red' : cls === 'busy' ? 'blue' : 'amber'}">${esc(txt)}</span></p>
    <div class="dl" style="margin:10px 0">${det('Google account', esc(s.account.email))}${det('Last synced', s.last ? new Date(s.last).toLocaleString() : 'not yet')}${det('Waiting to sync', plural(s.pending, 'change'))}${det('HerdBook version', esc(APP_VERSION) + (CHANNEL === 'test' ? ' (test copy)' : ''))}</div>
    ${s.state === 'error' ? `<p class="err">${esc(s.msg)}</p>` : ''}
    <p><button class="btn primary" onclick="tapSync().then(()=>ROUTES.settings())">Sync now</button> <button class="btn" onclick="doSignOut()">Sign out of this device</button></p>
    <p class="muted small">HerdBook syncs by itself when it has signal. Google asks you to tap “Sync” about once an hour of use, to confirm it’s still you.</p>`;
}
async function doSignIn() {
  try { if (await Sync.signIn()) { await load(); refresh(); toast('Signed in — your herd is backed up'); } }
  catch (e) { alert('Sign-in did not work: ' + e.message); ROUTES.settings(); }
}
async function doSignOut() { if (await Sync.signOut()) { await load(); location.hash = '#/'; refresh(); } }
let INSTALL_EVT = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); INSTALL_EVT = e; if (route().r === 'settings') ROUTES.settings(); });
function installCard() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return '<p><span class="chip green">Installed</span> HerdBook is on this device and works without signal.</p>';
  const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (INSTALL_EVT) return '<p>Put HerdBook on this device like an app — its own icon, its own window, works with no signal.</p><p><button class="btn primary" onclick="INSTALL_EVT.prompt();INSTALL_EVT.userChoice.then(()=>{INSTALL_EVT=null;ROUTES.settings()})">Install HerdBook</button></p>';
  if (ios) return `<p>On iPhone or iPad, this must be done in <b>Safari</b>:</p><ol><li>Tap the <b>Share</b> button (square with an arrow) at the bottom.</li><li>Scroll down, tap <b>Add to Home Screen</b>, then <b>Add</b>.</li><li>From now on open HerdBook from that icon.</li></ol><p class="muted small">Always use the home-screen icon on iPhone — Apple can clear a website’s saved records if the site isn’t on the home screen and isn’t opened for a few weeks.</p>`;
  if (/Android/.test(ua)) return '<p>In Chrome, tap the <b>⋮</b> menu (top right) → <b>Add to Home screen</b> (or <b>Install app</b>).</p>';
  return '<p>In Chrome or Edge, click the <b>install</b> icon at the right end of the address bar (a screen with a down arrow), or the <b>⋮ / …</b> menu → <b>Install HerdBook</b> / <b>Apps → Install this site as an app</b>. It gets a desktop icon and its own window.</p>';
}
function allRecords() { const o = {}; COLLS.forEach(c => o[c] = DB[c]); return o; }
function downloadBackup() {
  download('HerdBook backup ' + S().farmName.replace(/[\\/:*?"<>|]/g, '') + ' ' + today() + '.json', JSON.stringify(Object.assign({ format: 'herdbook-backup', app: APP_VERSION, exported: new Date().toISOString() }, allRecords())), 'application/json');
}
// replace every record with what is in a backup; written as new changes so it spreads to every device
async function replaceAll(colls) {
  const ops = [], keep = new Set();
  for (const c of COLLS) for (const d of colls[c] || []) if (d && d.id) { keep.add(c + '/' + d.id); ops.push({ coll: c, data: d }); }
  for (const c of COLLS) for (const d of DB[c]) if (!keep.has(c + '/' + d.id)) ops.push({ coll: c, del: d.id });
  for (let i = 0; i < ops.length; i += 1000) await saveMany(ops.slice(i, i + 1000));
}
// backup files come as {animals:[...],...} (downloaded / old HerdBook) or {docs:{'coll/id':{d}}} (Google copies)
function backupColls(data) {
  if (data && data.docs && !Array.isArray(data.docs)) { const o = {}; COLLS.forEach(c => o[c] = []); for (const [k, v] of Object.entries(data.docs)) { const c = k.slice(0, k.indexOf('/')); if (o[c] && !v.x && v.d) o[c].push(v.d); } return o; }
  return data;
}
async function showDriveBackups() {
  let list; try { list = await Sync.listBackups(); } catch (e) { return alert('Could not get the backups from Google: ' + e.message); }
  const label = n => { const m = n.match(/backup-(\d{4}-\d\d-\d\d)\.json$/); if (m) return 'Start of ' + fmtD(m[1]); const v = n.match(/before-v(.+)\.json$/); if (v) return 'Just before HerdBook update ' + v[1]; const r = n.match(/before-restore-(\d{4}-\d\d-\d\d)/); return r ? 'Just before a restore on ' + fmtD(r[1]) : n; };
  modal(`<h2>Restore an earlier day</h2><p>Pick a day to put the whole herd back the way it was then. Changes made after that day are lost (a copy of today is kept first, so this can be undone the same way).</p>
   ${list.length ? `<div class="tscroll" style="max-height:50vh">${table([{ h: 'Copy', f: f => esc(label(f.name)) }, { h: 'Saved', f: f => f.modifiedTime ? new Date(f.modifiedTime).toLocaleString() : '' }, { h: '', f: f => `<button class="btn sm" onclick="restoreDrive('${esc(f.id)}','${esc(label(f.name)).replace(/'/g, '')}')">Restore</button>` }], list)}</div>` : empty('No copies yet — HerdBook makes the first one the next time it syncs.')}
   <div class="mfoot"><span class="sp"></span><button class="btn" onclick="closeModal()">Close</button></div>`, { wide: true });
}
async function restoreDrive(id, label) {
  try {
    const colls = backupColls(await Sync.readBackup(id)), n = (colls.animals || []).length;
    if (!confirm(`Put the whole herd back to ${label} (${plural(n, 'animal')})?\n\nThis changes it on every phone and computer signed in to this herd.`)) return;
    await Sync.backupBeforeRestore(); await replaceAll(colls); closeModal(); refresh(); await Sync.run(true); toast('Herd restored to ' + label);
  } catch (e) { alert('Restore failed: ' + e.message); }
}
async function saveSettings() {
  const s = S(), v = Object.assign({}, s, { farmName: $('#s_name').value.trim() || 'My Herd', gestation: parseInt($('#s_g').value) || 283, defaultBW: parseFloat($('#s_bw').value) || 75 });
  for (const k of ['breeds', 'colors', 'routes', 'sites', 'incomeCats', 'expenseCats']) v[k] = $('#s_' + k).value.split('\n').map(x => x.trim()).filter(Boolean);
  await put1('settings', v); Farms.upd(Store.name(), { name: v.farmName }); Sync.renameFolder(v.farmName); refresh(); toast('Settings saved');
}
function exportAnimals(list) {
  const rows = list.map(a => { const lw = lastW(a), x = adj205(a); return [a.tag, a.name, a.eid, a.sex === 'F' ? 'Female' : a.sex === 'M' ? 'Bull' : a.sex === 'S' ? 'Steer' : '', typeOf(a), a.birthDate, a.breed, a.color, damText(a), sireText(a), pastureName(a.pastureId), a.status || 'Active', a.birthWeight, a.calvingEase, x ? x.ww : '', x ? x.adj : '', lw ? lw.weight : '', lw ? lw.date : '', a.regNo, a.brand, a.horn, a.purchaseDate, a.purchasePrice, a.saleDate, a.salePrice, a.buyer, a.deathDate, a.deathCause, a.notes]; });
  download('HerdBook animals ' + today() + '.csv', toCSV([['Tag', 'Name', 'EID', 'Sex', 'Kind', 'Birth Date', 'Breed', 'Color', 'Dam', 'Sire', 'Pasture', 'Status', 'Birth Weight', 'Calving Ease', 'Weaning Weight', 'Adj 205', 'Last Weight', 'Last Weight Date', 'Reg No', 'Brand', 'Horns', 'Purchase Date', 'Purchase Price', 'Sale Date', 'Sale Price', 'Buyer', 'Death Date', 'Death Cause', 'Notes'], ...rows]));
}
const COLMAP = {
  tag: ['tag', 'tagno', 'tagnumber', 'eartag', 'visualtag', 'visualid', 'id', 'number', 'cow', 'animal'], name: ['name'], eid: ['eid', 'electronicid', 'rfid', 'eidtag'], regNo: ['reg', 'regno', 'registration', 'registrationnumber', 'regnumber'],
  sex: ['sex', 'gender', 'type', 'kind', 'class'], birthDate: ['birthdate', 'dob', 'born', 'birthday', 'dateofbirth', 'birth'], breed: ['breed'], color: ['color', 'colour', 'markings'],
  dam: ['dam', 'damtag', 'mother', 'dameartag'], sire: ['sire', 'siretag', 'father', 'bull', 'sirename'], pasture: ['pasture', 'location', 'field', 'pen'], status: ['status'],
  birthWeight: ['birthweight', 'bw', 'birthwt'], brand: ['brand', 'tattoo'], horn: ['horn', 'horns', 'hornstatus'], notes: ['notes', 'note', 'comments', 'comment'],
  purchaseDate: ['purchasedate', 'boughtdate', 'datepurchased'], purchasePrice: ['purchaseprice', 'price', 'cost']
};
async function importAnimals(file) {
  if (!file) return;
  const rows = parseCSV(await file.text()); if (rows.length < 2) return alert('That file has no rows.');
  const head = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '')), map = {};
  for (const [k, names] of Object.entries(COLMAP)) { const i = head.findIndex(h => names.includes(h)); if (i >= 0 && !Object.values(map).includes(i)) map[k] = i; }
  if (map.tag == null && map.name == null) return alert('HerdBook could not find a Tag or Name column. The first row must be column headings.');
  const data = rows.slice(1).map(r => { const o = {}; for (const [k, i] of Object.entries(map)) o[k] = (r[i] || '').trim(); return o; }).filter(o => o.tag || o.name);
  const existing = new Set(DB.animals.filter(isActive).map(a => (a.tag || '').toLowerCase()).filter(Boolean));
  const dups = data.filter(o => o.tag && existing.has(o.tag.toLowerCase())).length;
  const unmatched = rows[0].filter((h, i) => !Object.values(map).includes(i) && h.trim());
  const m = modal(`<h2>Import ${plural(data.length, 'animal')}</h2>
   <p>Columns used: ${Object.keys(map).map(k => `<span class="chip blue">${esc(rows[0][map[k]])} → ${k}</span>`).join(' ')}</p>
   ${unmatched.length ? `<p class="muted small">Not used: ${unmatched.map(esc).join(', ')}</p>` : ''}
   ${dups ? `<p><label class="chk"><input type="checkbox" id="im_skip" checked> Skip ${plural(dups, 'row')} whose tag is already on an active animal</label></p>` : ''}
   <div class="tscroll" style="max-height:40vh">${table(Object.keys(map).map(k => ({ h: k, f: o => esc(o[k]) })), data.slice(0, 8))}</div>${data.length > 8 ? `<p class="muted small">…and ${data.length - 8} more</p>` : ''}
   <div class="err" id="im_e"></div><div class="mfoot"><span class="sp"></span><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" id="im_go">Import</button></div>`, { wide: true });
  m.querySelector('#im_go').onclick = async () => {
    const skip = $('#im_skip') && $('#im_skip').checked, ops = [], made = [], pastures = {};
    DB.pastures.forEach(p => pastures[p.name.toLowerCase()] = p.id);
    for (const o of data) {
      if (skip && o.tag && existing.has(o.tag.toLowerCase())) continue;
      const sx = (o.sex || '').toLowerCase();
      const a = { id: uid(), tag: o.tag || null, name: o.name || null, eid: o.eid || null, regNo: o.regNo || null, breed: o.breed || null, color: o.color || null, brand: o.brand || null, horn: o.horn || null, notes: o.notes || null,
        sex: /^(f|female|cow|heifer|h|hfr)/.test(sx) ? 'F' : /^(s|steer)/.test(sx) ? 'S' : /^(m|male|bull|b)/.test(sx) ? 'M' : 'F',
        calvedBefore: /^cow/.test(sx) || undefined, birthDate: parseAnyDate(o.birthDate), birthWeight: parseFloat(o.birthWeight) || null,
        purchaseDate: parseAnyDate(o.purchaseDate), purchasePrice: parseFloat((o.purchasePrice || '').replace(/[$,]/g, '')) || null,
        status: ['sold', 'dead', 'reference'].includes((o.status || '').toLowerCase()) ? o.status[0].toUpperCase() + o.status.slice(1).toLowerCase() : 'Active', _dam: o.dam, _sire: o.sire };
      if (o.pasture) { const k = o.pasture.toLowerCase(); if (!pastures[k]) { const p = { id: uid(), name: o.pasture }; pastures[k] = p.id; ops.push({ coll: 'pastures', data: p }); } a.pastureId = pastures[k]; }
      made.push(a);
    }
    const byTag = t => { const l = (t || '').trim().toLowerCase(); if (!l) return null; return made.find(x => (x.tag || '').toLowerCase() === l || (x.name || '').toLowerCase() === l) || findAnimal(t); };
    for (const a of made) {
      const d = byTag(a._dam), s = byTag(a._sire);
      if (a._dam) { if (d && d.sex === 'F' && d.id !== a.id) a.damId = d.id; else a.damName = a._dam; }
      if (a._sire) { if (s && s.sex !== 'F' && s.id !== a.id) a.sireId = s.id; else a.sireName = a._sire; }
      delete a._dam; delete a._sire; ops.push({ coll: 'animals', data: a });
    }
    try { for (let i = 0; i < ops.length; i += 500) await saveMany(ops.slice(i, i + 500)); closeModal(); location.hash = '#/animals'; refresh(); toast(plural(made.length, 'animal') + ' imported'); }
    catch (e) { $('#im_e').textContent = 'Import failed: ' + e.message; }
  };
}
async function restoreBackup(file) {
  if (!file) return;
  let data; try { data = JSON.parse(await file.text()); } catch { return alert('That isn’t a HerdBook backup file.'); }
  const colls = backupColls(data);
  if (!colls || !COLLS.some(c => Array.isArray(colls[c]) && colls[c].length)) return alert('That file has no HerdBook records in it.');
  const n = (colls.animals || []).length;
  if (!confirm(`Replace everything in HerdBook with this backup (${plural(n, 'animal')})?` + (Sync.st.account ? '\n\nThis changes it on every phone and computer signed in to this herd. A copy of the herd as it is now is kept in Google first.' : ''))) return;
  try {
    if (Sync.st.account) { try { await Sync.backupBeforeRestore(); } catch (e) { if (!confirm('HerdBook could not save a copy to Google first (' + e.message + '). Restore anyway?')) return; } }
    await replaceAll(colls); refresh(); toast('Backup restored');
  } catch (e) { alert('Restore failed: ' + e.message); }
}

// ---------------------------------------------------------------- start
function startServiceWorker() {
  if (!('serviceWorker' in navigator) || HB.noServiceWorker) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloading) { reloading = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js').then(reg => {
    // a new version downloaded last time: switch to it now, before any work is started
    if (reg.waiting && hadController) reg.waiting.postMessage('skip');
    else reg.update().catch(() => { });      // look for a newer HerdBook every time it opens
    reg.addEventListener('updatefound', () => {
      const w = reg.installing; if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && hadController && navigator.serviceWorker.controller && !$('.updbar')) {
          const b = document.createElement('div'); b.className = 'updbar';
          b.innerHTML = 'A new version of HerdBook is ready. <button class="btn sm" id="upd_go">Use it now</button> <button class="btn link sm" onclick="this.parentNode.remove()" aria-label="Later">Later</button>';
          document.body.appendChild(b); b.querySelector('#upd_go').onclick = () => { if (!$('#modal-root').innerHTML || confirm('Close the form you have open?')) w.postMessage('skip'); };
        }
      });
    });
    setInterval(() => reg.update().catch(() => { }), 60 * 60 * 1000);
  }).catch(() => { });
}
// started at the end of work.js, once every part of HerdBook is loaded
async function start() {
  startServiceWorker();
  try {
    await load();
    await Sync.init({
      onState: () => { renderSync(); const sc = $('#synccard'); if (sc && route().r === 'settings') sc.innerHTML = '<h2>Sync and sign-in</h2>' + syncCard(); },
      onRemote: async () => { await load(); if ($('#modal-root').innerHTML || UI.busy) UI.stale = true; else refresh(); }
    });
    refresh();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
    const lv = await Store.getMeta('lastVersion');
    if (lv && lv !== APP_VERSION) toast('HerdBook was updated to version ' + APP_VERSION);
    if (lv !== APP_VERSION) await Store.setMeta('lastVersion', APP_VERSION);
  } catch (e) {
    main(`<div class="card" style="margin:40px auto;max-width:520px"><h2>HerdBook could not open its records</h2><p>This browser would not let HerdBook use its storage on this device. In a private / incognito window that can happen — open HerdBook normally, or from its icon.</p><p class="muted small">${esc(e.message)}</p><button class="btn primary" onclick="location.reload()">Try again</button></div>`);
  }
}
