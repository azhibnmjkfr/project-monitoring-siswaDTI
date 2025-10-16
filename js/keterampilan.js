function ensureKdStore(c, sid) {
  c.skills = c.skills || { kds: [], scores: {} };
  c.skills.scores = c.skills.scores || {};
  if (!c.skills.scores[sid]) c.skills.scores[sid] = {};
  // siapkan objek untuk setiap KD
  c.skills.kds.forEach(k => {
    if (!c.skills.scores[sid][k.id]) {
      c.skills.scores[sid][k.id] = { praktik: null, proyek: null, portofolio: null };
    }
  });
  // hapus skor KD yang sudah tidak ada
  Object.keys(c.skills.scores[sid]).forEach(kid=>{
    if (!c.skills.kds.find(k=>k.id===kid)) delete c.skills.scores[sid][kid];
  });
}

function avgDefined(vals) {
  const nums = vals.filter(v => typeof v === 'number');
  if (!nums.length) return '';
  const sum = nums.reduce((a,b)=>a+b,0);
  return Math.round(sum / nums.length);
}

function addStudentFlowSkill(c) {
  const name = prompt("Nama siswa baru:");
  if (!name) return;
  const id = uid();
  c.students.push({ id, name: name.trim() });
  ensureKdStore(c, id);
  saveState();
  mountKeterampilan();
}

function removeStudentFlowSkill(c, sid) {
  if (!confirm("Hapus siswa ini dari kelas aktif?")) return;
  c.students = c.students.filter(s => s.id !== sid);
  if (c.skills?.scores) delete c.skills.scores[sid];
  if (c.components?.tugas) delete c.components.tugas[sid];
  if (c.components?.pts) delete c.components.pts[sid];
  if (c.attitudes) {
    delete c.attitudes.A[sid];
    delete c.attitudes.B[sid];
    delete c.attitudes.C[sid];
    delete c.attitudes.notes[sid];
  }
  if (c.remedial) delete c.remedial[sid];
  saveState();
  mountKeterampilan();
}

function renameKD(c, kid){
  const kd = c.skills.kds.find(k=>k.id===kid);
  if(!kd) return;
  const name = prompt('Ubah nama KD:', kd.name);
  if(name===null) return;
  kd.name = name.trim() || kd.name;
  saveState(); mountKeterampilan();
}

function deleteKD(c, kid){
  if(!confirm('Hapus KD ini beserta seluruh nilainya?')) return;
  c.skills.kds = c.skills.kds.filter(k=>k.id!==kid);
  Object.keys(c.skills.scores||{}).forEach(sid=>{
    if(c.skills.scores[sid]) delete c.skills.scores[sid][kid];
  });
  saveState(); mountKeterampilan();
}

function mountKeterampilan(){
  const root = document.getElementById('tab-keterampilan');
  const c = currentClass(); if(!c){ root.innerHTML='<p>Belum ada kelas.</p>'; return; }

  const hasKD = c.skills.kds.length>0;
  const addBtnKD = isEdit ? `<button id="btnAddKD" class="btn primary">+ KD</button>` : '';
  const addBtnStudent = isEdit ? `<button id="btnAddStudentSkill" class="btn outline">+ Tambah Siswa</button>` : '';

  if(!hasKD){
    root.innerHTML = `
      <div class="row" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h3 style="margin:0">Nilai Keterampilan</h3>
        <div style="display:flex;gap:8px">${addBtnStudent} ${addBtnKD}</div>
      </div>
      <div class="hint card" style="padding:10px">Belum ada KD — klik <strong>+ KD</strong> untuk menambahkan.</div>`;
  }else{
    const head1Cells = c.skills.kds.map(k=>{
      const controls = isEdit
        ? ` <button class="icon-btn" style="padding:2px 6px;font-size:12px" title="Ubah KD" data-rename-kd="${k.id}">✏️</button>
            <button class="icon-btn" style="padding:2px 6px;font-size:12px" title="Hapus KD" data-del-kd="${k.id}">🗑</button>`
        : '';
      return `<th colspan="3"><span>${k.name}</span>${controls}</th>`;
    }).join('');
    const head1 = `<tr><th rowspan="2">#</th><th rowspan="2">Nama</th>${head1Cells}<th rowspan="2">Nilai Akhir</th></tr>`;
    const head2 = `<tr>${c.skills.kds.map(()=>['1','2','3'].map(s=>`<th>${s}</th>`).join('')).join('')}</tr>`;

    const rows = c.students.map((s,i)=>{
      ensureKdStore(c, s.id);
      const perKdCells = c.skills.kds.map(k=>{
        const sc = c.skills.scores[s.id][k.id];
        const show = v => (typeof v === 'number' ? v : '-');
        return `
          <td class="editable center" data-s="${s.id}" data-kd="${k.id}" data-f="praktik">${show(sc.praktik)}</td>
          <td class="editable center" data-s="${s.id}" data-kd="${k.id}" data-f="proyek">${show(sc.proyek)}</td>
          <td class="editable center" data-s="${s.id}" data-kd="${k.id}" data-f="portofolio">${show(sc.portofolio)}</td>
        `;
      }).join('');
      const finalScore = avgDefined(
        c.skills.kds.flatMap(k=>{
          const sc = c.skills.scores[s.id][k.id];
          return [sc.praktik, sc.proyek, sc.portofolio].filter(v=>typeof v === 'number');
        })
      );
      const removeBtn = isEdit ? `<button class="icon-btn" title="Hapus siswa" data-del="${s.id}">🗑</button>` : '';
      return `<tr>
        <td class="center">${i+1}</td>
        <td>${s.name} ${removeBtn}</td>
        ${perKdCells}
        <td class="center">${finalScore}</td>
      </tr>`;
    }).join('');

    root.innerHTML = `
      <div class="row" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h3 style="margin:0">Nilai Keterampilan</h3>
        <div style="display:flex;gap:8px">${addBtnStudent} ${addBtnKD}</div>
      </div>
      <div class="table-wrap">
        <table class="table table-keterampilan sep-3"><thead>${head1}${head2}</thead><tbody>${rows}</tbody></table>
      </div>
      <div class="panel-foot" style="font-size:13px;color:#445">
        <em>Keterangan:</em> <strong>1</strong>=Praktik, <strong>2</strong>=Proyek, <strong>3</strong>=Portofolio.
      </div>`;
  }

  // Tambah KD
  const btnKD = document.getElementById('btnAddKD');
  if(btnKD) btnKD.onclick = ()=>{
    const name = prompt('Nama KD (mis. KD 4.1 ...):');
    if(!name) return;
    c.skills.kds.push({id:uid(), name:name.trim()});
    c.students.forEach(stu => ensureKdStore(c, stu.id));
    saveState(); mountKeterampilan();
  };

  if (isEdit) {
    // Edit nilai: angka 0–100; '-' atau kosong = hapus nilai (tidak dihitung)
    const labelMap = { praktik:'Nilai 1 (0–100)', proyek:'Nilai 2 (0–100)', portofolio:'Nilai 3 (0–100)' };
    const tds = root.querySelectorAll('td.editable[data-s][data-kd][data-f]');
    tds.forEach(td=>{
      td.onclick = ()=>{
        const sid = td.getAttribute('data-s');
        const kid = td.getAttribute('data-kd');
        const field = td.getAttribute('data-f');
        ensureKdStore(c, sid);
        const cur = c.skills.scores[sid][kid][field];
        const raw = prompt(labelMap[field], (typeof cur === 'number' ? cur : '-'));
        if (raw === null) return;
        const s = String(raw).trim();
        if (s === "" || s === "-") {
          c.skills.scores[sid][kid][field] = null;
        } else {
          const n = Number(s);
          if (Number.isNaN(n) || n < 0 || n > 100) { alert("Masukkan angka 0–100, atau '-' untuk mengosongkan."); return; }
          c.skills.scores[sid][kid][field] = n;
        }
        saveState(); mountKeterampilan();
      };
    });

    // Rename / Delete KD
    root.querySelectorAll('[data-rename-kd]').forEach(btn=>{
      btn.onclick = ()=> renameKD(c, btn.getAttribute('data-rename-kd'));
    });
    root.querySelectorAll('[data-del-kd]').forEach(btn=>{
      btn.onclick = ()=> deleteKD(c, btn.getAttribute('data-del-kd'));
    });

    // Tambah/Hapus siswa
    const addBtn = document.getElementById('btnAddStudentSkill');
    if (addBtn) addBtn.onclick = ()=> addStudentFlowSkill(c);
    root.querySelectorAll('button.icon-btn[data-del]').forEach(btn=>{
      btn.onclick = ()=> removeStudentFlowSkill(c, btn.getAttribute('data-del'));
    });
  }
}
