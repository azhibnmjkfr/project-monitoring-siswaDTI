function mountRemedial(){
  const root = document.getElementById('tab-remedial');
  const c = currentClass(); if(!c){ root.innerHTML='<p>Belum ada kelas.</p>'; return; }

  const rows = [];
  c.students.forEach(s=>{
    const pts = Number(c.components.pts[s.id] ?? '');
    if(pts && pts<75){
      const r = c.remedial[s.id] || {materi:'',bentuk:'',nilai:'',ket:''};
      rows.push({s,pts,r});
    }
  });

  const htmlRows = rows.map((row,i)=>(
    `<tr>
      <td>${i+1}</td><td>${row.s.name}</td>
      <td class="bad" style="text-align:right">${row.pts}</td>
      <td class="editable">${row.r.materi||''}</td>
      <td class="editable">${row.r.bentuk||''}</td>
      <td class="editable" style="text-align:right">${row.r.nilai||''}</td>
      <td class="editable">${row.r.ket||''}</td>
    </tr>`
  )).join('');

  root.innerHTML = `
    <h3 style="margin:0 0 8px">Program Remedial (otomatis dari PTS &lt; 75)</h3>
    <div class="table-wrap"><table class="table table-remedial sep-all">
      <thead>
        <tr>
          <th>#</th><th>Nama Siswa</th><th>Nilai Sebelum Remedial</th>
          <th>Materi yang Belum Dikuasai</th><th>Bentuk Pelaksanaan Remedial</th>
          <th>Nilai Tes Remedial</th><th>Keterangan</th>
        </tr>
      </thead><tbody>${htmlRows || '<tr><td colspan="7">Belum ada siswa yang perlu remedial.</td></tr>'}</tbody>
    </table></div>
  `;

  if(isEdit){
    root.querySelectorAll('tbody tr').forEach((tr,idx)=>{
      const s = rows[idx]?.s; if(!s) return;
      const cells = tr.querySelectorAll('.editable');
      cells.forEach((td,j)=>{
        td.onclick = ()=>{
          const labels = ['Materi yang Belum Dikuasai','Bentuk Pelaksanaan Remedial','Nilai Tes Remedial (0–100)','Keterangan'];
          const cur = td.textContent.trim();
          const val = prompt(labels[j]+':', cur);
          if(val===null) return;
          c.remedial[s.id] = c.remedial[s.id] || {materi:'',bentuk:'',nilai:'',ket:''};
          if(j===0) c.remedial[s.id].materi = val;
          if(j===1) c.remedial[s.id].bentuk = val;
          if(j===2){ const n=Number(val); if(isNaN(n)||n<0||n>100){ alert('0–100'); return; } c.remedial[s.id].nilai=n; }
          if(j===3) c.remedial[s.id].ket = val;
          saveState(); mountRemedial();
        };
      });
    });
  }
}
