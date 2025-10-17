// js/auto-drive-save.js
// Auto-upload ke Google Drive saat KELUAR dari Mode Guru

(function () {
  function findBtn() {
    return document.getElementById('btnMode');
  }
  function isInGuruMode(btn) {
    // Di app kamu: saat sedang di Mode Guru, teks tombol = "Keluar Mode Guru"
    // Jadi kalau mengandung 'keluar' berarti SEDANG di guru mode.
    return btn && btn.textContent.toLowerCase().includes('keluar');
  }

  function init() {
    const btn = findBtn();
    if (!btn) return;

    btn.addEventListener('click', () => {
      // Jika sebelum klik ini tombol bertuliskan "Keluar Mode Guru",
      // artinya kita SEDANG di guru mode -> klik ini = KELUAR dari mode guru.
      const leavingGuru = isInGuruMode(btn);
      if (leavingGuru) {
        // Beri sedikit jeda agar UI selesai menyimpan ke localStorage,
        // baru kemudian upload ke Drive.
        setTimeout(() => {
          if (typeof window.driveSave === 'function') {
            // manual:true = tampilkan alert/feedback sesuai implementasi kamu
            window.driveSave({ manual: true });
          }
        }, 150);
      }
    });

    // (Opsional) Jika tab ditutup saat masih di Mode Guru, kita tetap coba upload.
    // Perlu diingat: beforeunload tidak selalu memberi waktu untuk network,
    // jadi ini "best effort" saja. Simpanan utamanya terjadi saat tombol ditekan.
    window.addEventListener('beforeunload', () => {
      const b = findBtn();
      if (isInGuruMode(b) && typeof window.driveSave === 'function') {
        try { window.driveSave({ manual: false }); } catch (_) {}
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
