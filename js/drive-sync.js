/* =========================================================================
   Google Drive Sync (robust version)
   ========================================================================= */

// Tunggu sampai DOM dan config siap
async function initializeDrive() {
    console.log("Memulai inisialisasi Drive Sync...");
    
    // Tunggu sampai CONFIG tersedia
    let attempts = 0;
    while (!window.CONFIG && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (!window.CONFIG) {
        console.error("CONFIG tidak ditemukan setelah menunggu");
        setChip("Error: Config tidak ditemukan", "error");
        return;
    }
    
    console.log("CONFIG ditemukan:", CONFIG);
    
    const GOOGLE_CLIENT_ID = CONFIG.CLIENT_ID;
    const GOOGLE_API_KEY   = CONFIG.API_KEY;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_API_KEY) {
        setChip("Error: Client ID atau API Key kosong", "error");
        return;
    }

    // Lanjutkan dengan inisialisasi...
    mountDriveUI();
    loadGoogleScripts();
}

/* =============== Status Chip =============== */
let chip;
function setChip(text, tone = "loading") {
    if (!chip) {
        chip = document.createElement('div');
        chip.id = 'driveStatusChip';
        chip.style.cssText = `
            position: fixed; right: 14px; bottom: 150px; z-index: 9999;
            font: 12px/1.2 system-ui, Segoe UI, Arial; color: #244626;
            background: #fff; border: 1px solid #D3E1D8; border-radius: 10px;
            padding: 6px 10px; box-shadow: 0 6px 14px rgba(0,0,0,.08);
            max-width: 200px; word-wrap: break-word;
        `;
        document.body.appendChild(chip);
    }
    const colors = { loading: "#fff", ready: "#E7F5EC", error: "#FFEDEE" };
    chip.style.background = colors[tone] || "#fff";
    chip.textContent = `Drive: ${text}`;
}

/* =============== Load Google Scripts =============== */
function loadGoogleScripts() {
    setChip("Loading Google APIs...", "loading");

    // Load Google Identity Services
    if (!document.querySelector('script[src*="accounts.google.com"]')) {
        const gis = document.createElement('script');
        gis.src = "https://accounts.google.com/gsi/client";
        gis.async = true;
        gis.defer = true;
        gis.onerror = () => setChip("Gagal load Google Auth", "error");
        document.head.appendChild(gis);
    }

    // Load Google API Client
    if (!document.querySelector('script[src*="apis.google.com"]')) {
        const gapi = document.createElement('script');
        gapi.src = "https://apis.google.com/js/api.js";
        gapi.async = true;
        gapi.defer = true;
        gapi.onload = () => {
            window.__gapiLoaded__ = true;
            initializeGapi();
        };
        gapi.onerror = () => setChip("Gagal load Google API", "error");
        document.head.appendChild(gapi);
    } else {
        initializeGapi();
    }
}

/* =============== Initialize GAPI =============== */
async function initializeGapi() {
    try {
        setChip("Menyiapkan Google Drive...", "loading");
        
        await waitForGapi();
        
        await new Promise((resolve, reject) => {
            gapi.load('client', {
                callback: resolve,
                onerror: reject,
                timeout: 10000
            });
        });

        await gapi.client.init({
            apiKey: CONFIG.API_KEY,
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
        });

        setChip("Ready", "ready");
        console.log("Google API initialized successfully");
        
    } catch (error) {
        console.error("Gagal initialize Google API:", error);
        setChip(`Init error: ${error.message}`, "error");
    }
}

/* =============== Wait for GAPI =============== */
function waitForGapi(maxMs = 10000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            if (window.gapi && typeof gapi.load === "function") {
                resolve(true);
            } else if (Date.now() - start > maxMs) {
                reject(new Error("gapi timeout"));
            } else {
                setTimeout(check, 200);
            }
        };
        check();
    });
}

/* =============== UI Components =============== */
function mountDriveUI() {
    if (document.getElementById('driveSyncDock')) return;
    
    const dock = document.createElement('div');
    dock.id = 'driveSyncDock';
    dock.style.cssText = `
        position: fixed; right: 14px; bottom: 14px; z-index: 9999;
        display: flex; flex-direction: column; gap: 8px;
        background: rgba(255,255,255,0.95); padding: 12px;
        border-radius: 12px; border: 1px solid #D3E1D8;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    `;
    
    dock.innerHTML = `
        <div style="font-size: 12px; font-weight: bold; color: #244626; margin-bottom: 8px;">
            Google Drive Sync
        </div>
        <button id="btnDriveConnect" class="btn" style="border-radius:8px;padding:6px 10px;font-size:12px">
            🔗 Connect
        </button>
        <button id="btnDriveSave" class="btn primary" style="border-radius:8px;padding:6px 10px;font-size:12px">
            💾 Save to Drive
        </button>
        <button id="btnDriveLoad" class="btn outline" style="border-radius:8px;padding:6px 10px;font-size:12px">
            📥 Load from Drive
        </button>
    `;
    
    document.body.appendChild(dock);
    
    document.getElementById('btnDriveConnect').onclick = driveConnect;
    document.getElementById('btnDriveSave').onclick = driveSave;
    document.getElementById('btnDriveLoad').onclick = driveLoad;
}

/* =============== OAuth and Drive Operations =============== */
let tokenClient = null;
let accessToken = null;

function driveConnect() {
    try {
        if (!window.google?.accounts?.oauth2) {
            setChip("Google Auth belum siap", "error");
            return;
        }

        if (!tokenClient) {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CONFIG.CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/drive.file',
                callback: (resp) => {
                    if (resp && resp.access_token) {
                        accessToken = resp.access_token;
                        setChip("Connected to Drive", "ready");
                    } else {
                        setChip("Auth dibatalkan", "error");
                    }
                }
            });
        }
        
        tokenClient.requestAccessToken();
        
    } catch (error) {
        console.error("Drive connect error:", error);
        setChip("Connect error", "error");
    }
}

async function findDriveFileIdByName() {
    try {
        const response = await gapi.client.drive.files.list({
            q: `name='project-monitoring-siswa-data.json' and trashed=false`,
            fields: "files(id, name)",
            spaces: 'drive'
        });
        
        const files = response.result.files || [];
        return files.length > 0 ? files[0].id : null;
    } catch (error) {
        console.error("Error finding file:", error);
        return null;
    }
}

async function driveSave() {
    try {
        if (!accessToken) {
            alert("Silakan klik 'Connect' terlebih dahulu.");
            return;
        }

        setChip("Menyimpan...", "loading");
        
        const contentStr = localStorage.getItem('penilaianAppV2') || "{}";
        let fileId = localStorage.getItem('pms_drive_file_id') || await findDriveFileIdByName();

        const metadata = {
            name: 'project-monitoring-siswa-data.json',
            mimeType: 'application/json'
        };

        if (!fileId) {
            const response = await gapi.client.drive.files.create({
                resource: metadata,
                fields: 'id'
            });
            
            fileId = response.result.id;
            localStorage.setItem('pms_drive_file_id', fileId);
            
            await gapi.client.drive.files.update({
                fileId: fileId,
                uploadType: 'media',
                media: {
                    mimeType: 'application/json',
                    body: contentStr
                }
            });
            
            setChip("Data tersimpan (file baru)", "ready");
        } else {
            await gapi.client.drive.files.update({
                fileId: fileId,
                uploadType: 'media',
                media: {
                    mimeType: 'application/json',
                    body: contentStr
                }
            });
            
            setChip("Data diperbarui", "ready");
        }
        
    } catch (error) {
        console.error("Save error:", error);
        setChip("Gagal menyimpan", "error");
        alert("Gagal menyimpan ke Drive: " + error.message);
    }
}

async function driveLoad() {
    try {
        setChip("Memuat...", "loading");
        
        const fileId = localStorage.getItem('pms_drive_file_id') || await findDriveFileIdByName();
        if (!fileId) {
            setChip("File tidak ditemukan", "error");
            alert("Belum ada file data di Drive.");
            return;
        }

        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        
        localStorage.setItem('penilaianAppV2', JSON.stringify(response.result));
        setChip("Data dimuat", "ready");
        
        setTimeout(() => {
            if (confirm("Data berhasil dimuat. Reload halaman?")) {
                location.reload();
            }
        }, 500);
        
    } catch (error) {
        console.error("Load error:", error);
        setChip("Gagal memuat", "error");
        alert("Gagal memuat dari Drive: " + error.message);
    }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDrive);
} else {
    // Jika DOM sudah ready, tunggu sebentar lalu initialize
    setTimeout(initializeDrive, 1000);
}
