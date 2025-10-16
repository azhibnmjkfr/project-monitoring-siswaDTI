const BUTIR_A = ['Kebersihan/Kerapian','Ketekunan/Ketelitian','Tanggung Jawab Lingkungan','Berpikir Kritis','Toleransi','Leadership','Keberanian','Nasionalisme','Kreativitas/Inovasi'];
const BUTIR_B = ['Bersyukur','Sholat Berjama\'ah','Berdoa Memulai Kegiatan','Mengucapkan Salam','Suka Membaca Al-Qur\'an'];
const BUTIR_C = ['Jujur','Disiplin','Empati/Kasih Sayang','Tanggung Jawab','Kerja Sama','Rasa Hormat'];

function addStudentFlowSikap(c) {
  const name = prompt("Nama siswa baru:");
  if (!name) return;
  const id = uid();
  c.students.push({ id, name: name.trim() });
  saveState();
  mountSikap();
}

function removeStudentFlowSikap(c, sid) {
  if (!confirm("Hapus siswa ini dari kelas aktif?")) return;
  c.students = c.students.filter(s => s.id !== sid);
  if (c.attitudes) {
    delete c.attitudes.A[sid];
    delete c.attitudes.B[sid];
    delete c.attitudes.C[sid];
    delete c.attitudes.notes[sid];
  }
  if (c.components?.tugas) delete c.components.tugas[sid];
  if (c.components?.pts) delete c.components.pts[sid];
  if (c.skills?.scores) delete c.skills.scores[sid];
  if (c.remedial) delete c.remedial[sid];
  saveState();
  mountSikap();
}

function mountSikap(){
  const root = document.getElementById('tab-sikap');
  const c = currentClass(); if(!c){ root.innerHTML = '<p>Belum ada kelas.</p>'; return; }

  const rows = c.students.map((s,i)=>{
    const A=c.attitudes.A[s.id]||'', B=c.attitudes.B[s.id]||'', C=c.attitudes.C[s.id]||'', note=c.attitudes.notes[s.id]||'';
    const removeBtn = isEdit ? `<button class="icon-btn" title="Hapus siswa" data-del="${s.id}">🗑</button>` : '';
    return `<tr>
      <td class="center">${i+1}</td>
      <td>${s.name} ${removeBtn}</td>
      <td class="editable center">${A||''}</td>
      <td class="editable center">${B||''}</td>
      <td class="editable center">${C||''}</td>
      <td class="editable center">${note||''}</td>
    </tr>`;
  }).join('');

  root.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 8px">
      <h3 style="margin:0">Jurnal Sikap & Karakter</h3>
      ${isEdit ? `<button id="btnAddStudentSikap" class="btn outline">+ Tambah Siswa</button>` : ''}
    </div>
    <div class="table-wrap"><table class="table">
      <thead>
        <tr><th>#</th><th>Nama</th><th>A</th><th>B</th><th>C</th><th>Keterangan</th></tr>
      </thead><tbody>${rows}</tbody>
    </table></div>
    <details style="margin-top:10px">
      <summary class="btn outline" style="display:inline-block">Info Butir</summary>
      <div class="card" style="margin-top:8px">
        <div class="grid3">
          ${renderButirBlock('Butir A – Sikap Pendidikan Kehidupan', BUTIR_A)}
          ${renderButirBlock('Butir B – Sikap Spiritual', BUTIR_B)}
          ${renderButirBlock('Butir C – Sikap Sosial', BUTIR_C)}
        </div>
      </div>
    </details>
  `;

  // edit (popup prompt sederhana dulu)
  if(isEdit){
    // edit nilai/ket: tetap prompt, tapi terpusat via class "center"
    root.querySelectorAll('tbody tr').forEach((tr,idx)=>{
      const s = c.students[idx];
      const tds = tr.querySelectorAll('.editable');
      tds.forEach((td,j)=>{
        td.onclick = ()=>{
          const label = ['A (angka butir, mis: 1,3,6)','B (angka butir)','C (angka butir)','Keterangan'][j];
          const cur = td.textContent.trim();
          const val = prompt(label+':', cur);
          if(val===null) return;
          if(j===3) c.attitudes.notes[s.id] = val.trim();
          else ['A','B','C'].forEach((k,ii)=>{ if(ii===j) c.attitudes[k][s.id]=val.trim(); });
          saveState(); mountSikap();
        };
      });
    });

    // tambah/hapus siswa
    const addBtn = document.getElementById('btnAddStudentSikap');
    if (addBtn) addBtn.onclick = ()=> addStudentFlowSikap(c);
    root.querySelectorAll('button.icon-btn[data-del]').forEach(btn=>{
      btn.onclick = ()=> removeStudentFlowSikap(c, btn.getAttribute('data-del'));
    });
  }
}

function renderButirBlock(title,list){
  return `<div><h4 style="margin:0 0 6px">${title}</h4><ol style="margin:0 0 8px 18px">${list.map(x=>`<li>${x}</li>`).join('')}</ol></div>`;
}

/* kecil util untuk grid informasi butir */
const style = document.createElement('style');
style.textContent = `.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}`;
document.head.appendChild(style);
