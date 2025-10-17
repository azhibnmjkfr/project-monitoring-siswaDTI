/* =========================================================================
   Google Drive Sync (with status chip) — defensive build
   ========================================================================= */

const GOOGLE_CLIENT_ID = "435459939699-iar3gdsl2kuc256u3lhaq0glrsu3kpqe.apps.googleusercontent.com";   // <-- milikmu
const GOOGLE_API_KEY   = "AIzaSyDWGAbIKD3cuO2wGkNpj5CEb3PIBx9k6-k";                                     // <-- milikmu

const DRIVE_FILE_NAME = "project-monitoring-siswa-data.json";
const LS_FILE_ID_KEY  = "pms_drive_file_id";
const LS_APP_KEY      = "penilaianAppV2";

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function log(...a){ try{ console.log("[DriveSync]", ...a); }catch(_){} }

/* ---------- Status chip ---------- */
let chip;
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
  const colors = { loading:"#fff", ready:"#E7F5EC", error:"#FFEDEE" };
  chip.style.background = colors[tone] || "#fff";
  chip.textContent = `Drive: ${text}`;
}

/* ---------- Inject scripts ---------- */
(function inject(){
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootstrap);
  else bootstrap();

  const gis = document.createElement('script');
  gis.src = "https://accounts.google.com/gsi/client";
  gis.async = true; gis.defer = true;
  document.head.appendChild(gis);

  const gapi = document.createElement('script');
  gapi.src = "https://apis.google.com/js/api.js";
  gapi.async = true; gapi.defer = true;
  gapi.onload = ()=> window.__gapiLoaded = true;
  document.head.appendChild(gapi);
})();

/* ---------- Bootstrap ---------- */
async function bootstrap(){
  // Pasang tombol dulu supaya UI selalu muncul
  mountDriveUI();
  setChip("Loading…", "loading");

  // tunggu gapi (maks ~5 dtk)
  for (let i=0;i<25;i++){ if (window.__gapiLoaded && window.gapi) break; await sleep(200); }
  if (!window.gapi){ setChip("gapi tidak tersedia (diblokir/lemot)", "error"); return; }

  try{
    await gapi.load("client");
    await gapi.client.init({
      apiKey: GOOGLE_API_KEY,
      discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
    });
    setChip("Ready", "ready");
    autoLoadPublicData(); // non-blocking
  }catch(e){
    log("gapi init error", e);
    setChip("Init error (cek API Key & origin)", "error");
  }
}

/* ---------- UI ---------- */
let tokenClient = null, accessToken = null;

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
  document.getElementById('btnDriveSave').onclick    = driveSave;
  document.getElementById('btnDriveLoad').onclick    = driveLoad;
}

/* ---------- Auth ---------- */
function driveConnect(){
  try{
    if (!window.google?.accounts?.oauth2){
      setChip("Auth belum siap, klik lagi 1–2 dtk", "error"); return;
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
  }catch(e){ log("connect error", e); setChip("Auth error (cek Client ID / Test users)", "error"); }
}

/* ---------- Helpers ---------- */
async function findDriveFileIdByName(){
  try{
    if (!gapi?.client?.drive) return null;
    const res = await gapi.client.drive.files.list({
      q: `name='${DRIVE_FILE_NAME}' and trashed=false`,
      fields: "files(id,name)"
    });
    const files = res.result.files || [];
    return files.length ? files[0].id : null;
  }catch(e){ log("find file error", e); return null; }
}
async function ensurePublicReadable(fileId){
  try{ await gapi.client.drive.permissions.create({ fileId, resource: { role:"reader", type:"anyone" } }); }
  catch(e){ /* abaikan jika sudah publik */ }
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
    body: body
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
    body: body
  });
  if(!res.ok) throw new Error('Update file failed');
}

/* ---------- Actions ---------- */
async function driveSave(){
  try{
    if(!accessToken){ alert("Klik Connect Drive dulu."); return; }
    const contentStr = localStorage.getItem(LS_APP_KEY) || "{}";
    let fileId = localStorage.getItem(LS_FILE_ID_KEY) || await findDriveFileIdByName();

    if(!fileId){
      const id = await createDriveFile(contentStr);
      localStorage.setItem(LS_FILE_ID_KEY, id);
      await ensurePublicReadable(id);
      alert("Data tersimpan (file baru) di Drive.");
      setChip("Saved (new)", "ready");
    }else{
      await updateDriveFile(fileId, contentStr);
      await ensurePublicReadable(fileId);
      alert("Data diperbarui di Drive.");
      setChip("Saved", "ready");
    }
  }catch(e){ log("save error", e); setChip("Save error", "error"); alert("Gagal menyimpan ke Drive: " + e.message); }
}

async function driveLoad(){
  try{
    let fileId = localStorage.getItem(LS_FILE_ID_KEY) || await findDriveFileIdByName();
    if(!fileId){ setChip("No file", "error"); alert("Belum ada file di Drive. Simpan dulu."); return; }
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('File tidak bisa diakses publik');
    const jsonText = await res.text();
    localStorage.setItem(LS_APP_KEY, jsonText);
    setChip("Loaded", "ready");
    location.reload();
  }catch(e){
    log("load error", e);
    setChip("Load error", "error");
    alert("Gagal memuat dari Drive: " + e.message);
  }
}

async function autoLoadPublicData(){
  try{
    const local = localStorage.getItem(LS_APP_KEY);
    if(local && local !== "{}") return;
    for (let i=0;i<10;i++){ if(window.gapi) break; await sleep(200); }
    const fileId = await findDriveFileIdByName(); if(!fileId) return;
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url); if(!res.ok) return;
    const jsonText = await res.text();
    localStorage.setItem(LS_APP_KEY, jsonText);
    setChip("Auto-loaded", "ready");
  }catch(e){ /* ignore */ }
}

