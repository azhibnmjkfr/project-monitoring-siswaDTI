/* =========================
   PENGETAHUAN (BAB dinamis)
   ========================= */

function ensureBabStore(c, sid) {
  // Pastikan struktur nilai per BAB ada untuk siswa ini
  const names = c.components.babNames || [];
  c.components.tugas = c.components.tugas || {};
  if (!c.components.tugas[sid]) {
    c.components.tugas[sid] = names.map(() => ({ t: null, r: null, e: null }));
  }
  // Sesuaikan panjang array bila jumlah BAB berubah
  const arr = c.components.tugas[sid];
  if (arr.length !== names.length) {
    while (arr.length < names.length) arr.push({ t: null, r: null, e: null });
    while (arr.length > names.length) arr.pop();
  }
  c.components.pts = c.components.pts || {};
}

function promptScore(label, curVal) {
  const raw = prompt(label, curVal ?? "");
  if (raw === null) return { cancel: true };
  const s = String(raw).trim();
  // "-" atau kosong = hapus nilai (tidak dihitung)
  if (s === "" || s === "-") return { clear: true };
  const n = Number(s);
  if (Number.isNaN(n) || n < 0 || n > 100) {
    alert("Masukkan angka 0–100, atau '-' untuk mengosongkan.");
    return { cancel: true };
  }
  return { value: n };
}

/* ====== BAB actions (Mode Guru) ====== */
function addBAB(c) {
  const idx = (c.components.babNames || []).length;
  const name = prompt("Nama BAB baru:", `BAB ${idx + 1}`);
  if (!name) return;
  c.components.babNames.push(name.trim());
  // Tambahkan slot nilai untuk tiap siswa
  c.students.forEach(s => {
    ensureBabStore(c, s.id);
    c.components.tugas[s.id].push({ t: null, r: null, e: null });
  });
  saveState(); mountPengetahuan();
}

function renameBAB(c, bi) {
  const cur = c.components.babNames[bi];
  const name = prompt("Ubah nama BAB:", cur);
  if (name === null) return;
  c.components.babNames[bi] = (name.trim() || cur);
  saveState(); mountPengetahuan();
}

function deleteBAB(c, bi) {
  if (!confirm("Hapus BAB ini beserta seluruh nilainya?")) return;
  // Hapus nama BAB
  c.components.babNames.splice(bi, 1);
  // Hapus nilai BAB ke-bi untuk semua siswa
  c.students.forEach(s => {
    ensureBabStore(c, s.id);
    c.components.tugas[s.id].splice(bi, 1);
  });
  saveState(); mountPengetahuan();
}

/* ====== Siswa actions ====== */
function addStudentFlow(c) {
  const name = prompt("Nama siswa baru:");
  if (!name) return;
  const id = uid();
  c.students.push({ id, name: name.trim() });
  ensureBabStore(c, id);
  saveState();
  mountPengetahuan();
}

function removeStudentFlow(c, sid) {
  if (!confirm("Hapus siswa ini dari kelas aktif?")) return;
  c.students = c.students.filter(s => s.id !== sid);
  if (c.components?.tugas) delete c.components.tugas[sid];
  if (c.components?.pts) delete c.components.pts[sid];
  if (c.attitudes) {
    delete c.attitudes.A[sid];
    delete c.attitudes.B[sid];
    delete c.attitudes.C[sid];
    delete c.attitudes.notes[sid];
  }
  if (c.skills?.scores) delete c.skills.scores[sid];
  if (c.remedial) delete c.remedial[sid];
  saveState();
  mountPengetahuan();
}

/* ====== Hitung RPH ====== */
// RPH = rata-rata semua nilai T/R/E yang terisi di semua BAB (PTS tidak termasuk)
function computeRPH(c, sid){
  ensureBabStore(c, sid);
  const vals = [];
  c.components.tugas[sid].forEach(obj=>{
    ['t','r','e'].forEach(k=>{
      if (typeof obj[k] === 'number') vals.push(obj[k]);
    });
  });
  if (!vals.length) return '';
  const sum = vals.reduce((a,b)=>a+b,0);
  return Math.round(sum / vals.length);
}

/* ====== Mount ====== */
function mountPengetahuan(){
  const root = document.getElementById('tab-pengetahuan');
  const c = currentClass(); 
  if(!c){ root.innerHTML = '<p>Belum ada data kelas.</p>'; return; }

  const names = c.components.babNames;

  // Header tabel 2 baris.
  // Baris 1: kolom grup per BAB + kontrol (Mode Guru)
  const headRow1 = `
    <tr>
      <th rowspan="2">No</th>
      <th rowspan="2">Nama</th>
      ${
        names.map((n,i)=> {
          const controls = isEdit
            ? ` <button class="icon-btn" style="padding:2px 6px;font-size:12px" title="Ubah BAB" data-rename-bab="${i}">✏️</button>
                <button class="icon-btn" style="padding:2px 6px;font-size:12px" title="Hapus BAB" data-del-bab="${i}">🗑</button>`
            : '';
          return `<th colspan="3" style="text-align:center"><span>${n}</span>${controls}</th>`;
        }).join('')
      }
      <th rowspan="2">PTS</th>
      <th rowspan="2">RPH</th>
    </tr>
  `;

  // Baris 2: sub-kolom
  const headRow2 = `
    <tr>
      ${names.map(()=>['Tsk','Resp','Eval'].map(h=>`<th title="${h==='Tsk'?'Task':h==='Resp'?'Responsibility':'Evaluation'}">${h}</th>`).join('')).join('')}
    </tr>
  `;

  // Baris siswa
  const rows = c.students.map((s,i)=>{
    ensureBabStore(c, s.id);
    const perBab = c.components.tugas[s.id];
    const cells = perBab.map((obj,bi)=>(
      `<td class="editable center" data-s="${s.id}" data-b="${bi}" data-k="t">${obj.t ?? ''}</td>
       <td class="editable center" data-s="${s.id}" data-b="${bi}" data-k="r">${obj.r ?? ''}</td>
       <td class="editable center" data-s="${s.id}" data-b="${bi}" data-k="e">${obj.e ?? ''}</td>`
    )).join('');
    const pts = c.components.pts[s.id] ?? '';
    const rph = computeRPH(c, s.id);
    const removeBtn = isEdit ? `<button class="icon-btn" title="Hapus siswa" data-del="${s.id}">🗑</button>` : '';
    return `
      <tr>
        <td class="center">${i+1}</td>
        <td>${s.name} ${removeBtn}</td>
        ${cells}
        <td class="editable center" data-pts="${s.id}">${pts}</td>
        <td class="center">${rph}</td>
      </tr>
    `;
  }).join('');

  // Render
  root.innerHTML = `
    <div class="panel-head">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <h3 style="margin:0">Nilai Pengetahuan <small style="color:#667">KKM 75 • 0–100</small></h3>
        ${isEdit ? `<div style="display:flex;gap:8px">
          <button id="btnAddStudent" class="btn outline">+ Tambah Siswa</button>
          <button id="btnAddBAB" class="btn primary">+ BAB</button>
        </div>`:''}
      </div>
    </div>

    <div class="table-wrap">
      <table class="table table-pengetahuan sep-3">
        <thead>${headRow1}${headRow2}</thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="panel-foot" style="padding:8px 12px 0; font-size:13px; color:#444;">
      <em>Keterangan singkatan:</em>
      <strong>Tsk</strong>=Task,
      <strong>Resp</strong>=Responsibility,
      <strong>Eval</strong>=Evaluation.
    </div>
  `;

  // Event: edit nilai
  if (isEdit) {
    // T/R/E
    root.querySelectorAll('td.editable[data-s]').forEach(td=>{
      td.onclick = ()=>{
        const sid = td.getAttribute('data-s');
        const bi  = Number(td.getAttribute('data-b'));
        const key = td.getAttribute('data-k'); // t/r/e
        ensureBabStore(c, sid);
        const currentVal = c.components.tugas[sid][bi][key];
        const label = key==='t'?'Nilai Task (0–100)':'Nilai '+(key==='r'?'Responsibility':'Evaluation')+' (0–100)';
        const res = promptScore(label, currentVal);
        if (res.cancel) return;
        if (res.clear) c.components.tugas[sid][bi][key] = null;
        else c.components.tugas[sid][bi][key] = res.value;
        saveState(); mountPengetahuan();
      };
    });

    // PTS
    root.querySelectorAll('td.editable[data-pts]').forEach(td=>{
      td.onclick = ()=>{
        const sid = td.getAttribute('data-pts');
        const cur = c.components.pts[sid];
        const res = promptScore('Nilai PTS (0–100)', cur);
        if (res.cancel) return;
        if (res.clear) delete c.components.pts[sid];
        else c.components.pts[sid] = res.value;
        saveState(); mountPengetahuan();
      };
    });

    // Tambah/Hapus siswa
    const addBtn = document.getElementById('btnAddStudent');
    if (addBtn) addBtn.onclick = ()=> addStudentFlow(c);
    root.querySelectorAll('button.icon-btn[data-del]').forEach(btn=>{
      btn.onclick = ()=> removeStudentFlow(c, btn.getAttribute('data-del'));
    });

    // BAB actions
    const addBabBtn = document.getElementById('btnAddBAB');
    if (addBabBtn) addBabBtn.onclick = ()=> addBAB(c);
    root.querySelectorAll('[data-rename-bab]').forEach(btn=>{
      btn.onclick = ()=> renameBAB(c, Number(btn.getAttribute('data-rename-bab')));
    });
    root.querySelectorAll('[data-del-bab]').forEach(btn=>{
      btn.onclick = ()=> deleteBAB(c, Number(btn.getAttribute('data-del-bab')));
    });
  }
}
