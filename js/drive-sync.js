/* =========================================================================
   Google Drive Sync – v3 (autosave + autoload polling, conflict aware)
   ========================================================================= */

const GOOGLE_CLIENT_ID = CONFIG.CLIENT_ID;
const GOOGLE_API_KEY   = CONFIG.API_KEY;

const DRIVE_FILE_NAME = "project-monitoring-siswa-data.json";
const LS_APP_KEY      = "penilaianAppV2";
const LS_FILE_ID_KEY  = "pms_drive_file_id";
const LS_REMOTE_META  = "pms_drive_remote_meta";   // {fileId, modifiedTime, md5, when}
const LS_LAST_HASH    = "pms_last_local_hash";     // checksum terakhir yang tersimpan

// interval
const CHECK_LOCAL_EVERY_MS = 10_000;   // cek perubahan lokal tiap 10 dtk
const POLL_REMOTE_EVERY_MS = 60_000;   // cek perubahan di Drive tiap 60 dtk
const SAVE_DEBOUNCE_MS     = 3_000;    // jeda sebelum auto-save (debounce)

let chip;                   // status chip
let accessToken = null;     // OAuth token
let tokenClient = null;     // GIS client
let saveTimer = null;       // debounce saver
let lastLocalHash = null;   // hash terakhir dari local data
let lastLoadedRemoteTime = null; // kapan terakhir load dari Drive

/* ---------- util ---------- */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => { try{ console.log("[DriveSync]", ...a); }catch(_){} };

function setChip(text, tone="loading"){
  if(!chip){
    chip = document.createElement('div');
    chip.id = 'driveStatusChip';
    chip.style.cssText = `
      position:fixed;right:14px;bottom:150px;z-index:9999;
      font:12px/1.2 system-ui,Segoe UI,Arial; color:#244626;
      background:#fff;border:1px solid #D3E1D8;border-radius:10px;
      padding:6px 10px;box-shadow:0 6px 14px rgba(0,0,0,.08)
    `;
    document.body.appendChild(chip);
  }
  const colors = { loading:"#fff", ready:"#E7F5EC", error:"#FFEDEE", warn:"#FFF5E5" };
  chip.style.background = colors[tone] || "#fff";
  chip.textContent = `Drive: ${text}`;
}

function getLocalJsonStr(){ return localStorage.getItem(LS_APP_KEY) || "{}"; }
function setLocalJsonStr(s){ localStorage.setItem(LS_APP_KEY, s); }

function loadRemoteMeta(){ try{ return JSON.parse(localStorage.getItem(LS_REMOTE_META)||"null"); }catch(_){ return null; } }
function saveRemoteMeta(meta){ localStorage.setItem(LS_REMOTE_META, JSON.stringify(meta)); }

/* checksum ringan (32-bit) */
function checksum(str){
  let h = 2166136261;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h += (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24); // FNV-ish
  }
  return (h>>>0).toString(16);
}

/* ---------- inject scripts ---------- */
(function inject(){
  // tombol UI
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountDriveUI);
  else mountDriveUI();
  setChip("Loading…", "loading");

  // GIS
  const gis = document.createElement('script');
  gis.src = "https://accounts.google.com/gsi/client";
  gis.async = true; gis.defer = true;
  document.head.appendChild(gis);

  // gapi
  const gapi = document.createElement('script');
  gapi.src = "https://apis.google.com/js/api.js";
  gapi.async = true; gapi.defer = true;
  gapi.onload = () => window.__gapiLoaded__ = true;
  document.head.appendChild(gapi);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();
})();

/* ---------- bootstrap ---------- */
async function waitForGapi(maxMs=8000){
  const start = Date.now();
  while(Date.now()-start < maxMs){
    if (window.__gapiLoaded__ && window.gapi && typeof gapi.load === "function") return true;
    await sleep(150);
  }
  return false;
}
async function loadGapiClientModule(maxMs=8000){
  await new Promise((resolve,reject)=>{
    try{ gapi.load("client", () => resolve()); }catch(e){ reject(e); }
  });
  const start = Date.now();
  while(Date.now()-start < maxMs){
    if (gapi.client) return true;
    await sleep(100);
  }
  return false;
}
async function initGapiClient(){
  const ok = await loadGapiClientModule();
  if(!ok) throw new Error("gapi.client not ready");
  await gapi.client.init({
    apiKey: GOOGLE_API_KEY,
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
  });
}

async function bootstrap(){
  const ok = await waitForGapi();
  if(!ok){ setChip("gapi tidak tersedia", "error"); return; }
  try{
    await initGapiClient();
    setChip("Ready", "ready");
    autoLoadPublicData();   // pertama kali (jika local kosong)
    startAutoWatchers();    // aktifkan auto-save & auto-poll
  }catch(e){
    log("gapi init error", e);
    setChip("Init error (cek API Key & origin)", "error");
  }
}

/* ---------- UI ---------- */
function mountDriveUI(){
  if (document.getElementById('driveSyncDock')) return;
  const dock = document.createElement('div');
  dock.id = 'driveSyncDock';
  dock.style.cssText = `
    position: fixed; right: 14px; bottom: 14px; z-index: 9999;
    display: flex; flex-direction: column; gap: 8px;
  `;
  dock.innerHTML = `
    <button id="btnDriveConnect" class="btn" style="border-radius:10px;padding:8px 12px">Connect Drive</button>
    <button id="btnDriveSave" class="btn primary" style="border-radius:10px;padding:8px 12px">Save to Drive</button>
    <button id="btnDriveLoad" class="btn outline" style="border-radius:10px;padding:8px 12px">Load from Drive</button>
  `;
  document.body.appendChild(dock);
  document.getElementById('btnDriveConnect').onclick = driveConnect;
  document.getElementById('btnDriveSave').onclick    = () => driveSave({manual:true});
  document.getElementById('btnDriveLoad').onclick    = driveLoad;
}

/* ---------- Auth ---------- */
function driveConnect(){
  try{
    if (!window.google?.accounts?.oauth2){
      setChip("Auth belum siap, klik lagi", "warn"); return;
    }
    if (!tokenClient){
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata',
        callback: (resp)=>{
          if (resp?.access_token){
            accessToken = resp.access_token;
            setChip("Connected", "ready");
            alert("Google Drive connected!");
          } else setChip("Gagal dapat token", "error");
        }
      });
    }
    tokenClient.requestAccessToken();
  }catch(e){
    log("connect error", e);
    setChip("Auth error (cek Client ID / Test users)", "error");
  }
}

/* ---------- Drive helpers ---------- */
async function findDriveFileIdByName(){
  try{
    const res = await gapi.client.drive.files.list({
      q: `name='${DRIVE_FILE_NAME}' and trashed=false`,
      fields: "files(id,name,modifiedTime,md5Checksum)"
    });
    const files = res.result.files || [];
    if (!files.length) return null;
    const f = files[0];
    saveRemoteMeta({fileId:f.id, modifiedTime:f.modifiedTime, md5:f.md5Checksum, when:Date.now()});
    return f.id;
  }catch(e){ log("find file error", e); return null; }
}

async function getFileMeta(fileId){
  try{
    const r = await gapi.client.drive.files.get({
      fileId, fields: "id,modifiedTime,md5Checksum"
    });
    return r.result;
  }catch(e){ return null; }
}

async function ensurePublicReadable(fileId){
  try{ await gapi.client.drive.permissions.create({ fileId, resource:{ role:"reader", type:"anyone" } }); }
  catch(_){ /* abaikan jika sudah publik */ }
}

async function createDriveFile(contentStr){
  const metadata = { name: DRIVE_FILE_NAME, mimeType: 'application/json' };
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";
  const body =
    delimiter + "Content-Type: application/json\r\n\r\n" + JSON.stringify(metadata) +
    delimiter + "Content-Type: application/json\r\n\r\n" + contentStr + close_delim;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'multipart/related; boundary=' + boundary },
    body
  });
  if(!res.ok) throw new Error('Create file failed');
  const json = await res.json();
  return json.id;
}

async function updateDriveFile(fileId, contentStr){
  const metadata = { mimeType: 'application/json' };
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";
  const body =
    delimiter + "Content-Type: application/json\r\n\r\n" + JSON.stringify(metadata) +
    delimiter + "Content-Type: application/json\r\n\r\n" + contentStr + close_delim;

  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'multipart/related; boundary=' + boundary },
    body
  });
  if(!res.ok) throw new Error('Update file failed');
}

/* ---------- Actions ---------- */
async function driveSave({manual=false}={}){
  try{
    if(!accessToken){ alert("Klik Connect Drive dulu."); return; }
    const contentStr = getLocalJsonStr();
    let fileId = localStorage.getItem(LS_FILE_ID_KEY) || await findDriveFileIdByName();

    if(!fileId){
      const id = await createDriveFile(contentStr);
      localStorage.setItem(LS_FILE_ID_KEY, id);
      await ensurePublicReadable(id);
      setChip("Saved (new)", "ready");
    }else{
      await updateDriveFile(fileId, contentStr);
      await ensurePublicReadable(fileId);
      setChip("Saved", "ready");
    }

    const meta = await getFileMeta(localStorage.getItem(LS_FILE_ID_KEY));
    if (meta) saveRemoteMeta({fileId: meta.id, modifiedTime: meta.modifiedTime, md5: meta.md5Checksum, when: Date.now()});
    lastLoadedRemoteTime = Date.now();

    const h = checksum(contentStr);
    lastLocalHash = h;
    localStorage.setItem(LS_LAST_HASH, h);

    if (manual) alert("Data disimpan ke Google Drive.");
  }catch(e){
    log("save error", e);
    setChip("Save error", "error");
    alert("Gagal menyimpan ke Drive: " + e.message);
  }
}

async function driveLoad(){
  try{
    let fileId = localStorage.getItem(LS_FILE_ID_KEY) || await findDriveFileIdByName();
    if(!fileId){ setChip("No file", "warn"); alert("Belum ada file di Drive. Simpan dulu."); return; }
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('File tidak bisa diakses publik');
    const jsonText = await res.text();
    setLocalJsonStr(jsonText);
    setChip("Loaded", "ready");
    lastLoadedRemoteTime = Date.now();
    // cache hash baru supaya tidak langsung autosave lagi
    lastLocalHash = checksum(jsonText);
    localStorage.setItem(LS_LAST_HASH, lastLocalHash);
    location.reload();
  }catch(e){
    log("load error", e);
    setChip("Load error", "error");
    alert("Gagal memuat dari Drive: " + e.message);
  }
}

/* ---------- Auto features ---------- */
function startAutoWatchers(){
  // Inisialisasi hash lokal
  lastLocalHash = localStorage.getItem(LS_LAST_HASH) || checksum(getLocalJsonStr());
  localStorage.setItem(LS_LAST_HASH, lastLocalHash);

  // 1) DETEKSI PERUBAHAN LOKAL -> AUTO SAVE (debounce)
  setInterval(() => {
    try{
      const nowHash = checksum(getLocalJsonStr());
      if (nowHash !== lastLocalHash){
        lastLocalHash = nowHash;
        localStorage.setItem(LS_LAST_HASH, nowHash);
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(()=> {
          if (accessToken) driveSave().catch(()=>{});
          else setChip("Perubahan belum disimpan (Connect Drive)", "warn");
        }, SAVE_DEBOUNCE_MS);
      }
    }catch(_){}
  }, CHECK_LOCAL_EVERY_MS);

  // 2) POLLING REMOTE -> AUTO LOAD JIKA LEBIH BARU
  setInterval(async () => {
    try{
      const fileId = localStorage.getItem(LS_FILE_ID_KEY) || await findDriveFileIdByName();
      if(!fileId) return;
      const meta = await getFileMeta(fileId);
      if(!meta) return;

      const rec = loadRemoteMeta() || {};
      const remoteTime = Date.parse(meta.modifiedTime || rec.modifiedTime || 0);
      const localChangeTime = Date.now() - (saveTimer ? SAVE_DEBOUNCE_MS : 0);

      // Jika remote lebih baru daripada terakhir kali kita muat/simpan, cek konflik
      const likelyChangedRemotely = !lastLoadedRemoteTime || remoteTime > lastLoadedRemoteTime + 2000;

      if (likelyChangedRemotely){
        // kalau lokal tidak berubah sejak terakhir save (hash sama), auto load
        const hNow = checksum(getLocalJsonStr());
        const hSaved = localStorage.getItem(LS_LAST_HASH);
        if (hNow === hSaved){
          setChip("Remote updated → auto load", "ready");
          await driveLoad();
        }else{
          // ada perubahan lokal juga → minta pilihan user
          setChip("Remote changed; klik Load from Drive", "warn");
        }
      }
    }catch(_){ /* diamkan */ }
  }, POLL_REMOTE_EVERY_MS);
}

/* ---------- Auto load pertama kali (jika local kosong) ---------- */
async function autoLoadPublicData(){
  try{
    const local = getLocalJsonStr();
    if(local && local !== "{}") return;
    const fileId = await findDriveFileIdByName(); if(!fileId) return;
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url); if(!res.ok) return;
    const jsonText = await res.text();
    setLocalJsonStr(jsonText);
    lastLocalHash = checksum(jsonText);
    localStorage.setItem(LS_LAST_HASH, lastLocalHash);
    setChip("Auto-loaded", "ready");
  }catch(_){}
}
