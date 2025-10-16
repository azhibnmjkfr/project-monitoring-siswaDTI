// ===== Data & State (tanpa fetch) =====
const PASSWORD = 'azhibnmjkfr';
const STATE_KEY = 'penilaianAppV2';

let state = null;
let isEdit = false;

const SEED_CLASSES = [
  { name: "8A", students: [
    "AGHA MIFZALSYAH","AHMAD ARKAN RAMADHAN","AHMAD ZHAHIR AZHARI","ASHABUL KAHFI","ASYAM IBRAHIM ACHMAD","ATHA RASYA RISQY","ATHAR MUHAMMAD KAYANA RS","AUFAR AL AKBAR","AZIZUL HAKIM","DAFFA RIZQULLAH","FATHAN FIRSAN PRATAMA","GHAZY VATHANI","HAQI MUHAMMAD BERLIAN","HAYYAL BASYIR","HUSNUL MUBARAK","KAISA AZMI","M FARRAS ABQARI","M. 'AFI","M. AMMAR FATHAN","M. FAWWAZ HAFUZA","MUHAFIZ AL JIBRAN","MUHAMMAD ABYAN AL GHIFARY","MUHAMMAD BARIQ ATHARI"
  ]},
  { name: "9A", students: [
    "ABRAL AZIZI","AHMAD RAIFAL KIRAM","AL-FATHIR RAHMAD","ALTHAF NADHIM","AMMAR AL-ARABI","ATTAYA ZIYAN RIZKILLAH","ELFITJA NAHARA","LUTHFI KHAIRULLAH","M. AL JIYAD TSAQIF","M. ZHAFRAN NABIL","MHD. RAFKA SADIQ AL-FARUQ","MHD. RAFKY SADIQ AL-FARUQ","MUHAMMAD ALIF ASH SIDDIQ","MUHAMMAD ALTHAF","MUHAMMAD ATAYA RIZQULLAH","MUHAMMAD FADHIL NASUTION","MUHAMMAD GALAXY SYAM LUBIS","MUHAMMAD RAIHAN AKBAR","MUHAMMAD RIYAD HAFIZH"
  ]},
  { name: "9B", students: [
    "AHMAD KHAISURAN DHARLY GIBRAN","FATHUR RAHMAN","FAWWAZ AKBAR SAPUTRA","M YAHYA AYYASH","MUHAMMAD HAFIZ ALFITRA","MUHAMMAD IHSAN ABADI","MUHAMMAD NABIL AL MUANNISI","MUHAMMAD NABIL LAZUARDI","MUHAMMAD SYAFIQ BZ","MUHARRIR","MUZAFFAR NAFIS","NAUFAL HAFY FAWWAZ","RAHMAD ALFARUQI","RAYYAN FIRZY","RIZKY NAUFAL DANI","T M NAUFAL DIKA","T. ZIYAN ALZAKI","ZAYYAN HAFIZ","MUHAMMAD RAFFA AL-FAYYADH","M. MIKAIL AL-HABIB","MUHAMMAD ARIQ KEMAL PASYA"
  ]},
  { name: "9C", students: [
    "ADINDA MAGHFIRA","AFIYA RAMADHANI","AFRA HUMAIRA AZKIA","AISHA ALIFA","AISYAH ALTHAFUNNISA","ALISHA ADLINA","ALMIRA","ALYA ZAHIRA","AQILLA ZUHRA NUGROHO","ARINI HIDAYATI","BALQHIS HUMAIRAH MURY","BALQIS MALLICA FAKHIRA","BUNGA NATASYA","CUT ATHALLAH ZAKIA","CUT FATIMA SYAFINA","ESQI ZASKIA","FALISHA ZAKHYRA","FARAH AULIA DZIKRA","FARRAS NAILATUL IZZAH","HAFIZA KHAIRA LUBNA","HAURA ALFIAH","HAURA NADHIFAH","HUMAIRA","HUMAIRA QAULAN SADIDA","KHURUL INAYAH","MARYAMI"
  ]},
  { name: "9D", students: [
    "MAZAYA HUMAIRA","MUIZZAH AFRAHUNNISA","MUTIA SALMA","NADIYYA ALTHAFUNNISA","NAJWA FAIZA","NATASYA FACHIRA AZMINA","NAURA HILMIYA","NISA ANINDYA","NUR ADINDA","OLIVIA REGINA PUTRI","PUTRI HANIFATURRACHMI","PUTRI SALSABILA","PUTROE FAIZA","PUTROE HUMAIRA ANANDITA","PUTROE RAHIL AMIRA","QANITA ASYIFA FAISAL","QATHRATUN NADAL HAQQI","SHAKIRA PUTRI RAMADHANI","SYIFA MAKHAYLA RUSDIAN","TARISHAH SHENA AZZUHRA","TAZKIYAH SHUBI ISKANDAR","ULFIA HAFIZHAH","ZAHIRA ADHA MURIANDAH","ZALFA ANNISA","NUR AZKA SYAWALANI"
  ]}
];

function uid(){ return Math.random().toString(36).slice(2,9); }
function saveState(){ localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
function loadState(){ try{ return JSON.parse(localStorage.getItem(STATE_KEY)); }catch{ return null; } }
function currentClass(){ return state.classes.find(c=>c.id===state.activeClassId) || null; }

async function initState(){
  const exist = loadState();
  if(exist){ state = exist; return; }

  state = {
    meta: {
      school: 'MTsT Daarut Tahfizh Al - Ikhlas',
      teacher: 'Ahmad Zaman Huri, S.Pd.',
      year: '2025/2026',
      semester: 'Ganjil',
      subject: 'Bahasa Inggris'
    },
    classes: SEED_CLASSES.map(cls=>({
      id: uid(),
      name: cls.name,
      students: cls.students.map(n=>({id:uid(), name:n})),
      components: { babNames:['BAB 1','BAB 2','BAB 3','BAB 4'], tugas:{}, pts:{} },
      skills: { kds:[], scores:{} },
      attitudes: { A:{}, B:{}, C:{}, notes:{} },
      remedial: {}
    })),
    activeClassId: null
  };
  state.activeClassId = state.classes[0]?.id || null; // default 8A
  saveState();
}
