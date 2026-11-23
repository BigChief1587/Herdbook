'use strict';
/* HerdBook storage + sync.
   Every record is kept on THIS device (IndexedDB), so HerdBook works with no signal.
   When the farm signs in with Google, records sync through that farm's own Google Drive
   (the hidden "app data" folder only HerdBook can see). Each farm = its own Google account;
   nobody else's records are ever in it.

   Records:  {k:'coll/id', c:coll, id, d:data, u:time-ms, x:1 if deleted, dirty:1 if not yet synced}
   Drive:    herdbook-data.json  {format:1, app, saved, by, docs:{k:{u,d}|{u,x:1}}}
             photo-<pid>.jpg, backup-YYYY-MM-DD.json, backup-before-v<ver>.json, backup-before-restore-*.json
   Merge:    per record, newest change wins. Deletes are kept as markers so they spread too. */

const HB = window.HB_CONFIG || {};
const APP_VERSION = '2.0.1';
const CHANNEL = /\/test\//.test(location.pathname) || HB.channel === 'test' ? 'test' : 'live';
const DRIVE = HB.driveBase || 'https://www.googleapis.com';
const PFX = CHANNEL === 'test' ? 'test-' : '';
const DATA_FILE = PFX + 'herdbook-data.json';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

// ---------------------------------------------------------------- device storage
const Store = (() => {
  let db = null;
  const U = {};            // k -> last change time, for every record (incl. deleted)
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  function open() {
    if (db) return Promise.resolve(db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('herdbook' + (CHANNEL === 'test' ? '-test' : ''), 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('docs', { keyPath: 'k' }); d.createObjectStore('photos', { keyPath: 'pid' }); d.createObjectStore('meta'); };
      r.onsuccess = () => { db = r.result; db.onversionchange = () => { db.close(); location.reload(); }; res(db); };
      r.onerror = () => rej(r.error || new Error('This browser would not let HerdBook save records.'));
      r.onblocked = () => rej(new Error('Close HerdBook in your other tabs or windows, then try again.'));
    });
  }
  // run fn(store objects) in one transaction; resolves after it is safely written
  function tx(names, mode, fn) {
    return new Promise((res, rej) => {
      const t = db.transaction(names, mode); let out;
      t.oncomplete = () => Promise.resolve(out).then(res, rej);
      t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Save was stopped'));
      out = fn(...(Array.isArray(names) ? names : [names]).map(n => t.objectStore(n)));
    });
  }
  async function allDocs() { const l = await tx('docs', 'readonly', s => rq(s.getAll())); for (const r of l) U[r.k] = r.u; return l; }
  async function putDocs(recs) { await tx('docs', 'readwrite', s => { for (const r of recs) s.put(r); }); for (const r of recs) U[r.k] = r.u; }
  // clear "not synced" only if the record has not changed again since it was sent
  async function markSynced(pairs) {
    await tx('docs', 'readwrite', s => { for (const [k, u] of pairs) { const g = s.get(k); g.onsuccess = () => { const r = g.result; if (r && r.u === u && r.dirty) { r.dirty = 0; s.put(r); } }; } });
  }
  const nextU = k => Math.max(Date.now(), (U[k] || 0) + 1);
  const getMeta = k => tx('meta', 'readonly', s => rq(s.get(k)));
  const setMeta = (k, v) => tx('meta', 'readwrite', s => { s.put(v, k); });
  const getPhoto = pid => tx('photos', 'readonly', s => rq(s.get(pid)));
  const putPhoto = p => tx('photos', 'readwrite', s => { s.put(p); });
  const delPhoto = pid => tx('photos', 'readwrite', s => { s.delete(pid); });
  const allPhotos = () => tx('photos', 'readonly', s => rq(s.getAll()));
  async function clearAll() { await tx(['docs', 'photos', 'meta'], 'readwrite', (a, b, c) => { a.clear(); b.clear(); c.clear(); }); for (const k in U) delete U[k]; }
  return { open, allDocs, putDocs, markSynced, nextU, getMeta, setMeta, getPhoto, putPhoto, delPhoto, allPhotos, clearAll, U };
})();

// ---------------------------------------------------------------- Google sign-in
const Auth = (() => {
  let token = null, exp = 0, client = null, waiting = null, gisLoading = null;
  const ready = () => !!(HB.clientId || HB.fakeAuth);
  function loadGIS() {
    if (HB.fakeAuth || window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gisLoading) return gisLoading;
    gisLoading = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => res(); s.onerror = () => { gisLoading = null; rej(new Error('Could not reach Google — check the signal.')); };
      document.head.appendChild(s);
    });
    return gisLoading;
  }
  function makeClient() {
    if (client || HB.fakeAuth || !(window.google && google.accounts && google.accounts.oauth2)) return;
    client = google.accounts.oauth2.initTokenClient({
      client_id: HB.clientId, scope: SCOPE,
      callback: r => { const w = waiting; waiting = null; if (!w) return; if (r.error) w.rej(new Error(r.error_description || r.error)); else { set(r.access_token, r.expires_in); w.res(token); } },
      error_callback: e => { const w = waiting; waiting = null; if (w) w.rej(new Error(e && e.type === 'popup_closed' ? 'Sign-in was closed before it finished.' : e && e.type === 'popup_failed_to_open' ? 'The Google sign-in window was blocked. Allow pop-ups for HerdBook and try again.' : 'Google sign-in did not finish.')); }
    });
  }
  function set(t, secs) { token = t; exp = Date.now() + (secs || 3600) * 1000; Store.setMeta('token', { token, exp }).catch(() => { }); }
  async function restore() { try { const t = await Store.getMeta('token'); if (t && t.exp > Date.now() + 120000) { token = t.token; exp = t.exp; } } catch { } }
  // preload Google's sign-in script while there is signal, so a tap can open it straight away
  function warm() { if (HB.clientId && navigator.onLine) loadGIS().then(makeClient).catch(() => { }); }
  const valid = () => !!token && Date.now() < exp - 60000;
  // interactive = called from a tap (Google needs a tap to open its window)
  async function get(interactive, hint) {
    if (valid()) return token;
    if (HB.fakeAuth) { set('fake-' + (localStorage.getItem('hbFakeUser') || HB.fakeAuth), 3600); return token; }
    if (!interactive || !HB.clientId) return null;
    await loadGIS(); makeClient();
    return new Promise((res, rej) => { waiting = { res, rej }; client.requestAccessToken(hint ? { login_hint: hint, prompt: '' } : { prompt: 'select_account' }); });
  }
  function drop() { token = null; exp = 0; Store.setMeta('token', null).catch(() => { }); }
  function revoke() { const t = token; drop(); try { if (t && !HB.fakeAuth && window.google) google.accounts.oauth2.revoke(t, () => { }); } catch { } }
  return { ready, warm, restore, get, valid, drop, revoke };
})();

// ---------------------------------------------------------------- Google Drive (hidden app folder)
class NeedSignIn extends Error { constructor() { super('Sign in to sync'); this.needSignIn = true; } }
const Drive = (() => {
  async function f(path, opt = {}) {
    const t = await Auth.get(false); if (!t) throw new NeedSignIn();
    let r;
    try { r = await fetch(DRIVE + path, Object.assign({}, opt, { headers: Object.assign({}, opt.headers, { Authorization: 'Bearer ' + t }) })); }
    catch { const e = new Error('No connection to Google Drive'); e.offline = true; throw e; }
    if (r.status === 401) { Auth.drop(); throw new NeedSignIn(); }
    if (!r.ok) { let m = ''; try { m = (await r.json()).error.message; } catch { } throw new Error('Google Drive said: ' + (m || r.status)); }
    return r;
  }
  async function list() {
    const out = []; let pt = '';
    do {
      const j = await (await f('/drive/v3/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name,createdTime,modifiedTime,size)' + (pt ? '&pageToken=' + encodeURIComponent(pt) : ''))).json();
      out.push(...(j.files || [])); pt = j.nextPageToken;
    } while (pt);
    return out;
  }
  async function create(name, body, type) {
    const m = await (await f('/drive/v3/files?fields=id,name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parents: ['appDataFolder'] }) })).json();
    await upload(m.id, body, type); return m;
  }
  const upload = (id, body, type) => f('/upload/drive/v3/files/' + id + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': type }, body });
  const text = async id => (await f('/drive/v3/files/' + id + '?alt=media')).text();
  const blob = async id => (await f('/drive/v3/files/' + id + '?alt=media')).blob();
  const copy = async (id, name) => (await f('/drive/v3/files/' + id + '/copy?fields=id,name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parents: ['appDataFolder'] }) })).json();
  const del = id => f('/drive/v3/files/' + id, { method: 'DELETE' });
  const who = async () => (await (await f('/drive/v3/about?fields=user(displayName,emailAddress,permissionId)')).json()).user;
  return { list, create, upload, text, blob, copy, del, who };
})();

// ---------------------------------------------------------------- sync
const Sync = (() => {
  const st = { state: 'local', last: null, pending: 0, account: null, msg: '', backups: [] };
  let files = null, running = false, again = false, timer = null, onRemote = () => { }, onState = () => { };
  const byName = n => files && files.find(x => x.name === n);
  const deviceName = () => /iPhone/.test(navigator.userAgent) ? 'iPhone' : /iPad/.test(navigator.userAgent) ? 'iPad' : /Android/.test(navigator.userAgent) ? 'Android phone' : /Windows/.test(navigator.userAgent) ? 'Windows PC' : 'computer';
  function set(o) { Object.assign(st, o); onState(st); }
  async function countPending() { const l = await Store.allDocs(); set({ pending: l.filter(r => r.dirty).length }); }

  async function init(h) {
    onRemote = h.onRemote || onRemote; onState = h.onState || onState;
    await Auth.restore();
    const acct = await Store.getMeta('account');
    set({ account: acct || null, last: await Store.getMeta('lastSync') || null, state: acct ? 'idle' : 'local' });
    await countPending();
    Auth.warm();
    addEventListener('online', () => { Auth.warm(); soon(500); });
    addEventListener('offline', () => set({ state: st.account ? 'offline' : st.state }));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') soon(800); });
    setInterval(() => soon(0), 3 * 60 * 1000);
    if (acct) soon(300);
  }
  function soon(ms = 2500) { if (!st.account) return; clearTimeout(timer); timer = setTimeout(() => run(false), ms); }

  // first sign-in on this device (from a tap)
  async function signIn() {
    if (!Auth.ready()) throw new Error('Google sign-in is not set up in this copy of HerdBook yet (config.js has no client ID).');
    const bound = await Store.getMeta('account');
    await Auth.get(true, bound && bound.email);
    const u = await Drive.who();
    if (bound && bound.pid !== u.permissionId) {
      const l = await Store.allDocs(), pend = l.filter(r => r.dirty).length;
      if (!confirm(`This device holds the herd for ${bound.email}.\n\nSwitch to ${u.emailAddress}? This device's copy of ${bound.email}'s herd is removed (it stays safe in that Google account).` + (pend ? `\n\nWARNING: ${pend} change(s) on this device have NOT synced yet and would be lost.` : ''))) { Auth.drop(); return false; }
      await Store.clearAll(); onRemote(true);
    }
    const acct = { pid: u.permissionId, email: u.emailAddress, name: u.displayName };
    await Store.setMeta('account', acct); set({ account: acct, state: 'idle', msg: '' });
    files = null; await run(true); return true;
  }
  async function signOut() {
    const l = await Store.allDocs(), pend = l.filter(r => r.dirty).length;
    if (!confirm('Sign out and remove this herd from this device?\n\nYour records stay safe in your Google account; sign in again to get them back.' + (pend ? `\n\nWARNING: ${pend} change(s) on this device have NOT synced yet and would be lost. Cancel and tap Sync first.` : ''))) return false;
    Auth.revoke(); await Store.clearAll(); files = null; set({ account: null, state: 'local', last: null, pending: 0 }); onRemote(true); return true;
  }

  async function backupIfDue(remote, dataFile) {
    const day = new Date(); const d = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
    const want = [];
    if (!byName(PFX + 'backup-' + d + '.json')) want.push(PFX + 'backup-' + d + '.json');
    // first time a NEW version of HerdBook touches records an older version wrote
    if (remote.app && remote.app !== APP_VERSION && !byName(PFX + 'backup-before-v' + APP_VERSION + '.json')) want.push(PFX + 'backup-before-v' + APP_VERSION + '.json');
    for (const n of want) files.push(await Drive.copy(dataFile.id, n));
    // keep the newest 30 daily copies and 10 before-update / before-restore copies
    const old = (re, keep) => files.filter(x => re.test(x.name)).sort((a, b) => b.name.localeCompare(a.name)).slice(keep);
    const stale = [...old(new RegExp('^' + PFX + 'backup-\\d{4}-'), 30), ...old(new RegExp('^' + PFX + 'backup-before-'), 10)];
    for (const x of stale) { try { await Drive.del(x.id); files = files.filter(y => y !== x); } catch { } }
  }

  async function run(interactive) {
    if (!st.account) return;
    if (running) { again = true; return; }
    if (!navigator.onLine) { await countPending(); return set({ state: 'offline' }); }
    if (!Auth.valid()) {
      if (!interactive) { await countPending(); return set({ state: 'signin' }); }
      try { await Auth.get(true, st.account.email); } catch (e) { return set({ state: 'signin', msg: e.message }); }
    }
    running = true; set({ state: 'syncing', msg: '' });
    let changed = false;
    try {
      files = await Drive.list();          // fresh every time: other devices add files (photos, the first data file)
      // normally one data file; two can appear if two devices start a brand-new herd at the same moment -> fold them together
      const dfs = files.filter(x => x.name === DATA_FILE).sort((a, b) => (a.createdTime || a.id).localeCompare(b.createdTime || b.id));
      let df = dfs[0], remote = { docs: {} }, extra = false;
      if (df) { remote = JSON.parse(await Drive.text(df.id)); if (!remote.docs) remote.docs = {}; await backupIfDue(remote, df); }
      for (const x of dfs.slice(1)) {
        const o = JSON.parse(await Drive.text(x.id));
        for (const [k, v] of Object.entries(o.docs || {})) if (!remote.docs[k] || v.u > remote.docs[k].u) { remote.docs[k] = v; extra = true; }
      }
      const local = await Store.allDocs(), L = {};
      for (const r of local) L[r.k] = r;
      // take every remote change that is newer than ours
      const take = [];
      for (const [k, v] of Object.entries(remote.docs)) {
        const r = L[k];
        if (!r || v.u > r.u) { const i = k.indexOf('/'); const n = { k, c: k.slice(0, i), id: k.slice(i + 1), u: v.u, d: v.x ? null : v.d, x: v.x ? 1 : 0, dirty: 0 }; take.push(n); L[k] = n; }
      }
      if (take.length) { await Store.putDocs(take); changed = true; }
      // send ours if we have anything Drive does not
      const sent = [];
      for (const r of Object.values(L)) { const v = remote.docs[r.k]; if (!v || r.u > v.u) sent.push([r.k, r.u]); }
      if (sent.length || !df || extra || dfs.length > 1) {
        const out = { format: 1, app: APP_VERSION, saved: new Date().toISOString(), by: deviceName(), docs: {} };
        for (const r of Object.values(L)) out.docs[r.k] = r.x ? { u: r.u, x: 1 } : { u: r.u, d: r.d };
        const body = new Blob([JSON.stringify(out)], { type: 'application/json' });
        if (df) await Drive.upload(df.id, body, 'application/json'); else files.push(df = await Drive.create(DATA_FILE, body, 'application/json'));
        for (const x of dfs.slice(1)) { await Drive.del(x.id); files = files.filter(y => y !== x); }
      }
      // anything Drive already had (or we just sent) is synced
      await Store.markSynced(Object.values(L).filter(r => r.dirty).map(r => [r.k, r.u]));
      await syncPhotos();
      const now = new Date().toISOString(); await Store.setMeta('lastSync', now);
      if (changed) { changed = false; await onRemote(false); }   // screen shows the new records before we say "Synced"
      await countPending(); set({ state: 'idle', last: now });
    } catch (e) {
      if (e.needSignIn) set({ state: 'signin' });
      else if (e.offline || !navigator.onLine) set({ state: 'offline' });
      else { files = null; set({ state: 'error', msg: e.message }); }
      await countPending();
    } finally {
      running = false;
      if (changed) onRemote(false);
      if (again) { again = false; soon(200); }
    }
  }

  async function syncPhotos() {
    for (const p of await Store.allPhotos()) {
      const name = PFX + 'photo-' + p.pid + '.jpg', f = byName(name);
      if (p.del) { if (f) { await Drive.del(f.id); files = files.filter(x => x !== f); } await Store.delPhoto(p.pid); }
      else if (!p.up && p.blob) { if (!f) files.push(await Drive.create(name, p.blob, 'image/jpeg')); p.up = 1; await Store.putPhoto(p); }
    }
  }
  // photo for display: this device first, then Drive
  const urls = {};
  async function photoUrl(pid) {
    if (urls[pid]) return urls[pid];
    let p = await Store.getPhoto(pid);
    if ((!p || !p.blob) && st.account && Auth.valid() && navigator.onLine) {
      try { let f = files && byName(PFX + 'photo-' + pid + '.jpg'); if (!f) { files = await Drive.list(); f = byName(PFX + 'photo-' + pid + '.jpg'); } if (f) { p = { pid, blob: await Drive.blob(f.id), up: 1 }; await Store.putPhoto(p); } } catch { }
    }
    return p && p.blob ? (urls[pid] = URL.createObjectURL(p.blob)) : null;
  }
  async function addPhoto(pid, blob) { await Store.putPhoto({ pid, blob, up: 0 }); soon(); }
  async function removePhoto(pid) { await Store.putPhoto({ pid, del: 1 }); if (urls[pid]) { URL.revokeObjectURL(urls[pid]); delete urls[pid]; } soon(); }

  // ---- Drive backups (list + restore)
  async function listBackups() {
    if (!st.account) return [];
    if (!Auth.valid()) await Auth.get(true, st.account.email);
    files = await Drive.list();
    return files.filter(x => x.name.startsWith(PFX + 'backup-')).sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || ''));
  }
  async function readBackup(id) { return JSON.parse(await Drive.text(id)); }
  async function backupBeforeRestore() {
    if (!files) files = await Drive.list();
    const df = byName(DATA_FILE); if (!df) return;
    const n = PFX + 'backup-before-restore-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json';
    files.push(await Drive.copy(df.id, n));
  }
  return { st, init, soon, run, signIn, signOut, photoUrl, addPhoto, removePhoto, listBackups, readBackup, backupBeforeRestore, countPending };
})();
