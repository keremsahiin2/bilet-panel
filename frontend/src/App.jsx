import { useState } from "react";

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

const TR_MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const TR_DAYS   = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

// "Farabi Sokak: Sosyal Sanathane - 4 Nisan Cumartesi 12:00 - 14:00"
// "Tunalı: Ara Sokak Pub - 5 Nisan Pazar 19:30 - Genel Kültür"
// → { dateKey: "4 Nisan Cumartesi", timeSlot: "12:00 - 14:00" } veya { dateKey: "5 Nisan Pazar", timeSlot: "19:30" }
function parseIdeasoftName(fullName) {
  // \S+ yerine [^\d]+ kullanıyoruz — Türkçe karakterleri de kapsar
  const m1 = fullName.match(/- (\d+ [\S]+ [\S]+) (\d{2}:\d{2} - \d{2}:\d{2})/u);
  if (m1) return { dateKey: m1[1], timeSlot: m1[2] };
  const m2 = fullName.match(/- (\d+ [\S]+ [\S]+) (\d{2}:\d{2}) - /u);
  if (m2) return { dateKey: m2[1], timeSlot: m2[2] };
  const m3 = fullName.match(/- (\d+ [\S]+ [\S]+) (\d{2}:\d{2})$/u);
  if (m3) return { dateKey: m3[1], timeSlot: m3[2] };
  return null;
}

function parseDateStr(isoStr) {
  const d = new Date(isoStr);
  const day   = d.getDate();
  const month = TR_MONTHS[d.getMonth()];
  const dow   = TR_DAYS[d.getDay()];
  const hh    = String(d.getHours()).padStart(2,'0');
  const mm    = String(d.getMinutes()).padStart(2,'0');
  return { dateKey: `${day} ${month} ${dow}`, time: `${hh}:${mm}` };
}

function eventNameToCategory(name) {
  if (!name) return null;
  if (name.includes('3D Figür')) return '3D Figür';
  if (name.includes('Punch')) return 'Punch';
  if (name.includes('Seramik')) return 'Seramik';
  if (name.includes('Cupcake')) return 'Cupcake Mum';
  if (name.includes('Quiz')) {
    const m = name.match(/Quiz[^\n]*?[:\-]\s*(.+?)(?:\s*[\|\-]\s*Sosyal|\s*$)/i);
    if (m && m[1] && m[1].trim().length > 1 && !m[1].includes('Sanathane')) return 'Quiz Night - ' + m[1].trim();
    return 'Quiz Night';
  }
  if (name.includes('Plak')) return 'Plak Boyama';
  if (name.includes('Maske')) return 'Maske';
  if (name.includes('Heykel')) return 'Heykel';
  if (name.includes('Bez')) return 'Bez Çanta';
  if (name.includes('Mekanda')) return 'Mekanda Seç';
  return null;
}

function bubiletToCategory(name) {
  if (!name) return null;
  if (name.includes('3D Figür') || name.includes('3d') || name.includes('3D')) return '3D Figür';
  if (name.includes('Punch')) return 'Punch';
  if (name.includes('Seramik')) return 'Seramik';
  if (name.includes('Cupcake') || (name.includes('Mum') && !name.includes('Workshop'))) return 'Cupcake Mum';
  if (name.includes('Quiz')) {
    const m = name.match(/Quiz[^\n]*?[:\-]\s*(.+?)(?:\s*[\|\-]\s*Sosyal|\s*$)/i);
    if (m && m[1] && m[1].trim().length > 1 && !m[1].includes('Sanathane')) return 'Quiz Night - ' + m[1].trim();
    return 'Quiz Night';
  }
  if (name.includes('Plak')) return 'Plak Boyama';
  if (name.includes('Maske')) return 'Maske';
  if (name.includes('Heykel')) return 'Heykel';
  if (name.includes('Bez')) return 'Bez Çanta';
  if (name.includes('Resim')) return 'Resim';
  if (name.includes('Mekanda')) return 'Mekanda Seç';
  return null;
}

// ─── Seans Takvimi ─────────────────────────────────────────────────────────
// 0=Pazar,1=Pzt,2=Salı,3=Çar,4=Per,5=Cuma,6=Cmt
const EVENT_SCHEDULE = {
  'Heykel':       { weekday:[1,2,3,4,5], slots:['16:00 - 18:00','19:00 - 21:00'], weekend:[0,6], weekendSlots:['12:00 - 14:00','14:00 - 16:00','16:30 - 18:30','19:00 - 21:00'] },
  'Resim':        { weekday:[1,2,3,4,5], slots:['16:00 - 18:00','19:00 - 21:00'], weekend:[0,6], weekendSlots:['12:00 - 14:00','14:00 - 16:00','16:30 - 18:30','19:00 - 21:00'] },
  '3D Figür':     { weekday:[1,2,3,4,5], slots:['16:00 - 18:00','19:00 - 21:00'], weekend:[0,6], weekendSlots:['12:00 - 14:00','14:00 - 16:00','16:30 - 18:30','19:00 - 21:00'] },
  'Plak Boyama':  { weekday:[1,2,3,4,5], slots:['16:00 - 18:00','19:00 - 21:00'], weekend:[0,6], weekendSlots:['12:00 - 14:00','14:00 - 16:00','16:30 - 18:30','19:00 - 21:00'] },
  'Maske':        { weekday:[1,2,3,4,5], slots:['16:00 - 18:00','19:00 - 21:00'], weekend:[0,6], weekendSlots:['12:00 - 14:00','14:00 - 16:00','16:30 - 18:30','19:00 - 21:00'] },
  'Bez Çanta':    { weekday:[1,2,3,4,5], slots:['16:00 - 18:00','19:00 - 21:00'], weekend:[0,6], weekendSlots:['12:00 - 14:00','14:00 - 16:00','16:30 - 18:30','19:00 - 21:00'] },
  'Cupcake Mum':  { weekday:[5], slots:['17:30 - 19:30'], weekend:[0,6], weekendSlots:['14:30 - 16:30','17:00 - 19:00'] },
  'Seramik':      { weekday:[5], slots:['18:00 - 20:00'],  weekend:[0,6], weekendSlots:['14:30 - 16:30','17:00 - 19:00'] },
  'Punch':        { weekday:[], slots:[], weekend:[0,6], weekendSlots:['12:00 - 14:00','18:30 - 20:30'] },
  'Mekanda Seç':  { weekday:[1,2,3,4,5], slots:['16:00 - 18:00','19:00 - 21:00'], weekend:[0,6], weekendSlots:['12:00 - 14:00','14:00 - 16:00','16:30 - 18:30','19:00 - 21:00'] },
};

// Etkinliğe ait ürün (parent) bilgileri — İdeasoft'ta hangi parent altına ekleneceği
// ve hangi optionGroups/prices kullanılacağı
const EVENT_IDEASOFT_META = {
  // prices, specialInfo, sku → server tarafında parent'tan dinamik çekilir
  // Burada sadece parentId, fiyat ve stok bilgileri tutulur
  'Heykel':      { parentId:4247, price:450, stock:10, tax:20, currency:{id:3,label:'TL',abbr:'TL'}, mekan:'Farabi Sokak: Sosyal Sanathane' },
  'Resim':       { parentId:4241, price:450, stock:10, tax:20, currency:{id:3,label:'TL',abbr:'TL'}, mekan:'Farabi Sokak: Sosyal Sanathane' },
  '3D Figür':    { parentId:4234, price:450, stock:10, tax:20, currency:{id:3,label:'TL',abbr:'TL'}, mekan:'Farabi Sokak: Sosyal Sanathane' },
  'Plak Boyama': { parentId:4249, price:450, stock:10, tax:20, currency:{id:3,label:'TL',abbr:'TL'}, mekan:'Farabi Sokak: Sosyal Sanathane' },
  'Maske':       { parentId:4245, price:450, stock:10, tax:20, currency:{id:3,label:'TL',abbr:'TL'}, mekan:'Farabi Sokak: Sosyal Sanathane' },
  'Bez Çanta':   { parentId:4243, price:450, stock:10, tax:20, currency:{id:3,label:'TL',abbr:'TL'}, mekan:'Farabi Sokak: Sosyal Sanathane' },
  'Cupcake Mum': { parentId:4252, price:450, stock:8,  tax:20, currency:{id:3,label:'TL',abbr:'TL'}, mekan:'Farabi Sokak: Sosyal Sanathane' },
  'Seramik':     { parentId:12671,price:450, stock:8,  tax:20, currency:{id:3,label:'TL',abbr:'TL'}, mekan:'Farabi Sokak: Sosyal Sanathane' },
  'Punch':       { parentId:4278, price:600, stock:8,  tax:20, currency:{id:3,label:'TL',abbr:'TL'}, mekan:'Farabi Sokak: Sosyal Sanathane' },
  'Mekanda Seç': { parentId:5135, price:450, stock:10, tax:20, currency:{id:3,label:'TL',abbr:'TL'}, mekan:'Farabi Sokak: Sosyal Sanathane' },
};

function generateSeansListForCat(cat, startDateStr, endDateStr) {
  const sched = EVENT_SCHEDULE[cat];
  if (!sched) return [];

  // startDateStr ve endDateStr: "YYYY-MM-DD"
  const start = new Date(startDateStr + 'T00:00:00');
  const end   = new Date(endDateStr   + 'T23:59:59');
  const result = [];

  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay(); // 0=Pazar, 6=Cmt
    const day = cur.getDate();
    const monthName = TR_MONTHS[cur.getMonth()];
    const dayName   = TR_DAYS[dow];
    const dateKey   = `${day} ${monthName} ${dayName}`;

    let slots = [];
    if (sched.weekend.includes(dow)) {
      slots = sched.weekendSlots;
    } else if (sched.weekday.includes(dow)) {
      slots = sched.slots;
    }

    slots.forEach(slot => {
      result.push({ dateKey, slot, date: new Date(cur) });
    });

    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

function buildIdeasoftPayload(cat, dateKey, slot) {
  const meta = EVENT_IDEASOFT_META[cat];
  if (!meta) return null;
  // Seans adı: "Farabi Sokak: Sosyal Sanathane - 12 Nisan Pazar 19:00 - 21:00"
  const seansName = `${meta.mekan} - ${dateKey} ${slot}`;
  return {
    id: null,
    name: seansName,
    barcode: null,
    stockAmount: String(meta.stock),
    price1: String(meta.price),
    currency: meta.currency,
    discount: '0',
    discountType: 1,
    moneyOrderDiscount: 0,
    buyingPrice: '0',
    marketPriceDetail: null,
    taxIncluded: 1,
    tax: meta.tax,
    warranty: 0,
    volumetricWeight: '0',
    stockTypeLabel: 'Piece',
    customShippingDisabled: 1,
    customShippingCost: 0,
    customizationGroups: [],
    gift: null,
    hasGift: 0,
    installmentThreshold: '-',
    selectionGroups: [],
    extraInfos: [],
    status: 1,
    parent: { id: meta.parentId },
    // prices, specialInfo, sku, slug, optionGroups, optionIds → server tarafında dinamik oluşturulur
  };
}

function buildSeanceMap(data) {
  if (!data) return [];
  const map = {};

  const ensureSeance = (dateKey, timeSlot, sortDate) => {
    const key = `${dateKey}|${timeSlot}`;
    if (!map[key]) map[key] = { dateKey, timeSlot, sortDate: sortDate || new Date(0), categories: {}, _sorted: false };
    return key;
  };

  const ensureCat = (key, cat) => {
    if (!map[key].categories[cat]) map[key].categories[cat] = { bubilet:0, biletinial:0, ideasoft:0 };
  };

  // İdeasoft — temel iskelet, tüm seanslar buradan oluşur
  // Quiz Night için kategori adı fullName'in sonundan alınır:
  // "Tunalı: Ara Sokak Pub - 5 Nisan Pazar 19:30 - Genel Kültür" → "Quiz Night - Genel Kültür"
  (data.ideasoft || []).forEach(s => {
    const parsed = parseIdeasoftName(s.fullName);
    if (!parsed) return;
    const { dateKey, timeSlot } = parsed;

    // Quiz Night için konsept adını fullName'den çıkar
    let cat = s.category;
    if (cat === 'Quiz Night') {
      // "- 5 Nisan Pazar 19:30 - Genel Kültür" → son " - " den sonrası konsept adı
      const lastDash = s.fullName.lastIndexOf(' - ');
      const timeMatch = s.fullName.match(/\d{2}:\d{2}/g);
      const lastTime  = timeMatch ? timeMatch[timeMatch.length - 1] : null;
      // Son " - " den sonrası bir saat değilse konsept adıdır
      if (lastDash !== -1) {
        const afterLastDash = s.fullName.slice(lastDash + 3).trim();
        if (afterLastDash && !/^\d{2}:\d{2}/.test(afterLastDash)) {
          cat = 'Quiz Night - ' + afterLastDash;
        }
      }
    }

    const key = ensureSeance(dateKey, timeSlot, null);
    ensureCat(key, cat);
    map[key].categories[cat].ideasoft += (s.soldCount || 0);
    // seanceId ve status'u satış panelinde toggle için sakla
    if (s.seanceId) {
      if (!map[key]._seanceIds) map[key]._seanceIds = [];
      if (!map[key]._seanceIds.includes(s.seanceId)) map[key]._seanceIds.push(s.seanceId);
      if (!map[key]._seanceStatus) map[key]._seanceStatus = {};
      map[key]._seanceStatus[s.seanceId] = s.status;
    }
    // Her seans için Quiz Night ise hangi konsept olduğunu kaydet (biletinial eşleştirmesi için)
    if (!map[key]._quizCat && cat.startsWith('Quiz Night')) {
      map[key]._quizCat = cat;
    }
    if (!map[key]._sorted) {
      const dayNum = parseInt(dateKey);
      let monIdx = -1;
      for (let i = 0; i < TR_MONTHS.length; i++) {
        if (dateKey.includes(TR_MONTHS[i])) { monIdx = i; break; }
      }
      const startMatch = timeSlot.match(/^(\d{2}):(\d{2})/);
      const [startH, startM] = startMatch ? [parseInt(startMatch[1]), parseInt(startMatch[2])] : [0, 0];
      const _n = new Date();
      const nowYear = _n.getFullYear();
      // Önce bu yıl için tarihi dene; o günün 21:00'ı geçmişse gelecek yıla at
      let year = nowYear;
      const candidateDay21 = new Date(nowYear, monIdx >= 0 ? monIdx : _n.getMonth(), dayNum || 1, 21, 0, 0);
      if (_n >= candidateDay21) {
        year = nowYear + 1;
      }
      map[key].sortDate = new Date(year, monIdx >= 0 ? monIdx : _n.getMonth(), dayNum || 1, startH, startM || 0);
      map[key]._sorted = true;
    }
  });

  // Biletini Al — sadece satışı > 0 olan seansları ekle
  // Workshop seansları: server tarafında _workshopCat ile kırılım çözüldü.
  // Quiz seansları: Biletini Al'da konsept adı yok, sadece "Quiz Night" geliyor.
  // Eşleştirme: aynı gün + saat → İdeasoft'taki _quizCat kategori adını kullan.
  (data.biletinial || []).forEach(s => {
    if (!s.SalesTicketTotalCount || s.SalesTicketTotalCount === 0) return;

    // SeanceDate "2026-04-04T12:00:00" formatında lokal saat olarak geliyor — direkt parse et
    const { dateKey, time } = parseDateStr(s.SeanceDate);

    // Workshop alt kırılımı server tarafında zaten çözüldü:
    // _workshopCat varsa direkt kullan (ör. "Bez Çanta", "Heykel" vb.)
    const isQuiz = s.EventName && s.EventName.includes('Quiz');

    let cat;
    if (s._workshopCat) {
      cat = s._workshopCat;
    } else if (isQuiz) {
      cat = 'Quiz Night';
    } else {
      cat = eventNameToCategory(s.EventName);
    }
    if (!cat) return;

    // Önce tam eşleşme ara (aynı gün + saat)
    let matchKey = Object.keys(map).find(k => {
      const [kDate, kSlot] = k.split('|');
      return kDate === dateKey && kSlot.startsWith(time);
    });

    // Quiz için: tam eşleşme yoksa aynı günde _quizCat olan seansı bul
    if (!matchKey && isQuiz) {
      matchKey = Object.keys(map).find(k => {
        const [kDate] = k.split('|');
        return kDate === dateKey && map[k]._quizCat;
      });
    }

    // Workshop için: tam eşleşme yoksa aynı günde ilgili kategoriyi ara
    // (Biletini Al saat/timezone farkı olabilir; _workshopCat ile kategori eşleştir)
    if (!matchKey && s._workshopCat) {
      matchKey = Object.keys(map).find(k => {
        const [kDate] = k.split('|');
        return kDate === dateKey && map[k].categories[cat] !== undefined;
      });
      // Hâlâ bulunamadıysa aynı günün herhangi bir seansına ekle
      if (!matchKey) {
        matchKey = Object.keys(map).find(k => k.startsWith(dateKey + '|'));
      }
    }

    // Quiz değilse ve workshop değilse: tam eşleşme yoksa aynı günde aynı kategoriyi bul
    if (!matchKey && !isQuiz && !s._workshopCat) {
      matchKey = Object.keys(map).find(k => {
        const [kDate] = k.split('|');
        return kDate === dateKey && map[k].categories[cat] !== undefined;
      });
      if (!matchKey) {
        matchKey = Object.keys(map).find(k => k.startsWith(dateKey + '|'));
      }
      if (matchKey) {
        map[matchKey]._allDay = map[matchKey]._allDay || {};
        map[matchKey]._allDay[cat] = (map[matchKey]._allDay[cat] || 0) + (s.SalesTicketTotalCount || 0);
      }
    }

    // Quiz için kategori adını İdeasoft'takiyle eşitle
    if (isQuiz && matchKey && map[matchKey]._quizCat) {
      cat = map[matchKey]._quizCat;
    }

    const key = matchKey || ensureSeance(dateKey, time, new Date(s.SeanceDate));
    ensureCat(key, cat);
    map[key].categories[cat].biletinial += (s.SalesTicketTotalCount || 0);
  });

  // Bubilet
  (data.bubilet || []).forEach(s => {
    const { dateKey, time } = parseDateStr(s.tarih);
    const isQuiz = s.etkinlikAdi && s.etkinlikAdi.includes('Quiz');

    // Workshop alt kırılımı server tarafında zaten çözüldü:
    // _workshopCat varsa direkt kullan (ör. "Mekanda Seç", "Seramik" vb.)
    let cat;
    if (s._workshopCat) {
      cat = s._workshopCat;
    } else if (isQuiz) {
      cat = 'Quiz Night';
    } else {
      cat = bubiletToCategory(s.etkinlikAdi);
    }
    if (!cat) return;

    // Tam eşleşme
    let matchKey = Object.keys(map).find(k => {
      const [kDate, kSlot] = k.split('|');
      return kDate === dateKey && kSlot.startsWith(time);
    });

    // Quiz için: aynı günde _quizCat olan seansı bul
    if (!matchKey && isQuiz) {
      matchKey = Object.keys(map).find(k => {
        const [kDate] = k.split('|');
        return kDate === dateKey && map[k]._quizCat;
      });
    }

    // Quiz için kategori adını İdeasoft'takiyle eşitle
    if (isQuiz && matchKey && map[matchKey]._quizCat) {
      cat = map[matchKey]._quizCat;
    }

    const key = matchKey || ensureSeance(dateKey, time, new Date(s.tarih));
    ensureCat(key, cat);
    map[key].categories[cat].bubilet += (s.biletAdet || 0);
  });

  // Filtreleme kuralı:
  // - Başlangıç saatinden 30 dakika sonra kaybolur.
  // - Başlangıç saati yoksa o günün 21:00'ında kaybolur.
  const _now = new Date();

  return Object.values(map)
    .filter(s => {
      // timeSlot örnek: "14:00 - 16:00" → başlangıç 14:00
      const startMatch = s.timeSlot.match(/^(\d{2}):(\d{2})/);
      let hideAfter;
      if (startMatch) {
        // Başlangıç saati + 30dk
        hideAfter = new Date(
          s.sortDate.getFullYear(),
          s.sortDate.getMonth(),
          s.sortDate.getDate(),
          parseInt(startMatch[1]),
          parseInt(startMatch[2]) + 30,
          0
        );
      } else {
        // Başlangıç saati yoksa o günün 21:00'ı
        hideAfter = new Date(
          s.sortDate.getFullYear(),
          s.sortDate.getMonth(),
          s.sortDate.getDate(),
          21, 0, 0
        );
      }
      return _now < hideAfter;
    })
    .sort((a,b) => a.sortDate - b.sortDate);
}

// ─── Ana Uygulama ─────────────────────────────────────────────────────────────
export default function App() {
  const [loggedIn, setLoggedIn]             = useState(false);
  const [autoLoginLoading, setAutoLoginLoading] = useState(true); // başlangıçta deniyor
  const [roleScreen, setRoleScreen]         = useState(false);  // rol seçim ekranı
  const [role, setRole]                     = useState(null);   // 'admin' | 'staff'
  const [rolePin, setRolePin]               = useState('');
  const [rolePinTarget, setRolePinTarget]   = useState(null);   // hangi rol için pin isteniyor
  const [rolePinError, setRolePinError]     = useState(false);
  const [form, setForm]                     = useState({ bubiletUser:'', bubiletPass:'', biletinialToken:'', ideasoftUser:'', ideasoftPass:'' });
  const [rememberMe, setRememberMe]         = useState(true);
  const [loginLoading, setLoginLoading]     = useState(false);
  const [loginError, setLoginError]         = useState(null);
  const [mode, setMode]                     = useState(null);
  const [salesData, setSalesData]           = useState(null);
  const [salesLoading, setSalesLoading]     = useState(false);
  const [salesError, setSalesError]         = useState(null);
  const [lastUpdated, setLastUpdated]       = useState(null);
  const [expandedSeance, setExpandedSeance] = useState(null);
  const [selectedCat, setSelectedCat]       = useState(null);
  const [stockEdits, setStockEdits]         = useState({});
  const [stockUpdating, setStockUpdating]   = useState({});
  const [stockMsg, setStockMsg]             = useState({});
  const [showIdeasoftReport, setShowIdeasoftReport] = useState(false);
  const [toggling, setToggling]                   = useState({});
  const [deleting, setDeleting]                   = useState({});
  const [deleteConfirm, setDeleteConfirm]         = useState({});

  // Sayfa açılınca otomatik login dene
  useState(() => {
    fetch('/api/auto-login', { method:'POST' })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setLoggedIn(true);
          setRoleScreen(true);
          // Arka planda satış verilerini hemen çekmeye başla
          fetch("/api/sales").then(r=>r.json()).then(d=>{ if(!d.error){ setSalesData(d); setLastUpdated(new Date().toLocaleTimeString("tr-TR")); } }).catch(()=>{});
        } else {
          // Kayıtlı bilgileri forma doldur
          fetch('/api/saved-credentials')
            .then(r=>r.json())
            .then(d => {
              if (d.exists) {
                setForm(p => ({...p,
                  bubiletUser:     d.bubiletUser     || '',
                  biletinialToken: d.biletinialToken || '',
                  ideasoftUser:    d.ideasoftUser    || '',
                  bubiletPass:     d.bubiletPassFilled  ? '••••••••' : '',
                  ideasoftPass:    d.ideasoftPassFilled ? '••••••••' : '',
                }));
              }
            }).catch(()=>{});
        }
      })
      .catch(() => {})
      .finally(() => setAutoLoginLoading(false));
  }, []);

  const handleLogin = async () => {
    setLoginLoading(true); setLoginError(null);
    const sendPass = v => (v === '••••••••' ? '' : v);
    const body = {
      bubiletUser:     form.bubiletUser,
      bubiletPass:     sendPass(form.bubiletPass),
      biletinialToken: form.biletinialToken,
      ideasoftUser:    form.ideasoftUser,
      ideasoftPass:    sendPass(form.ideasoftPass),
      rememberMe
    };
    try {
      const res  = await fetch("/api/login", {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setLoggedIn(true);
      setRoleScreen(true);
    } catch(e) { setLoginError(e.message); }
    finally { setLoginLoading(false); }
  };

  const fetchSales = async () => {
    setSalesLoading(true); setSalesError(null);
    try {
      // /api/sales/refresh → Bubilet/Biletinial/İdeasoft'tan taze veri çeker
      // (eski /api/sales sadece bellekteki eski veriyi döndürüyordu)
      const res  = await fetch("/api/sales/refresh", { method: "POST" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSalesData(json);
      setLastUpdated(new Date().toLocaleTimeString("tr-TR"));
      setShowIdeasoftReport(false);
    } catch(e) { setSalesError(e.message); }
    finally { setSalesLoading(false); }
  };

  const handleStockUpdate = async (seanceId) => {
    const val = stockEdits[seanceId];
    if (val === undefined || val === '') return;
    setStockUpdating(p => ({...p,[seanceId]:true}));
    setStockMsg(p => ({...p,[seanceId]:''}));
    try {
      const res  = await fetch("/api/ideasoft/update-stock", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({seanceId, newStock:parseInt(val)})
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setStockMsg(p => ({...p,[seanceId]:'✓'}));
      setStockEdits(p => { const n={...p}; delete n[seanceId]; return n; });
      if (salesData) fetchSales();
    } catch(e) { setStockMsg(p => ({...p,[seanceId]:'✗'})); }
    finally { setStockUpdating(p => ({...p,[seanceId]:false})); }
  };

  const handleToggleSeance = async (seanceId, currentlyActive) => {
    setToggling(p => ({...p,[seanceId]:true}));
    try {
      const res  = await fetch("/api/ideasoft/toggle-seance", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({seanceId, active:!currentlyActive})
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      // Tüm veriyi yeniden çekmek yerine sadece o seansin status'unu local güncelle
      setSalesData(prev => {
        if (!prev || !prev.ideasoft) return prev;
        return {
          ...prev,
          ideasoft: prev.ideasoft.map(s =>
            s.seanceId === seanceId ? { ...s, status: currentlyActive ? 0 : 1 } : s
          )
        };
      });
    } catch(e) { alert('Hata: ' + e.message); }
    finally { setToggling(p => ({...p,[seanceId]:false})); }
  };

  const handleDeleteOption = async (seanceId) => {
    if (!deleteConfirm[seanceId]) {
      // İlk tıklama — onay iste
      setDeleteConfirm(p => ({...p, [seanceId]: true}));
      // 5 saniye sonra onayı iptal et
      setTimeout(() => setDeleteConfirm(p => {
        const next = {...p}; delete next[seanceId]; return next;
      }), 5000);
      return;
    }
    // İkinci tıklama — gerçekten sil
    setDeleteConfirm(p => { const n={...p}; delete n[seanceId]; return n; });
    setDeleting(p => ({...p, [seanceId]: true}));
    try {
      const res = await fetch(`/api/ideasoft/delete-option/${seanceId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      // Local state'den kaldır
      setSalesData(prev => {
        if (!prev || !prev.ideasoft) return prev;
        return { ...prev, ideasoft: prev.ideasoft.filter(s => s.seanceId !== seanceId) };
      });
    } catch(e) { alert('Silme hatası: ' + e.message); }
    finally { setDeleting(p => { const n={...p}; delete n[seanceId]; return n; }); }
  };

  // Geçmiş seans kontrolü: başlangıç saati geçmiş mi?
  const isSeancePast = (s) => {
    const parsed = parseIdeasoftName(s.fullName);
    if (!parsed) return false;
    const dayNum = parseInt(parsed.dateKey);
    let monIdx = -1;
    for (let i = 0; i < TR_MONTHS.length; i++) {
      if (parsed.dateKey.includes(TR_MONTHS[i])) { monIdx = i; break; }
    }
    if (monIdx === -1) return false;
    const startMatch = parsed.timeSlot.match(/^(\d{2}):(\d{2})/);
    if (!startMatch) return false;
    const now = new Date();
    const startTime = new Date(now.getFullYear(), monIdx, dayNum, parseInt(startMatch[1]), parseInt(startMatch[2]), 0);
    return now >= startTime;
  };

  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState({});

  // ─── SEANS YAZDIRMA ────────────────────────────────────────────────────────
  const [seansYazMode, setSeansYazMode]         = useState(false);   // tam sayfa ekran
  const [seansYazStep, setSeansYazStep]         = useState(1);       // 1=etkinlik seç, 2=tarih, 3=önizleme/oluştur
  const [seansYazCat, setSeansYazCat]           = useState(null);
  const [seansYazStart, setSeansYazStart]       = useState('');
  const [seansYazEnd, setSeansYazEnd]           = useState('');
  const [seansYazList, setSeansYazList]         = useState([]);      // oluşturulacak seanslar
  const [seansYazProgress, setSeansYazProgress] = useState(null);    // { done, total, errors }
  const [seansYazDone, setSeansYazDone]         = useState(false);

  const handleBulkDeletePast = async (cat) => {
    if (!bulkDeleteConfirm[cat]) {
      setBulkDeleteConfirm(p => ({...p, [cat]: true}));
      setTimeout(() => setBulkDeleteConfirm(p => { const n={...p}; delete n[cat]; return n; }), 5000);
      return;
    }
    setBulkDeleteConfirm(p => { const n={...p}; delete n[cat]; return n; });
    setBulkDeleting(true);
    const pastSeances = (salesData?.ideasoft || []).filter(s => s.category === cat && s.seanceId && isSeancePast(s));
    let deletedIds = [];
    for (const s of pastSeances) {
      try {
        const res = await fetch(`/api/ideasoft/delete-option/${s.seanceId}`, { method: 'DELETE' });
        const json = await res.json();
        if (!json.error) deletedIds.push(s.seanceId);
      } catch(e) { /* devam et */ }
    }
    if (deletedIds.length > 0) {
      setSalesData(prev => {
        if (!prev || !prev.ideasoft) return prev;
        return { ...prev, ideasoft: prev.ideasoft.filter(s => !deletedIds.includes(s.seanceId)) };
      });
    }
    setBulkDeleting(false);
  };



  // ─── OTOM. SEANS KAPATMA ───────────────────────────────────────────────────
  // Her dakika kontrol: başlangıç saati gelen aktif seansları otomatik kapat
  useState(() => {
    const autoCloseCheck = () => {
      if (!salesData?.ideasoft) return;
      const now = new Date();
      salesData.ideasoft.forEach(s => {
        if (s.status !== 1) return; // zaten pasif
        if (!s.seanceId) return;
        const parsed = parseIdeasoftName(s.fullName);
        if (!parsed) return;
        const dayNum = parseInt(parsed.dateKey);
        let monIdx = -1;
        for (let i = 0; i < TR_MONTHS.length; i++) {
          if (parsed.dateKey.includes(TR_MONTHS[i])) { monIdx = i; break; }
        }
        if (monIdx === -1) return;
        // Başlangıç saatini al
        const startMatch = parsed.timeSlot.match(/^(\d{2}):(\d{2})/);
        if (!startMatch) return;
        const startH = parseInt(startMatch[1]);
        const startM = parseInt(startMatch[2]);
        const startTime = new Date(now.getFullYear(), monIdx, dayNum, startH, startM, 0);
        // Başlangıç saati geldi ve seans hâlâ aktif → kapat
        if (now >= startTime && !toggling[s.seanceId]) {
          console.log('Otomatik seans kapatma (başlangıç saati):', s.fullName);
          handleToggleSeance(s.seanceId, true);
        }
      });
    };
    const interval = setInterval(autoCloseCheck, 30000); // her 30 saniyede kontrol
    autoCloseCheck(); // hemen bir kez çalıştır
    return () => clearInterval(interval);
  }, [salesData]);

  const getIdeasoftForCat = (cat) => {
    return (salesData?.ideasoft || [])
      .filter(s => s.category === cat)
      .sort((a, b) => {
        const toDate = (s) => {
          const parsed = parseIdeasoftName(s.fullName);
          if (!parsed) return new Date(0);
          const dayNum = parseInt(parsed.dateKey);
          let monIdx = -1;
          for (let i = 0; i < TR_MONTHS.length; i++) {
            if (parsed.dateKey.includes(TR_MONTHS[i])) { monIdx = i; break; }
          }
          if (monIdx === -1) return new Date(0);
          const startMatch = parsed.timeSlot.match(/^(\d{2}):(\d{2})/);
          const [h, m] = startMatch ? [parseInt(startMatch[1]), parseInt(startMatch[2])] : [0, 0];
          const now = new Date();
          return new Date(now.getFullYear(), monIdx, dayNum, h, m, 0);
        };
        return toDate(a) - toDate(b);
      });
  };

  // ─── SEANS YAZDIRMA ────────────────────────────────────────────────────────
  const handleSeansYazOpen = () => {
    setSeansYazMode(true);
    setSeansYazStep(1);
    setSeansYazCat(null);
    setSeansYazStart('');
    setSeansYazEnd('');
    setSeansYazList([]);
    setSeansYazProgress(null);
    setSeansYazDone(false);
  };

  const handleSeansYazCatSelect = (cat) => {
    setSeansYazCat(cat);
    setSeansYazStep(2);
  };

  const handleSeansYazDateConfirm = () => {
    if (!seansYazStart || !seansYazEnd) return;
    const list = generateSeansListForCat(seansYazCat, seansYazStart, seansYazEnd);
    setSeansYazList(list);
    setSeansYazStep(3);
  };

  const [seansYazErrors, setSeansYazErrors] = useState([]); // hatalı seans detayları
  const [seansYazCurrentName, setSeansYazCurrentName] = useState('');

  const handleSeansYazCreate = async () => {
    const jobId = 'job_' + Date.now();
    setSeansYazProgress({ done: 0, total: seansYazList.length, errors: 0 });
    setSeansYazErrors([]);
    setSeansYazCurrentName('');

    const seances = seansYazList.map(item => buildIdeasoftPayload(seansYazCat, item.dateKey, item.slot));

    // Polling: her 1 saniyede progress sorgula
    const pollInterval = setInterval(async () => {
      try {
        const pr = await fetch('/api/ideasoft/bulk-progress/' + jobId).then(r => r.json());
        if (pr.found) {
          setSeansYazProgress({ done: pr.done, total: pr.total, errors: pr.errors });
          setSeansYazCurrentName(pr.current || '');
        }
      } catch {}
    }, 1000);

    try {
      const res = await fetch('/api/ideasoft/create-seances-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seances, jobId })
      });
      const json = await res.json();
      clearInterval(pollInterval);
      if (json.error) {
        setSeansYazProgress({ done: 0, total: seansYazList.length, errors: seansYazList.length });
        setSeansYazErrors([{ seans: 'Tümü', hata: json.error }]);
      } else {
        const errorList = (json.results || [])
          .filter(r => !r.success)
          .map(r => ({ seans: r.name, hata: r.error }));
        setSeansYazProgress({ done: json.total, total: json.total, errors: json.errors || 0 });
        setSeansYazErrors(errorList);
        setSeansYazCurrentName('');
      }
    } catch(e) {
      clearInterval(pollInterval);
      setSeansYazProgress({ done: 0, total: seansYazList.length, errors: seansYazList.length });
      setSeansYazErrors([{ seans: 'Tümü', hata: e.message }]);
    }
    setSeansYazDone(true);
  };

  // ─── SEANS YAZDIRMA TAM EKRAN ──────────────────────────────────────────────
  if (seansYazMode) {
    const SEANS_CATS = Object.keys(EVENT_SCHEDULE);
    return (
      <div style={S.page}>
        <div style={S.header}>
          <div style={S.headerLeft}>
            <button style={{...S.smallBtn, marginRight:4}} onClick={() => setSeansYazMode(false)}>← Geri</button>
            <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>📅 SEANS YAZDIRMA</span>
          </div>
          {seansYazStep > 1 && !seansYazDone && (
            <button style={S.smallBtn} onClick={() => { setSeansYazStep(s => s-1); setSeansYazProgress(null); setSeansYazDone(false); }}>
              ← Önceki Adım
            </button>
          )}
        </div>
        <div style={{maxWidth:720,margin:'0 auto',padding:'24px 18px'}}>
          {/* Adım göstergesi */}
          <div style={{display:'flex',gap:8,marginBottom:28,alignItems:'center'}}>
            {['Etkinlik Seç','Tarih Aralığı','Önizleme & Oluştur'].map((label,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:8,flex:1}}>
                <div style={{width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:12,fontWeight:800,flexShrink:0,
                  background: seansYazStep>i+1?'#22c55e': seansYazStep===i+1?'#4fc9ff':'#1a2035',
                  color: seansYazStep>=i+1?'#fff':'#374151',
                  border:'2px solid '+(seansYazStep>i+1?'#22c55e':seansYazStep===i+1?'#4fc9ff':'#1a2035')
                }}>{seansYazStep>i+1?'✓':i+1}</div>
                <span style={{fontSize:11,color:seansYazStep===i+1?'#4fc9ff':'#374151',fontWeight:seansYazStep===i+1?700:400,whiteSpace:'nowrap'}}>{label}</span>
                {i<2 && <div style={{flex:1,height:1,background:'#1a2035',minWidth:8}}/>}
              </div>
            ))}
          </div>

          {/* ADIM 1 */}
          {seansYazStep === 1 && (
            <div>
              <div style={{fontSize:13,color:'#64748b',marginBottom:16,fontWeight:600,letterSpacing:1,textTransform:'uppercase'}}>
                Seans yazdırmak istediğiniz etkinliği seçin
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {SEANS_CATS.map(cat => (
                  <button key={cat}
                    onClick={() => handleSeansYazCatSelect(cat)}
                    style={{
                      background:'#0d1120',border:'1px solid #1a2035',borderRadius:14,
                      padding:'18px 14px',cursor:'pointer',display:'flex',flexDirection:'column',
                      alignItems:'center',textAlign:'center',gap:8,transition:'all 0.15s'
                    }}>
                    <span style={{fontSize:28}}>{getCatIcon(cat)}</span>
                    <span style={{fontSize:13,fontWeight:700,color:'#e2e8f0'}}>{cat}</span>
                    <span style={{fontSize:11,color:'#374151'}}>
                      {EVENT_SCHEDULE[cat].weekday.length > 0 && EVENT_SCHEDULE[cat].weekend.length > 0
                        ? 'Hafta içi + haftasonu'
                        : EVENT_SCHEDULE[cat].weekend.length > 0
                          ? 'Yalnızca haftasonu'
                          : 'Hafta içi'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ADIM 2 */}
          {seansYazStep === 2 && (
            <div>
              <div style={{background:'#0d1120',border:'1px solid #1a2035',borderRadius:14,padding:'16px 18px',marginBottom:20}}>
                <div style={{fontSize:14,fontWeight:700,color:'#4fc9ff',marginBottom:6}}>
                  {getCatIcon(seansYazCat)} {seansYazCat}
                </div>
                {EVENT_SCHEDULE[seansYazCat]?.weekday?.length > 0 && (
                  <div style={{fontSize:11,color:'#64748b',marginBottom:3}}>
                    📌 Hafta içi: {EVENT_SCHEDULE[seansYazCat].slots.join(' & ')}
                  </div>
                )}
                {EVENT_SCHEDULE[seansYazCat]?.weekend?.length > 0 && (
                  <div style={{fontSize:11,color:'#64748b'}}>
                    📌 Haftasonu: {EVENT_SCHEDULE[seansYazCat].weekendSlots.join(' & ')}
                  </div>
                )}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div>
                  <div style={{fontSize:11,color:'#64748b',marginBottom:6,fontWeight:600,letterSpacing:1}}>BAŞLANGIÇ TARİHİ</div>
                  <input type="date" value={seansYazStart} onChange={e=>setSeansYazStart(e.target.value)}
                    style={{...S.input, marginBottom:0, fontSize:15, padding:'12px 14px'}}/>
                </div>
                <div>
                  <div style={{fontSize:11,color:'#64748b',marginBottom:6,fontWeight:600,letterSpacing:1}}>BİTİŞ TARİHİ</div>
                  <input type="date" value={seansYazEnd} onChange={e=>setSeansYazEnd(e.target.value)}
                    style={{...S.input, marginBottom:0, fontSize:15, padding:'12px 14px'}}/>
                </div>
                <button
                  onClick={handleSeansYazDateConfirm}
                  disabled={!seansYazStart || !seansYazEnd || seansYazStart > seansYazEnd}
                  style={{
                    padding:'14px',borderRadius:12,fontSize:15,fontWeight:700,border:'none',cursor:'pointer',
                    background: (!seansYazStart||!seansYazEnd||seansYazStart>seansYazEnd)
                      ? '#1a2035' : 'linear-gradient(135deg,#0ea5e9,#0284c7)',
                    color: (!seansYazStart||!seansYazEnd||seansYazStart>seansYazEnd) ? '#374151' : '#fff',
                    transition:'all 0.15s'
                  }}>
                  Seansları Hesapla →
                </button>
              </div>
            </div>
          )}

          {/* ADIM 3 */}
          {seansYazStep === 3 && (
            <div>
              {!seansYazProgress && !seansYazDone && (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
                    <div style={{fontSize:13,color:'#e2e8f0',fontWeight:700}}>
                      {getCatIcon(seansYazCat)} {seansYazCat} — <span style={{color:'#4fc9ff'}}>{seansYazList.length} seans</span>
                    </div>
                    <span style={{fontSize:11,color:'#374151'}}>{seansYazStart} → {seansYazEnd}</span>
                  </div>
                  {seansYazList.length === 0 ? (
                    <div style={S.empty}>Bu tarih aralığında seans bulunamadı.</div>
                  ) : (
                    <>
                      <div style={{background:'#0d1120',border:'1px solid #1a2035',borderRadius:12,overflow:'hidden',marginBottom:16,maxHeight:380,overflowY:'auto'}}>
                        {seansYazList.map((item, i) => (
                          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                            padding:'10px 14px',borderBottom:'1px solid #0a0e1a'}}>
                            <span style={{fontSize:13,color:'#94a3b8'}}>{item.dateKey}</span>
                            <span style={{fontSize:13,fontWeight:700,color:'#4fc9ff'}}>{item.slot}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={handleSeansYazCreate}
                        style={{width:'100%',padding:'15px',borderRadius:12,fontSize:15,fontWeight:700,border:'none',
                          cursor:'pointer',background:'linear-gradient(135deg,#22c55e,#16a34a)',color:'#fff'}}>
                        ✅ {seansYazList.length} Seansı İdeasoft'a Yaz
                      </button>
                    </>
                  )}
                </>
              )}

              {seansYazProgress && !seansYazDone && (
                <div style={{textAlign:'center',padding:'32px 16px'}}>
                  <div style={{fontSize:36,marginBottom:12}}>⏳</div>
                  <div style={{fontSize:16,fontWeight:700,color:'#fff',marginBottom:4}}>Seanslar ekleniyor, lütfen bekleyin</div>
                  <div style={{fontSize:14,color:'#b47cff',fontWeight:700,marginBottom:16,letterSpacing:1}}>
                    {getCatIcon(seansYazCat)} {seansYazCat}
                  </div>

                  {/* Şu an eklenen seans */}
                  {seansYazCurrentName ? (
                    <div style={{background:'#0d1a2e',border:'1px solid #1e3a5f',borderRadius:10,
                      padding:'10px 16px',marginBottom:16,marginLeft:'auto',marginRight:'auto',maxWidth:380,textAlign:'left'}}>
                      <div style={{fontSize:10,color:'#4fc9ff',fontWeight:700,letterSpacing:1,marginBottom:3,textTransform:'uppercase'}}>Ekleniyor</div>
                      <div style={{fontSize:13,color:'#e2e8f0',fontWeight:600}}>{seansYazCurrentName}</div>
                    </div>
                  ) : (
                    <div style={{height:46,marginBottom:16}}/>
                  )}

                  {/* İlerleme çubuğu */}
                  <div style={{background:'#1a2035',borderRadius:8,height:10,overflow:'hidden',
                    margin:'0 auto 10px',maxWidth:380}}>
                    <div style={{
                      height:'100%',borderRadius:8,
                      background:'linear-gradient(90deg,#0ea5e9,#22c55e)',
                      width: seansYazProgress.total > 0
                        ? Math.round((seansYazProgress.done / seansYazProgress.total) * 100) + '%'
                        : '0%',
                      transition:'width 0.5s ease'
                    }}/>
                  </div>
                  <div style={{fontSize:13,color:'#4fc9ff',fontWeight:700,marginBottom:4}}>
                    {seansYazProgress.done} / {seansYazProgress.total} eklendi
                  </div>
                  {seansYazProgress.errors > 0 && (
                    <div style={{fontSize:12,color:'#f87171',marginTop:4}}>✗ {seansYazProgress.errors} hata</div>
                  )}
                </div>
              )}

              {seansYazDone && seansYazProgress && (
                <div style={{textAlign:'center',padding:'32px 16px'}}>
                  <div style={{fontSize:52,marginBottom:16}}>{seansYazProgress.errors===0?'🎉':'⚠️'}</div>
                  <div style={{fontSize:18,fontWeight:800,color:'#fff',marginBottom:12}}>
                    {seansYazProgress.errors===0?'Tüm seanslar oluşturuldu!':'İşlem tamamlandı'}
                  </div>
                  <div style={{fontSize:14,color:'#22c55e',marginBottom:4}}>
                    ✓ {seansYazProgress.done - seansYazProgress.errors} seans başarıyla oluşturuldu
                  </div>
                  {seansYazProgress.errors > 0 && (
                    <div style={{fontSize:13,color:'#f87171',marginBottom:12}}>
                      ✗ {seansYazProgress.errors} seans oluşturulamadı
                    </div>
                  )}
                  {seansYazErrors.length > 0 && (
                    <div style={{background:'#1a0f0f',border:'1px solid #7f1d1d',borderRadius:10,padding:'12px 14px',marginBottom:16,textAlign:'left',maxHeight:220,overflowY:'auto'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#f87171',marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>Hatalı Seanslar</div>
                      {seansYazErrors.map((e,i)=>(
                        <div key={i} style={{marginBottom:6,paddingBottom:6,borderBottom:'1px solid #2a1010'}}>
                          <div style={{fontSize:12,fontWeight:700,color:'#fca5a5'}}>{e.seans}</div>
                          <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>{e.hata}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setSeansYazMode(false)}
                    style={{marginTop:8,padding:'13px 32px',borderRadius:12,fontSize:14,fontWeight:700,
                      border:'none',cursor:'pointer',background:'linear-gradient(135deg,#b47cff,#7c3aff)',color:'#fff'}}>
                    ← Panele Dön
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (autoLoginLoading) {
    const RADIUS = 40;
    const CIRC = 2 * Math.PI * RADIUS;
    return (
      <div style={S.page}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',paddingTop:'37vh'}}>
          {/* SVG yuvarlak timer */}
          <div style={{position:'relative',width:100,height:100,marginBottom:18}}>
            <svg width="100" height="100" style={{transform:'rotate(-90deg)'}}>
              {/* Arka halka */}
              <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#1a2035" strokeWidth="5"/>
              {/* İlerleme halkası - CSS animasyonlu */}
              <circle
                cx="50" cy="50" r={RADIUS}
                fill="none"
                stroke="#b47cff"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset="0"
                style={{
                  animation:'loginTimer 6.5s linear forwards',
                }}
              />
            </svg>
            {/* Ortadaki ikon */}
            <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',fontSize:28}}>🎟</div>
          </div>
          <div style={{fontSize:14,color:'#475569',letterSpacing:1}}>Giriş yapılıyor…</div>
          <style>{`
            @keyframes loginTimer {
              from { stroke-dashoffset: 0; }
              to   { stroke-dashoffset: ${CIRC}; }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // ─── ROL SEÇİM EKRANI ──────────────────────────────────────────────────────
  if (loggedIn && roleScreen && !role) {
    const PINS = { admin: '2580', staff: '1525' };
    const handleRolePin = () => {
      if (rolePin === PINS[rolePinTarget]) {
        setRole(rolePinTarget);
        setRoleScreen(false);
        setRolePin('');
        setRolePinTarget(null);
        setRolePinError(false);
      } else {
        setRolePinError(true);
        setRolePin('');
      }
    };

    // Pin isteniyor
    if (rolePinTarget) {
      const numpadPress = (digit) => {
        if (rolePin.length >= 4) return;
        const next = rolePin + digit;
        setRolePin(next);
        setRolePinError(false);
        if (next.length === 4) {
          setTimeout(() => {
            if (next === PINS[rolePinTarget]) {
              setRole(rolePinTarget);
              setRoleScreen(false);
              setRolePin('');
              setRolePinTarget(null);
              setRolePinError(false);
            } else {
              setRolePinError(true);
              setRolePin('');
            }
          }, 120);
        }
      };
      const numpadDel = () => { setRolePin(p => p.slice(0,-1)); setRolePinError(false); };
      const NUMPAD = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];
      return (
        <div style={S.page}>
          <div style={{display:'flex',justifyContent:'center',padding:'0 20px',marginTop:'22vh'}}>
            <div style={{...S.loginCard, maxWidth:320, textAlign:'center', width:'100%'}}>
              <div style={{fontSize:36, marginBottom:12}}>
                {rolePinTarget === 'admin' ? '🔐' : '👤'}
              </div>
              <div style={{fontSize:15, fontWeight:700, color:'#fff', marginBottom:4}}>
                {rolePinTarget === 'admin' ? 'Yönetici Girişi' : 'Çalışan Girişi'}
              </div>
              <div style={{fontSize:12, color:'#475569', marginBottom:20}}>Şifrenizi girin</div>
              {rolePinError && (
                <div style={{...S.errBox, marginBottom:14}}>❌ Yanlış şifre, tekrar deneyin</div>
              )}
              <div style={{display:'flex', justifyContent:'center', gap:14, marginBottom:28}}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{
                    width:16, height:16, borderRadius:'50%',
                    background: rolePin.length > i
                      ? (rolePinTarget==='admin' ? '#b47cff' : '#0ea5e9')
                      : '#1a2035',
                    border: '2px solid ' + (rolePin.length > i
                      ? (rolePinTarget==='admin' ? '#b47cff' : '#0ea5e9')
                      : '#374151'),
                    transition:'background 0.15s'
                  }}/>
                ))}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16}}>
                {NUMPAD.flat().map((k, i) => (
                  k === '' ? <div key={i}/> :
                  k === '⌫' ? (
                    <button key={i}
                      onClick={numpadDel}
                      style={{padding:'16px 0', background:'#111827', color:'#94a3b8',
                        border:'1px solid #1a2035', borderRadius:12, fontSize:20,
                        cursor:'pointer', fontWeight:600}}>⌫</button>
                  ) : (
                    <button key={i}
                      onClick={() => numpadPress(k)}
                      style={{padding:'16px 0', background:'#0d1120', color:'#e2e8f0',
                        border:'1px solid #1a2035', borderRadius:12, fontSize:22,
                        cursor:'pointer', fontWeight:700, transition:'background 0.1s'}}>
                      {k}
                    </button>
                  )
                ))}
              </div>
              <button
                style={{...S.loginBtn,
                  background: rolePin.length >= 4
                    ? (rolePinTarget==='admin'
                        ? 'linear-gradient(135deg,#b47cff,#7c3aff)'
                        : 'linear-gradient(135deg,#0ea5e9,#0284c7)')
                    : '#1a2035',
                  color: rolePin.length >= 4 ? '#fff' : '#374151',
                  cursor: rolePin.length >= 4 ? 'pointer' : 'default',
                  marginBottom:8
                }}
                onClick={handleRolePin}
                disabled={rolePin.length < 4}
              >Giriş →</button>
              <button
                style={{...S.smallBtn, width:'100%', textAlign:'center'}}
                onClick={() => { setRolePinTarget(null); setRolePin(''); setRolePinError(false); }}
              >← Geri</button>
            </div>
          </div>
        </div>
      );
    }

    // Rol seçim butonları
    return (
      <div style={S.page}>
        <div style={{display:'flex',justifyContent:'center',padding:'0 20px',marginTop:'22vh'}}>
          <div style={{...S.loginCard, maxWidth:400, textAlign:'center', width:'100%'}}>
            <div style={{fontSize:30, marginBottom:8}}>🎟</div>
            <div style={{fontSize:16, fontWeight:800, letterSpacing:2, color:'#fff', marginBottom:4}}>BİLET PANELİ</div>
            <div style={{fontSize:12, color:'#475569', marginBottom:32}}>Devam etmek için rolünüzü seçin</div>
            <div style={{display:'flex', flexDirection:'column', gap:12}}>
              <button
                style={{background:'linear-gradient(135deg,#b47cff,#7c3aff)', border:'none', borderRadius:14,
                  padding:'20px', cursor:'pointer', color:'#fff', textAlign:'left', display:'flex',
                  alignItems:'center', gap:14}}
                onClick={() => setRolePinTarget('admin')}
              >
                <span style={{fontSize:32}}>🔐</span>
                <div>
                  <div style={{fontSize:15, fontWeight:700, marginBottom:2}}>Yönetici</div>
                  <div style={{fontSize:12, opacity:0.7}}>Satışlar + Stok yönetimi</div>
                </div>
              </button>
              <button
                style={{background:'linear-gradient(135deg,#0ea5e9,#0284c7)', border:'none', borderRadius:14,
                  padding:'20px', cursor:'pointer', color:'#fff', textAlign:'left', display:'flex',
                  alignItems:'center', gap:14}}
                onClick={() => setRolePinTarget('staff')}
              >
                <span style={{fontSize:32}}>👤</span>
                <div>
                  <div style={{fontSize:15, fontWeight:700, marginBottom:2}}>Çalışan</div>
                  <div style={{fontSize:12, opacity:0.7}}>Yalnızca satışları görüntüle</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── GİRİŞ ─────────────────────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <div style={{...S.page, overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'center',padding:'0 20px',paddingTop:'27vh',paddingBottom:40}}>
          <div style={{...S.loginCard, width:'100%'}}>
            <div style={S.brand}><span style={S.brandIcon}>🎟</span><span style={S.brandName}>BİLET PANELİ</span></div>
            <p style={S.brandSub}>Çoklu platform satış yönetimi</p>
            {loginError && <div style={S.errBox}>{loginError}</div>}
            <FieldGroup label="BUBILET" color="#b47cff">
              <Input placeholder="E-posta" value={form.bubiletUser} onChange={v=>setForm(p=>({...p,bubiletUser:v}))} />
              <Input type="password" placeholder="Şifre" value={form.bubiletPass} onChange={v=>setForm(p=>({...p,bubiletPass:v}))} />
            </FieldGroup>
            <FieldGroup label="BİLETİNİ AL" color="#ff9f4a">
              <p style={S.hint}>partner.biletinial.com → F12 → Network → Authorization → Bearer sonrasını kopyala</p>
              <textarea style={S.textarea} placeholder="eyJhbGci..." value={form.biletinialToken}
                onChange={e=>setForm(p=>({...p,biletinialToken:e.target.value}))} />
            </FieldGroup>
            <FieldGroup label="İDEASOFT" color="#4fc9ff">
              <p style={S.hint}>İlk girişte tarayıcı açılır, mail kodunu gir. Sonraki girişler otomatik.</p>
              <Input placeholder="Kullanıcı adı" value={form.ideasoftUser} onChange={v=>setForm(p=>({...p,ideasoftUser:v}))} />
              <Input type="password" placeholder="Şifre" value={form.ideasoftPass} onChange={v=>setForm(p=>({...p,ideasoftPass:v}))} />
            </FieldGroup>
            <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,cursor:'pointer'}}>
              <input type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)}
                style={{accentColor:'#b47cff',width:16,height:16}} />
              <span style={{fontSize:13,color:'#64748b'}}>Beni hatırla (bir dahaki seferde otomatik giriş)</span>
            </label>
            <button style={S.loginBtn} onClick={handleLogin} disabled={loginLoading}>
              {loginLoading ? '⏳ Giriş yapılıyor… (1-3 dk)' : 'Giriş Yap →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── ANA EKRAN ─────────────────────────────────────────────────────────────
  const seances = buildSeanceMap(salesData);

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.headerLeft}><span style={S.brandIcon}>🎟</span><span style={S.headerTitle}>BİLET PANELİ</span></div>
        <div style={S.headerRight}>
          {lastUpdated && <span style={S.ts}>{lastUpdated}</span>}
          {role && (
            <span style={{fontSize:11, color: role==='admin'?'#b47cff':'#0ea5e9',
              background: role==='admin'?'#1a0a2e':'#0a1a2e',
              border:'1px solid '+(role==='admin'?'#b47cff44':'#0ea5e944'),
              borderRadius:6, padding:'3px 10px', fontWeight:700}}>
              {role === 'admin' ? '🔐 Yönetici' : '👤 Çalışan'}
            </span>
          )}
          <button style={S.smallBtn} onClick={()=>{setLoggedIn(false);setMode(null);setSalesData(null);setRole(null);setRoleScreen(false);}}>Çıkış</button>
        </div>
      </div>

      {/* Ana Butonlar */}
      {role === 'staff' ? (
        /* Çalışan: tek geniş yatay buton */
        <div style={{padding:'18px',maxWidth:720,margin:'0 auto'}}>
          <button
            style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:14,
              padding:'22px 24px',borderRadius:16,border:'none',cursor:'pointer',
              background: mode==='sales'
                ? 'linear-gradient(135deg,#7c3aff,#b47cff)'
                : 'linear-gradient(135deg,#b47cff,#7c3aff)',
              boxShadow: mode==='sales' ? '0 0 24px #b47cff44' : 'none',
              transition:'all 0.2s'}}
            onClick={()=>{ setMode('sales'); fetchSales(); }}
          >
            <span style={{fontSize:32}}>📊</span>
            <div style={{textAlign:'left'}}>
              <div style={{fontSize:16,fontWeight:800,color:'#fff',marginBottom:2}}>
                {salesLoading ? '⟳ Yükleniyor…' : 'Satışları Getir'}
              </div>
              <div style={{fontSize:12,color:'#e2e8f0',opacity:0.75}}>3 platformdaki seans satışlarını listele</div>
            </div>
          </button>
        </div>
      ) : (
        /* Yönetici: iki kart yan yana + Seans Yazdır bar */
        <>
          <div style={S.mainActions}>
            <ActionCard icon="📊" title="Satışları Getir" desc="3 platformdaki seans satışlarını listele"
              color="#b47cff" active={mode==='sales'} loading={salesLoading}
              onClick={()=>{ setMode('sales'); fetchSales(); }} />
            <ActionCard icon="📦" title="Stok Güncelle" desc="İdeasoft ürün stoklarını düzenle"
              color="#4fc9ff" active={mode==='stock'}
              onClick={()=>setMode(mode==='stock'?null:'stock')} />
          </div>
          {/* Seans Yazdır — yatay geniş bar */}
          <div style={{padding:'0 18px 6px', maxWidth:720, margin:'0 auto'}}>
            <button
              onClick={handleSeansYazOpen}
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:14,
                padding:'15px 22px', borderRadius:14, border:'1px solid #1a2035',
                cursor:'pointer', textAlign:'left',
                background:'#0d1120',
                boxShadow:'none',
                transition:'all 0.2s'
              }}
              onMouseOver={e=>{e.currentTarget.style.borderColor='#ff9f4a';e.currentTarget.style.boxShadow='0 0 18px #ff9f4a22';e.currentTarget.style.background='#0f1525';}}
              onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.boxShadow='none';e.currentTarget.style.background='#0d1120';}}>
              <span style={{fontSize:26}}>📅</span>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start'}}>
                <span style={{fontSize:14, fontWeight:700, color:'#94a3b8', marginBottom:4}}>Seans Yazdır</span>
                <span style={{fontSize:11, color:'#374151', lineHeight:1.5}}>İdeasoft'a yeni seans dönemleri ekle</span>
              </div>
              <span style={{marginLeft:'auto', fontSize:18, color:'#374151'}}>›</span>
            </button>
          </div>
        </>
      )}

      {/* ── SATIŞ PANELİ ── */}
      {mode==='sales' && (
        <div style={S.panel}>
          <div style={S.panelHeader}>
            <span style={S.panelTitle}>📊 Seans Bazlı Satışlar</span>
            <button style={S.refreshBtn} onClick={fetchSales} disabled={salesLoading}>
              {salesLoading ? '⟳ Yükleniyor…' : '⟳ Yenile'}
            </button>
          </div>

          {salesData && (() => {
            const bubiletOk  = (salesData.bubilet  || []).length > 0;
            const bialOk     = (salesData.biletinial|| []).length > 0;
            const ideasoftOk = (salesData.ideasoft  || []).length > 0;
            return (
              <div style={{display:'flex',gap:6,marginBottom:14}}>
                {[['Bubilet',bubiletOk],['Biletini Al',bialOk],['İdeasoft',ideasoftOk]].map(([label,ok])=>(
                  <div key={label} style={{display:'flex',alignItems:'center',gap:4,flex:1,
                    background:ok?'#0d2a1a':'#2a0d0d',
                    border:'1px solid '+(ok?'#22c55e44':'#ef444444'),
                    borderRadius:8,padding:'5px 8px',minWidth:0}}>
                    <span style={{width:8,height:8,borderRadius:'50%',display:'inline-block',flexShrink:0,
                      background:ok?'#22c55e':'#ef4444',
                      boxShadow:'0 0 6px '+(ok?'#22c55e':'#ef4444')}}/>
                    <span style={{fontSize:12,color:ok?'#86efac':'#fca5a5',fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{label}</span>
                    <span style={{fontSize:10,color:'#475569',whiteSpace:'nowrap'}}>{ok?'bağlı':'yok'}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          {salesError && <div style={S.errBox}>{salesError}</div>}
          {salesLoading && !salesData && <div style={S.loadMsg}>⟳ Veriler çekiliyor…</div>}

          {seances.map(s => {
            const key   = `${s.dateKey}|${s.timeSlot}`;
            const open  = expandedSeance === key;
            const cats  = Object.entries(s.categories);
            const total = cats.reduce((a,[,v])=>a+v.bubilet+v.biletinial+v.ideasoft, 0);

            return (
              <div key={key} style={{...S.seanceCard,...(total>0?{borderColor:'#1e293b'}:{})}}>
                <div style={S.seanceHeader} onClick={()=>setExpandedSeance(open?null:key)}>
                  <div style={S.seanceLeft}>
                    <span style={S.seanceDate}>{s.dateKey}</span>
                    <span style={S.seanceTime}>{s.timeSlot}</span>
                  </div>
                  <div style={S.seanceRight}>
                    <div style={S.seanceSummary}>
                      {cats.filter(([,v])=>v.bubilet+v.biletinial+v.ideasoft>0).map(([cat,v])=>(
                        <span key={cat} style={S.catPill}>
                          {getCatIcon(cat)} {cat}: <b style={{color:'#fff'}}>{v.bubilet+v.biletinial+v.ideasoft}</b>
                        </span>
                      ))}
                    </div>
                    <span style={{...S.totalPill,...(total>0?{color:'#b47cff',background:'#1a0f2e',border:'1px solid #b47cff44'}:{})}}>
                      {total} bilet
                    </span>
                    <span style={{...S.chevron,...(open?{transform:'rotate(90deg)',color:'#94a3b8'}:{})}}>›</span>
                  </div>
                </div>

                {open && (
                  <div style={S.detailWrap}>
                    {[...cats].sort((a,b)=>(b[1].bubilet+b[1].biletinial+b[1].ideasoft)-(a[1].bubilet+a[1].biletinial+a[1].ideasoft)).map(([cat,v]) => {
                      const t = v.bubilet+v.biletinial+v.ideasoft;
                      const isAllDay = s._allDay && s._allDay[cat];
                      return (
                        <div key={cat} style={{...S.detailRow,...(t>0?{background:'#1e2d45',border:'1px solid #2d4060'}:{})}}>
                          <span style={S.detailCat}>
                            {getCatIcon(cat)} {cat}
                            {isAllDay && <span style={{fontSize:10,color:'#ff9f4a',marginLeft:6,fontWeight:600}}>(tüm gün)</span>}
                          </span>
                          <div style={S.platforms}>
                            <Chip label="Bubilet"  value={v.bubilet}    color="#b47cff" />
                            <Chip label="Bit.Al"   value={v.biletinial} color="#ff9f4a" />
                            <Chip label="SS.com"   value={v.ideasoft}   color="#4fc9ff" />
                            <span style={{fontSize:18,fontWeight:700,color:t>0?'#fff':'#1e293b',minWidth:28,textAlign:'right'}}>
                              {t}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {!salesLoading && seances.length===0 && salesData && (
            <div style={S.empty}>Veri bulunamadı.</div>
          )}
        </div>
      )}

      {/* ── STOK PANELİ ── */}
      {mode==='stock' && (
        <div style={S.panel}>
          <div style={S.panelHeader}>
            <span style={S.panelTitle}>📦 Stok Yönetimi</span>
          </div>
          <div style={S.catGrid}>
            {Object.keys(CAT_ICON).map(cat=>(
              <button key={cat} style={{...S.catBtn,...(selectedCat===cat?S.catBtnActive:{})}}
                onClick={()=>{ setSelectedCat(selectedCat===cat?null:cat); if(!salesData && selectedCat!==cat) fetchSales(); }}>
                {getCatIcon(cat)} {cat}
              </button>
            ))}
          </div>

          {selectedCat && (
            <div style={S.stockPanel}>
              <div style={S.stockPanelHeader}>
                <span style={S.stockCatTitle}>{getCatIcon(selectedCat)} {selectedCat}</span>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  {salesData && (() => {
                    const pastCount = (salesData?.ideasoft||[]).filter(s=>s.category===selectedCat&&s.seanceId&&isSeancePast(s)).length;
                    if (pastCount === 0) return null;
                    const confirming = bulkDeleteConfirm[selectedCat];
                    return (
                      <button
                        onClick={()=>handleBulkDeletePast(selectedCat)}
                        disabled={bulkDeleting}
                        style={{
                          padding:'5px 10px',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer',border:'none',
                          background: confirming ? '#3f0f0f' : '#1a1a1a',
                          color: confirming ? '#ff4444' : '#64748b',
                          border: confirming ? '1px solid #7f1d1d' : '1px solid #1e293b',
                          opacity: bulkDeleting ? 0.5 : 1,
                          transition:'all 0.2s',whiteSpace:'nowrap'
                        }}>
                        {bulkDeleting ? '⟳ Siliniyor…' : confirming ? `⚠️ Emin misin? (${pastCount})` : `🗑 Geçmiş Seansları Sil (${pastCount})`}
                      </button>
                    );
                  })()}
                  {!salesData && (
                    <button style={S.smallBtn} onClick={fetchSales} disabled={salesLoading}>
                      {salesLoading?'Yükleniyor…':'Veriyi Yükle'}
                    </button>
                  )}
                </div>
              </div>
              {!salesData && !salesLoading && <div style={S.empty}>Stok verisi için "Veriyi Yükle" butonuna basın.</div>}
              {salesLoading && <div style={S.loadMsg}>⟳ Yükleniyor…</div>}
              {salesData && (
                <div>
                  {getIdeasoftForCat(selectedCat).length===0
                    ? <div style={S.empty}>Bu kategoride seans bulunamadı.</div>
                    : getIdeasoftForCat(selectedCat).map(s=>{
                        const editing  = stockEdits[s.seanceId]!==undefined && stockEdits[s.seanceId]!=='';
                        const updating = stockUpdating[s.seanceId];
                        const msg      = stockMsg[s.seanceId];
                        return (
                          <div key={s.seanceId||s.productId} style={S.stockRow}>
                            <div style={S.stockRowLeft}>
                              <span style={S.stockRowName}>
                                {s.fullName.replace('Farabi Sokak: Sosyal Sanathane - ','').replace('Tunalı: Ara Sokak Pub - ','')}
                              </span>
                              <div style={{...S.badgeRow, alignItems:'center'}}>
                                <SBadge label="Mevcut"    value={s.stockAmount??'—'} color="#4fc9ff"/>
                                {s.soldCount!=null   && <SBadge label="Satılan"    value={s.soldCount}    color="#ff9f4a"/>}
                                {s.baselineStock!=null && <SBadge label="Başlangıç" value={s.baselineStock} color="#555"/>}
                                {s.seanceId && (
                                  <div
                                    onClick={()=>!toggling[s.seanceId]&&handleToggleSeance(s.seanceId, s.status===1)}
                                    style={{
                                      marginLeft:'auto',
                                      display:'flex',alignItems:'center',gap:6,
                                      cursor:toggling[s.seanceId]?'wait':'pointer',
                                      opacity:toggling[s.seanceId]?0.6:1,
                                      flexShrink:0
                                    }}>
                                    <span style={{
                                      fontSize:10,fontWeight:700,letterSpacing:1,
                                      color:s.status===1?'#22c55e':'#64748b',
                                      textTransform:'uppercase'
                                    }}>
                                      {s.status===1?'SEANS AÇIK':'SEANS KAPALI'}
                                    </span>
                                    <div style={{
                                      width:44,height:24,borderRadius:12,
                                      background:s.status===1?'#22c55e':'#3a3a3a',
                                      position:'relative',
                                      transition:'background 0.25s',
                                      flexShrink:0
                                    }}>
                                      <div style={{
                                        position:'absolute',
                                        top:3,
                                        left:s.status===1?23:3,
                                        width:18,height:18,borderRadius:'50%',
                                        background:'#fff',
                                        boxShadow:'0 1px 4px rgba(0,0,0,0.3)',
                                        transition:'left 0.25s'
                                      }}/>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            {s.seanceId && (
                              <div style={S.stockUpdateBlock}>
                                <input style={S.stockInputFull} type="number" min="0" placeholder="Yeni stok"
                                  value={stockEdits[s.seanceId]??''}
                                  onChange={e=>setStockEdits(p=>({...p,[s.seanceId]:e.target.value}))}/>
                                <button style={{...S.updateBtnFull,...(editing&&!updating?S.updateBtnOn:{})}}
                                  disabled={!editing||updating}
                                  onClick={()=>handleStockUpdate(s.seanceId)}>
                                  {updating?'⟳ Güncelleniyor…':'Güncelle'}
                                </button>
                                {msg && <span style={{fontSize:12,fontWeight:600,color:msg==='✓'?'#4ade80':'#f87171',paddingTop:2}}>{msg}</span>}
                                <button
                                  disabled={deleting[s.seanceId]}
                                  onClick={()=>handleDeleteOption(s.seanceId)}
                                  style={{width:'100%',padding:'9px 12px',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',border:'none',
                                    background: deleteConfirm[s.seanceId] ? '#3f0f0f' : '#1a1a1a',
                                    color: deleteConfirm[s.seanceId] ? '#ff4444' : '#64748b',
                                    border: deleteConfirm[s.seanceId] ? '1px solid #7f1d1d' : '1px solid #1e293b',
                                    opacity: deleting[s.seanceId] ? 0.5 : 1,
                                    transition:'all 0.2s'}}>
                                  {deleting[s.seanceId] ? '⟳ Siliniyor…' : deleteConfirm[s.seanceId] ? '⚠️ Emin misin? Tekrar bas!' : '🗑 Seansı Sil'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                  }
                  <p style={{fontSize:11,color:'#1e293b',padding:'10px 18px 14px',margin:0}}>
                    ⚠ Buradan yapılan güncellemeler satış olarak sayılmaz.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── İDEASOFT TOPLAM SATIŞ RAPORU ── */}
          {salesData && salesData.ideasoft && (() => {
            // Gün bazlı harita: aktif seanslardan hesaplanır (canlı veri)
            const dayMap = {}; // { "5 Nisan Pazar": { "Heykel": 2, ... } }
            const TR_MONTHS_SHORT = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

            salesData.ideasoft.forEach(s => {
              if (!s.soldCount || s.soldCount === 0) return;
              const m = s.fullName.match(/- (\d+) (\w+) (\w+)/u);
              if (!m) return;
              const dayKey   = m[1] + ' ' + m[2] + ' ' + m[3];
              const cat      = s.category;
              if (!dayMap[dayKey]) dayMap[dayKey] = {};
              dayMap[dayKey][cat] = (dayMap[dayKey][cat] || 0) + s.soldCount;
            });

            // Aylık harita: server'dan gelen kalıcı arşiv (seanslar silinse bile korunur)
            const monthMap = salesData.monthlySales || {};

            const days = Object.keys(dayMap).sort((a, b) => {
              const [dA, mA] = a.split(' ');
              const [dB, mB] = b.split(' ');
              const miA = TR_MONTHS_SHORT.indexOf(mA);
              const miB = TR_MONTHS_SHORT.indexOf(mB);
              return miA !== miB ? miA - miB : parseInt(dA) - parseInt(dB);
            });

            const hasSales = days.length > 0 || Object.keys(monthMap).length > 0;

            return (
              <div style={{marginTop:16}}>
                <button
                  style={{...S.ideasoftReportBtn}}
                  onClick={()=>setShowIdeasoftReport(p=>!p)}>
                  <span>📈 İdeasoft Toplam Satış Raporu</span>
                  <span style={{...S.chevron,...(showIdeasoftReport?{transform:'rotate(90deg)',color:'#94a3b8'}:{}),...{fontSize:16}}}>›</span>
                </button>

                {showIdeasoftReport && (
                  <div style={S.reportPanel}>
                    {!hasSales && (
                      <div style={S.empty}>Henüz İdeasoft satışı yok.</div>
                    )}

                    {/* Gün gün */}
                    {days.map(day => {
                      const cats = Object.entries(dayMap[day]).sort((a,b)=>b[1]-a[1]);
                      return (
                        <div key={day} style={S.reportDayBlock}>
                          <div style={S.reportDayTitle}>{day}</div>
                          {cats.map(([cat, count]) => (
                            <div key={cat} style={S.reportRow}>
                              <span style={S.reportCat}>{getCatIcon(cat)} {cat}</span>
                              <span style={S.reportCount}>{count}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}

                    {/* Aylık toplamlar */}
                    {Object.keys(monthMap).map(month => {
                      const cats = Object.entries(monthMap[month]).sort((a,b)=>b[1]-a[1]);
                      const total = cats.reduce((s,[,v])=>s+v,0);
                      return (
                        <div key={month} style={S.reportMonthBlock}>
                          <div style={S.reportMonthTitle}>{month.toUpperCase()} AYI TOPLAM</div>
                          {cats.map(([cat, count]) => (
                            <div key={cat} style={S.reportMonthRow}>
                              <span style={S.reportCat}>{getCatIcon(cat)} {cat}</span>
                              <span style={{...S.reportCount,color:'#b47cff',fontSize:16,fontWeight:800}}>{count}</span>
                            </div>
                          ))}
                          <div style={{...S.reportMonthRow,borderTop:'1px solid #1e293b',marginTop:4,paddingTop:8}}>
                            <span style={{...S.reportCat,color:'#fff',fontWeight:700}}>Toplam</span>
                            <span style={{...S.reportCount,color:'#fff',fontSize:17,fontWeight:800}}>{total}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}


        </div>
      )}
    </div>
  );
}

// ─── Küçük bileşenler ─────────────────────────────────────────────────────────
function FieldGroup({label,color,children}){
  return <div style={{marginBottom:20}}><div style={{fontSize:10,fontWeight:700,letterSpacing:2,color,marginBottom:10}}>{label}</div>{children}</div>;
}
function Input({type='text',placeholder,value,onChange}){
  return <input type={type} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)} style={S.input}/>;
}
function ActionCard({icon,title,desc,color,active,onClick,loading}){
  return (
    <button style={{...S.actionCard,...(active?{borderColor:color,boxShadow:`0 0 18px ${color}22`,background:'#0f1525'}:{})}} onClick={onClick}>
      <span style={{fontSize:26,marginBottom:6}}>{icon}</span>
      <span style={{fontSize:14,fontWeight:700,color:active?color:'#94a3b8',marginBottom:4}}>{loading?'⟳ Yükleniyor…':title}</span>
      <span style={{fontSize:11,color:'#374151',lineHeight:1.5}}>{desc}</span>
      {active && <div style={{position:'absolute',bottom:0,left:0,right:0,height:3,background:color,borderRadius:'0 0 4px 4px'}}/>}
    </button>
  );
}
function Chip({label,value,color}){
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',minWidth:48}}>
      <span style={{fontSize:9,color:'#64748b',marginBottom:1,textTransform:'uppercase',letterSpacing:1}}>{label}</span>
      <span style={{fontSize:15,fontWeight:700,color:value>0?color:'#334155'}}>{value}</span>
    </div>
  );
}
function SBadge({label,value,color}){
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1}}>
      <span style={{fontSize:9,color:'#374151',textTransform:'uppercase',letterSpacing:1}}>{label}</span>
      <span style={{fontSize:17,fontWeight:700,color}}>{value}</span>
    </div>
  );
}

const CAT_ICON = {
  'Heykel':'🗿','Resim':'🧑‍🎨','3D Figür':'🪆','Maske':'🎭','Bez Çanta':'👜',
  'Seramik':'☕️','Plak Boyama':'💿','Quiz Night':'🏆','Cupcake Mum':'🧁',
  'Punch':'🧶','Mekanda Seç':'📍'
};

// Kategori adı "Quiz Night - Konsept" formatında olabilir, önce tam eşleşme, sonra prefix
function getCatIcon(cat) {
  if (CAT_ICON[cat]) return CAT_ICON[cat];
  if (cat && cat.startsWith('Quiz Night')) return '🎯';
  return '📁';
}

const S = {
  page:       {minHeight:'100vh',background:'#07090f',color:'#e2e8f0',fontFamily:'"DM Sans",system-ui,sans-serif',paddingBottom:60},
  loginWrap:  {display:'flex',justifyContent:'center',alignItems:'flex-start',minHeight:'100vh',padding:20,paddingTop:'calc(env(safe-area-inset-top, 0px) + 60px)'},
  loginCard:  {width:'100%',maxWidth:420,background:'#0d1120',border:'1px solid #1a2035',borderRadius:20,padding:'36px 32px'},
  brand:      {display:'flex',alignItems:'center',gap:10,marginBottom:4},
  brandIcon:  {fontSize:24},
  brandName:  {fontSize:16,fontWeight:800,letterSpacing:3,color:'#fff'},
  brandSub:   {fontSize:11,color:'#374151',marginBottom:28,letterSpacing:1},
  hint:       {fontSize:11,color:'#374151',marginBottom:8,lineHeight:1.6},
  input:      {width:'100%',padding:'10px 14px',background:'#07090f',color:'#e2e8f0',border:'1px solid #1a2035',borderRadius:10,fontSize:14,marginBottom:10,boxSizing:'border-box',outline:'none'},
  textarea:   {width:'100%',height:68,padding:'10px 14px',background:'#07090f',color:'#e2e8f0',border:'1px solid #1a2035',borderRadius:10,fontSize:12,marginBottom:10,boxSizing:'border-box',resize:'vertical'},
  loginBtn:   {width:'100%',padding:'13px',background:'linear-gradient(135deg,#b47cff,#7c3aff)',color:'#fff',border:'none',borderRadius:12,fontSize:15,fontWeight:700,cursor:'pointer',marginTop:8},
  errBox:     {background:'#1f0f0f',border:'1px solid #7f1d1d',borderRadius:10,padding:'10px 14px',color:'#fca5a5',fontSize:13,marginBottom:16},
  header:     {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px',paddingTop:'calc(env(safe-area-inset-top, 0px) + 14px)',borderBottom:'1px solid #0f1525',background:'#090d17',position:'sticky',top:0,zIndex:10},
  headerLeft: {display:'flex',alignItems:'center',gap:8},
  headerTitle:{fontSize:13,fontWeight:800,letterSpacing:3,color:'#fff'},
  headerRight:{display:'flex',alignItems:'center',gap:10},
  ts:         {fontSize:11,color:'#374151'},
  smallBtn:   {background:'#111827',color:'#94a3b8',border:'1px solid #1a2035',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:12,fontWeight:600},
  mainActions:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:'18px',paddingTop:24,maxWidth:720,margin:'0 auto'},
  actionCard: {background:'#0d1120',border:'1px solid #1a2035',borderRadius:14,padding:'20px 14px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',transition:'all 0.2s',position:'relative',overflow:'hidden'},
  panel:      {maxWidth:720,margin:'0 auto',padding:'0 18px'},
  panelHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12},
  panelTitle: {fontSize:12,fontWeight:700,color:'#475569',letterSpacing:1,textTransform:'uppercase'},
  refreshBtn: {background:'#111827',color:'#94a3b8',border:'1px solid #1a2035',borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:12,fontWeight:600},
  seanceCard: {background:'#0d1120',border:'1px solid #0f1525',borderRadius:12,marginBottom:6,overflow:'hidden',transition:'border-color 0.2s'},
  seanceHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 14px',cursor:'pointer',gap:10,flexWrap:'wrap'},
  seanceLeft: {display:'flex',alignItems:'baseline',gap:10,flexShrink:0},
  seanceDate: {fontSize:12,fontWeight:600,color:'#64748b'},
  seanceTime: {fontSize:14,fontWeight:700,color:'#e2e8f0'},
  seanceRight:{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',flex:1,justifyContent:'flex-end'},
  seanceSummary:{display:'flex',flexWrap:'wrap',gap:5},
  catPill:    {fontSize:11,color:'#64748b',background:'#0a0e1a',borderRadius:6,padding:'2px 8px',border:'1px solid #1e293b'},
  totalPill:  {fontSize:13,fontWeight:700,color:'#374151',background:'#0a0e1a',border:'1px solid #1e293b',borderRadius:8,padding:'3px 10px',flexShrink:0},
  chevron:    {fontSize:18,color:'#374151',transition:'transform 0.2s',display:'inline-block',flexShrink:0},
  detailWrap: {borderTop:'1px solid #0f1525',padding:'10px 14px',background:'#131929',display:'flex',flexDirection:'column',gap:6},
  detailRow:  {display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',borderRadius:8,background:'#1a2236',border:'1px solid #243050',flexWrap:'wrap',gap:8},
  detailCat:  {fontSize:13,color:'#94a3b8',minWidth:120,fontWeight:600},
  platforms:  {display:'flex',alignItems:'center',gap:14},
  loadMsg:    {color:'#374151',fontSize:13,padding:'24px 0',textAlign:'center'},
  empty:      {color:'#374151',fontSize:13,padding:'24px 0',textAlign:'center'},
  catGrid:    {display:'flex',flexWrap:'wrap',gap:7,marginBottom:16},
  catBtn:     {background:'#0d1120',color:'#475569',border:'1px solid #1a2035',borderRadius:10,padding:'8px 14px',cursor:'pointer',fontSize:13,fontWeight:600,transition:'all 0.15s'},
  catBtnActive:{background:'#0a1a28',color:'#4fc9ff',border:'1px solid #4fc9ff44'},
  stockPanel: {background:'#0d1120',border:'1px solid #1a2035',borderRadius:14,overflow:'hidden'},
  stockPanelHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid #0f1525'},
  stockCatTitle:{fontSize:14,fontWeight:700,color:'#fff'},
  stockRow:   {display:'flex',flexDirection:'column',gap:10,padding:'14px 16px',borderBottom:'1px solid #090d17'},
  stockRowLeft:{display:'flex',flexDirection:'column',gap:8},
  stockRowName:{display:'block',fontSize:12,color:'#64748b',lineHeight:1.4},
  badgeRow:   {display:'flex',gap:16},
  stockUpdateBlock:{display:'flex',flexDirection:'column',gap:6,marginTop:2},
  stockInputFull:{width:'100%',padding:'8px 12px',background:'#07090f',color:'#fff',border:'1px solid #1a2035',borderRadius:8,fontSize:14,outline:'none',boxSizing:'border-box'},
  updateBtnFull:{width:'100%',padding:'9px 12px',background:'#111827',color:'#1e293b',border:'1px solid #1a2035',borderRadius:8,fontSize:13,fontWeight:700,cursor:'default',transition:'all 0.15s'},
  updateBtnOn:{background:'linear-gradient(135deg,#0ea5e9,#0284c7)',color:'#fff',border:'none',cursor:'pointer'},
  // legacy
  stockRowRight:{display:'flex',alignItems:'center',gap:7},
  stockInput: {width:76,padding:'7px 8px',background:'#07090f',color:'#fff',border:'1px solid #1a2035',borderRadius:8,fontSize:14,outline:'none'},
  updateBtn:  {padding:'7px 12px',background:'#111827',color:'#1e293b',border:'1px solid #1a2035',borderRadius:8,fontSize:12,fontWeight:600,cursor:'default'},
  // İdeasoft rapor
  ideasoftReportBtn:{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 18px',background:'#0d1120',border:'1px solid #1a2035',borderRadius:12,cursor:'pointer',color:'#4fc9ff',fontSize:14,fontWeight:700,marginBottom:0},
  reportPanel:{background:'#0d1120',border:'1px solid #1a2035',borderRadius:12,overflow:'hidden',marginTop:6},
  reportDayBlock:{padding:'12px 16px',borderBottom:'1px solid #0f1525'},
  reportDayTitle:{fontSize:12,fontWeight:700,color:'#64748b',marginBottom:8,textTransform:'uppercase',letterSpacing:1},
  reportRow:  {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0'},
  reportMonthBlock:{padding:'14px 16px',background:'#090d17',borderTop:'2px solid #1e293b'},
  reportMonthTitle:{fontSize:11,fontWeight:800,color:'#b47cff',marginBottom:10,letterSpacing:2},
  reportMonthRow:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0'},
  reportCat:  {fontSize:13,color:'#94a3b8'},
  reportCount:{fontSize:15,fontWeight:700,color:'#ff9f4a'},
};
