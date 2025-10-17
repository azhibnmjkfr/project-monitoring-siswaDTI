/* ============================================================
   Google Drive Sync (no server) for project-monitoring-siswaDTI
   ============================================================ */

const GOOGLE_CLIENT_ID = "435459939699-iar3gdsl2kuc256u3lhaq0glrsu3kpqe.apps.googleusercontent.com
";     // <-- ganti ini
const GOOGLE_API_KEY   = "AIzaSyDWGAbIKD3cuO2wGkNpj5CEb3PIBx9k6-k";       // <-- ganti ini

const DRIVE_FILE_NAME = "project-monitoring-siswa-data.json";
const LS_FILE_ID_KEY  = "pms_drive_file_id";
const LS_APP_KEY      = "penilaianAppV2";

(function injectGoogleScripts(){
  const gis = document.createElement('script');
  gis.src = "https://accounts.google.com/gsi/client";
  document.head.appendChild(gis);

  const gapi = document.createElement('script');
  gapi.src = "https://apis.google.com/js/api.js";
  gapi.onload = ()=> window.gapi.load('client', initGapi);
  document.head.appendChild(gapi);
})();

async function initGapi(){
  try{
    await gapi.client.init({
      apiKey: GOOGLE_API_KEY,
      discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
    });
  }catch(e){ console.warn("gapi init error", e); }
  mountDriveUI();
  autoLoadPublicData();
}

function mountDriveUI(){
  if (document.getElementById('driveSyncDock')) return;
  const dock = document.createElement('div');
  dock.id = 'driveSyncDock';
  dock.style.cssText = `
    position: fixed; right: 14px; bottom: 14px; z-index: 9999;
    display: flex; flex-direction: column; gap: 8px;
  `;
  dock.innerHTML = `
    <button id="btnDriveConnect" style="border-radius:10px;padding:8px 12px">Connect Drive</button>
    <button id="btnDriveSave" style="border-radius:10px;padding:8px 12px">Save to Drive</button>
    <button id="btnDriveLoad" style="border-radius:10px;padding:8px 12px">Load from Drive</button>
  `;
  document.body.appendChild(dock);
  document.getElementById('btnDriveConnect').onclick = driveConnect;
  document.getElementById('btnDriveSave').onclick    = driveSave;
  document.getElementById('btnDriveLoad').onclick    = driveLoad;
}

let tokenClient = null;
let accessToken = null;

function driveConnect(){
  if (!tokenClient){
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata',
      callback: (resp)=>{
        if (resp && resp.access_token){
          accessToken = resp.access_token;
          alert("Drive connected!");
        }
      }
    });
  }
  tokenClient.requestAccessToken();
}

async function findDriveFileIdByName(){
  try{
    const res = await gapi.client.drive.files.list({
      q: `name='${DRIVE_FILE_NAME}' and trashed=false`,
      fields: "files(id,name)"
    });
    const files = res.result.files || [];
    return files.length ? files[0].id : null;
  }catch(e){ return null; }
}

async function createDriveFile(contentStr){
  const metadata = { name: DRIVE_FILE_NAME, mimeType: 'application/json' };
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";
  const multipartBody =
      delimiter + "Content-Type: application/json\r\n\r\n" +
      JSON.stringify(metadata) + delimiter +
      "Content-Type: application/json\r\n\r\n" + contentStr + close_delim;
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'multipart/related; boundary=' + boundary
    },
    body: multipartBody
  });
  const json = await res.json();
  return json.id;
}

async function updateDriveFile(fileId, contentStr){
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";
  const metadata = { mimeType: 'application/json' };
  const multipartBody =
      delimiter + "Content-Type: application/json\r\n\r\n" +
      JSON.stringify(metadata) + delimiter +
      "Content-Type: application/json\r\n\r\n" + contentStr + close_delim;
  await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'multipart/related; boundary=' + boundary
    },
    body: multipartBody
  });
}

async function ensurePublicReadable(fileId){
  try{
    await gapi.client.drive.permissions.create({
      fileId,
      resource: { role: "reader", type: "anyone" }
    });
  }catch(e){}
}

async function driveSave(){
  if(!accessToken){ alert("Klik Connect Drive dulu."); return; }
  const contentStr = localStorage.getItem(LS_APP_KEY) || "{}";
  let fileId = localStorage.getItem(LS_FILE_ID_KEY) || await findDriveFileIdByName();
  if(!fileId){
    const id = await createDriveFile(contentStr);
    localStorage.setItem(LS_FILE_ID_KEY, id);
    await ensurePublicReadable(id);
    alert("Data baru disimpan ke Drive.");
  }else{
    await updateDriveFile(fileId, contentStr);
    await ensurePublicReadable(fileId);
    alert("Data diperbarui di Drive.");
  }
}

async function driveLoad(){
  let fileId = localStorage.getItem(LS_FILE_ID_KEY) || await findDriveFileIdByName();
  if(!fileId){ alert("Belum ada file di Drive."); return; }
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('File tidak ditemukan');
  const jsonText = await res.text();
  localStorage.setItem(LS_APP_KEY, jsonText);
  location.reload();
}

async function autoLoadPublicData(){
  const local = localStorage.getItem(LS_APP_KEY);
  if(local && local !== "{}") return;
  const fileId = await findDriveFileIdByName();
  if(!fileId) return;
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  if(!res.ok) return;
  const jsonText = await res.text();
  localStorage.setItem(LS_APP_KEY, jsonText);
}
