// js/auto-drive-save.js
// Fitur: 
// 1) Auto-upload saat KELUAR Mode Guru
// 2) Auto-save setiap 30 detik KETIKA Mode Guru aktif
// 3) Save manual tetap berfungsi

(function () {
  // ====== Konfigurasi ======
  const AUTOSAVE_MS = 30000;                   // tiap 30 detik
  const LS_APP_KEY = (window.LS_APP_KEY) || 'penilaianAppV2';

  // ====== State ======
  let autosaveTimer = null;
  let lastUploadedStr = null;                  // untuk deteksi perubahan
  let isSaving = false;                        // guard agar tak tumpang tindih

  // ====== Util ======
  function $(id) { return document.getElementById(id); }
  function getBtn() { return $('btnMode'); }
  function isInGuruMode(btn) {
    // Saat SEDANG di Mode Guru, teks tombol jadi "Keluar Mode Guru"
    return btn && btn.textContent.toLowerCase().includes('keluar');
  }
  function readLocalStr() {
    try { return localStorage.getItem(LS_APP_KEY) || '{}'; }
    catch (_) { return '{}'; }
  }
  async function saveNow(manual=false) {
    if (typeof window.driveSave !== 'function') return;
    if (isSaving) return;          // cegah overlap
    isSaving = true;
    try {
      await window.driveSave({ manual });
      // anggap sukses → catat snapshot terakhir yang sudah diupload
      lastUploadedStr = readLocalStr();
    } catch (_) {
      // kalau gagal, biarkan; interval nanti akan coba lagi
    } finally {
      isSaving = false;
    }
  }

  // ====== Auto-save interval (saat MODE GURU) ======
  function startAutosave() {
    if (autosaveTimer) return; // sudah jalan
    // catat state awal agar tidak upload langsung bila belum ada perubahan
    lastUploadedStr = readLocalStr();

    autosaveTimer = setInterval(async () => {
      const btn = getBtn();
      if (!isInGuruMode(btn)) return;     // hanya ketika mode guru aktif
      const current = readLocalStr();
      if (current !== lastUploadedStr) {
        // ada perubahan → simpan (tanpa pop-up alert)
        await saveNow(false);
      }
    }, AUTOSAVE_MS);
  }

  function stopAutosave() {
    if (autosaveTimer) {
      clearInterval(autosaveTimer);
      autosaveTimer = null;
    }
  }

  // ====== Hook tombol Mode Guru ======
  function wireBtn() {
    const btn = getBtn();
    if (!btn) return;

    btn.addEventListener('click', () => {
      // Jika sebelum klik sedang di mode guru → berarti kita AKAN KELUAR
      const leavingGuru = isInGuruMode(btn);
      if (leavingGuru) {
        // Hentikan timer & lakukan save sekali saat keluar
        stopAutosave();
        setTimeout(() => saveNow(true), 150);
      } else {
        // Kita AKAN MASUK Mode Guru → mulai autosave setelah teks tombol berubah
        setTimeout(() => {
          const b = getBtn();
          if (isInGuruMode(b)) startAutosave();
        }, 120);
      }
    });

    // Jika saat halaman pertama kali dibuka sudah di Mode Guru (jarang),
    // aktifkan autosave langsung.
    if (isInGuruMode(btn)) startAutosave();

    // Best-effort: jika tab ditutup saat masih di mode guru, coba simpan.
    window.addEventListener('beforeunload', () => {
      const b = getBtn();
      if (isInGuruMode(b)) {
        // Tidak dijamin selesai oleh browser, tapi tidak ada ruginya mencoba.
        try { navigator.sendBeacon && saveNow(false); } catch(_) {}
      }
    });
  }

  // ====== Init ======
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireBtn);
  } else {
    wireBtn();
  }
})();
