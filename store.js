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
const APP_VERSION = '2.2.0';
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
  // the files of the open farm
  const list = (loc = LOC) => loc ? query('q=' + encodeURIComponent(`'${loc}' in parents and trashed=false`) + '&fields=' + FIELDS) : query('spaces=appDataFolder&fields=' + FIELDS);
  const parents = loc => [loc || 'appDataFolder'];
  async function create(name, body, type, loc = LOC) { const m = await J('/drive/v3/files?fields=id,name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parents: parents(loc) }) }); await upload(m.id, body, type); return m; }
  const upload = (id, body, type) => f('/upload/drive/v3/files/' + id + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': type }, body });
  const text = async id => (await f('/drive/v3/files/' + id + '?alt=media')).text();
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
  return { list, create, upload, text, blob, copy, del, who, makeFolder, folder, rename, farmFolders, perms, share, setRole, unshare };
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
  let files = null, running = false, again = false, timer = null, onRemote = () => { }, onState = () => { }, started = false;
  const byName = n => files && files.find(x => x.name === n);
  const deviceName = () => /iPhone/.test(navigator.userAgent) ? 'iPhone' : /iPad/.test(navigator.userAgent) ? 'iPad' : /Android/.test(navigator.userAgent) ? 'Android phone' : /Windows/.test(navigator.userAgent) ? 'Windows PC' : 'computer';
  function set(o) { Object.assign(st, o); onState(st); }
  async function countPending() { const l = await Store.allDocs(); set({ pending: l.filter(r => r.dirty).length }); }
  const readOnly = () => !!(st.farm && st.farm.role === 'reader');

  // read the open farm's settings from this device
  async function loadFarm() {
    await Auth.restore();
    LOC = (await Store.getMeta('loc')) || null;
    const acct = await Store.getMeta('account');
    set({ account: acct || null, last: await Store.getMeta('lastSync') || null, state: acct ? 'idle' : 'local', farm: Farms.cur(), msg: '' });
    files = null; await countPending();
  }
  async function init(h) {
    onRemote = h.onRemote || onRemote; onState = h.onState || onState;
    await loadFarm();
    if (!started) {
      started = true; Auth.warm();
      addEventListener('online', () => { Auth.warm(); soon(500); });
      addEventListener('offline', () => set({ state: st.account ? 'offline' : st.state }));
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') soon(800); });
      // shared farms check more often: someone else may be recording too
      setInterval(() => { if (LOC || Date.now() % 3 === 0) soon(0); }, 60 * 1000);
    }
    if (st.account) soon(300);
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
      await Store.clearAll(); LOC = null; onRemote(true);
    }
    const acct = { pid: u.permissionId, email: u.emailAddress, name: u.displayName };
    await Store.setMeta('account', acct); set({ account: acct, state: 'idle', msg: '' });
    files = null; await run(true); return true;
  }
  // sign out of every farm on this device
  async function signOut() {
    let pend = 0; for (const fm of Farms.get()) { if (fm.db === Store.name()) pend += (await Store.allDocs()).filter(r => r.dirty).length; }
    if (!confirm('Sign out and remove ' + (Farms.get().length > 1 ? 'every farm' : 'this herd') + ' from this device?\n\nYour records stay safe in Google; sign in again to get them back.' + (pend ? `\n\nWARNING: ${pend} change(s) on this device have NOT synced yet and would be lost. Cancel and tap Sync first.` : ''))) return false;
    Auth.revoke();
    const cur = Store.name();
    for (const fm of Farms.get()) if (fm.db !== cur) await Store.drop(fm.db);
    await Store.clearAll(); Farms.reset(); await Store.switchTo(Farms.BASE);
    if (cur !== Farms.BASE) await Store.drop(cur);
    LOC = null; files = null; set({ account: null, state: 'local', last: null, pending: 0, farm: Farms.cur() }); onRemote(true); return true;
  }

  async function backupIfDue(remote, dataFile) {
    const day = new Date(); const d = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
    const want = [];
    if (!byName(PFX + 'backup-' + d + '.json')) want.push(PFX + 'backup-' + d + '.json');
    // first time a NEW version of HerdBook touches records an older version wrote
    if (remote.app && remote.app !== APP_VERSION && !byName(PFX + 'backup-before-v' + APP_VERSION + '.json')) want.push(PFX + 'backup-before-v' + APP_VERSION + '.json');
    for (const n of want) { try { files.push(await Drive.copy(dataFile.id, n)); } catch (e) { if (e.status !== 403) throw e; } }
    // keep the newest 30 daily copies and 10 before-update / before-restore copies (only what this account may delete)
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
    const db0 = Store.name();
    try {
      for (let pass = 0; pass < 2; pass++) {
        if (LOC) {     // the owner may have changed what we can do on their farm
          const fo = await Drive.folder(LOC), role = fo.ownedByMe ? 'owner' : fo.capabilities && fo.capabilities.canEdit ? 'writer' : 'reader';
          if (Farms.cur().role !== role) { Farms.upd(Store.name(), { role }); set({ farm: Farms.cur() }); changed = true; }
        }
        files = await Drive.list();         // fresh every time: other devices add files (photos, the first data file)
        // normally one data file; two can appear if two devices start a brand-new herd at the same moment -> fold them together
        const dfs = files.filter(x => x.name === DATA_FILE).sort((a, b) => (a.createdTime || a.id).localeCompare(b.createdTime || b.id));
        let df = dfs[0], remote = { docs: {} }, extra = false;
        if (df) remote = JSON.parse(await Drive.text(df.id)); if (!remote.docs) remote.docs = {};
        // the owner made this farm shareable on another device: follow it to its folder
        if (!LOC && remote.movedTo) { LOC = remote.movedTo; await Store.setMeta('loc', LOC); Farms.upd(db0, { folder: LOC, role: 'owner' }); continue; }
        if (df && !readOnly()) await backupIfDue(remote, df);
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
        // send ours if we have anything Drive does not (compared record by record, so nothing is lost if two people saved at once)
        const sent = [];
        for (const r of Object.values(L)) { const v = remote.docs[r.k]; if (!v || r.u > v.u) sent.push([r.k, r.u]); }
        if (!readOnly() && (sent.length || !df || extra || dfs.length > 1)) {
          const out = { format: 1, app: APP_VERSION, saved: new Date().toISOString(), by: (st.account.name || st.account.email) + ' · ' + deviceName(), docs: {} };
          for (const r of Object.values(L)) out.docs[r.k] = r.x ? { u: r.u, x: 1 } : { u: r.u, d: r.d };
          const body = new Blob([JSON.stringify(out)], { type: 'application/json' });
          if (df) await Drive.upload(df.id, body, 'application/json'); else files.push(df = await Drive.create(DATA_FILE, body, 'application/json'));
          for (const x of dfs.slice(1)) { try { await Drive.del(x.id); files = files.filter(y => y !== x); } catch { } }
          if (LOC && sent.length) setTimeout(() => soon(0), 20000 + Math.random() * 20000);   // shared farm: look again shortly in case someone saved at the same moment
        }
        // anything Drive already had (or we just sent) is synced
        if (!readOnly()) await Store.markSynced(Object.values(L).filter(r => r.dirty).map(r => [r.k, r.u]));
        break;
      }
      if (!readOnly()) await syncPhotos();
      const now = new Date().toISOString(); await Store.setMeta('lastSync', now);
      if (changed) { changed = false; await onRemote(false); }   // screen shows the new records before we say "Synced"
      await countPending(); set({ state: 'idle', last: now });
    } catch (e) {
      if (e.needSignIn) set({ state: 'signin' });
      else if (e.offline || !navigator.onLine) set({ state: 'offline' });
      else if (e.status === 404 && LOC) { files = null; set({ state: 'error', msg: 'This farm’s Google Drive folder can’t be found. The owner may have stopped sharing it with you, or deleted it.' }); }
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
      if (p.del) { if (f) { try { await Drive.del(f.id); } catch { } files = files.filter(x => x !== f); } await Store.delPhoto(p.pid); }
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
  const forgetUrls = () => { for (const k in urls) { URL.revokeObjectURL(urls[k]); delete urls[k]; } };

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

  // ---- sharing
  const need = async () => { if (!st.account) throw new Error('Sign in with Google first (Settings).'); if (!Auth.valid()) await Auth.get(true, st.account.email); };
  // move a farm from the private app folder into a "HerdBook – <farm>" folder the owner can share
  async function makeShareable(farmName) {
    await need(); if (LOC) return LOC;
    await run(true); if (st.state === 'error') throw new Error(st.msg);
    const old = await Drive.list(null);
    const fo = await Drive.makeFolder('HerdBook – ' + farmName);
    // pictures: copy every one across (from this device, or from the old Drive folder)
    for (const x of old.filter(x => x.name.startsWith(PFX + 'photo-'))) {
      const pid = x.name.slice((PFX + 'photo-').length, -4); let p = await Store.getPhoto(pid);
      const b = p && p.blob ? p.blob : await Drive.blob(x.id);
      await Drive.create(x.name, b, 'image/jpeg', fo.id);
    }
    LOC = fo.id; await Store.setMeta('loc', LOC); Farms.upd(Store.name(), { folder: LOC, role: 'owner', name: farmName });
    await run(true);                                   // writes the herd into the new folder
    // tell the owner's other phones and computers where the herd went
    const df = old.find(x => x.name === DATA_FILE);
    if (df) { const o = JSON.parse(await Drive.text(df.id)); o.movedTo = LOC; await Drive.upload(df.id, new Blob([JSON.stringify(o)], { type: 'application/json' }), 'application/json'); }
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
