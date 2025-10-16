// ===== Bootstrapping =====
(async function(){
  await initState();
  bindMeta();
  bindMode();
  bindTabs();
  fillClassSelect();
  renderHeaderMeta();
  showTab('pengetahuan');
})();

// ===== Meta & Export/Import =====
function bindMeta(){
  const academicYear = document.querySelector('#academicYear');
  const semester     = document.querySelector('#semester');
  const subjectName  = document.querySelector('#subjectName');

  academicYear.value = state.meta.year || '2025/2026';
  semester.value     = state.meta.semester || 'Ganjil';
  subjectName.value  = 'Bahasa Inggris';
  subjectName.readOnly = true;

  academicYear.addEventListener('change', ()=>{
    state.meta.year = academicYear.value;
    saveState(); renderHeaderMeta();
  });
  semester.addEventListener('change', ()=>{
    state.meta.semester = semester.value;
    saveState(); renderHeaderMeta();
  });

  // export/import
  document.getElementById('btnExportJSON').onclick = ()=>{
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='penilaian-state.json'; a.click();
    URL.revokeObjectURL(url);
  };
  document.getElementById('importJSON').onchange = (e)=>{
    const f = e.target.files?.[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{
      try{
        const data = JSON.parse(rd.result);
        if(!data || !data.classes) throw new Error('Format tidak dikenal');
        state = data; saveState();
        fillClassSelect(); renderHeaderMeta(); showTab(currentTab());
      }catch(err){ alert('Gagal impor: '+err.message); }
    };
    rd.readAsText(f);
  };
}

function renderHeaderMeta(){
  const set = (id, val)=> document.getElementById(id).textContent = val;
  set('metaSchool',   state.meta.school);
  set('metaTeacher',  state.meta.teacher);
  set('metaSubject',  state.meta.subject);
  set('metaYear',     state.meta.year);
  set('metaSemester', state.meta.semester);
  set('activeClassName', currentClass()?.name || '-');

  // header stack
  const schoolTitle = document.getElementById('schoolTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');
  const subjectLine  = document.getElementById('subjectLine');
  const teacherLine  = document.getElementById('teacherLine');

  if(schoolTitle) schoolTitle.textContent = state.meta.school;
  if(pageSubtitle) pageSubtitle.textContent = 'Rekap Penilaian Siswa';
  if(subjectLine)  subjectLine.innerHTML   = 'Mata Pelajaran <strong>Bahasa Inggris</strong>';
  if(teacherLine)  teacherLine.innerHTML   = 'Teacher: <strong>'+ state.meta.teacher +'</strong>';

  document.title = `Rekap Penilaian Siswa – ${state.meta.school}`;
}

// ===== Mode Guru =====
function bindMode(){
  const btn = document.getElementById('btnMode');
  btn.onclick = ()=>{
    if(isEdit){ isEdit=false; btn.textContent='Masuk Mode Guru'; showTab(currentTab()); return; }
    const p = prompt('Password mode guru:');
    if(p===PASSWORD){ isEdit=true; btn.textContent='Keluar Mode Guru'; showTab(currentTab()); }
    else if(p!==null){ alert('Password salah'); }
  };
}

// ===== Kelas & Tabs =====
function fillClassSelect(){
  const sel = document.getElementById('classSelect');
  sel.innerHTML = '';
  state.classes.forEach(c=>{
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name; sel.appendChild(opt);
  });
  if(!state.activeClassId) state.activeClassId = state.classes[0]?.id || null;
  sel.value = state.activeClassId || '';
  sel.onchange = ()=>{ state.activeClassId = sel.value; saveState(); renderHeaderMeta(); showTab(currentTab()); };
}
function bindTabs(){
  document.querySelectorAll('.tab').forEach(b=>{
    b.onclick = ()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      showTab(b.dataset.tab);
    };
  });
}
function currentTab(){
  const active = Array.from(document.querySelectorAll('.tab')).find(t=>t.classList.contains('active'));
  return active?.dataset.tab || 'pengetahuan';
}
function showTab(name){
  ['pengetahuan','keterampilan','sikap','remedial'].forEach(t=>{
    document.getElementById(`tab-${t}`).classList.toggle('hidden', t!==name);
  });
  if(name==='pengetahuan')  mountPengetahuan();
  if(name==='keterampilan') mountKeterampilan();
  if(name==='sikap')        mountSikap();
  if(name==='remedial')     mountRemedial();
}
