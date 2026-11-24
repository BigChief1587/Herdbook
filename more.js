'use strict';
/* HerdBook - family tree (any animal: ancestors up, calves and grandcalves down) and tasks with real reminders.
   Reminders: a task with a time goes into the person's own Google Calendar, which alerts on their phone even when
   HerdBook is closed (a web app can't wake a closed phone on its own without a paid server). While HerdBook is open
   it also pops up its own alert. Loaded last; starts HerdBook at the bottom. */

// ================================================================ FAMILY TREE
const famSub = x => [typeOf(x), x.birthDate ? 'born ' + x.birthDate.slice(0, 4) : '', x.breed, x.regNo ? 'reg ' + x.regNo : ''].filter(Boolean).join(' · ');
function famLink(id, name, role) {
  const x = id && AN(id);
  const st = x && !isActive(x) ? ` <span class="chip ${x.status === 'Dead' ? 'red' : ''}">${esc(x.status)}</span>` : '';
  const r = role ? `<em>${esc(role)}</em>` : '';
  if (x) return `<a class="fn" href="#/animal/${x.id}">${r}<b>${esc(keyOf(x))}${x.name && x.name !== x.tag ? ' <span class="muted">' + esc(x.name) + '</span>' : ''}</b>${st}<small>${esc(famSub(x))}</small></a>`;
  if (name) return `<span class="fn none">${r}<b>${esc(name)}</b><small>not in the herd</small></span>`;
  return `<span class="fn unk">${r}<b>unknown</b></span>`;
}
// up: parents, grandparents, great-grandparents
function famUp(x, depth, prefix) {
  if (!x || depth <= 0) return '';
  const role = p => prefix ? prefix + '’s ' + p.toLowerCase() : p;
  const one = (id, name, p) => `<li>${famLink(id, name, role(p))}${famUp(id && AN(id), depth - 1, role(p))}</li>`;
  return `<ul>${one(x.sireId, x.sireName, 'Sire')}${one(x.damId, x.damName, 'Dam')}</ul>`;
}
// down: calves, grandcalves... (a cow's calves, or every calf a bull sired)
const kidsOf = x => (x.sex === 'F' ? CHILD[x.id] : PROG[x.id]) || [];
function famCount(x, depth) { if (depth <= 0) return 0; let n = 0; for (const k of kidsOf(x)) n += 1 + famCount(k, depth - 1); return n; }
function famDown(x, depth, level = 1) {
  const kids = kidsOf(x).slice().sort((p, q) => (p.birthDate || '').localeCompare(q.birthDate || ''));
  if (!kids.length || depth <= 0) return '';
  const other = k => x.sex === 'F' ? (sireText(k) ? 'by ' + sireText(k) : '') : (damText(k) ? 'out of ' + damText(k) : '');
  const word = level === 1 ? 'Calf' : level === 2 ? 'Grandcalf' : 'Great-grandcalf';
  return `<ul>${kids.map(k => { const sub = depth > 1 ? famDown(k, depth - 1, level + 1) : '', n = kidsOf(k).length;
    return `<li>${sub ? `<details${level === 1 && kids.length <= 12 ? ' open' : ''}><summary>` : ''}${famLink(k.id, null, word + (other(k) ? ' · ' + other(k) : ''))}${sub ? `<span class="fcount">${plural(n, 'calf', 'calves')}</span></summary>${sub}</details>` : ''}</li>`; }).join('')}</ul>`;
}
function famSibs(x) {
  const out = [];
  const full = [], half = [];
  for (const s of (x.damId && CHILD[x.damId]) || []) if (s.id !== x.id) (x.sireId && s.sireId === x.sireId ? full : half).push([s, 'same dam']);
  for (const s of (x.sireId && PROG[x.sireId]) || []) if (s.id !== x.id && s.damId !== x.damId) half.push([s, 'same sire']);
  if (full.length) out.push(`<h3>Full brothers &amp; sisters (${full.length})</h3><ul class="flat">${full.map(([s]) => `<li>${famLink(s.id)}</li>`).join('')}</ul>`);
  if (half.length) out.push(`<h3>Half brothers &amp; sisters (${half.length})</h3><ul class="flat">${half.slice(0, 40).map(([s, w]) => `<li>${famLink(s.id, null, w)}</li>`).join('')}${half.length > 40 ? `<li class="muted small">…and ${half.length - 40} more</li>` : ''}</ul>`);
  return out.join('');
}
function familyTree(x) {
  const nDown = famCount(x, 4), kids = kidsOf(x).length;
  const photo = (x.photos || [])[0];
  return `<section class="card ftree"><div class="fme">${photo ? `<img data-pid="${photo}" alt="">` : ''}<div><div class="ctag">${esc(keyOf(x))}${x.name && x.name !== x.tag ? ' <span>' + esc(x.name) + '</span>' : ''}</div><div class="muted">${esc([typeOf(x), ageStr(x) ? ageStr(x) + ' old' : '', x.breed, isActive(x) ? '' : x.status].filter(Boolean).join(' · '))}</div>
     <p><a class="btn sm" href="#/animal/${x.id}">Open ${esc(keyOf(x))}’s page</a> <button class="btn sm noprint" onclick="window.print()">Print</button></p></div></div>
    <h2>Up — parents &amp; grandparents</h2><div class="tree up">${famUp(x, 3, '')}</div>
    <h2>Down — ${kids ? plural(kids, 'calf', 'calves') + (nDown > kids ? ', ' + plural(nDown - kids, 'more descendant') : '') : 'no calves recorded'}</h2>${kids ? `<div class="tree down">${famDown(x, 4)}</div>` : ''}
    ${famSibs(x)}
    <p class="muted small">Tap any animal to open its page. Parents come from each animal’s Edit screen; animals you never owned (AI sires, a bought cow’s mother) show as names.</p></section>`;
}
ROUTES.family = function (id) {
  const x = id && AN(id);
  main(page('Family tree', '', `<div class="card"><div class="fld"><label for="ft_q">Any animal — tag, name or EID</label>${comboHtml('ft_q', 'ftq', x ? keyOf(x) : '', 'Type a tag or name, or tap ▾', () => animalItems(), 'big')}</div><div class="err" id="ft_e"></div></div>`
    + (x ? familyTree(x) : empty('Pick an animal to see its parents and grandparents, and its calves and grandcalves.'))));
  const inp = $('#ft_q');
  const go = () => { const t = inp.value.trim(); if (!t) return; const y = findAnimal(t) || DB.animals.find(a => (a.name || '').toLowerCase() === t.toLowerCase());
    if (!y) { $('#ft_e').textContent = 'No animal “' + t + '” in the herd.'; return; } if (y.id !== id) location.hash = '#/family/' + y.id; };
  inp.addEventListener('change', go);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !(CB && CB.hi >= 0)) { e.preventDefault(); go(); } });
  if (!x && !isPhone()) inp.focus();
};

// ================================================================ TASKS
const TASK_CATS = ['Cattle', 'Health', 'Breeding & calving', 'Feed & hay', 'Fence & water', 'Equipment', 'Pasture', 'Money', 'Other'];
const REPEATS = [['', 'Once'], ['daily', 'Every day'], ['weekly', 'Every week'], ['monthly', 'Every month'], ['yearly', 'Every year']];
const REMINDS = [['0', 'At the time'], ['15', '15 min before'], ['60', '1 hour before'], ['1440', '1 day before'], ['none', 'No reminder']];
const taskTime = t => t.time || '08:00';                       // just a date = 8:00 in the morning
const dueAt = t => t.date ? new Date(t.date + 'T' + taskTime(t)).getTime() : null;
const remindAt = t => t.remind === 'none' || !t.date ? null : dueAt(t) - (+t.remind || 0) * 60000;
const fmtTime = hm => { const [h, m] = (hm || '08:00').split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
function nextDate(d, rep) {
  const x = parseD(d);
  if (rep === 'daily') x.setDate(x.getDate() + 1);
  else if (rep === 'weekly') x.setDate(x.getDate() + 7);
  else if (rep === 'monthly') { const day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + 1); x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); }
  else if (rep === 'yearly') x.setFullYear(x.getFullYear() + 1);
  return iso(x);
}
const me = () => Sync.st.account ? Sync.st.account.email : null;
const myName = () => Sync.st.account ? (Sync.st.account.name || Sync.st.account.email.split('@')[0]) : '';
const taskAnimals = t => [...(t.animalIds || []), ...(t.animalId ? [t.animalId] : [])].filter((v, i, l) => v && l.indexOf(v) === i);
function whenText(t) {
  if (!t.date) return 'no date';
  const d = t.date === today() ? 'Today' : t.date === addDays(today(), 1) ? 'Tomorrow' : t.date === addDays(today(), -1) ? 'Yesterday' : fmtD(t.date).replace(', ' + thisYear(), '');
  return d + ' · ' + fmtTime(taskTime(t));
}

// ---- Google Calendar: each person's own reminders
const Cal = (() => {
  const on = () => !!(Sync.st.account && Auth.wantsCal());
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'America/Chicago'; } })();
  const local = ms => { const d = new Date(ms); return iso(d) + 'T' + z2(d.getHours()) + ':' + z2(d.getMinutes()) + ':00'; };
  function body(t) {
    const an = taskAnimals(t).map(id => AN(id)).filter(Boolean).map(keyOf);
    return {
      summary: '🐄 ' + t.title,
      description: [an.length ? 'Animals: ' + an.join(', ') : '', t.pastureId ? 'Pasture: ' + pastureName(t.pastureId) : '', t.who ? 'For: ' + t.who : '', t.note || '', 'From HerdBook — ' + S().farmName].filter(Boolean).join('\n'),
      start: { dateTime: local(dueAt(t)), timeZone: tz }, end: { dateTime: local(dueAt(t) + 30 * 60000), timeZone: tz },
      reminders: { useDefault: false, overrides: t.remind === 'none' ? [] : [{ method: 'popup', minutes: +t.remind || 0 }] },
      extendedProperties: { private: { herdbook: t.id } }
    };
  }
  const wantsMine = t => !t.done && t.date && t.remind !== 'none' && (t.remindWho || []).includes(me());
  // bring this person's calendar event in line with the task; returns the task's new cal map
  async function put(t) {
    const m = me(), cal = Object.assign({}, t.cal || {}), ev = cal[m];
    if (!wantsMine(t)) { if (ev) { try { await Drive.req('/calendar/v3/calendars/primary/events/' + ev, { method: 'DELETE' }); } catch (e) { if (e.status !== 404 && e.status !== 410) throw e; } delete cal[m]; } return cal; }
    if (ev) { try { await Drive.J('/calendar/v3/calendars/primary/events/' + ev, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body(t)) }); return cal; } catch (e) { if (e.status !== 404 && e.status !== 410) throw e; } }
    const r = await Drive.J('/calendar/v3/calendars/primary/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body(t)) });
    cal[m] = r.id; return cal;
  }
  // save the task and update this person's calendar; with no signal it is caught up later
  async function save(t, extraOps = []) {
    if (on()) { try { if (Auth.valid()) { t.cal = await put(t); delete (t.calLater || {})[me()]; } else throw new Error('later'); } catch { t.calLater = Object.assign({}, t.calLater, { [me()]: 1 }); } }
    await saveMany([{ coll: 'tasks', data: t }, ...extraOps]);
  }
  // catch up: tasks changed while offline, or changed by someone else on a shared farm
  let busy = false;
  async function sweep() {
    if (!on() || busy || !navigator.onLine || !Auth.valid()) return; busy = true;
    try {
      const m = me(), ops = [];
      for (const t of DB.tasks) {
        const has = !!(t.cal || {})[m], want = wantsMine(t), stamp = (t.calSeen || {})[m], sig = [t.title, t.date, t.time, t.remind, t.done, t.note].join('|');
        if ((t.calLater || {})[m] || want !== has || (want && stamp !== sig)) {
          const n = Object.assign({}, t); n.cal = await put(n); n.calLater = Object.assign({}, n.calLater); delete n.calLater[m];
          n.calSeen = Object.assign({}, n.calSeen, { [m]: sig }); ops.push({ coll: 'tasks', data: n });
        }
      }
      if (ops.length) await saveMany(ops);
    } catch { } finally { busy = false; }
  }
  async function turnOn() {
    await Auth.get(true, me(), 'cal');
    const ops = []; for (const t of DB.tasks) if (!t.done && t.date && dueAt(t) > Date.now() - 864e5) ops.push({ coll: 'tasks', data: Object.assign({}, t, { remindWho: [...new Set([...(t.remindWho || []), me()])] }) });
    if (ops.length) await saveMany(ops);
    await sweep();
  }
  async function turnOff() {
    const ops = []; for (const t of DB.tasks) if ((t.cal || {})[me()] || (t.remindWho || []).includes(me())) { const n = Object.assign({}, t, { remindWho: (t.remindWho || []).filter(x => x !== me()) }); try { n.cal = await put(n); } catch { } ops.push({ coll: 'tasks', data: n }); }
    if (ops.length) await saveMany(ops);
    Auth.forget('cal');
  }
  return { on, save, sweep, turnOn, turnOff };
})();

// ---- in-app alert while HerdBook is open (and a phone notification, if allowed)
const ALERT_K = 'hbAlerted';
function checkAlerts() {
  let seen = {}; try { seen = JSON.parse(localStorage.getItem(ALERT_K) || '{}'); } catch { }
  const now = Date.now();
  for (const t of DB.tasks) {
    const at = remindAt(t); if (t.done || at == null || at > now || now - at > 6 * 3600e3) continue;
    const key = t.id + '@' + t.date + taskTime(t); if (seen[key]) continue; seen[key] = now;
    showAlert(t);
  }
  for (const k of Object.keys(seen)) if (now - seen[k] > 7 * 864e5) delete seen[k];
  try { localStorage.setItem(ALERT_K, JSON.stringify(seen)); } catch { }
}
function showAlert(t) {
  const b = document.createElement('div'); b.className = 'talert';
  b.innerHTML = `<b>⏰ ${esc(t.title)}</b><span>${esc(whenText(t))}</span><div><button class="btn sm primary">Done</button> <button class="btn sm">In 1 hour</button> <button class="btn sm link">Close</button></div>`;
  const [d, s, c] = b.querySelectorAll('button');
  d.onclick = () => { b.remove(); toggleTask(t.id); }; s.onclick = () => { b.remove(); snoozeTask(t.id, 'hour'); }; c.onclick = () => b.remove();
  document.body.appendChild(b);
  try { if (window.Notification && Notification.permission === 'granted' && navigator.serviceWorker) navigator.serviceWorker.ready.then(r => r.showNotification('HerdBook: ' + t.title, { body: whenText(t), icon: 'icon-192.png', tag: t.id })); } catch { }
}
setInterval(() => { try { checkAlerts(); } catch { } }, 30000);
setInterval(() => Cal.sweep(), 120000);

// ---- the task form
function actTask(id, preset) {
  const t = id ? IX.tasks[id] : Object.assign({ date: today(), remind: '0', cat: 'Cattle', remindWho: me() ? [me()] : [] }, preset || {});
  const anim = taskAnimals(t).map(i => AN(i)).filter(Boolean).map(keyOf).join(' ');
  const who = [...new Set([myName(), ...DB.tasks.map(x => x.who).filter(Boolean)])].filter(Boolean);
  openForm({
    title: id ? 'Task' : 'New task', wide: true,
    values: Object.assign({}, t, { animals: anim, remind: t.remind || '0', repeat: t.repeat || '', mine: !id || (t.remindWho || []).includes(me()) }),
    fields: [
      { k: 'title', label: 'What needs doing', req: true, full: true, big: true, ph: 'e.g. Check heifers, move cows to the north pasture, call the vet' },
      { k: 'quick', label: 'When', type: 'buttons', options: ['Today', 'Tomorrow', 'Saturday', 'Next week'], full: true },
      { k: 'date', label: 'Date', type: 'date', req: true }, { k: 'time', label: 'Time', type: 'time', hint: 'Leave blank for 8:00 AM.' },
      { k: 'repeat', label: 'Repeat', type: 'buttons', options: REPEATS, full: true },
      { k: 'remind', label: 'Remind me', type: 'select', options: REMINDS, blank: false },
      { k: 'mine', label: 'Reminder', type: 'check', text: Cal.on() ? 'Put it in my Google Calendar (alerts my phone)' : 'Remind me (turn on phone reminders on the Tasks page)' },
      { k: 'cat', label: 'Kind of job', type: 'buttons', options: TASK_CATS, full: true },
      { k: 'animals', label: 'Animals (tags, spaces between)', ph: 'optional — e.g. 214 216', full: true },
      { k: 'pastureId', label: 'Pasture', type: 'select', options: pastureOpts() }, { k: 'who', label: 'Who’s doing it', type: 'list', options: who },
      { k: 'note', label: 'Notes', type: 'textarea', full: true, rows: 2 }
    ],
    onChange: (f, e) => {
      if (e && e.target.name === 'quick') {
        const q = e.target.value, d = new Date(); let v = today();
        if (q === 'Tomorrow') v = addDays(today(), 1); else if (q === 'Saturday') v = addDays(today(), ((6 - d.getDay()) + 7) % 7 || 7); else if (q === 'Next week') v = addDays(today(), 7);
        f.elements.date.value = v;
      }
    },
    validate: v => { const miss = (v.animals || '').split(/[\s,;]+/).filter(Boolean).filter(x => !findAnimal(x)); return miss.length ? 'Not in the herd: ' + miss.join(', ') : null; },
    save: async v => {
      const r = Object.assign({}, t, { title: v.title, date: v.date, time: v.time || '', repeat: v.repeat || '', remind: v.remind || '0', cat: v.cat || 'Other', pastureId: v.pastureId, who: v.who, note: v.note,
        animalIds: (v.animals || '').split(/[\s,;]+/).filter(Boolean).map(x => findAnimal(x)).filter(Boolean).map(a => a.id) });
      delete r.animalId; if (!r.id) { r.id = uid(); r.by = myName(); }
      if (me()) r.remindWho = v.mine ? [...new Set([...(r.remindWho || []), me()])] : (r.remindWho || []).filter(x => x !== me());
      await Cal.save(r);
    },
    toastText: 'Task saved',
    del: id ? async () => { const r = Object.assign({}, t, { done: true, remindWho: [] }); if (Cal.on()) { try { await Cal.save(r); } catch { } } await del1('tasks', id); } : null
  });
}
async function toggleTask(id) {
  const t = IX.tasks[id]; if (!t) return;
  const done = !t.done, r = Object.assign({}, t, { done, doneAt: done ? new Date().toISOString() : null, doneBy: done ? myName() : null });
  const extra = [];
  // a repeating job: ticking it off puts the next one on the list
  if (done && t.repeat && t.date && !t.nextMade) {
    let nd = nextDate(t.date, t.repeat); while (nd < today()) nd = nextDate(nd, t.repeat);
    const n = Object.assign({}, t, { id: uid(), date: nd, done: false, doneAt: null, doneBy: null, cal: {}, calLater: {}, calSeen: {}, nextMade: false });
    r.nextMade = true;
    if (Cal.on()) { try { n.cal = {}; await Cal.save(n); } catch { } } else extra.push({ coll: 'tasks', data: n });
  }
  await Cal.save(r, extra);
  refresh(); toast(done ? (t.repeat ? 'Done — next one is on the list' : 'Done') : 'Back on the list');
}
async function snoozeTask(id, how) {
  const t = IX.tasks[id]; if (!t) return;
  const r = Object.assign({}, t);
  if (how === 'hour') { const d = new Date(Date.now() + 3600e3); r.date = iso(d); r.time = z2(d.getHours()) + ':' + z2(d.getMinutes()); }
  else { r.date = addDays(t.date && t.date >= today() ? t.date : today(), 1); }
  await Cal.save(r); refresh(); toast(how === 'hour' ? 'Moved to ' + fmtTime(r.time) : 'Moved to tomorrow');
}
async function quickTask() {
  const title = $('#qt_t').value.trim(); if (!title) { $('#qt_t').focus(); return; }
  const d = $('#qt_d').value, time = $('#qt_time').value;
  await Cal.save({ id: uid(), title, date: d, time, remind: '0', cat: 'Cattle', repeat: '', by: myName(), remindWho: me() ? [me()] : [] });
  refresh(); toast('Added — ' + whenText({ date: d, time }));
}

// ---- the Tasks page
ROUTES.tasks = function () {
  const f = UI.tf || (UI.tf = { cat: '', who: '' }), now = Date.now(), t0 = today(), wkEnd = addDays(t0, 7);
  const open = DB.tasks.filter(t => !t.done && (!f.cat || t.cat === f.cat) && (!f.who || t.who === f.who)).sort((a, b) => (dueAt(a) || 9e15) - (dueAt(b) || 9e15));
  const groups = [['Overdue', t => t.date && dueAt(t) < now], ['Today', t => t.date === t0 && dueAt(t) >= now], ['Tomorrow', t => t.date === addDays(t0, 1)], ['This week', t => t.date > addDays(t0, 1) && t.date <= wkEnd], ['Later', t => t.date > wkEnd], ['No date', t => !t.date]];
  const used = new Set();
  const row = t => {
    const an = taskAnimals(t), late = t.date && dueAt(t) < now;
    return `<div class="trow${late ? ' late' : ''}"><button class="tchk" onclick="toggleTask('${t.id}')" aria-label="Mark done"></button>
      <div class="tmain" onclick="actTask('${t.id}')"><b>${esc(t.title)}</b>
       <small><span class="${late ? 'tlate' : ''}">${esc(whenText(t))}</span>${t.repeat ? ' · ↻ ' + esc((REPEATS.find(x => x[0] === t.repeat) || [])[1] || '') : ''}${t.remind !== 'none' && (t.remindWho || []).includes(me()) && Cal.on() ? ' · 🔔' : ''}${t.who ? ' · ' + esc(t.who) : ''}</small>
       <span>${t.cat ? `<span class="chip">${esc(t.cat)}</span>` : ''}${an.slice(0, 6).map(id => AN(id) ? `<a class="chip blue" href="#/animal/${id}" onclick="event.stopPropagation()">${esc(keyOf(AN(id)))}</a>` : '').join('')}${an.length > 6 ? `<span class="chip">+${an.length - 6}</span>` : ''}${t.pastureId ? `<span class="chip">${esc(pastureName(t.pastureId))}</span>` : ''}</span>
       ${t.note ? `<div class="muted small">${esc(t.note)}</div>` : ''}</div>
      ${late || t.date === t0 ? `<div class="tsnz"><button class="btn sm" onclick="snoozeTask('${t.id}','hour')">+1 hr</button><button class="btn sm" onclick="snoozeTask('${t.id}','day')">Tomorrow</button></div>` : ''}</div>`;
  };
  const lists = groups.map(([name, fn]) => { const l = open.filter(t => !used.has(t.id) && fn(t)); l.forEach(t => used.add(t.id)); return l.length ? `<h3 class="tgrp${name === 'Overdue' ? ' late' : ''}">${name} <span>${l.length}</span></h3>${l.map(row).join('')}` : ''; }).join('');
  const done = DB.tasks.filter(t => t.done).sort((a, b) => (b.doneAt || b.date || '').localeCompare(a.doneAt || a.date || '')).slice(0, 40);
  const auto = reminders().filter(r => !r.task);
  const whos = [...new Set(DB.tasks.map(t => t.who).filter(Boolean))];
  const calCard = !Sync.st.account ? '<p>Sign in with Google (Settings) and HerdBook can put your tasks in Google Calendar, so your phone reminds you even when HerdBook is closed.</p>'
    : Cal.on() ? `<p><span class="chip green">On</span> Your tasks go into <b>${esc(me())}</b>’s Google Calendar — your phone alerts you at the time, even with HerdBook closed.</p><p><button class="btn sm" onclick="Cal.turnOff().then(refresh)">Stop phone reminders</button> ${window.Notification && Notification.permission !== 'granted' ? '<button class="btn sm" onclick="Notification.requestPermission().then(refresh)">Also pop up here while HerdBook is open</button>' : ''}</p>`
    : `<p>Get a real alert on your phone at the time of each task — even when HerdBook is closed. HerdBook puts them in your own Google Calendar (Google asks you once).</p><p><button class="btn primary" onclick="Cal.turnOn().then(()=>{refresh();toast('Phone reminders on')}).catch(e=>alert(e.message))">Turn on phone reminders</button></p>`;
  main(page('Tasks', `<button class="btn primary" onclick="actTask()">+ New task</button>`,
    `<div class="card qadd"><input id="qt_t" class="big" placeholder="What needs doing?" onkeydown="if(event.key==='Enter')quickTask()">
      <div class="qrow"><select id="qt_d">${opts([[t0, 'Today'], [addDays(t0, 1), 'Tomorrow'], [addDays(t0, ((6 - new Date().getDay()) + 7) % 7 || 7), 'Saturday'], [addDays(t0, 7), 'Next week']], t0, false)}</select><input id="qt_time" type="time" aria-label="Time (blank = 8 AM)"><button class="btn primary" onclick="quickTask()">Add</button><button class="btn" onclick="actTask(null,{title:$('#qt_t').value})">More…</button></div>
      <div class="hint">No time = 8:00 AM.</div></div>
     ${Cal.on() ? '' : card('Reminders on this phone', calCard)}
     <div class="toolbar"><select onchange="UI.tf.cat=this.value;refresh()">${opts([['', 'Every kind of job'], ...TASK_CATS], f.cat, false)}</select>${whos.length ? `<select onchange="UI.tf.who=this.value;refresh()">${opts([['', 'Anyone'], ...whos], f.who, false)}</select>` : ''}</div>
     <section class="card tlist">${lists || empty('Nothing on the list. Add a job above.')}</section>
     ${Cal.on() ? card('Reminders on this phone', calCard) : ''}
     ${auto.length ? card('HerdBook noticed', `<ul class="rem">${auto.map(r => `<li><span class="when">${r.date < t0 ? '<span class="chip red">past due</span>' : fmtD(r.date)}</span><span>${r.href ? `<a href="${r.href}">${r.text}</a>` : r.text}${r.ids ? ` <button class="btn link sm" onclick="showList(${listRef(r.ids)})">show</button>` : ''} <button class="btn link sm" onclick='actTask(null,${esc(JSON.stringify({ title: r.text.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, ' ').slice(0, 80), date: r.date < t0 ? t0 : r.date, cat: /calv|bred|preg/i.test(r.text) ? 'Breeding & calving' : /booster|withdrawal/i.test(r.text) ? 'Health' : 'Cattle', animalIds: (r.ids || []).slice(0, 30) }))})'>make a task</button></span></li>`).join('')}</ul>`) : ''}
     ${done.length ? `<details class="card"><summary><b>Done lately (${done.length})</b></summary>${done.map(t => `<div class="trow done"><button class="tchk on" onclick="toggleTask('${t.id}')" aria-label="Not done"></button><div class="tmain" onclick="actTask('${t.id}')"><b>${esc(t.title)}</b><small>${esc(whenText(t))}${t.doneBy ? ' · done by ' + esc(t.doneBy) : ''}</small></div></div>`).join('')}</details>` : ''}`));
  Cal.sweep();
};

start();
