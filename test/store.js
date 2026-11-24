'use strict';
/* HerdBook storage + sync.
   Every record is kept on THIS device (IndexedDB), so HerdBook works with no signal.
   When signed in with Google, a farm's records sync through Google Drive:
     - a farm only its owner uses can live in the owner's hidden "app data" folder (how 2.0/2.1 kept them);
     - a SHARED farm lives in a "HerdBook – <farm>" folder in the owner's Drive. The owner invites people by
       Gmail (Drive sharing: "can record" = writer, "can only look" = reader) and can remove them again.
   One device can hold several farms (each its own IndexedDB) and flip between them.

   Records:  {k:'coll/id', c:coll, id, d:data, u:time-ms, x:1 if deleted, dirty:1 if not yet synced}
   Drive:    herdbook-data.json  {format:1, app, saved, by, docs:{k:{u,d}|{u,x:1}}, movedTo?:folderId}
             photo-<pid>.jpg, backup-YYYY-MM-DD.json, backup-before-v<ver>.json, backup-before-restore-*.json
   Merge:    per record, newest change wins. Deletes are kept as markers so they spread too.
             Each sync compares every record with Drive (not just "unsynced" ones), so if two people save
             at the same moment and one copy overwrites the other, the next sync puts the missing change back. */

const HB = window.HB_CONFIG || {};
const APP_VERSION = '2.3.0-test';
const CHANNEL = /\/test\//.test(location.pathname) || HB.channel === 'test' ? 'test' : 'live';
const DRIVE = HB.driveBase || 'https://www.googleapis.com';
const PFX = CHANNEL === 'test' ? 'test-' : '';
const DATA_FILE = PFX + 'herdbook-data.json';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file';
const FARM_TAG = CHANNEL === 'test' ? 'farm-test' : 'farm';
const FOLDER = 'application/vnd.google-apps.folder';
let LOC = null;            // where the open farm syncs: null = the hidden app-data folder, else a Drive folder id

// ---------------------------------------------------------------- the farms on this device
const Farms = (() => {
  const BASE = 'herdbook' + (CHANNEL === 'test' ? '-test' : ''), K = 'hbFarms' + (CHANNEL === 'test' ? '-test' : ''), C = 'hbFarm' + (CHANNEL === 'test' ? '-test' : '');
  const get = () => { try { const l = JSON.parse(localStorage.getItem(K) || 'null'); if (Array.isArray(l) && l.length) return l; } catch { } return [{ db: BASE, name: null, folder: null, role: 'owner' }]; };
  const save = l => { try { localStorage.setItem(K, JSON.stringify(l)); } catch { } };
  const cur = () => { let c = null; try { c = localStorage.getItem(C); } catch { } const l = get(); return l.find(f => f.db === c) || l[0]; };
  const setCur = db => { try { localStorage.setItem(C, db); } catch { } };
  const upd = (db, o) => { const l = get(); const f = l.find(x => x.db === db); if (f) Object.assign(f, o); else l.push(Object.assign({ db }, o)); save(l); };
  const remove = db => { save(get().filter(f => f.db !== db)); };
  const dbFor = folder => BASE + '-f-' + folder;
  return { BASE, get, cur, setCur, upd, remove, dbFor, reset: () => { try { localStorage.removeItem(K); localStorage.removeItem(C); } catch { } } };
})();

// ---------------------------------------------------------------- device storage
const Store = (() => {
  let db = null, name = null;
  const U = {};            // k -> last change time, for every record (incl. deleted)
  const rq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  function open() {
    if (db) return Promise.resolve(db);
    name = Farms.cur().db;
    return new Promise((res, rej) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('docs', { keyPath: 'k' }); d.createObjectStore('photos', { keyPath: 'pid' }); d.createObjectStore('meta'); };
      r.onsuccess = () => { db = r.result; db.onversionchange = () => { db.close(); location.reload(); }; res(db); };
      r.onerror = () => rej(r.error || new Error('This browser would not let HerdBook save records.'));
      r.onblocked = () => rej(new Error('Close HerdBook in your other tabs or windows, then try again.'));
    });
  }
  // open another farm's records on this device
  async function switchTo(dbName) { if (db) { db.close(); db = null; } for (const k in U) delete U[k]; Farms.setCur(dbName); await open(); }
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
  // pictures are kept as plain bytes: some iPhone versions can't keep a Blob in IndexedDB
  const unpack = p => { if (p && !p.blob && p.buf) { p = Object.assign({}, p, { blob: new Blob([p.buf], { type: p.type || 'image/jpeg' }) }); delete p.buf; } return p; };
  const getPhoto = async pid => unpack(await tx('photos', 'readonly', s => rq(s.get(pid))));
  const putPhoto = async p => {
    let r = p;
    if (p.blob) { r = Object.assign({}, p, { buf: await new Response(p.blob).arrayBuffer(), type: p.blob.type || 'image/jpeg' }); delete r.blob; }
    return tx('photos', 'readwrite', s => { s.put(r); });
  };
  const delPhoto = pid => tx('photos', 'readwrite', s => { s.delete(pid); });
  const allPhotos = async () => (await tx('photos', 'readonly', s => rq(s.getAll()))).map(unpack);
  async function clearAll() { await tx(['docs', 'photos', 'meta'], 'readwrite', (a, b, c) => { a.clear(); b.clear(); c.clear(); }); for (const k in U) delete U[k]; }
  // throw a farm's records off this device entirely (leaving a farm / signing out)
  async function drop(dbName) {
    if (dbName === name && db) { db.close(); db = null; }
    await new Promise(res => { const r = indexedDB.deleteDatabase(dbName); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  }
  return { open, switchTo, allDocs, putDocs, markSynced, nextU, getMeta, setMeta, getPhoto, putPhoto, delPhoto, allPhotos, clearAll, drop, U, name: () => name };
})();

// ---------------------------------------------------------------- Google sign-in
const Auth = (() => {
  let token = null, exp = 0, client = null, waiting = null, gisLoading = null;
  const ready = () => !!(HB.clientId || HB.fakeAuth);
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error('Could not reach Google — check the signal.')); document.head.appendChild(s); });
  function loadGIS() {
    if (HB.fakeAuth || window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (!gisLoading) gisLoading = loadScript('https://accounts.google.com/gsi/client').catch(e => { gisLoading = null; throw e; });
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
  // sv = which permissions the token was granted with; 2 = can also make + share a farm folder (HerdBook 2.2)
  function set(t, secs) { token = t; exp = Date.now() + (secs || 3600) * 1000; Store.setMeta('token', { token, exp, sv: 2 }).catch(() => { }); }
  async function restore() { if (valid()) { Store.setMeta('token', { token, exp, sv: 2 }).catch(() => { }); return; } try { const t = await Store.getMeta('token'); if (t && t.sv === 2 && t.exp > Date.now() + 120000) { token = t.token; exp = t.exp; } } catch { } }
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
  return { ready, warm, restore, get, valid, drop, revoke, loadScript, token: () => token };
})();

// ---------------------------------------------------------------- Google Drive
class NeedSignIn extends Error { constructor() { super('Sign in to sync'); this.needSignIn = true; } }
const Drive = (() => {
  async function f(path, opt = {}) {
    const t = await Auth.get(false); if (!t) throw new NeedSignIn();
    let r;
    try { r = await fetch(DRIVE + path, Object.assign({}, opt, { headers: Object.assign({}, opt.headers, { Authorization: 'Bearer ' + t }) })); }
    catch { const e = new Error('No connection to Google Drive'); e.offline = true; throw e; }
    if (r.status === 401) { Auth.drop(); throw new NeedSignIn(); }
    if (!r.ok) {
      let m = '', reason = ''; try { const j = (await r.json()).error; m = j.message; reason = (j.errors && j.errors[0] && j.errors[0].reason) || ''; } catch { }
      if (r.status === 403 && /insufficient/i.test(m + reason)) { Auth.drop(); throw new NeedSignIn(); }   // a token from before sharing existed: ask Google again
      const e = new Error('Google Drive said: ' + (m || r.status)); e.status = r.status; throw e;
    }
    return r;
  }
  const J = async (path, opt) => (await f(path, opt)).json();
  const FIELDS = 'nextPageToken,files(id,name,createdTime,modifiedTime,size)';
  async function query(params) {
    const out = []; let pt = '';
    do { const j = await J('/drive/v3/files?pageSize=1000&' + params + (pt ? '&pageToken=' + encodeURIComponent(pt) : '')); out.push(...(j.files || [])); pt = j.nextPageToken; } while (pt);
    return out;
  }
  // the open farm's files - only the ones whose name starts with `prefix` (records, backups or one photo), never the whole folder
  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  function list(loc = LOC, prefix = '', exact = false) {
    const nm = prefix ? ` and name ${exact ? '=' : 'contains'} '${esc(prefix)}'` : '';
    return loc ? query('q=' + encodeURIComponent(`'${loc}' in parents and trashed=false${nm}`) + '&fields=' + FIELDS)
      : query('spaces=appDataFolder' + (nm ? '&q=' + encodeURIComponent(nm.slice(5)) : '') + '&fields=' + FIELDS);
  }
  const find = (name, loc = LOC) => list(loc, name, true);
  const parents = loc => [loc || 'appDataFolder'];
  async function create(name, body, type, loc = LOC) { const m = await J('/drive/v3/files?fields=id,name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parents: parents(loc) }) }); const u = await upload(m.id, body, type); return Object.assign({ name, createdTime: u.modifiedTime }, m, u); }
  // returns {id, modifiedTime} so this device knows the file it just wrote doesn't need reading back
  const upload = async (id, body, type) => (await f('/upload/drive/v3/files/' + id + '?uploadType=media&fields=id,modifiedTime', { method: 'PATCH', headers: { 'Content-Type': type }, body })).json();
  const text = async id => (await f('/drive/v3/files/' + id + '?alt=media')).text();
  // record files are gzip-squeezed (about 10x smaller) when the phone can; older files are plain JSON - read either
  async function json(id) {
    const buf = new Uint8Array(await (await f('/drive/v3/files/' + id + '?alt=media')).arrayBuffer());
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      if (!window.DecompressionStream) throw new Error('This phone is too old to read the farm’s records — update its software (iPhone: iOS 16.4 or newer).');
      return JSON.parse(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
    }
    return JSON.parse(new TextDecoder().decode(buf));
  }
  const blob = async id => (await f('/drive/v3/files/' + id + '?alt=media')).blob();
  const copy = (id, name, loc = LOC) => J('/drive/v3/files/' + id + '/copy?fields=id,name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parents: parents(loc) }) });
  const del = id => f('/drive/v3/files/' + id, { method: 'DELETE' });
  const who = async () => (await J('/drive/v3/about?fields=user(displayName,emailAddress,permissionId)')).user;
  // ---- shared farms
  const FOLDER_FIELDS = 'id,name,ownedByMe,owners(displayName,emailAddress),appProperties,capabilities(canEdit,canShare)';
  const makeFolder = name => J('/drive/v3/files?fields=' + FOLDER_FIELDS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER, appProperties: { hb: FARM_TAG }, writersCanShare: false, description: 'HerdBook keeps this farm’s records here. Don’t delete, move or rename the files inside.' }) });
  const folder = id => J('/drive/v3/files/' + id + '?fields=' + FOLDER_FIELDS);
  const rename = (id, name) => J('/drive/v3/files/' + id + '?fields=id,name', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  // farm folders this Google account can see: its own, and ones shared with it
  const farmFolders = () => query('q=' + encodeURIComponent(`mimeType='${FOLDER}' and appProperties has { key='hb' and value='${FARM_TAG}' } and trashed=false`) + '&fields=' + encodeURIComponent('nextPageToken,files(' + FOLDER_FIELDS + ')'));
  const perms = id => J('/drive/v3/files/' + id + '/permissions?fields=permissions(id,type,role,emailAddress,displayName)').then(j => j.permissions || []);
  const share = (id, email, role, msg) => J('/drive/v3/files/' + id + '/permissions?sendNotificationEmail=true&emailMessage=' + encodeURIComponent(msg), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'user', role, emailAddress: email }) });
  const setRole = (id, pid, role) => J('/drive/v3/files/' + id + '/permissions/' + pid, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
  const unshare = (id, pid) => f('/drive/v3/files/' + id + '/permissions/' + pid, { method: 'DELETE' });
  return { list, find, create, upload, text, json, blob, copy, del, who, makeFolder, folder, rename, farmFolders, perms, share, setRole, unshare };
})();

// Google's own "pick a file" window: how a farm shared with you is let into HerdBook
const Picker = (() => {
  async function pick() {
    if (HB.fakeAuth) {   // test rig: the fake Drive lists what is shared
      const l = (await Drive.farmFolders()).filter(x => !x.ownedByMe && !Farms.get().some(f => f.folder === x.id));
      return l.length ? l[0].id : null;
    }
    if (!HB.apiKey) throw new Error('Joining a shared farm needs the Google "Picker" key in config.js (see SETUP GUIDE, step 6).');
    if (!window.gapi) await Auth.loadScript('https://apis.google.com/js/api.js');
    await new Promise(res => gapi.load('picker', res));
    const appId = HB.appId || String(HB.clientId || '').split('-')[0];
    return new Promise(res => {
      const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes(FOLDER).setOwnedByMe(false).setQuery('HerdBook');
      new google.picker.PickerBuilder().addView(view).setOAuthToken(Auth.token()).setDeveloperKey(HB.apiKey).setAppId(appId)
        .setTitle('Pick the HerdBook farm that was shared with you')
        .setCallback(d => { if (d.action === google.picker.Action.PICKED) res(d.docs[0].id); else if (d.action === google.picker.Action.CANCEL) res(null); })
        .build().setVisible(true);
    });
  }
  return { pick };
})();

// ---------------------------------------------------------------- sync
const Sync = (() => {
  const st = { state: 'local', last: null, pending: 0, account: null, msg: '', backups: [], farm: null };
  let running = false, again = false, timer = null, due = 0, onRemote = () => { }, onState = () => { }, started = false;
  const deviceName = () => /iPhone/.test(navigator.userAgent) ? 'iPhone' : /iPad/.test(navigator.userAgent) ? 'iPad' : /Android/.test(navigator.userAgent) ? 'Android phone' : /Windows/.test(navigator.userAgent) ? 'Windows PC' : 'computer';
  function set(o) { Object.assign(st, o); onState(st); }
  async function countPending() { const l = await Store.allDocs(); set({ pending: l.filter(r => r.dirty).length }); }
  const readOnly = () => !!(st.farm && st.farm.role === 'reader');

  // ---- how a farm is kept in Drive (HerdBook 2.3+)
  // Records are split into one small file per month they were first made in (herdbook-part-2026-11.json ...),
  // so a day at the chute only sends this month's file, and a check that finds nothing new costs one tiny listing.
  // HerdBook 2.2 and older kept everything in one file (herdbook-data.json); it is still read whenever it changes,
  // so a phone that hasn't updated yet doesn't lose anything.
  const PART = PFX + 'herdbook-part-', MOVED = PFX + 'herdbook-moved.json';
  function bucketOf(k) {
    const id = k.slice(k.indexOf('/') + 1), t = parseInt(id.slice(0, 8), 36);
    if (id.length >= 10 && /^[0-9a-z]+$/.test(id) && t > 1.5e12 && t < 4.1e12) { const d = new Date(t); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); }
    let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
    return 'x' + (Math.abs(h) % 4);                 // records with hand-made ids (settings, very old imports)
  }
  const partName = b => PART + b + '.json';
  const docOut = r => r.x ? { u: r.u, x: 1 } : { u: r.u, d: r.d };
  // squeeze with gzip when this browser can (Chrome, Edge, Safari 16.4+): a month of records goes from ~400 KB to ~40 KB
  async function fileBody(docs) {
    const s = JSON.stringify({ format: 2, app: APP_VERSION, saved: new Date().toISOString(), by: st.account ? (st.account.name || st.account.email) + ' · ' + deviceName() : deviceName(), docs });
    if (!window.CompressionStream) return new Blob([s], { type: 'application/json' });
    return new Blob([await new Response(new Blob([s]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()], { type: 'application/octet-stream' });
  }
  const BT = b => b.type || 'application/json';
  const dayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  async function pool(items, n, fn) { const q = items.slice(); await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => { while (q.length) await fn(q.shift()); })); }
  const allDocsOut = async () => { const o = {}; for (const r of await Store.allDocs()) o[r.k] = docOut(r); return o; };

  // read the open farm's settings from this device
  async function loadFarm() {
    await Auth.restore();
    LOC = (await Store.getMeta('loc')) || null;
    const acct = await Store.getMeta('account');
    set({ account: acct || null, last: await Store.getMeta('lastSync') || null, state: acct ? 'idle' : 'local', farm: Farms.cur(), msg: '' });
    await countPending();
  }
  async function init(h) {
    onRemote = h.onRemote || onRemote; onState = h.onState || onState;
    await loadFarm();
    if (!started) {
      started = true; Auth.warm();
      addEventListener('online', () => { Auth.warm(); soon(500); });
      addEventListener('offline', () => set({ state: st.account ? 'offline' : st.state }));
      // coming back to HerdBook: look for news. Putting the phone away: send what's waiting, now.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') soon(800); else if (st.pending) run(false); });
      // a check is one small listing, so every minute is cheap; a farm only you use checks every 3 minutes
      let tick = 0; setInterval(() => { tick++; if (LOC || tick % 3 === 0) soon(0); }, 60 * 1000);
    }
    if (st.account) soon(300);
  }
  // sync in `ms`; a later call never pushes an earlier one back (so steady saving at the chute still sends every minute or so)
  function soon(ms = 2500) {
    if (!st.account) return; const at = Date.now() + ms;
    if (timer && due <= at) return;
    clearTimeout(timer); due = at; timer = setTimeout(() => { timer = null; due = 0; run(false); }, ms);
  }

  // first sign-in on this device (from a tap)
  async function signIn() {
    if (!Auth.ready()) throw new Error('Google sign-in is not set up in this copy of HerdBook yet (config.js has no client ID).');
    const bound = await Store.getMeta('account');
    await Auth.get(true, bound && bound.email);
    const u = await Drive.who();
    if (bound && bound.pid !== u.permissionId) {
      const l = await Store.allDocs(), pend = l.filter(r => r.dirty).length;
      if (!confirm(`This device holds the herd for ${bound.email}.\n\nSwitch to ${u.emailAddress}? This device's copy of ${bound.email}'s herd is removed (it stays safe in that Google account).` + (pend ? `\n\nWARNING: ${pend} change(s) on this device have NOT synced yet and would be lost.` : ''))) { Auth.drop(); return false; }
      await Store.clearAll(); LOC = null; onRemote(true);
    }
    const acct = { pid: u.permissionId, email: u.emailAddress, name: u.displayName };
    await Store.setMeta('account', acct); set({ account: acct, state: 'idle', msg: '' });
    await run(true); return true;
  }
  // sign out of every farm on this device
  async function signOut() {
    const pend = (await Store.allDocs()).filter(r => r.dirty).length;
    if (!confirm('Sign out and remove ' + (Farms.get().length > 1 ? 'every farm' : 'this herd') + ' from this device?\n\nYour records stay safe in Google; sign in again to get them back.' + (pend ? `\n\nWARNING: ${pend} change(s) on this device have NOT synced yet and would be lost. Cancel and tap Sync first.` : ''))) return false;
    Auth.revoke();
    const cur = Store.name();
    for (const fm of Farms.get()) if (fm.db !== cur) await Store.drop(fm.db);
    await Store.clearAll(); Farms.reset(); await Store.switchTo(Farms.BASE);
    if (cur !== Farms.BASE) await Store.drop(cur);
    LOC = null; set({ account: null, state: 'local', last: null, pending: 0, farm: Farms.cur() }); onRemote(true); return true;
  }

  // a whole-herd copy once a day (newest 30 kept) and one the first time a new HerdBook version syncs (newest 10)
  async function backupIfDue(legacyApp) {
    const d = dayStr(), lastDay = await Store.getMeta('backupDay'), ranV = await Store.getMeta('ranVersion');
    if (lastDay === d && ranV === APP_VERSION) return;
    const bl = await Drive.list(LOC, PFX + 'backup-'), has = n => bl.some(x => x.name === n), want = [];
    if (!has(PFX + 'backup-' + d + '.json')) want.push(PFX + 'backup-' + d + '.json');
    const older = ranV ? ranV !== APP_VERSION : !!(legacyApp && legacyApp !== APP_VERSION);
    if (older && !has(PFX + 'backup-before-v' + APP_VERSION + '.json')) want.push(PFX + 'backup-before-v' + APP_VERSION + '.json');
    if (want.length) { const body = await fileBody(await allDocsOut()); for (const n of want) { try { bl.push(await Drive.create(n, body, BT(body))); } catch (e) { if (e.status !== 403) throw e; } } }
    const old = (re, keep) => bl.filter(x => re.test(x.name)).sort((a, b) => b.name.localeCompare(a.name)).slice(keep);
    for (const x of [...old(new RegExp('^' + PFX + 'backup-\\d{4}-'), 30), ...old(new RegExp('^' + PFX + 'backup-before-'), 10)]) { try { await Drive.del(x.id); } catch { } }
    await Store.setMeta('backupDay', d); await Store.setMeta('ranVersion', APP_VERSION);
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
    const db0 = Store.name();
    try {
      for (let pass = 0; pass < 3; pass++) {
        if (LOC) {     // the owner may have changed what we can do on their farm
          const fo = await Drive.folder(LOC), role = fo.ownedByMe ? 'owner' : fo.capabilities && fo.capabilities.canEdit ? 'writer' : 'reader';
          if (Farms.cur().role !== role) { Farms.upd(db0, { role }); set({ farm: Farms.cur() }); changed = true; }
        }
        // one small listing of the record files only (not the photos or backups)
        const files = (await Drive.list(LOC, PFX + 'herdbook-')).filter(x => x.name.startsWith(PFX + 'herdbook-'));
        const follow = async to => { LOC = to; await Store.setMeta('loc', LOC); Farms.upd(db0, { folder: LOC, role: 'owner' }); };
        if (!LOC) { const mv = files.find(x => x.name === MOVED); if (mv) { const o = await Drive.json(mv.id); if (o.movedTo) { await follow(o.movedTo); continue; } } }
        const seen = (await Store.getMeta('seen')) || {}, seen2 = {};
        const L = {}, take = [], need = new Set();
        for (const r of await Store.allDocs()) L[r.k] = r;
        const merge = (docs, dirty) => { for (const [k, v] of Object.entries(docs || {})) { const r = L[k]; if (!r || v.u > r.u) { const i = k.indexOf('/'); const n = { k, c: k.slice(0, i), id: k.slice(i + 1), u: v.u, d: v.x ? null : v.d, x: v.x ? 1 : 0, dirty: dirty ? 1 : 0 }; take.push(n); L[k] = n; } } };
        // 1. the one-file format of HerdBook 2.2 and older: read it only when it changed; anything new in it moves into the monthly files
        let legacyApp = null, moved = null;
        for (const lf of files.filter(x => x.name === DATA_FILE)) {
          seen2[lf.id] = lf.modifiedTime;
          if (seen[lf.id] === lf.modifiedTime) continue;
          const o = await Drive.json(lf.id); legacyApp = o.app || legacyApp;
          if (!LOC && o.movedTo) moved = o.movedTo;
          merge(o.docs, true);
        }
        if (moved) { await follow(moved); continue; }
        // 2. the monthly files: read only the ones someone changed since this device last looked
        const parts = files.filter(x => x.name.startsWith(PART)), groups = {};
        for (const x of parts) { (groups[x.name] || (groups[x.name] = [])).push(x); seen2[x.id] = x.modifiedTime; }
        const remoteOf = {};
        const toRead = Object.entries(groups).filter(([, l]) => l.length > 1 || seen[l[0].id] !== l[0].modifiedTime);
        await pool(toRead, 6, async ([n, l]) => {
          const docs = {};
          for (const x of l) { const o = await Drive.json(x.id); for (const [k, v] of Object.entries(o.docs || {})) if (!docs[k] || v.u > docs[k].u) docs[k] = v; }
          remoteOf[n.slice(PART.length, -5)] = docs;
        });
        for (const docs of Object.values(remoteOf)) merge(docs, false);
        if (take.length) { await Store.putDocs(take); changed = true; }
        // 3. what to send: months holding changes made here, months where Drive is missing something we have
        //    (two people saved at the same moment and one copy landed on the other), two copies of one month to fold together
        const byB = {};
        for (const r of Object.values(L)) { const b = bucketOf(r.k); (byB[b] || (byB[b] = [])).push(r); if (r.dirty) need.add(b); }
        for (const [b, docs] of Object.entries(remoteOf)) {
          if (groups[partName(b)].length > 1) need.add(b);
          for (const r of byB[b] || []) { const v = docs[r.k]; if (!v || r.u > v.u) { need.add(b); break; } }
        }
        for (const b of Object.keys(byB)) if (!groups[partName(b)]) need.add(b);     // a month not in Drive yet (or the first sync ever)
        if (!readOnly()) {
          await backupIfDue(legacyApp);
          if (need.size) {
            await pool([...need], 4, async b => {
              const docs = {}; for (const r of byB[b] || []) docs[r.k] = docOut(r);
              const l = (groups[partName(b)] || []).slice().sort((x, y) => (x.createdTime || x.id).localeCompare(y.createdTime || y.id));
              const body = await fileBody(docs);
              const res = l.length ? await Drive.upload(l[0].id, body, BT(body)) : await Drive.create(partName(b), body, BT(body));
              seen2[res.id] = res.modifiedTime;               // our own write: no need to read it back
              for (const x of l.slice(1)) { try { await Drive.del(x.id); delete seen2[x.id]; } catch { } }
            });
            if (LOC) setTimeout(() => soon(0), 20000 + Math.random() * 20000);   // shared farm: look again shortly in case someone saved at the same moment
            await Store.markSynced(Object.values(L).filter(r => r.dirty && need.has(bucketOf(r.k))).map(r => [r.k, r.u]));
          }
        }
        await Store.setMeta('seen', seen2);
        break;
      }
      if (!readOnly()) await syncPhotos();
      const now = new Date().toISOString(); await Store.setMeta('lastSync', now);
      if (changed) { changed = false; await onRemote(false); }   // screen shows the new records before we say "Synced"
      await countPending(); set({ state: 'idle', last: now });
    } catch (e) {
      if (e.needSignIn) set({ state: 'signin' });
      else if (e.offline || !navigator.onLine) set({ state: 'offline' });
      else if (e.status === 404 && LOC) set({ state: 'error', msg: 'This farm’s Google Drive folder can’t be found. The owner may have stopped sharing it with you, or deleted it.' });
      else set({ state: 'error', msg: e.message });
      await countPending();
    } finally {
      running = false;
      if (changed) onRemote(false);
      if (again) { again = false; soon(200); }
    }
  }

  // photos waiting to go up (or be deleted) - a short list, so a sync never has to look through every picture
  async function photoQueue() {
    let q = await Store.getMeta('photoQ');
    if (!Array.isArray(q)) { q = (await Store.allPhotos()).filter(p => p.del || !p.up).map(p => p.pid); await Store.setMeta('photoQ', q); }
    return q;
  }
  async function queuePhoto(pid) { const q = await photoQueue(); if (!q.includes(pid)) { q.push(pid); await Store.setMeta('photoQ', q); } }
  async function syncPhotos() {
    const q = await photoQueue(); if (!q.length) return;
    const left = [];
    for (const pid of q) {
      const p = await Store.getPhoto(pid), name = PFX + 'photo-' + pid + '.jpg';
      try {
        if (!p) continue;
        if (p.del) { for (const f of await Drive.find(name)) { try { await Drive.del(f.id); } catch { } } await Store.delPhoto(pid); }
        else if (!p.up && p.blob) { if (!(await Drive.find(name)).length) await Drive.create(name, p.blob, 'image/jpeg'); p.up = 1; await Store.putPhoto(p); }
      } catch (e) { left.push(pid); if (e.needSignIn || e.offline) { left.push(...q.slice(q.indexOf(pid) + 1)); break; } }
    }
    await Store.setMeta('photoQ', [...new Set(left)]);
  }
  // photo for display: this device first, then Drive
  const urls = {};
  async function photoUrl(pid) {
    if (urls[pid]) return urls[pid];
    let p = await Store.getPhoto(pid);
    if ((!p || !p.blob) && st.account && Auth.valid() && navigator.onLine) {
      try { const f = (await Drive.find(PFX + 'photo-' + pid + '.jpg'))[0]; if (f) { p = { pid, blob: await Drive.blob(f.id), up: 1 }; await Store.putPhoto(p); } } catch { }
    }
    return p && p.blob ? (urls[pid] = URL.createObjectURL(p.blob)) : null;
  }
  async function addPhoto(pid, blob) { await Store.putPhoto({ pid, blob, up: 0 }); await queuePhoto(pid); soon(); }
  async function removePhoto(pid) { await Store.putPhoto({ pid, del: 1 }); await queuePhoto(pid); if (urls[pid]) { URL.revokeObjectURL(urls[pid]); delete urls[pid]; } soon(); }
  const forgetUrls = () => { for (const k in urls) { URL.revokeObjectURL(urls[k]); delete urls[k]; } };

  // ---- Drive backups (list + restore)
  async function listBackups() {
    if (!st.account) return [];
    if (!Auth.valid()) await Auth.get(true, st.account.email);
    return (await Drive.list(LOC, PFX + 'backup-')).filter(x => x.name.startsWith(PFX + 'backup-')).sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || ''));
  }
  async function readBackup(id) { return Drive.json(id); }
  async function backupBeforeRestore() {
    const n = PFX + 'backup-before-restore-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json';
    const body = await fileBody(await allDocsOut()); await Drive.create(n, body, BT(body));
  }

  // ---- sharing
  const need = async () => { if (!st.account) throw new Error('Sign in with Google first (Settings).'); if (!Auth.valid()) await Auth.get(true, st.account.email); };
  // move a farm from the private app folder into a "HerdBook – <farm>" folder the owner can share
  async function makeShareable(farmName) {
    await need(); if (LOC) return LOC;
    await run(true); if (st.state === 'error') throw new Error(st.msg);
    const fo = await Drive.makeFolder('HerdBook – ' + farmName);
    // pictures: copy every one across (from this device, or from the old Drive folder)
    for (const x of (await Drive.list(null, PFX + 'photo-')).filter(x => x.name.startsWith(PFX + 'photo-'))) {
      const pid = x.name.slice((PFX + 'photo-').length, -4), p = await Store.getPhoto(pid);
      await Drive.create(x.name, p && p.blob ? p.blob : await Drive.blob(x.id), 'image/jpeg', fo.id);
    }
    LOC = fo.id; await Store.setMeta('loc', LOC); await Store.setMeta('seen', {}); Farms.upd(Store.name(), { folder: LOC, role: 'owner', name: farmName });
    await run(true);                                   // writes the herd into the new folder
    // tell the owner's other phones and computers where the herd went (both ways, for phones still on HerdBook 2.2)
    const mark = new Blob([JSON.stringify({ movedTo: LOC })], { type: 'application/json' });
    const mv = await Drive.find(MOVED, null); if (mv.length) await Drive.upload(mv[0].id, mark, 'application/json'); else await Drive.create(MOVED, mark, 'application/json', null);
    for (const df of await Drive.find(DATA_FILE, null)) { const o = await Drive.json(df.id); o.movedTo = LOC; await Drive.upload(df.id, new Blob([JSON.stringify(o)], { type: 'application/json' }), 'application/json'); }
    set({ farm: Farms.cur() });
    return LOC;
  }
  async function people() { await need(); if (!LOC) return []; return Drive.perms(LOC); }
  async function invite(email, role, farmName) {
    await need(); const loc = await makeShareable(farmName);
    const who = st.account.name || st.account.email;
    const msg = `${who} invited you to the "${farmName}" herd in HerdBook.\n\n1. Open ${location.origin + location.pathname} on your phone or computer.\n2. Sign in with Google using this Gmail address.\n3. Tap the farm name at the top, then "Join a farm shared with me", and pick "HerdBook – ${farmName}".`;
    return Drive.share(loc, email.trim().toLowerCase(), role, msg);
  }
  async function setRole(pid, role) { await need(); return Drive.setRole(LOC, pid, role); }
  async function remove(pid) { await need(); return Drive.unshare(LOC, pid); }
  async function renameFolder(farmName) { if (LOC && st.farm && st.farm.role === 'owner' && st.account && Auth.valid()) { try { await Drive.rename(LOC, 'HerdBook – ' + farmName); } catch { } } }

  // ---- several farms on one device
  async function switchFarm(dbName) {
    clearTimeout(timer); while (running) await new Promise(r => setTimeout(r, 100));
    const acct = st.account;
    forgetUrls(); await Store.switchTo(dbName);
    if (acct && !(await Store.getMeta('account'))) await Store.setMeta('account', acct);
    await loadFarm(); await onRemote(true); soon(200);
  }
  // let a farm someone shared with you onto this device
  async function joinFarm() {
    await need();
    let id = null; try { const l = (await Drive.farmFolders()).filter(x => !x.ownedByMe && !Farms.get().some(f => f.folder === x.id)); if (l.length === 1) id = l[0].id; else if (l.length > 1) id = await chooseFolder(l); } catch { }
    if (!id) id = await Picker.pick();
    if (!id) return null;
    const fo = await Drive.folder(id);
    if (!fo.appProperties || fo.appProperties.hb !== FARM_TAG) throw new Error('That folder isn’t a HerdBook farm.');
    const dbName = Farms.dbFor(id), owner = fo.owners && fo.owners[0];
    if (Farms.get().some(f => f.db === dbName)) { await switchFarm(dbName); return fo; }
    Farms.upd(dbName, { name: fo.name.replace(/^HerdBook – /, ''), folder: id, role: fo.capabilities && fo.capabilities.canEdit ? 'writer' : 'reader', owner: owner ? owner.displayName || owner.emailAddress : '' });
    const acct = st.account;
    await Store.switchTo(dbName); await Store.setMeta('account', acct); await Store.setMeta('loc', id);
    forgetUrls(); await loadFarm(); await run(true); await onRemote(true);
    return fo;
  }
  let chooseFolder = async l => l[0].id;
  async function leaveFarm(dbName) {
    if (dbName === Farms.BASE) throw new Error('This is your own farm on this device.');
    if (Store.name() === dbName) await switchFarm(Farms.BASE);
    await Store.drop(dbName); Farms.remove(dbName);
  }
  return { st, init, soon, run, signIn, signOut, photoUrl, addPhoto, removePhoto, listBackups, readBackup, backupBeforeRestore, countPending,
    makeShareable, people, invite, setRole, remove, renameFolder, switchFarm, joinFarm, leaveFarm, readOnly, setChooser: fn => { chooseFolder = fn; } };
})();
