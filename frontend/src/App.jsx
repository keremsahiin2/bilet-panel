import { useState, useEffect, useRef } from "react";

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

  // Biletini Al'da etkinlik saati gelince API 0 dondürebilir — onceki degeri koru
  const addBiletinial = (key, cat, count) => {
    ensureCat(key, cat);
    // Asla azaltma — mevcut deger daha buyukse koru (tamamlanan seans korumasi)
    if (count > map[key].categories[cat].biletinial) {
      map[key].categories[cat].biletinial = count;
    }
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

    // Tamamlanan seanslar (_isCompleted) için sadece TAM eşleşme kullan.
    // Fallback devreye girerse geçmiş saatlerin satışları yanlış slota yapışır
    // (örn. 12:00'deki tamamlanan seans → 18:30'daki Punch seansına yapışır).
    if (s._isCompleted && !matchKey) return;

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
    addBiletinial(key, cat, (s.SalesTicketTotalCount || 0));
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
    // Bubilet: etkinlik tamamlanca API 0 dondurebilir — onceki degeri koru
    const _bubiletCount = s.biletAdet || 0;
    ensureCat(key, cat);
    if (_bubiletCount > map[key].categories[cat].bubilet) {
      map[key].categories[cat].bubilet = _bubiletCount;
    }
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
  // Global body/html reset — kenar beyaz cizgileri kaldir
  if (typeof document !== 'undefined') {
    const resetEl = (el) => {
      if (!el) return;
      el.style.margin = '0';
      el.style.padding = '0';
      el.style.border = 'none';
      el.style.outline = 'none';
      el.style.overflowX = 'hidden';
      el.style.width = '100%';
      el.style.maxWidth = '100%';
      el.style.boxSizing = 'border-box';
    };
    // Viewport meta — klavye açılınca zoom olmasın
    let vp = document.querySelector('meta[name="viewport"]');
    if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
    vp.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    resetEl(document.documentElement);
    resetEl(document.body);
    document.body.style.background = '#07090f';
    // #root div'i de sifirla (Vite/CRA'da genellikle margin/padding kalir)
    const root = document.getElementById('root');
    if (root) resetEl(root);
  }
  const [loggedIn, setLoggedIn]             = useState(false);
  const [autoLoginLoading, setAutoLoginLoading] = useState(false); // artık kullanılmıyor
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

  // ─── MALZEME TAKİBİ ────────────────────────────────────────────────────────
  // ── Malzeme kategorileri — her item: { key, label, type }
  // type: 'counter' | 'text' | 'toggle2' ('yeterli'/'yetmez') | 'toggle3' ('yeterli'/'azaldı')
  const MALZEME_CATS = {
    '3D Figürler': [
      { key:'Spiderman',           label:'Spiderman',            type:'counter' },
      { key:'Spiderman Çocuk',     label:'Spiderman Çocuk',      type:'counter' },
      { key:'Winnie the Pooh',     label:'Winnie the Pooh',      type:'counter' },
      { key:'Stitch',              label:'Stitch',               type:'counter' },
      { key:'Yoda',                label:'Yoda',                 type:'counter' },
      { key:'Pikaçu',              label:'Pikaçu',               type:'counter' },
      { key:'Bart',                label:'Bart',                 type:'counter' },
      { key:'Mickey Mouse',        label:'Mickey Mouse',         type:'counter' },
      { key:'Ironman',             label:'Ironman',              type:'counter' },
      { key:'Groot',               label:'Groot',                type:'counter' },
      { key:'Superman',            label:'Superman',             type:'counter' },
      { key:'Batman Yeni',         label:'Batman Yeni',          type:'counter' },
      { key:'Batman',              label:'Batman',               type:'counter' },
      { key:'Mike',                label:'Mike',                 type:'counter' },
      { key:'Donald',              label:'Donald',               type:'counter' },
      { key:'Minnie',              label:'Minnie',               type:'counter' },
      { key:'Bugs Bunny',          label:'Bugs Bunny',           type:'counter' },
      { key:'Shrek',               label:'Shrek',                type:'counter' },
      { key:'Shrek Gözlük',        label:'Shrek Gözlük',         type:'counter' },
      { key:'Fiona',               label:'Fiona',                type:'counter' },
      { key:'Süngerbob',           label:'Süngerbob',            type:'counter' },
      { key:'Tom',                 label:'Tom',                  type:'counter' },
      { key:'Jerry',               label:'Jerry',                type:'counter' },
      { key:'Ninja Kaplumbağa',    label:'Ninja Kaplumbağa',     type:'counter' },
      { key:'Labubu',              label:'Labubu',               type:'counter' },
      { key:'Labubu Kalpli',       label:'Labubu Kalpli',        type:'counter' },
      { key:'Garfield',            label:'Garfield',             type:'counter' },
      { key:'Minion',              label:'Minion',               type:'counter' },
      { key:'Goku',                label:'Goku',                 type:'counter' },
      { key:'Chucky',              label:'Chucky',               type:'counter' },
      { key:'Garen',               label:'Garen',                type:'counter' },
      { key:'Eşşek',               label:'Eşşek',                type:'counter' },
      { key:'Dobby',               label:'Dobby',                type:'counter' },
      { key:'Dumbledore',          label:'Dumbledore',           type:'counter' },
      { key:'Hagrid',              label:'Hagrid',               type:'counter' },
      { key:'Harry Potter Bust',   label:'Harry Potter Bust',    type:'counter' },
      { key:'Harry Potter Kuşlu',  label:'Harry Potter Kuşlu',   type:'counter' },
      { key:'Hulk',                label:'Hulk',                 type:'counter' },
      { key:'Vecna',               label:'Vecna',                type:'counter' },
      { key:'Şirine',              label:'Şirine',               type:'counter' },
      { key:'Hello Kitty',         label:'Hello Kitty',          type:'counter' },
      { key:'Rick & Morty',        label:'Rick & Morty',         type:'counter' },
      { key:'Sullivan',            label:'Sullivan',             type:'counter' },
      { key:'Buzz',                label:'Buzz',                 type:'counter' },
    ],
    'Resim Malzemeleri': [
      { key:'Tuval',         label:'Tuval',         type:'counter' },
      { key:'Tuval Çantası', label:'Tuval Çantası', type:'counter' },
      { key:'Akrilik Boya',  label:'Akrilik Boya',  type:'text', placeholder:'Hangi renkler eksik?' },
    ],
    'Punch Malzemeleri': [
      { key:'Renkli İpler',       label:'Renkli İpler',       type:'text', placeholder:'Hangi renkler eksik?' },
      { key:'İp Geçirme Teli',    label:'İp Geçirme Teli',    type:'counter' },
    ],
    'Mum Malzemeleri': [
      { key:'Parafin',             label:'Parafin',             type:'toggle2' },
      { key:'Soya Wax',            label:'Soya Wax',            type:'toggle2' },
      { key:'Mum Kokuları',        label:'Mum Kokuları',        type:'text', placeholder:'Eksik kokular...' },
      { key:'Mum Renk Pigmentleri',label:'Mum Renk Pigmentleri',type:'text', placeholder:'Eksik renkler...' },
    ],
    'Diğer Malzemeler': [
      { key:'Seramik Kili',  label:'Seramik Kili',  type:'counter', unit:'paket' },
      { key:'Heykel Kili',   label:'Heykel Kili',   type:'counter', unit:'paket' },
      { key:'Kraft Çanta',   label:'Kraft Çanta',   type:'counter', unit:'koli'  },
      { key:'Bez Çanta',     label:'Bez Çanta',     type:'toggle3' },
      { key:'Maske',         label:'Maske',         type:'counter' },
    ],
  };
  const initMalzeme = () => {
    const s = {};
    Object.entries(MALZEME_CATS).forEach(([cat, items]) => {
      s[cat] = {};
      items.forEach(item => {
        if (item.type === 'counter') s[cat][item.key] = 0;
        else if (item.type === 'text') s[cat][item.key] = '';
        else if (item.type === 'toggle2') s[cat][item.key] = 'yeterli'; // 'yeterli' | 'yetmez'
        else if (item.type === 'toggle3') s[cat][item.key] = 'yeterli'; // 'yeterli' | 'azaldı'
      });
    });
    return s;
  };
  const [malzemeStock, setMalzemeStock] = useState(initMalzeme);
  const [malzemeCat, setMalzemeCat]     = useState(null);
  const [malzemeLoaded, setMalzemeLoaded] = useState(false);
  const [malzemeSaving, setMalzemeSaving] = useState(false);
  const WHATSAPP_NUMBER = '905050523801';

  // ─── QUIZ NIGHT ────────────────────────────────────────────────────────────
  // quizData: { eventType, groups:[{no,name}], scores:{groupNo: {q1:true/false,...}}, scorer, myGroups:[no,...] }
  const [quizData, setQuizData]           = useState(null);
  const [quizLoaded, setQuizLoaded]       = useState(false);
  const [quizRole, setQuizRole]           = useState(null);      // null | 'host' | 'scorer'
  const [quizStep, setQuizStep]           = useState('select'); // 'select'|'groups'|'scoring'|'results'
  const [quizEventType, setQuizEventType] = useState(null);    // 'genelkultur'|'diziyfilm'
  const [quizGroups, setQuizGroups]       = useState([]);      // [{no,name}]
  const [quizMyGroups, setQuizMyGroups]   = useState([]);      // bu puantörün grupları [no,...]
  const [quizCurrentQ, setQuizCurrentQ]  = useState(1);
  const [quizScores, setQuizScores]       = useState({});      // {groupNo: {1:true,2:false,...}}
  const quizScoresRef = useRef({});
  const [quizSaving, setQuizSaving]       = useState(false);
  const [quizDeleteConfirm, setQuizDeleteConfirm] = useState(false);
  const [quizAnswers, setQuizAnswers]           = useState({});  // {1:'Ankara', 2:'Van Gogh', ...}
  const [quizAnswerFile, setQuizAnswerFile]     = useState(null); // yüklenen dosya adı
  const [quizAnswerLoading, setQuizAnswerLoading] = useState(false);
  const [quizAnswerError, setQuizAnswerError]   = useState('');
  // Sunucu modu — soru dosyası
  const [quizQuestions, setQuizQuestions]       = useState({}); // {1:{question:'...',answer:'...',section:'...'}, ...}
  const [quizQFile, setQuizQFile]               = useState(null);
  const [quizQLoading, setQuizQLoading]         = useState(false);
  const [quizQError, setQuizQError]             = useState('');
  const [quizHostQ, setQuizHostQ]               = useState(1);  // sunucu ekranındaki aktif soru no
  // Results screen live data (must be top-level — no hooks inside if blocks)
  const [quizResultsLoading, setQuizResultsLoading] = useState(false);
  // Quiz Night özel giriş modu
  const [quizNightMode, setQuizNightMode]       = useState(false); // true = quiz night role screen
  const [quizNightPin, setQuizNightPin]         = useState('');
  const [quizNightPinError, setQuizNightPinError] = useState(false);
  // Kombine dosya (soru+cevap) yükleme
  const [quizCombinedLoading, setQuizCombinedLoading] = useState(false);
  const [quizCombinedError, setQuizCombinedError] = useState('');
  const [quizCombinedFile, setQuizCombinedFile] = useState(null);
  // Puantör ekranında soruyu göster
  const [quizShowQuestion, setQuizShowQuestion] = useState(false);
  // Sıralama seçeneği
  const [quizSortMode, setQuizSortMode]         = useState('score'); // 'score' | 'groupno'
  // Slot kilitleme state (gruplar ekranında)
  const [quizSlots, setQuizSlots]               = useState({}); // {slotKey: clientId}
  const [quizClientId]                          = useState(() => 'client_' + Math.random().toString(36).slice(2));
  const [quizGroupCount, setQuizGroupCount]     = useState(''); // kaç grup olacak (string input)
  const [quizGroupCountSet, setQuizGroupCountSet] = useState(false); // grup sayısı belirlendi mi
  // Polling interval ref
  const quizPollRef = useRef(null);
  const [quizLiveScores, setQuizLiveScores]     = useState({});
  const [quizLiveGroups, setQuizLiveGroups]     = useState([]);
  const [quizExpandedGroup, setQuizExpandedGroup] = useState(null); // detay paneli

  const QUIZ_EVENTS = {
    genelkultur: { label: 'Genel Kültür', totalQ: 50, pointPerQ: 10, icon: '🧠' },
    diziyfilm:   { label: 'Dizi & Film',  totalQ: 40, pointPerQ: null, icon: '🎬',
      // ilk 10→10pt, 11-20→20pt, 21-30→30pt, 31-40→40pt
      getPoints: (qNo) => {
        if (qNo <= 10) return 10;
        if (qNo <= 20) return 20;
        if (qNo <= 30) return 30;
        return 40;
      }
    }
  };

  const getQuizPoint = (eventType, qNo) => {
    const ev = QUIZ_EVENTS[eventType];
    if (!ev) return 0;
    if (ev.pointPerQ) return ev.pointPerQ;
    return ev.getPoints(qNo);
  };

  const calcGroupScore = (groupNo, eventType, scores) => {
    const ev = QUIZ_EVENTS[eventType];
    if (!ev) return 0;
    const gs = scores[groupNo] || {};
    let total = 0;
    for (let q = 1; q <= ev.totalQ; q++) {
      if (gs[q]) total += getQuizPoint(eventType, q);
    }
    return total;
  };

  // Sonuçlar ekranına geçince sunucudan güncel veriyi çek
  useEffect(() => {
    if (quizStep !== 'results') return;
    setQuizResultsLoading(true);
    fetch('/api/quiz')
      .then(r => r.json())
      .then(d => {
        if (d.quizData) {
          setQuizLiveScores(d.quizData.scores || {});
          setQuizLiveGroups(d.quizData.groups || []);
          setQuizScores(d.quizData.scores || {});
          setQuizGroups(d.quizData.groups || []);
        } else {
          setQuizLiveScores(quizScores);
          setQuizLiveGroups(quizGroups);
        }
      })
      .catch(() => {
        setQuizLiveScores(quizScores);
        setQuizLiveGroups(quizGroups);
      })
      .finally(() => setQuizResultsLoading(false));
  }, [quizStep]);

  // Quiz verilerini sunucudan yükle
  useEffect(() => {
    fetch('/api/quiz')
      .then(r => r.json())
      .then(d => {
        if (d.quizData) {
          setQuizData(d.quizData);
          // Mevcut oturuma devam et
          setQuizEventType(d.quizData.eventType);
          setQuizGroups(d.quizData.groups || []);
          setQuizScores(d.quizData.scores || {});
          quizScoresRef.current = d.quizData.scores || {};
          // Kaldığı sorudan devam et
          if (d.quizData.currentQ) setQuizCurrentQ(d.quizData.currentQ);
          // Grup sayısı ayarlandıysa
          if (d.quizData.groups && d.quizData.groups.length > 0) {
            setQuizGroupCountSet(true);
            setQuizGroupCount(String(d.quizData.groups.length));
          }
          // Cevap anahtarı sunucuda varsa yükle
          if (d.quizData.answers && Object.keys(d.quizData.answers).length > 0) {
            setQuizAnswers(d.quizData.answers);
            setQuizAnswerFile((d.quizData.answersFile || 'Sunucudan yüklendi') + ' (' + Object.keys(d.quizData.answers).length + ' cevap)');
          }
          // Soru dosyası sunucuda varsa yükle
          if (d.quizData.questions && Object.keys(d.quizData.questions).length > 0) {
            setQuizQuestions(d.quizData.questions);
            setQuizQFile((d.quizData.questionsFile || 'Sunucudan yüklendi') + ' (' + Object.keys(d.quizData.questions).length + ' soru)');
          }
          // Kombine dosya adı
          if (d.quizData.questionsFile) {
            setQuizCombinedFile(d.quizData.questionsFile);
          }
        }
        setQuizLoaded(true);
      })
      .catch(() => setQuizLoaded(true));
  }, []);

  // Real-time polling — her 3 saniyede sunucudan güncel veriyi çek
  useEffect(() => {
    if (!mode || mode !== 'quiz') return;
    const poll = setInterval(() => {
      fetch('/api/quiz')
        .then(r => r.json())
        .then(d => {
          if (!d.quizData) return;
          // Grupları güncelle (isim değişiklikleri yansısın)
          setQuizGroups(prev => {
            const srv = d.quizData.groups || [];
            if (JSON.stringify(prev) !== JSON.stringify(srv)) return srv;
            return prev;
          });
          // Skorları merge et
          setQuizScores(prev => {
            const srv = d.quizData.scores || {};
            const merged = { ...srv };
            Object.keys(prev).forEach(gno => {
              merged[gno] = { ...(merged[gno]||{}), ...prev[gno] };
            });
            return merged;
          });
          // currentQ sunucudan yükle ama biz değiştiriyorsak önceliğimiz
          if (d.quizData.answers && Object.keys(d.quizData.answers).length > 0) {
            setQuizAnswers(d.quizData.answers);
          }
        })
        .catch(() => {});
    }, 3000);
    quizPollRef.current = poll;
    return () => clearInterval(poll);
  }, [mode]);

  const saveQuizData = (newData) => {
    setQuizSaving(true);
    // currentQ'yu da kaydet
    const dataWithQ = { ...newData, currentQ: quizCurrentQ };
    fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizData: dataWithQ })
    })
    .then(r => r.json())
    .then(json => {
      // Sunucu merge edip güncel scores döndürüyor — local state'i güncelle
      if (json.mergedScores) {
        setQuizScores(json.mergedScores);
        setQuizData(prev => prev ? {...prev, scores: json.mergedScores} : prev);
      }
    })
    .catch(() => {})
    .finally(() => setQuizSaving(false));
  };

  // Word dosyasından cevapları parse et
  const parseAnswerText = (text) => {
    const lines = text.split(/\n/);
    const answers = {};
    lines.forEach(line => {
      line = line.trim();
      if (!line) return;
      // "1- Ankara", "2- B) Van Gogh", "1. Ankara" gibi formatlar
      const m = line.match(/^(\d+)[\-\.\)\s]+(.+)$/);
      if (m) {
        answers[parseInt(m[1])] = m[2].trim();
      }
    });
    return answers;
  };

  // Word/txt dosyası yükle — sunucuya yolla, mammoth orada parse eder
  const handleAnswerFileUpload = async (file) => {
    if (!file) return;
    setQuizAnswerLoading(true);
    setQuizAnswerError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/quiz/parse-answers', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setQuizAnswers(json.answers);
      setQuizAnswerFile(file.name + ' (' + json.count + ' cevap)');
      // Cevapları sunucudaki quizData'ya da kaydet — diğer kullanıcılar da görsün
      const current = await fetch('/api/quiz').then(r=>r.json()).catch(()=>({quizData:null}));
      const base = current.quizData || { eventType: quizEventType, groups: quizGroups, scores: quizScores, myGroups: quizMyGroups };
      const updated = {...base, answers: json.answers, answersFile: file.name};
      await fetch('/api/quiz', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({quizData: updated})
      }).catch(()=>{});
    } catch(e) {
      setQuizAnswerError('Dosya okunamadı: ' + e.message);
    }
    setQuizAnswerLoading(false);
  };

  // Kombine dosya yükleme — hem sorular (sunucu için) hem cevaplar (puantör için) aynı dosyadan
  const handleCombinedFileUpload = async (file) => {
    if (!file) return;
    setQuizCombinedLoading(true);
    setQuizCombinedError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Önce soru dosyası olarak parse et (sunucu modu)
      const qRes = await fetch('/api/quiz/parse-questions', { method: 'POST', body: formData });
      const qJson = await qRes.json();
      if (qJson.error) throw new Error(qJson.error);
      setQuizQuestions(qJson.questions || {});
      setQuizQFile(file.name + ' (' + qJson.count + ' soru)');
      setQuizHostQ(1);

      // Aynı dosyadan cevapları da çıkar (cevap anahtarı)
      const formData2 = new FormData();
      formData2.append('file', file);
      const aRes = await fetch('/api/quiz/parse-answers', { method: 'POST', body: formData2 });
      const aJson = await aRes.json();
      if (!aJson.error && aJson.count > 0) {
        setQuizAnswers(aJson.answers || {});
        setQuizAnswerFile(file.name + ' (' + aJson.count + ' cevap)');
        // Cevapları sunucuya da kaydet
        const current = await fetch('/api/quiz').then(r=>r.json()).catch(()=>({quizData:null}));
        const base = current.quizData || { eventType: quizEventType, groups: quizGroups, scores: quizScores, myGroups: quizMyGroups };
        const updated = {...base, answers: aJson.answers, answersFile: file.name, questions: qJson.questions, questionsFile: file.name};
        await fetch('/api/quiz', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({quizData: updated})
        }).catch(()=>{});
      }
      setQuizCombinedFile(file.name + ' (' + qJson.count + ' soru, ' + (aJson.count||0) + ' cevap)');
    } catch(e) {
      setQuizCombinedError('Dosya okunamadı: ' + e.message);
    }
    setQuizCombinedLoading(false);
  };

  // Soru dosyası parse et (sunucu modu) — server'a gönder, mammoth parse eder
  const handleQuestionFileUpload = async (file) => {
    if (!file) return;
    setQuizQLoading(true);
    setQuizQError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/quiz/parse-questions', { method:'POST', body: formData });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setQuizQuestions(json.questions);
      setQuizQFile(file.name + ' (' + json.count + ' soru)');
      setQuizHostQ(1);
    } catch(e) {
      setQuizQError('Dosya okunamadı: ' + e.message);
    }
    setQuizQLoading(false);
  };

  const deleteQuizData = async () => {
    await fetch('/api/quiz', { method: 'DELETE' });
    setQuizData(null);
    setQuizStep('select');
    setQuizEventType(null);
    setQuizGroups([]);
    setQuizMyGroups([]);
    setQuizCurrentQ(1);
    setQuizScores({});
    setQuizDeleteConfirm(false);
    setQuizGroupCount('');
    setQuizGroupCountSet(false);
    setQuizCombinedFile(null);
    setQuizAnswers({});
    setQuizAnswerFile(null);
    setQuizQuestions({});
    setQuizQFile(null);
  };

  // SORU CEVAPLARI — etkinliğe göre
  const QUIZ_ANSWERS = {
    genelkultur: {}, // boş — puantör sadece doğru/yanlış işaretler, cevap bilgisi gösterilmez
    diziyfilm: {}
  };

  // Sayfa açılınca otomatik login dene — rol ekranı hemen göster, veri arka planda gelir
  useState(() => {
    fetch('/api/auto-login', { method:'POST' })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setLoggedIn(true);
          setRoleScreen(true);
          setSalesLoading(true);
          if (json.ready) {
            fetch("/api/sales").then(r=>r.json()).then(d=>{ if(!d.error){ setSalesData(d); setLastUpdated(new Date().toLocaleTimeString("tr-TR")); } }).catch(()=>{}).finally(()=>setSalesLoading(false));
          } else {
            const poll = setInterval(() => {
              fetch('/api/login-status').then(r=>r.json()).then(s => {
                if (s.ready) {
                  clearInterval(poll);
                  fetch("/api/sales").then(r=>r.json()).then(d=>{ if(!d.error){ setSalesData(d); setLastUpdated(new Date().toLocaleTimeString("tr-TR")); } }).catch(()=>{}).finally(()=>setSalesLoading(false));
                } else if (s.status === 'error') {
                  clearInterval(poll);
                  setSalesLoading(false);
                }
              }).catch(()=>{});
            }, 800);
          }
        } else {
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
      .catch(() => {});
  }, []);

  // ─── Malzeme stoğunu sunucudan yükle (sayfa açılınca)
  useEffect(() => {
    fetch('/api/malzeme')
      .then(r => r.json())
      .then(d => {
        if (d.stock && Object.keys(d.stock).length > 0) {
          // Sunucudaki veriyi mevcut init yapısıyla birleştir — yeni figür eklenirse sıfır olarak başlar
          setMalzemeStock(prev => {
            const merged = { ...prev };
            Object.entries(d.stock).forEach(([cat, items]) => {
              if (merged[cat]) {
                merged[cat] = { ...merged[cat], ...items };
              }
            });
            return merged;
          });
        }
        setMalzemeLoaded(true);
      })
      .catch(() => setMalzemeLoaded(true));

    // WhatsApp numarası sabit tanımlı — fetch gerekmez
  }, []);

  // Mail etiketlerini sunucudan yükle
  useEffect(() => {
    fetch('/api/mail-labels')
      .then(r => r.json())
      .then(d => { if (d.labels) setMailLabels(d.labels); })
      .catch(() => {})
      .finally(() => setMailLabelsLoaded(true));
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
      setSalesLoading(true);
      // Polling ile veri hazır olunca çek
      const poll = setInterval(() => {
        fetch('/api/login-status').then(r=>r.json()).then(s => {
          if (s.ready) {
            clearInterval(poll);
            fetch("/api/sales").then(r=>r.json()).then(d=>{ if(!d.error){ setSalesData(d); setLastUpdated(new Date().toLocaleTimeString("tr-TR")); } }).catch(()=>{}).finally(()=>setSalesLoading(false));
          } else if (s.status === 'error') {
            clearInterval(poll);
            setSalesLoading(false);
          }
        }).catch(()=>{});
      }, 800);
    } catch(e) { setLoginError(e.message); }
    finally { setLoginLoading(false); }
  };

  const fetchSales = async () => {
    setSalesLoading(true); setSalesError(null);
    setSalesData(null); // Eski cache'i temizle
    try {
      const res  = await fetch("/api/sales/refresh", { method: "POST" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSalesData(json);
      setLastUpdated(new Date().toLocaleTimeString("tr-TR"));
      setShowIdeasoftReport(false);
    } catch(e) { setSalesError(e.message); }
    finally { setSalesLoading(false); }
  };

  const handleStockUpdate = async (seanceId, currentSoldCount) => {
    const val = stockEdits[seanceId];
    if (val === undefined || val === '') return;
    const newStock = parseInt(val);
    setStockUpdating(p => ({...p,[seanceId]:true}));
    setStockMsg(p => ({...p,[seanceId]:''}));

    // Önce local state'i hemen güncelle — sunucu yanıtı bekleme
    // Satış sayısı değişmez; sadece kalan kontenjan ve baseline güncellenir
    setSalesData(prev => {
      if (!prev || !prev.ideasoft) return prev;
      return {
        ...prev,
        ideasoft: prev.ideasoft.map(s => {
          if (s.seanceId !== seanceId) return s;
          const newBaseline = newStock + (currentSoldCount || 0);
          return { ...s, stockAmount: newStock, baselineStock: newBaseline, soldCount: currentSoldCount || 0 };
        })
      };
    });

    try {
      const res  = await fetch("/api/ideasoft/update-stock", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({seanceId, newStock, currentSoldCount: currentSoldCount || 0})
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setStockMsg(p => ({...p,[seanceId]:'✓'}));
      setStockEdits(p => { const n={...p}; delete n[seanceId]; return n; });
      // fetchSales ÇAĞIRILMIYOR — local state zaten güncellendi, satışlar korundu
    } catch(e) {
      setStockMsg(p => ({...p,[seanceId]:'✗ ' + e.message}));
      // Hata durumunda state'i geri al — veriyi yenile
      fetchSales();
    }
    finally { setStockUpdating(p => ({...p,[seanceId]:false})); }
  };

  const handleToggleSeance = async (seanceId, currentlyActive, isAutoClose = false) => {
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
    } catch(e) {
      if (isAutoClose) { console.warn('Otomatik kapatma hatası:', e.message); }
      else { alert('Hata: ' + e.message); }
    }
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
  const [allCatBulkDeleting, setAllCatBulkDeleting] = useState(false);
  const [allCatBulkConfirm, setAllCatBulkConfirm] = useState(false);

  // ─── SEANS YAZDIRMA ────────────────────────────────────────────────────────
  const [seansYazMode, setSeansYazMode]         = useState(false);   // tam sayfa ekran
  const [seansYazStep, setSeansYazStep]         = useState(1);       // 1=tarih, 2=etkinlik seç, 3=önizleme/oluştur
  const [seansYazCats, setSeansYazCats]         = useState([]);      // seçili kategoriler (çoklu)
  const [seansYazStart, setSeansYazStart]       = useState('');
  const [seansYazEnd, setSeansYazEnd]           = useState('');
  const [seansYazList, setSeansYazList]         = useState([]);      // oluşturulacak seanslar
  const [seansYazProgress, setSeansYazProgress] = useState(null);    // { done, total, errors }
  const [seansYazDone, setSeansYazDone]         = useState(false);

  // Tek bir seans sil — 429 gelirse kısa bekle ve tekrar dene
  const deleteOneSeance = async (seanceId) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`/api/ideasoft/delete-option/${seanceId}`, { method: 'DELETE' });
        const json = await res.json();
        if (!json.error) return true;
        if (json.error && json.error.includes('429')) {
          await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
          continue;
        }
        return false;
      } catch(e) {
        if (attempt < 2) await new Promise(r => setTimeout(r, 800));
      }
    }
    return false;
  };

  // Belirli bir kategorinin geçmiş seanslarını tümüyle sil
  const handleBulkDeletePast = async (cat) => {
    if (!bulkDeleteConfirm[cat]) {
      setBulkDeleteConfirm(p => ({...p, [cat]: true}));
      setTimeout(() => setBulkDeleteConfirm(p => { const n={...p}; delete n[cat]; return n; }), 5000);
      return;
    }
    setBulkDeleteConfirm(p => { const n={...p}; delete n[cat]; return n; });
    setBulkDeleting(true);
    const pastSeances = (salesData?.ideasoft || []).filter(s => s.category === cat && s.seanceId && isSeancePast(s));
    for (const s of pastSeances) {
      const ok = await deleteOneSeance(s.seanceId);
      if (ok) {
        const deletedId = s.seanceId;
        setSalesData(prev => {
          if (!prev || !prev.ideasoft) return prev;
          return { ...prev, ideasoft: prev.ideasoft.filter(x => x.seanceId !== deletedId) };
        });
      }
      await new Promise(r => setTimeout(r, 400));
    }
    setBulkDeleting(false);
  };

  // Tüm kategorilerdeki geçmiş seansları sil
  const handleAllCatBulkDeletePast = async () => {
    if (!allCatBulkConfirm) {
      setAllCatBulkConfirm(true);
      setTimeout(() => setAllCatBulkConfirm(false), 5000);
      return;
    }
    setAllCatBulkConfirm(false);
    setAllCatBulkDeleting(true);
    const allPast = (salesData?.ideasoft || []).filter(s => s.seanceId && isSeancePast(s));
    for (const s of allPast) {
      const ok = await deleteOneSeance(s.seanceId);
      if (ok) {
        const deletedId = s.seanceId;
        setSalesData(prev => {
          if (!prev || !prev.ideasoft) return prev;
          return { ...prev, ideasoft: prev.ideasoft.filter(x => x.seanceId !== deletedId) };
        });
      }
      await new Promise(r => setTimeout(r, 400));
    }
    setAllCatBulkDeleting(false);
  };



  // ─── OTOM. SEANS KAPATMA ───────────────────────────────────────────────────
  // Her 30 saniyede kontrol: başlangıç saati gelen aktif seansları otomatik kapat
  // useRef ile her zaman güncel salesData ve toggling'e erişilir (stale closure önlenir)
  const salesDataRef = useRef(salesData);
  const togglingRef  = useRef(toggling);
  useEffect(() => { salesDataRef.current = salesData; }, [salesData]);
  useEffect(() => { togglingRef.current  = toggling;  }, [toggling]);

  useEffect(() => {
    const autoCloseCheck = () => {
      const data = salesDataRef.current;
      if (!data?.ideasoft) return;
      const now = new Date();

      // Kapatılması gereken seansları topla
      const toClose = [];
      data.ideasoft.forEach(s => {
        if (s.status !== 1) return; // zaten pasif
        if (!s.seanceId) return;
        if (togglingRef.current[s.seanceId]) return; // zaten işlemde
        const parsed = parseIdeasoftName(s.fullName);
        if (!parsed) return;
        const dayNum = parseInt(parsed.dateKey);
        let monIdx = -1;
        for (let i = 0; i < TR_MONTHS.length; i++) {
          if (parsed.dateKey.includes(TR_MONTHS[i])) { monIdx = i; break; }
        }
        if (monIdx === -1) return;
        const startMatch = parsed.timeSlot.match(/^(\d{2}):(\d{2})/);
        if (!startMatch) return;
        const startH = parseInt(startMatch[1]);
        const startM = parseInt(startMatch[2]);
        const startTime = new Date(now.getFullYear(), monIdx, dayNum, startH, startM, 0);
        if (now >= startTime) {
          toClose.push(s);
        }
      });

      if (toClose.length === 0) return;

      // Seansları sunucu queue'suna bırak — client tarafında delay yok, sunucu 1.5s aralıkla işler
      // Her toggle zaten toggleQueue'ya giriyor, eş zamanlı istekler otomatik sıralanıyor
      console.log(`Otomatik kapatma: ${toClose.length} seans sunucu queue'suna ekleniyor`);
      toClose.forEach((s, i) => {
        console.log(`Otomatik seans kapatma (${i+1}/${toClose.length}):`, s.fullName);
        handleToggleSeance(s.seanceId, true, true); // true = otomatik kapatma, hata sessiz
      });
    };
    const interval = setInterval(autoCloseCheck, 60000); // her 60 saniyede kontrol — rate limit için
    autoCloseCheck(); // sayfa açılınca hemen bir kez çalıştır
    return () => clearInterval(interval);
  }, []); // bağımlılık yok — ref'ler üzerinden güncel veriye erişiliyor

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
    setSeansYazCats([]);
    setSeansYazStart('');
    setSeansYazEnd('');
    setSeansYazList([]);
    setSeansYazProgress(null);
    setSeansYazDone(false);
  };

  const handleSeansYazDateConfirm = () => {
    if (!seansYazStart || !seansYazEnd) return;
    setSeansYazStep(2);
  };

  const handleSeansYazCatToggle = (cat) => {
    setSeansYazCats(prev => prev.includes(cat) ? prev.filter(c=>c!==cat) : [...prev, cat]);
  };

  const handleSeansYazPreview = () => {
    // Seçili tüm kategoriler için seansları birleştir
    const SEANS_CATS_ALL = Object.keys(EVENT_SCHEDULE);
    const activeCats = seansYazCats.length === 0 ? SEANS_CATS_ALL : seansYazCats;
    const allItems = activeCats.flatMap(cat => 
      generateSeansListForCat(cat, seansYazStart, seansYazEnd).map(item => ({...item, cat}))
    );
    // Tarihe göre sırala
    allItems.sort((a,b) => a.date - b.date);
    setSeansYazList(allItems);
    setSeansYazStep(3);
  };

  const [seansYazErrors, setSeansYazErrors] = useState([]); // hatalı seans detayları
  const [seansYazCurrentName, setSeansYazCurrentName] = useState('');

  // ─── MAIL AT ───────────────────────────────────────────────────────────────
  const [mailMode, setMailMode]             = useState(false);
  const [mailStep, setMailStep]             = useState(1); // 1=etkinlik, 2=seans, 3=platform, 4=işlem, 5=kontenjan, 6=önizleme
  const [mailPlatforms, setMailPlatforms]   = useState([]); // ['bubilet','biletinial']
  const [mailEvent, setMailEvent]           = useState(null);
  const [mailSeans, setMailSeans]           = useState(null); // { dateKey, slot }
  const [mailIslem, setMailIslem]           = useState(null); // 'kontenjan' | 'tukendi' | 'iptal'
  const [mailKontenjan, setMailKontenjan]   = useState('');
  const [mailSending, setMailSending]       = useState(false);
  const [mailResult, setMailResult]         = useState(null); // { results: [{platform, success, error, to}] }
  const [expandedMailBody, setExpandedMailBody] = useState({});
  // Mail etiketleri: { "Punch|12 Nisan Pazar 18:30 - 20:30": [{islem:'kontenjan',kontenjan:'4',ts:'...'}, ...] }
  const [mailLabels, setMailLabels]             = useState({});
  const [mailLabelsLoaded, setMailLabelsLoaded] = useState(false);

  // Klasik etkinlikler = tek buton, gerisi ayrı
  const MAIL_EVENTS_DISPLAY = [
    { key: 'Klasik Etkinlikler', icon: '🎨', cats: ['Heykel','Bez Çanta','Plak Boyama','Maske','Resim','Mekanda Seç'] },
    { key: 'Cupcake Mum',        icon: '🧁', cats: ['Cupcake Mum'] },
    { key: 'Seramik',            icon: '☕️', cats: ['Seramik'] },
    { key: 'Punch',              icon: '🧶', cats: ['Punch'] },
    { key: '3D Figür',           icon: '🪆', cats: ['3D Figür'] },
    { key: 'Quiz Night',         icon: '🏆', cats: ['Quiz Night'] },
  ];

  const handleMailOpen = () => {
    setMailMode(true); setMailStep(1); setMailPlatforms([]); setMailEvent(null);
    setMailSeans(null); setMailIslem(null); setMailKontenjan(''); setMailSending(false); setMailResult(null);
  };

  const getMailSeansListForEvent = (eventName) => {
    // Temel kategori bul (Quiz Night - Konsept → Quiz Night)
    var baseCat = eventName;
    if (eventName && eventName.startsWith('Quiz Night')) baseCat = 'Quiz Night';

    const now = new Date();

    // İdeasoft'tan gerçek aktif seansları al
    const ideasoftSeances = (salesData?.ideasoft || [])
      .filter(s => s.category === baseCat && s.status === 1)
      .map(s => {
        const parsed = parseIdeasoftName(s.fullName);
        if (!parsed) return null;
        return { dateKey: parsed.dateKey, slot: parsed.timeSlot };
      })
      .filter(Boolean)
      .filter(s => {
        // Geçmiş seansları filtrele
        const dayNum = parseInt(s.dateKey);
        let monIdx = -1;
        for (let i = 0; i < TR_MONTHS.length; i++) {
          if (s.dateKey.includes(TR_MONTHS[i])) { monIdx = i; break; }
        }
        if (monIdx === -1) return true;
        const startMatch = s.slot.match(/^(\d{2}):(\d{2})/);
        if (!startMatch) return true;
        const startTime = new Date(now.getFullYear(), monIdx, dayNum, parseInt(startMatch[1]), parseInt(startMatch[2]), 0);
        return now < startTime;
      })
      .sort((a, b) => {
        const toDate = (s) => {
          const dayNum = parseInt(s.dateKey);
          let monIdx = -1;
          for (let i = 0; i < TR_MONTHS.length; i++) {
            if (s.dateKey.includes(TR_MONTHS[i])) { monIdx = i; break; }
          }
          const startMatch = s.slot.match(/^(\d{2}):(\d{2})/);
          const [h, m] = startMatch ? [parseInt(startMatch[1]), parseInt(startMatch[2])] : [0, 0];
          return new Date(now.getFullYear(), monIdx >= 0 ? monIdx : 0, dayNum, h, m, 0);
        };
        return toDate(a) - toDate(b);
      });

    // İdeasoft'ta veri varsa onu kullan, yoksa sabit takvimden üret (fallback)
    if (ideasoftSeances.length > 0) return ideasoftSeances;

    return generateSeansListForCat(baseCat, (() => {
      const d = new Date(); return d.toISOString().slice(0,10);
    })(), (() => {
      const d = new Date(); d.setDate(d.getDate()+60); return d.toISOString().slice(0,10);
    })());
  };

  const handleMailSend = async () => {
    setMailSending(true); setMailResult(null);
    try {
      const seansLabel = mailSeans ? `${mailSeans.dateKey} ${mailSeans.slot}` : '';
      const res = await fetch('/api/send-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: mailPlatforms,
          eventName: mailEvent,
          seansLabel,
          islemTipi: mailIslem,
          kontenjan: mailKontenjan,
        })
      });
      const json = await res.json();
      setMailResult(json);

      // Başarılı gönderimler varsa etiket kaydet
      const anySuccess = (json.results || []).some(r => r.success);
      if (anySuccess && mailEvent && mailSeans) {
        const labelKey = `${mailEvent}|${seansLabel}`;
        const newEntry = {
          islem: mailIslem,
          kontenjan: mailIslem === 'kontenjan' ? mailKontenjan : null,
          platforms: mailPlatforms.filter(p => (json.results||[]).find(r=>r.platform===p&&r.success)),
          ts: new Date().toLocaleString('tr-TR')
        };
        setMailLabels(prev => {
          const updated = { ...prev, [labelKey]: [...(prev[labelKey]||[]), newEntry] };
          // Sunucuya kaydet
          fetch('/api/mail-labels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ labels: updated })
          }).catch(() => {});
          return updated;
        });
      }
    } catch(e) {
      setMailResult({ results: [{ platform: 'genel', error: e.message }] });
    }
    setMailSending(false);
  };

  // ─── STOK İÇİ MAİL ────────────────────────────────────────────────────────
  // stockMailModal: { seanceId, seansLabel, eventCat } | null
  const [stockMailModal, setStockMailModal]     = useState(null);
  const [stockMailStep, setStockMailStep]       = useState(1); // 1=islem, 2=kontenjan, 3=platform, 4=sonuç
  const [stockMailIslem, setStockMailIslem]     = useState(null);
  const [stockMailKontenjan, setStockMailKontenjan] = useState('');
  const [stockMailPlatforms, setStockMailPlatforms] = useState([]);
  const [stockMailSending, setStockMailSending] = useState(false);
  const [stockMailResult, setStockMailResult]   = useState(null);

  const openStockMail = (s) => {
    const parsed = parseIdeasoftName(s.fullName);
    const seansLabel = parsed ? `${parsed.dateKey} ${parsed.timeSlot}` : s.fullName;
    setStockMailModal({ seanceId: s.seanceId, seansLabel, eventCat: s.category });
    setStockMailStep(1);
    setStockMailIslem(null);
    setStockMailKontenjan('');
    setStockMailPlatforms([]);
    setStockMailSending(false);
    setStockMailResult(null);
  };

  const closeStockMail = () => setStockMailModal(null);

  const toggleStockMailPlatform = (p) => {
    setStockMailPlatforms(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev, p]);
  };

  const handleStockMailSend = async () => {
    if (!stockMailModal) return;
    setStockMailSending(true);
    try {
      const res = await fetch('/api/send-mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: stockMailPlatforms,
          eventName: stockMailModal.eventCat,
          seansLabel: stockMailModal.seansLabel,
          islemTipi: stockMailIslem,
          kontenjan: stockMailKontenjan,
        })
      });
      const json = await res.json();
      setStockMailResult(json);
      // Etiket kaydet
      const anySuccess = (json.results||[]).some(r=>r.success);
      if (anySuccess) {
        const labelKey = `${stockMailModal.eventCat}|${stockMailModal.seansLabel}`;
        const newEntry = {
          islem: stockMailIslem,
          kontenjan: stockMailIslem==='kontenjan' ? stockMailKontenjan : null,
          platforms: stockMailPlatforms.filter(p=>(json.results||[]).find(r=>r.platform===p&&r.success)),
          ts: new Date().toLocaleString('tr-TR')
        };
        setMailLabels(prev => {
          const updated = {...prev, [labelKey]: [...(prev[labelKey]||[]), newEntry]};
          fetch('/api/mail-labels', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({labels:updated}) }).catch(()=>{});
          return updated;
        });
      }
      setStockMailStep(4);
    } catch(e) {
      setStockMailResult({ results:[{platform:'genel',error:e.message}] });
      setStockMailStep(4);
    }
    setStockMailSending(false);
  };

  const handleSeansYazCreate = async () => {
    setSeansYazProgress({ done: 0, total: seansYazList.length, errors: 0 });
    setSeansYazErrors([]);
    setSeansYazCurrentName('');

    const catGroups = {};
    seansYazList.forEach(item => {
      if (!catGroups[item.cat]) catGroups[item.cat] = [];
      catGroups[item.cat].push(item);
    });

    let totalDone = 0;
    let totalErrors = 0;
    const allErrorList = [];

    for (const [cat, items] of Object.entries(catGroups)) {
      const jobId = 'job_' + Date.now() + '_' + cat.replace(/\s/g, '_');
      const seances = items.map(item => buildIdeasoftPayload(item.cat, item.dateKey, item.slot));

      const pollInterval = setInterval(async () => {
        try {
          const pr = await fetch('/api/ideasoft/bulk-progress/' + jobId).then(r => r.json());
          if (pr.found) {
            setSeansYazProgress({ done: totalDone + pr.done, total: seansYazList.length, errors: totalErrors + pr.errors });
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
          totalErrors += seances.length;
          allErrorList.push({ seans: cat + ' (tümü)', hata: json.error });
        } else {
          totalDone += json.total || seances.length;
          totalErrors += json.errors || 0;
          (json.results || []).filter(r => !r.success).forEach(r => allErrorList.push({ seans: r.name, hata: r.error }));
        }
        setSeansYazProgress({ done: totalDone, total: seansYazList.length, errors: totalErrors });
        setSeansYazCurrentName('');
      } catch(e) {
        clearInterval(pollInterval);
        totalErrors += seances.length;
        allErrorList.push({ seans: cat + ' (tümü)', hata: e.message });
        setSeansYazProgress({ done: totalDone, total: seansYazList.length, errors: totalErrors });
      }
    }

    setSeansYazProgress({ done: totalDone, total: seansYazList.length, errors: totalErrors });
    setSeansYazErrors(allErrorList);
    setSeansYazCurrentName('');
    setSeansYazDone(true);
  };

  // ─── MAIL AT TAM EKRAN ─────────────────────────────────────────────────────
  if (mailMode) {
    const PLATFORM_LABELS = { bubilet: 'Bubilet', biletinial: 'Biletini Al' };
    const PLATFORM_COLORS = { bubilet: '#b47cff', biletinial: '#ff9f4a' };
    const ISLEM_OPTIONS = [
      { key:'kontenjan', icon:'📉', label:'Kontenjanı Azalt' },
      { key:'tukendi',   icon:'🚫', label:'Tükendi Yap' },
      { key:'iptal',     icon:'❌', label:'Etkinlik İptali & Ücret İadesi' },
    ];
    const MAIL_TARGETS = { bubilet:'info@bubilet.com.tr', biletinial:'info@biletinial.com' };
    const PLATFORM_LINKS = {
      bubilet: {
        'Klasik Etkinlikler': 'https://www.bubilet.com.tr/ankara/etkinlik/workshop-etkinlik-takvimi-sosyal-sanathane-ankara',
        'Cupcake Mum': 'https://www.bubilet.com.tr/ankara/etkinlik/cupcake-mum-workshop-sosyal-sanathane-ankara--etkinlik-takvimi',
        'Punch':       'https://www.bubilet.com.tr/ankara/etkinlik/punch-workshop-sosyal-sanathane-ankara-etkinlik-takvimi',
        'Seramik':     'https://www.bubilet.com.tr/ankara/etkinlik/seramik-workshop-sosyal-sanathane-ankara-etkinlik-takvimi',
        '3D Figür':    'https://www.bubilet.com.tr/ankara/etkinlik/3d-figur-boyama-workshop-sosyal-sanathane-ankara-etkinlik-takvimi',
        'Quiz Night':  'https://www.bubilet.com.tr/mekan/ara-sokak-pub',
      },
      biletinial: {
        'Klasik Etkinlikler': 'https://biletinial.com/tr-tr/egitim/workshop-etkinlik-takvimi-sosyal-sanathane-ankara',
        'Cupcake Mum': 'https://biletinial.com/tr-tr/egitim/cupcake-mum-workshop-sosyal-sanathane-ankara',
        'Seramik':     'https://biletinial.com/tr-tr/egitim/seramik-workshop-sosyal-sanathane-ankara',
        'Punch':       'https://biletinial.com/tr-tr/egitim/punch-workshop-sosyal-sanathane-ankara',
        '3D Figür':    'https://biletinial.com/tr-tr/egitim/3d-figur-boyama-workshop-sosyal-sanathane-ankara',
        'Quiz Night':  'https://biletinial.com/tr-tr/tiyatro/sosyal-sanathane-ankara-quiz-night',
      },
    };

    const seansLabel = mailSeans ? `${mailSeans.dateKey} ${mailSeans.slot}` : '';
    const mailSeansOptions = mailEvent ? getMailSeansListForEvent(
      mailEvent === 'Klasik Etkinlikler' ? 'Heykel' : mailEvent
    ) : [];

    const mailSubjectPreview = () => {
      if (mailIslem === 'kontenjan') return 'ACİL KONTENJAN DÜZENLEME İŞLEMİ';
      if (mailIslem === 'tukendi')   return 'ACİL TÜKENDİ YAPMA İŞLEMİ';
      if (mailIslem === 'iptal')     return 'ACİL ETKİNLİK İPTALİ';
      return '';
    };
    const mailBodyPreview = (platform) => {
      const link = (PLATFORM_LINKS[platform] && PLATFORM_LINKS[platform][mailEvent]) || '';
      const linkLine = link ? link + '\n' : '';
      if (mailIslem === 'kontenjan') return `${linkLine}${seansLabel} bu seansın kalan kontenjanının ${mailKontenjan} olarak güncellenmesini talep ediyoruz.\n\nSosyal Sanathane Ekibi`;
      if (mailIslem === 'tukendi')   return `${linkLine}${seansLabel} bu seansın kalan kontenjanının 0 yapılmasını (tükendi) olarak güncellenmesini talep ediyoruz.\n\nSosyal Sanathane Ekibi`;
      if (mailIslem === 'iptal')     return `${linkLine}${seansLabel} bu seansın iptalinin gerçekleşmesini ve varsa bilet satışlarının ücret iadesi yapılmasını talep ediyoruz.\n\nSosyal Sanathane Ekibi`;
      return '';
    };

    const togglePlatform = (p) => {
      setMailPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    };

    const stepBack = () => {
      if (mailResult) { setMailResult(null); return; }
      if (mailStep === 5) { setMailIslem(null); setMailStep(4); return; }
      if (mailStep > 1) setMailStep(s => s - 1);
      else setMailMode(false);
    };

    // Adım başlığı breadcrumb
    const breadcrumb = [
      mailEvent,
      mailSeans ? seansLabel : null,
      mailPlatforms.length > 0 ? mailPlatforms.map(p => PLATFORM_LABELS[p]).join(' + ') : null,
    ].filter(Boolean).join(' › ');

    return (
      <div style={S.page}>
        <div style={S.header}>
          <div style={S.headerLeft}>
            <button style={{...S.smallBtn, marginRight:4}} onClick={stepBack}>← Geri</button>
            <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>✉️ MAIL AT</span>
          </div>
        </div>
        <div style={{maxWidth:720,margin:'0 auto',padding:'24px 18px'}}>

          {/* Breadcrumb */}
          {breadcrumb && !mailResult && (
            <div style={{fontSize:11,color:'#4fc9ff',marginBottom:16,fontWeight:600,letterSpacing:0.5}}>{breadcrumb}</div>
          )}

          {/* SONUÇ */}
          {mailResult && (
            <div style={{paddingTop:10}}>
              <div style={{fontSize:13,color:'#64748b',marginBottom:16,fontWeight:600,letterSpacing:1,textTransform:'uppercase'}}>Gönderim Sonuçları</div>
              <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:24}}>
                {mailResult.results.map((r, i) => (
                  <div key={i} style={{background:'#0d1120',border:`1px solid ${r.error ? '#7f1d1d' : '#14532d'}`,borderRadius:14,padding:'16px 18px',display:'flex',alignItems:'center',gap:14}}>
                    <span style={{fontSize:28}}>{r.error ? '❌' : '✅'}</span>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color: r.error ? '#fca5a5' : '#22c55e',marginBottom:2}}>
                        {PLATFORM_LABELS[r.platform] || r.platform}
                      </div>
                      <div style={{fontSize:12,color:'#64748b'}}>
                        {r.error ? r.error : `→ ${MAIL_TARGETS[r.platform]}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setMailMode(false)} style={{...S.loginBtn,maxWidth:280,display:'inline-block'}}>
                Ana Ekrana Dön
              </button>
            </div>
          )}

          {!mailResult && (
            <>
              {/* ADIM 1 — Etkinlik seç */}
              {mailStep === 1 && (
                <div>
                  <div style={{fontSize:13,color:'#64748b',marginBottom:16,fontWeight:600,letterSpacing:1,textTransform:'uppercase'}}>Etkinliği seçin</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    {MAIL_EVENTS_DISPLAY.map(evt => (
                      <button key={evt.key} onClick={()=>{setMailEvent(evt.key);setMailStep(2);}}
                        style={{background:'#0d1120',border:'1px solid #1a2035',borderRadius:14,
                          padding:'16px 12px',cursor:'pointer',display:'flex',flexDirection:'column',
                          alignItems:'center',textAlign:'center',gap:6,
                          gridColumn: evt.key === 'Klasik Etkinlikler' ? 'span 2' : 'span 1'}}>
                        <span style={{fontSize:24}}>{evt.icon}</span>
                        <span style={{fontSize:13,fontWeight:700,color:'#e2e8f0'}}>{evt.key}</span>
                        {evt.key === 'Klasik Etkinlikler' && (
                          <span style={{fontSize:10,color:'#475569'}}>Heykel · Bez Çanta · Resim · Plak · Maske · Mekanda Seç</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mailStep === 2 && (
                <div>
                  <div style={{fontSize:13,color:'#64748b',marginBottom:16,fontWeight:600,letterSpacing:1,textTransform:'uppercase'}}>Seansı seçin</div>
                  {mailSeansOptions.length === 0 ? (
                    <div style={{color:'#64748b',textAlign:'center',padding:24}}>Önümüzdeki 60 günde seans bulunamadı.</div>
                  ) : (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {mailSeansOptions.map((s,i) => {
                        const lKey = `${mailEvent}|${s.dateKey} ${s.slot}`;
                        const labels = mailLabels[lKey] || [];
                        return (
                          <button key={i} onClick={()=>{setMailSeans(s);setMailStep(3);}}
                            style={{background:'#0d1120',border:'1px solid #1a2035',borderRadius:12,
                              padding:'14px 18px',cursor:'pointer',display:'flex',alignItems:'flex-start',
                              flexDirection:'column',gap:6,textAlign:'left'}}>
                            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',gap:10}}>
                              <span style={{fontSize:13,color:'#94a3b8',fontWeight:600}}>{s.dateKey}</span>
                              <span style={{fontSize:14,fontWeight:700,color:'#e2e8f0'}}>{s.slot}</span>
                              <span style={{color:'#374151',fontSize:18,marginLeft:'auto'}}>›</span>
                            </div>
                            {labels.length > 0 && (
                              <div style={{display:'flex',flexWrap:'wrap',gap:5,paddingTop:2}}>
                                {labels.map((lb, li) => {
                                  let tag, color;
                                  if (lb.islem === 'kontenjan') { tag = `📉 Kontenjan ${lb.kontenjan} düşürüldü`; color = '#0ea5e9'; }
                                  else if (lb.islem === 'tukendi') { tag = '🚫 Tükendi yapıldı'; color = '#f59e0b'; }
                                  else if (lb.islem === 'iptal') { tag = '❌ İptal & İade yapıldı'; color = '#ef4444'; }
                                  else { tag = lb.islem; color = '#64748b'; }
                                  return (
                                    <span key={li} style={{fontSize:10,fontWeight:700,color,
                                      background:color+'18',border:`1px solid ${color}44`,
                                      borderRadius:6,padding:'2px 8px',whiteSpace:'nowrap'}}>
                                      {tag}
                                      <span style={{fontSize:9,color:'#475569',marginLeft:4}}>{lb.ts}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ADIM 3 — Platform seç (çoklu) */}
              {mailStep === 3 && (
                <div>
                  <div style={{fontSize:13,color:'#64748b',marginBottom:16,fontWeight:600,letterSpacing:1,textTransform:'uppercase'}}>Platform seçin (birden fazla olabilir)</div>
                  <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:20}}>
                    {['bubilet','biletinial'].map(p => {
                      const selected = mailPlatforms.includes(p);
                      return (
                        <button key={p} onClick={()=>togglePlatform(p)}
                          style={{background: selected ? '#0a1a28' : '#0d1120',
                            border:`2px solid ${selected ? PLATFORM_COLORS[p] : '#1a2035'}`,
                            borderRadius:14,padding:'20px 22px',cursor:'pointer',
                            display:'flex',alignItems:'center',gap:14,textAlign:'left',transition:'all 0.15s'}}>
                          <span style={{fontSize:28}}>{p==='bubilet'?'🎟':'🎫'}</span>
                          <div style={{flex:1}}>
                            <div style={{fontSize:15,fontWeight:700,color:PLATFORM_COLORS[p],marginBottom:2}}>{PLATFORM_LABELS[p]}</div>
                            <div style={{fontSize:12,color:'#475569'}}>{MAIL_TARGETS[p]}</div>
                          </div>
                          <div style={{width:22,height:22,borderRadius:'50%',border:`2px solid ${selected ? PLATFORM_COLORS[p] : '#374151'}`,
                            background: selected ? PLATFORM_COLORS[p] : 'transparent',
                            display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            {selected && <span style={{color:'#fff',fontSize:12,fontWeight:800}}>✓</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={()=>setMailStep(4)}
                    disabled={mailPlatforms.length === 0}
                    style={{width:'100%',padding:'14px',borderRadius:12,fontSize:15,fontWeight:700,border:'none',cursor: mailPlatforms.length===0 ? 'default':'pointer',
                      background: mailPlatforms.length===0 ? '#1a2035' : 'linear-gradient(135deg,#b47cff,#7c3aff)',
                      color: mailPlatforms.length===0 ? '#374151' : '#fff', transition:'all 0.15s'}}>
                    Devam → {mailPlatforms.length > 0 && `(${mailPlatforms.length} platform)`}
                  </button>
                </div>
              )}

              {/* ADIM 4 — İşlem seç */}
              {mailStep === 4 && (
                <div>
                  <div style={{fontSize:13,color:'#64748b',marginBottom:16,fontWeight:600,letterSpacing:1,textTransform:'uppercase'}}>İşlem türünü seçin</div>
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {ISLEM_OPTIONS.map(opt => (
                      <button key={opt.key}
                        onClick={()=>{
                          setMailIslem(opt.key);
                          if (opt.key === 'kontenjan') setMailStep(5);
                          else setMailStep(6);
                        }}
                        style={{background:'#0d1120',border:'1px solid #1a2035',borderRadius:14,
                          padding:'18px 20px',cursor:'pointer',display:'flex',alignItems:'center',gap:14,textAlign:'left'}}>
                        <span style={{fontSize:26}}>{opt.icon}</span>
                        <span style={{fontSize:14,fontWeight:700,color:'#e2e8f0'}}>{opt.label}</span>
                        <span style={{marginLeft:'auto',color:'#374151',fontSize:18}}>›</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ADIM 5 — Kontenjan sayısı */}
              {mailStep === 5 && (
                <div>
                  <div style={{fontSize:13,color:'#64748b',marginBottom:10,fontWeight:600,letterSpacing:1,textTransform:'uppercase'}}>Kontenjan kaça düşürülsün?</div>
                  <input
                    type="number" min="0"
                    value={mailKontenjan}
                    onChange={e=>setMailKontenjan(e.target.value)}
                    placeholder="Örn: 3"
                    style={{...S.input, fontSize:20, padding:'14px', marginBottom:16, textAlign:'center'}}
                  />
                  <button
                    onClick={()=>setMailStep(6)}
                    disabled={!mailKontenjan || isNaN(parseInt(mailKontenjan))}
                    style={{
                      width:'100%',padding:'14px',borderRadius:12,fontSize:15,fontWeight:700,border:'none',cursor:'pointer',
                      background: (!mailKontenjan||isNaN(parseInt(mailKontenjan))) ? '#1a2035' : 'linear-gradient(135deg,#0ea5e9,#0284c7)',
                      color: (!mailKontenjan||isNaN(parseInt(mailKontenjan))) ? '#374151' : '#fff',
                      transition:'all 0.15s'
                    }}>
                    Devam →
                  </button>
                </div>
              )}

              {/* ADIM 6 — Önizleme & Gönder */}
              {mailStep === 6 && (
                <div>
                  <div style={{fontSize:13,color:'#64748b',marginBottom:16,fontWeight:600,letterSpacing:1,textTransform:'uppercase'}}>Mail Önizleme</div>
                  <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:20}}>
                    {mailPlatforms.map(p => (
                      <div key={p} style={{background:'#0d1120',border:`1px solid ${PLATFORM_COLORS[p]}44`,borderRadius:14,padding:'18px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,paddingBottom:10,borderBottom:'1px solid #0f1525'}}>
                          <span style={{fontSize:20}}>{p==='bubilet'?'🎟':'🎫'}</span>
                          <div>
                            <div style={{fontSize:13,fontWeight:700,color:PLATFORM_COLORS[p]}}>{PLATFORM_LABELS[p]}</div>
                            <div style={{fontSize:11,color:'#475569'}}>{MAIL_TARGETS[p]}</div>
                          </div>
                        </div>
                        <div style={{marginBottom:8}}>
                          <div style={{fontSize:10,color:'#64748b',marginBottom:2,fontWeight:700,letterSpacing:1}}>KONU</div>
                          <div style={{fontSize:13,fontWeight:700,color:'#fff'}}>{mailSubjectPreview()}</div>
                        </div>
                        <div>
                          <div
                            onClick={() => setExpandedMailBody(prev => ({...prev, [p]: !prev[p]}))}
                            style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',marginBottom:4}}
                          >
                            <div style={{fontSize:10,color:'#64748b',fontWeight:700,letterSpacing:1}}>İÇERİK</div>
                            <span style={{fontSize:10,color:'#475569'}}>{expandedMailBody[p] ? '▲ gizle' : '▼ göster'}</span>
                          </div>
                          {expandedMailBody[p] && (
                            <pre style={{fontSize:12,color:'#e2e8f0',whiteSpace:'pre-wrap',margin:0,fontFamily:'inherit',lineHeight:1.7}}>{mailBodyPreview(p)}</pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleMailSend}
                    disabled={mailSending}
                    style={{width:'100%',padding:'16px',background:mailSending?'#1a2035':'linear-gradient(135deg,#22c55e,#16a34a)',
                      color:mailSending?'#374151':'#fff',border:'none',borderRadius:14,fontSize:16,fontWeight:800,
                      cursor:mailSending?'default':'pointer',transition:'all 0.15s'}}>
                    {mailSending ? '⏳ Gönderiliyor…' : `✉️ ${mailPlatforms.length > 1 ? mailPlatforms.length + ' Platforma ' : ''}Mail Gönder`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

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
            <button style={S.smallBtn} onClick={() => { setSeansYazStep(s => s-1); setSeansYazProgress(null); setSeansYazDone(false); setSeansYazList([]); }}>
              ← Önceki Adım
            </button>
          )}
        </div>
        <div style={{maxWidth:720,margin:'0 auto',padding:'24px 18px'}}>
          {/* Adım göstergesi */}
          <div style={{display:'flex',gap:8,marginBottom:28,alignItems:'center'}}>
            {['Tarih Aralığı','Etkinlik Seç','Önizleme & Oluştur'].map((label,i)=>(
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

          {/* ADIM 1 — Tarih aralığı seç */}
          {seansYazStep === 1 && (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{fontSize:13,color:'#64748b',marginBottom:4,fontWeight:600,letterSpacing:1,textTransform:'uppercase'}}>
                Seans yazdırılacak tarih aralığını seçin
              </div>
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
                Devam — Etkinlik Seç →
              </button>
            </div>
          )}

          {/* ADIM 2 — Etkinlik seç (çoklu) */}
          {seansYazStep === 2 && (
            <div>
              <div style={{fontSize:13,color:'#64748b',marginBottom:4,fontWeight:600,letterSpacing:1,textTransform:'uppercase'}}>
                Hangi etkinlikler için seans yazılsın?
              </div>
              <div style={{fontSize:11,color:'#475569',marginBottom:14}}>
                📅 {seansYazStart} → {seansYazEnd} &nbsp;·&nbsp;
                {seansYazCats.length === 0 ? 'Hiçbiri seçilmedi (hepsi yazılır)' : `${seansYazCats.length} etkinlik seçildi`}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
                {Object.keys(EVENT_SCHEDULE).map(cat => {
                  const sel = seansYazCats.includes(cat);
                  return (
                    <button key={cat}
                      onClick={() => handleSeansYazCatToggle(cat)}
                      style={{
                        background: sel ? '#0a1a2a' : '#0d1120',
                        border: sel ? '2px solid #4fc9ff' : '1px solid #1a2035',
                        borderRadius:12, padding:'14px 10px', cursor:'pointer',
                        display:'flex', flexDirection:'column', alignItems:'center',
                        textAlign:'center', gap:6, transition:'all 0.15s', position:'relative'
                      }}>
                      {sel && <span style={{position:'absolute',top:6,right:8,fontSize:12,color:'#4fc9ff',fontWeight:800}}>✓</span>}
                      <span style={{fontSize:24}}>{getCatIcon(cat)}</span>
                      <span style={{fontSize:12,fontWeight:700,color:sel?'#4fc9ff':'#e2e8f0'}}>{cat}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{display:'flex',gap:8,marginBottom:10}}>
                <button
                  onClick={()=>setSeansYazCats(Object.keys(EVENT_SCHEDULE))}
                  style={{flex:1,padding:'9px',borderRadius:9,fontSize:12,fontWeight:700,cursor:'pointer',
                    background:'#111827',color:'#94a3b8',border:'1px solid #1e293b'}}>
                  Tümünü Seç
                </button>
                <button
                  onClick={()=>setSeansYazCats([])}
                  style={{flex:1,padding:'9px',borderRadius:9,fontSize:12,fontWeight:700,cursor:'pointer',
                    background:'#111827',color:'#94a3b8',border:'1px solid #1e293b'}}>
                  Seçimi Temizle
                </button>
              </div>
              <button
                onClick={handleSeansYazPreview}
                style={{
                  width:'100%',padding:'14px',borderRadius:12,fontSize:15,fontWeight:700,border:'none',cursor:'pointer',
                  background:'linear-gradient(135deg,#0ea5e9,#0284c7)',color:'#fff',transition:'all 0.15s'
                }}>
                Önizlemeye Geç →
              </button>
            </div>
          )}

          {/* ADIM 3 */}
          {seansYazStep === 3 && (
            <div>
              {!seansYazProgress && !seansYazDone && (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
                    <div style={{fontSize:13,color:'#e2e8f0',fontWeight:700}}>
                      <span style={{color:'#4fc9ff'}}>{seansYazList.length} seans</span>
                      {' '}— {seansYazCats.length===0?'Tüm etkinlikler':seansYazCats.join(', ')}
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
                            padding:'10px 14px',borderBottom:'1px solid #0a0e1a',gap:8}}>
                            <span style={{fontSize:12,color:'#64748b',flexShrink:0}}>{getCatIcon(item.cat)}</span>
                            <span style={{fontSize:12,color:'#94a3b8',flex:1}}>{item.dateKey}</span>
                            <span style={{fontSize:12,fontWeight:700,color:'#4fc9ff',flexShrink:0}}>{item.slot}</span>
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
                    {seansYazCats.length===0 ? 'Tüm etkinlikler' : seansYazCats.join(' · ')}
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

  // ─── ROL SEÇİM EKRANI ──────────────────────────────────────────────────────
  // ─── QUIZ NIGHT ÖZEL GİRİŞ MODU ──────────────────────────────────────────────
  if (quizNightMode && !role) {
    // Şifre ekranı — numpad ile
    const QUIZ_PIN = '0000';
    const numpadPress = (digit) => {
      if (quizNightPin.length >= 4) return;
      const next = quizNightPin + digit;
      setQuizNightPin(next);
      setQuizNightPinError(false);
      if (next.length === 4) {
        setTimeout(() => {
          if (next === QUIZ_PIN) {
            setLoggedIn(true);
            setRoleScreen(false);
            setRole('quiznight');
            setQuizNightPin('');
            setQuizNightPinError(false);
          } else {
            setQuizNightPinError(true);
            setQuizNightPin('');
          }
        }, 120);
      }
    };
    const numpadDel = () => { setQuizNightPin(p => p.slice(0,-1)); setQuizNightPinError(false); };
    const NUMPAD = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];
    return (
      <div style={S.page}>
        <div style={{display:'flex',justifyContent:'center',padding:'0 24px',marginTop:'22vh'}}>
          <div style={{...S.loginCard, maxWidth:320, textAlign:'center', width:'100%', border:'none'}}>
            <div style={{fontSize:36, marginBottom:12}}>🏆</div>
            <div style={{fontSize:15, fontWeight:700, color:'#fff', marginBottom:4}}>Quiz Night Girişi</div>
            <div style={{fontSize:12, color:'#475569', marginBottom:20}}>Şifrenizi girin</div>
            {quizNightPinError && (
              <div style={{...S.errBox, marginBottom:14}}>❌ Yanlış şifre, tekrar deneyin</div>
            )}
            <div style={{display:'flex', justifyContent:'center', gap:14, marginBottom:28}}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  width:16, height:16, borderRadius:'50%',
                  background: quizNightPin.length > i ? '#fbbf24' : '#1a2035',
                  border: '2px solid ' + (quizNightPin.length > i ? '#fbbf24' : '#374151'),
                  transition:'background 0.15s'
                }}/>
              ))}
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16}}>
              {NUMPAD.flat().map((k, i) => (
                k === '' ? <div key={i}/> :
                k === '⌫' ? (
                  <button key={i} onClick={numpadDel}
                    style={{padding:'16px 0', background:'#111827', color:'#94a3b8',
                      border:'1px solid #1a2035', borderRadius:12, fontSize:20,
                      cursor:'pointer', fontWeight:600}}>⌫</button>
                ) : (
                  <button key={i} onClick={() => numpadPress(k)}
                    style={{padding:'16px 0', background:'#0d1120', color:'#e2e8f0',
                      border:'1px solid #1a2035', borderRadius:12, fontSize:22,
                      cursor:'pointer', fontWeight:700}}>
                    {k}
                  </button>
                )
              ))}
            </div>
            <button
              style={{...S.loginBtn,
                background: quizNightPin.length >= 4 ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : '#1a2035',
                color: quizNightPin.length >= 4 ? '#000' : '#374151',
                cursor: quizNightPin.length >= 4 ? 'pointer' : 'default', marginBottom:8
              }}
              onClick={() => {
                if (quizNightPin === QUIZ_PIN) {
                  setLoggedIn(true); setRoleScreen(false); setRole('quiznight');
                  setQuizNightPin(''); setQuizNightPinError(false);
                } else { setQuizNightPinError(true); setQuizNightPin(''); }
              }}
              disabled={quizNightPin.length < 4}
            >Giriş →</button>
            <button style={{...S.smallBtn, width:'100%', textAlign:'center'}}
              onClick={() => { setQuizNightMode(false); setQuizNightPin(''); setQuizNightPinError(false); }}>
              ← Geri
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <div style={{display:'flex',justifyContent:'center',padding:'0 24px',marginTop:'22vh'}}>
            <div style={{...S.loginCard, maxWidth:320, textAlign:'center', width:'100%', border:'none'}}>
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
        <div style={{display:'flex',justifyContent:'center',padding:'0 24px',marginTop:'22vh'}}>
          <div style={{...S.loginCard, maxWidth:400, textAlign:'center', width:'100%', border:'none'}}>
            <div style={{fontSize:30, marginBottom:8}}>🎟</div>
            <div style={{fontSize:16, fontWeight:800, letterSpacing:2, color:'#fff', marginBottom:4}}>BİLET PANELİ</div>
            {salesLoading && (
              <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center',padding:'8px 0 4px'}}>
                <div style={{width:18,height:18,border:'2px solid #1a2035',borderTop:'2px solid #b47cff',
                  borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
                <span style={{fontSize:11,color:'#475569'}}>Veriler yükleniyor…</span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
            {!salesLoading && (
              <div style={{fontSize:12, color:'#475569', marginBottom:16}}>Devam etmek için rolünüzü seçin</div>
            )}
            <div style={{display:'flex', flexDirection:'column', gap:12, marginTop:8}}>
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
              <button
                style={{background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'none', borderRadius:14,
                  padding:'20px', cursor:'pointer', color:'#000', textAlign:'left', display:'flex',
                  alignItems:'center', gap:14}}
                onClick={() => { setQuizNightMode(true); setRolePinTarget(null); }}
              >
                <span style={{fontSize:32}}>🏆</span>
                <div>
                  <div style={{fontSize:15, fontWeight:700, marginBottom:2}}>Quiz Night Girişi</div>
                  <div style={{fontSize:12, opacity:0.7}}>Sunucu ve puantör girişi</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            <div style={{borderTop:'1px solid #1a2035',marginTop:20,paddingTop:16}}>
              <div style={{fontSize:11,color:'#374151',textAlign:'center',marginBottom:10}}>veya</div>
              <button
                onClick={() => setQuizNightMode(true)}
                style={{width:'100%',padding:'13px',background:'linear-gradient(135deg,#fbbf24,#f59e0b)',
                  color:'#000',border:'none',borderRadius:12,fontSize:14,fontWeight:800,cursor:'pointer'}}>
                🏆 Quiz Night Girişi
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── SATIŞ EKRANI (tam sayfa) ────────────────────────────────────────────────
  if (mode === 'sales') {
    const seancesSales = buildSeanceMap(salesData);
    return (
      <div style={S.page}>
        <div style={S.header}>
          <div style={S.headerLeft}>
            <button style={{...S.smallBtn, marginRight:4}} onClick={() => setMode(null)}>← Geri</button>
            <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>📊 SATIŞ PANELİ</span>
          </div>
          <div style={S.headerRight}>
            <button style={S.refreshBtn} onClick={fetchSales} disabled={salesLoading}>
              {salesLoading ? '⟳ Yükleniyor…' : '⟳ Yenile'}
            </button>
            {lastUpdated && <span style={S.ts}>{lastUpdated}</span>}
          </div>
        </div>
        <div style={S.panel}>
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
          {salesLoading && !salesData && (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'60px 0 40px'}}>
              <div style={{width:56,height:56,marginBottom:18,border:'4px solid #1a2035',borderTop:'4px solid #b47cff',
                borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
              <div style={{fontSize:14,color:'#64748b',fontWeight:600}}>Veriler çekiliyor…</div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {seancesSales.map(s => {
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

          {!salesLoading && seancesSales.length===0 && salesData && (
            <div style={S.empty}>Veri bulunamadı.</div>
          )}

          {/* İdeasoft Toplam Satış Raporu */}
          {salesData && salesData.ideasoft && (() => {
            const dayMap = {};
            const TR_MONTHS_SHORT = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
            salesData.ideasoft.forEach(s => {
              if (!s.soldCount || s.soldCount === 0) return;
              const m = s.fullName.match(/- (\d+) (\w+) (\w+)/u);
              if (!m) return;
              const dayKey = m[1] + ' ' + m[2] + ' ' + m[3];
              const cat    = s.category;
              if (!dayMap[dayKey]) dayMap[dayKey] = {};
              dayMap[dayKey][cat] = (dayMap[dayKey][cat] || 0) + s.soldCount;
            });
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
                <button style={{...S.ideasoftReportBtn}} onClick={()=>setShowIdeasoftReport(p=>!p)}>
                  <span>📈 İdeasoft Toplam Satış Raporu</span>
                  <span style={{...S.chevron,...(showIdeasoftReport?{transform:'rotate(90deg)',color:'#94a3b8'}:{}),...{fontSize:16}}}>›</span>
                </button>
                {showIdeasoftReport && (
                  <div style={S.reportPanel}>
                    {!hasSales && <div style={S.empty}>Henüz İdeasoft satışı yok.</div>}
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
      </div>
    );
  }

  // ─── STOK EKRANI (tam sayfa) ─────────────────────────────────────────────────
  if (mode === 'stock') {
    const PLATFORM_COLORS_SM = { bubilet:'#b47cff', biletinial:'#ff9f4a' };
    const PLATFORM_LABELS_SM = { bubilet:'Bubilet', biletinial:'Biletini Al' };
    const MAIL_TARGETS_SM    = { bubilet:'info@bubilet.com.tr', biletinial:'info@biletinial.com' };
    const ISLEM_OPTIONS_SM = [
      { key:'kontenjan', icon:'📉', label:'Kontenjanı Azalt' },
      { key:'tukendi',   icon:'🚫', label:'Tükendi Yap' },
      { key:'iptal',     icon:'❌', label:'İptal & Ücret İadesi' },
    ];

    // Inline mail modal overlay
    const renderMailModal = () => {
      if (!stockMailModal) return null;
      const { seansLabel, eventCat } = stockMailModal;
      return (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:100,display:'flex',alignItems:'flex-end',justifyContent:'center'}}
          onClick={e=>{if(e.target===e.currentTarget)closeStockMail();}}>
          <div style={{background:'#0d1120',borderRadius:'20px 20px 0 0',padding:'24px 20px 40px',width:'100%',maxWidth:520,
            boxShadow:'0 -8px 40px rgba(0,0,0,0.5)',maxHeight:'85vh',overflowY:'auto'}}>

            {/* Handle bar */}
            <div style={{width:40,height:4,borderRadius:2,background:'#1e293b',margin:'0 auto 20px'}}/>

            {/* Başlık */}
            <div style={{fontSize:11,color:'#4fc9ff',fontWeight:700,letterSpacing:1,marginBottom:4,textTransform:'uppercase'}}>✉️ Mail At</div>
            <div style={{fontSize:14,fontWeight:700,color:'#fff',marginBottom:4}}>{getCatIcon(eventCat)} {eventCat}</div>
            <div style={{fontSize:12,color:'#64748b',marginBottom:20}}>{seansLabel}</div>

            {/* ADIM 1 — İşlem seç */}
            {stockMailStep === 1 && (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{fontSize:11,color:'#475569',fontWeight:700,letterSpacing:1,marginBottom:4,textTransform:'uppercase'}}>İşlem türü</div>
                {ISLEM_OPTIONS_SM.map(opt => {
                  // Bu seans + bu işlem için daha önce atılmış mailler
                  const labelKey = `${eventCat}|${seansLabel}`;
                  const prevLabels = (mailLabels[labelKey] || []).filter(lb => lb.islem === opt.key);
                  return (
                    <div key={opt.key} style={{display:'flex',flexDirection:'column',gap:0}}>
                      {/* Geçmiş etiketler — butonun üzerinde */}
                      {prevLabels.length > 0 && (
                        <div style={{display:'flex',flexWrap:'wrap',gap:4,paddingBottom:6,paddingLeft:4}}>
                          {prevLabels.map((lb, li) => {
                            let tag, color;
                            if (lb.islem === 'kontenjan') { tag = `📉 Kontenjan ${lb.kontenjan}'e düşürüldü`; color = '#0ea5e9'; }
                            else if (lb.islem === 'tukendi') { tag = '🚫 Tükendi yapıldı'; color = '#f59e0b'; }
                            else if (lb.islem === 'iptal')   { tag = '❌ İptal & İade yapıldı'; color = '#ef4444'; }
                            else { tag = lb.islem; color = '#64748b'; }
                            return (
                              <div key={li} style={{display:'flex',flexDirection:'column',gap:1}}>
                                <span style={{fontSize:11,fontWeight:700,color,
                                  background:color+'18',border:`1px solid ${color}44`,
                                  borderRadius:6,padding:'3px 9px',whiteSpace:'nowrap'}}>
                                  {tag}
                                </span>
                                <span style={{fontSize:9,color:'#334155',paddingLeft:4}}>{lb.ts}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <button
                        onClick={()=>{ setStockMailIslem(opt.key); opt.key==='kontenjan'?setStockMailStep(2):setStockMailStep(3); }}
                        style={{background:'#111827',border:'1px solid #1e293b',borderRadius:12,padding:'16px 18px',
                          cursor:'pointer',display:'flex',alignItems:'center',gap:12,textAlign:'left'}}>
                        <span style={{fontSize:22}}>{opt.icon}</span>
                        <span style={{fontSize:14,fontWeight:700,color:'#e2e8f0'}}>{opt.label}</span>
                        <span style={{marginLeft:'auto',color:'#374151',fontSize:18}}>›</span>
                      </button>
                    </div>
                  );
                })}
                <button onClick={closeStockMail} style={{...S.smallBtn,width:'100%',textAlign:'center',marginTop:6}}>İptal</button>
              </div>
            )}

            {/* ADIM 2 — Kontenjan sayısı */}
            {stockMailStep === 2 && (
              <div>
                <div style={{fontSize:11,color:'#475569',fontWeight:700,letterSpacing:1,marginBottom:10,textTransform:'uppercase'}}>Kontenjan kaça düşürülsün?</div>
                <input type="number" min="0"
                  value={stockMailKontenjan}
                  onChange={e=>setStockMailKontenjan(e.target.value)}
                  placeholder="Örn: 3"
                  style={{...S.input,fontSize:20,padding:'14px',marginBottom:16,textAlign:'center'}}
                />
                <button
                  onClick={()=>setStockMailStep(3)}
                  disabled={!stockMailKontenjan||isNaN(parseInt(stockMailKontenjan))}
                  style={{width:'100%',padding:'14px',borderRadius:12,fontSize:15,fontWeight:700,border:'none',cursor:'pointer',
                    background:(!stockMailKontenjan||isNaN(parseInt(stockMailKontenjan)))?'#1a2035':'linear-gradient(135deg,#0ea5e9,#0284c7)',
                    color:(!stockMailKontenjan||isNaN(parseInt(stockMailKontenjan)))?'#374151':'#fff',marginBottom:10}}>
                  Devam →
                </button>
                <button onClick={()=>setStockMailStep(1)} style={{...S.smallBtn,width:'100%',textAlign:'center'}}>← Geri</button>
              </div>
            )}

            {/* ADIM 3 — Platform seç */}
            {stockMailStep === 3 && (
              <div>
                <div style={{fontSize:11,color:'#475569',fontWeight:700,letterSpacing:1,marginBottom:12,textTransform:'uppercase'}}>Platform seçin</div>
                <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
                  {['bubilet','biletinial'].map(p=>{
                    const sel = stockMailPlatforms.includes(p);
                    return (
                      <button key={p} onClick={()=>toggleStockMailPlatform(p)}
                        style={{background:sel?'#0a1a28':'#111827',
                          border:`2px solid ${sel?PLATFORM_COLORS_SM[p]:'#1e293b'}`,
                          borderRadius:12,padding:'16px 18px',cursor:'pointer',
                          display:'flex',alignItems:'center',gap:12,transition:'all 0.15s'}}>
                        <span style={{fontSize:22}}>{p==='bubilet'?'🎟':'🎫'}</span>
                        <div style={{flex:1,textAlign:'left'}}>
                          <div style={{fontSize:14,fontWeight:700,color:PLATFORM_COLORS_SM[p]}}>{PLATFORM_LABELS_SM[p]}</div>
                          <div style={{fontSize:11,color:'#475569'}}>{MAIL_TARGETS_SM[p]}</div>
                        </div>
                        <div style={{width:20,height:20,borderRadius:'50%',
                          border:`2px solid ${sel?PLATFORM_COLORS_SM[p]:'#374151'}`,
                          background:sel?PLATFORM_COLORS_SM[p]:'transparent',
                          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          {sel&&<span style={{color:'#fff',fontSize:11,fontWeight:800}}>✓</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={handleStockMailSend}
                  disabled={stockMailPlatforms.length===0||stockMailSending}
                  style={{width:'100%',padding:'15px',borderRadius:12,fontSize:15,fontWeight:800,border:'none',
                    background:stockMailPlatforms.length===0||stockMailSending?'#1a2035':'linear-gradient(135deg,#22c55e,#16a34a)',
                    color:stockMailPlatforms.length===0||stockMailSending?'#374151':'#fff',cursor:'pointer',marginBottom:10}}>
                  {stockMailSending?'⏳ Gönderiliyor…':'✉️ Mail Gönder'}
                </button>
                <button onClick={()=>setStockMailStep(stockMailIslem==='kontenjan'?2:1)}
                  style={{...S.smallBtn,width:'100%',textAlign:'center'}}>← Geri</button>
              </div>
            )}

            {/* ADIM 4 — Sonuç */}
            {stockMailStep === 4 && stockMailResult && (
              <div>
                <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
                  {(stockMailResult.results||[]).map((r,i)=>(
                    <div key={i} style={{background:'#07090f',border:`1px solid ${r.error?'#7f1d1d':'#14532d'}`,
                      borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
                      <span style={{fontSize:24}}>{r.error?'❌':'✅'}</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:r.error?'#fca5a5':'#22c55e'}}>
                          {PLATFORM_LABELS_SM[r.platform]||r.platform}
                        </div>
                        <div style={{fontSize:11,color:'#475569'}}>{r.error?r.error:`→ ${MAIL_TARGETS_SM[r.platform]}`}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={closeStockMail}
                  style={{width:'100%',padding:'14px',background:'linear-gradient(135deg,#b47cff,#7c3aff)',
                    color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer'}}>
                  Kapat
                </button>
              </div>
            )}
          </div>
        </div>
      );
    };

    return (
      <div style={S.page}>
        {renderMailModal()}
        <div style={S.header}>
          <div style={S.headerLeft}>
            <button style={{...S.smallBtn, marginRight:4}} onClick={() => setMode(null)}>← Geri</button>
            <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>📦 STOK YÖNETİMİ</span>
          </div>
        </div>
        <div style={S.panel}>
          <div style={S.catGrid}>
            {Object.keys(CAT_ICON).map(cat=>(
              <button key={cat} style={{...S.catBtn,...(selectedCat===cat?S.catBtnActive:{})}}
                onClick={()=>{ setSelectedCat(selectedCat===cat?null:cat); if(!salesData && selectedCat!==cat) fetchSales(); }}>
                {getCatIcon(cat)} {cat}
              </button>
            ))}
          </div>

          {/* Tüm kategorilerdeki geçmiş seansları sil */}
          {salesData && (() => {
            const totalPast = (salesData?.ideasoft||[]).filter(s=>s.seanceId&&isSeancePast(s)).length;
            if (totalPast === 0) return null;
            return (
              <div style={{padding:'0 0 10px'}}>
                <button
                  onClick={handleAllCatBulkDeletePast}
                  disabled={allCatBulkDeleting}
                  style={{
                    width:'100%',padding:'11px 16px',borderRadius:10,fontSize:12,fontWeight:700,
                    cursor:allCatBulkDeleting?'wait':'pointer',border:'none',
                    background: allCatBulkConfirm ? '#3f0f0f' : '#141a2a',
                    color: allCatBulkConfirm ? '#ff4444' : '#64748b',
                    border: allCatBulkConfirm ? '1px solid #7f1d1d' : '1px solid #1e293b',
                    opacity: allCatBulkDeleting ? 0.6 : 1,
                    transition:'all 0.2s'
                  }}>
                  {allCatBulkDeleting
                    ? '⟳ Tüm geçmiş seanslar siliniyor…'
                    : allCatBulkConfirm
                      ? `⚠️ Emin misin? Tüm kategorilerde ${totalPast} geçmiş seans silinecek`
                      : `🗑 Tüm Kategorilerdeki Geçmiş Seansları Sil (${totalPast})`}
                </button>
              </div>
            );
          })()}

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
                          padding:'5px 10px',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer',
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
                    : getIdeasoftForCat(selectedCat).map((s, idx, arr)=>{
                        const editing  = stockEdits[s.seanceId]!==undefined && stockEdits[s.seanceId]!=='';
                        const updating = stockUpdating[s.seanceId];
                        const msg      = stockMsg[s.seanceId];
                        const isLast   = idx === arr.length - 1;
                        return (
                          <div key={s.seanceId||s.productId}>
                            {/* ── Seans kartı ── */}
                            <div style={{
                              padding:'16px 16px 14px',
                              background: idx % 2 === 0 ? '#0d1120' : '#0a0e1a',
                            }}>
                              {/* Seans adı */}
                              <div style={{fontSize:13,color:'#94a3b8',fontWeight:600,marginBottom:10,lineHeight:1.4}}>
                                📅 {s.fullName.replace('Farabi Sokak: Sosyal Sanathane - ','').replace('Tunalı: Ara Sokak Pub - ','')}
                              </div>

                              {/* Badge satırı + toggle */}
                              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12,flexWrap:'wrap'}}>
                                <SBadge label="Mevcut"    value={s.stockAmount??'—'} color="#4fc9ff"/>
                                {s.soldCount!=null   && <SBadge label="Satılan"    value={s.soldCount}    color="#ff9f4a"/>}
                                {s.baselineStock!=null && <SBadge label="Başlangıç" value={s.baselineStock} color="#475569"/>}
                                {s.seanceId && (
                                  <div
                                    onClick={()=>!toggling[s.seanceId]&&handleToggleSeance(s.seanceId, s.status===1)}
                                    style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6,
                                      cursor:toggling[s.seanceId]?'wait':'pointer',
                                      opacity:toggling[s.seanceId]?0.6:1,flexShrink:0}}>
                                    <span style={{fontSize:10,fontWeight:700,letterSpacing:1,
                                      color:s.status===1?'#22c55e':'#64748b',textTransform:'uppercase'}}>
                                      {s.status===1?'AÇIK':'KAPALI'}
                                    </span>
                                    <div style={{width:44,height:24,borderRadius:12,
                                      background:s.status===1?'#22c55e':'#3a3a3a',
                                      position:'relative',transition:'background 0.25s',flexShrink:0}}>
                                      <div style={{position:'absolute',top:3,
                                        left:s.status===1?23:3,
                                        width:18,height:18,borderRadius:'50%',background:'#fff',
                                        boxShadow:'0 1px 4px rgba(0,0,0,0.3)',transition:'left 0.25s'}}/>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Stok güncelle + Mail At + Sil — yatay grid */}
                              {s.seanceId && (
                                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                                  {/* Stok input + güncelle */}
                                  <div style={{display:'flex',gap:7}}>
                                    <input style={{...S.stockInputFull,flex:1,marginBottom:0}}
                                      type="number" min="0" placeholder="Yeni stok"
                                      value={stockEdits[s.seanceId]??''}
                                      onChange={e=>setStockEdits(p=>({...p,[s.seanceId]:e.target.value}))}/>
                                    <button style={{...S.updateBtnFull,...(editing&&!updating?S.updateBtnOn:{}),
                                      flex:'0 0 110px',padding:'9px 0'}}
                                      disabled={!editing||updating}
                                      onClick={()=>handleStockUpdate(s.seanceId, s.soldCount)}>
                                      {updating?'⟳ …':'Güncelle'}
                                    </button>
                                  </div>
                                  {msg && <span style={{fontSize:12,fontWeight:600,color:msg==='✓'?'#4ade80':'#f87171'}}>{msg}</span>}

                                  {/* Mail At + Sil — yan yana */}
                                  <div style={{display:'flex',gap:7}}>
                                    <button
                                      onClick={()=>openStockMail(s)}
                                      style={{flex:1,padding:'9px 0',borderRadius:8,fontSize:13,fontWeight:700,
                                        cursor:'pointer',border:'none',
                                        background:'linear-gradient(135deg,#1a3a2a,#0d2a1a)',
                                        color:'#22c55e',
                                        border:'1px solid #22c55e44',
                                        transition:'all 0.15s'}}>
                                      ✉️ Mail At
                                    </button>
                                    <button
                                      disabled={deleting[s.seanceId]}
                                      onClick={()=>handleDeleteOption(s.seanceId)}
                                      style={{flex:1,padding:'9px 0',borderRadius:8,fontSize:13,fontWeight:700,
                                        cursor:'pointer',border:'none',
                                        background: deleteConfirm[s.seanceId] ? '#3f0f0f' : '#111827',
                                        color: deleteConfirm[s.seanceId] ? '#ff4444' : '#475569',
                                        border: deleteConfirm[s.seanceId] ? '1px solid #7f1d1d' : '1px solid #1e293b',
                                        opacity: deleting[s.seanceId] ? 0.5 : 1,
                                        transition:'all 0.2s'}}>
                                      {deleting[s.seanceId] ? '⟳ …' : deleteConfirm[s.seanceId] ? '⚠️ Emin misin?' : '🗑 Sil'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* ── Seanslar arası ayırıcı ── */}
                            {!isLast && (
                              <div style={{height:1,background:'linear-gradient(90deg,transparent,#1e3a5f88,transparent)',margin:'0 12px'}}/>
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
        </div>
      </div>
    );
  }


  // ─── QUIZ NIGHT EKRANI ─────────────────────────────────────────────────────
  // quiznight rolü veya quiz modu → quiz ekranını göster
  if (mode === 'quiz' || role === 'quiznight') {
    const ev = QUIZ_EVENTS[quizEventType];
    const totalQ = ev ? ev.totalQ : 0;

    // ── ROL SEÇİM EKRANI ──────────────────────────────────────────────────────
    if (!quizRole) {
      return (
        <div style={S.page}>
          <div style={S.header}>
            <div style={S.headerLeft}>
              <button style={{...S.smallBtn, marginRight:4}} onClick={() => {
                if (role === 'quiznight') {
                  // quiznight rolünden çıkış — tam logout
                  setLoggedIn(false); setRole(null); setRoleScreen(false);
                  setQuizNightMode(false); setQuizRole(null); setMode(null);
                } else {
                  setMode(null); setQuizNightMode(false);
                }
              }}>← Geri</button>
              <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>🏆 QUIZ NIGHT</span>
            </div>
          </div>
          <div style={{maxWidth:480,margin:'0 auto',padding:'24px 18px'}}>

            {/* ── KOMBINE DOSYA YÜKLEME (EN ÜSTTE) ─────────────────────────── */}
            <div style={{background:'#0d1120',border:'1px solid #1a2035',borderRadius:16,padding:'18px 20px',marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:700,color:'#4fc9ff',textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>
                📁 Soru &amp; Cevap Dosyası
              </div>
              <div style={{fontSize:11,color:'#475569',marginBottom:12,lineHeight:1.6}}>
                Hem soruları hem cevapları içeren dosyayı yükleyin.<br/>
                Sunucu için sorular, puantör için cevaplar otomatik ayrılır.
              </div>
              <label style={{
                display:'flex',alignItems:'center',gap:12,padding:'12px 16px',
                borderRadius:12,border:'2px dashed ' + (quizCombinedFile ? '#22c55e' : '#1a2035'),
                cursor:'pointer',background:'#0a0e1a',transition:'all 0.2s'
              }}
                onMouseOver={e=>{e.currentTarget.style.borderColor=quizCombinedFile?'#22c55e':'#4fc9ff';}}
                onMouseOut={e=>{e.currentTarget.style.borderColor=quizCombinedFile?'#22c55e':'#1a2035';}}>
                <span style={{fontSize:24}}>{quizCombinedFile ? '✅' : '📂'}</span>
                <div style={{flex:1}}>
                  {quizCombinedLoading
                    ? <span style={{fontSize:13,color:'#4fc9ff',fontWeight:700}}>⟳ Dosya işleniyor…</span>
                    : quizCombinedFile
                      ? <span style={{fontSize:12,color:'#22c55e',fontWeight:700}}>{quizCombinedFile}</span>
                      : <span style={{fontSize:12,color:'#475569'}}>Dosya seç (.docx veya .txt)</span>
                  }
                </div>
                <input type="file" accept=".txt,.docx" style={{display:'none'}}
                  onChange={e => { if(e.target.files[0]) handleCombinedFileUpload(e.target.files[0]); }} />
              </label>
              {quizCombinedError && (
                <div style={{fontSize:11,color:'#f87171',marginTop:8}}>❌ {quizCombinedError}</div>
              )}
              {quizCombinedFile && (
                <button onClick={() => {
                  setQuizCombinedFile(null); setQuizAnswers({}); setQuizAnswerFile(null);
                  setQuizQuestions({}); setQuizQFile(null); setQuizCombinedError('');
                }}
                  style={{marginTop:8,padding:'5px 14px',borderRadius:8,border:'1px solid #1a2035',
                    background:'transparent',color:'#64748b',fontSize:11,cursor:'pointer'}}>
                  × Dosyayı kaldır
                </button>
              )}
            </div>

            <div style={{textAlign:'center',marginBottom:24}}>
              <div style={{fontSize:52,marginBottom:10}}>🏆</div>
              <div style={{fontSize:22,fontWeight:800,color:'#fff',marginBottom:6}}>Quiz Night</div>
              <div style={{fontSize:14,color:'#475569'}}>Rolünüzü seçin</div>
            </div>
            {/* Sunucu kartı */}
            <button
              onClick={() => setQuizRole('host')}
              style={{
                width:'100%',display:'flex',alignItems:'center',gap:18,
                padding:'24px 22px',borderRadius:18,border:'1px solid #1a2035',
                cursor:'pointer',textAlign:'left',background:'#0d1120',
                marginBottom:14,transition:'all 0.2s'
              }}
              onMouseOver={e=>{e.currentTarget.style.borderColor='#b47cff';e.currentTarget.style.background='#0e0a1a';}}
              onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.background='#0d1120';}}>
              <div style={{width:56,height:56,borderRadius:14,background:'linear-gradient(135deg,#b47cff22,#7c3aff22)',
                border:'1px solid #b47cff44',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{fontSize:28}}>🎤</span>
              </div>
              <div>
                <div style={{fontSize:17,fontWeight:800,color:'#b47cff',marginBottom:4}}>Sunucu</div>
                <div style={{fontSize:12,color:'#64748b',lineHeight:1.5}}>
                  Soruları ekranda göster.<br/>
                  {quizQuestions && Object.keys(quizQuestions).length > 0
                    ? <span style={{color:'#22c55e',fontWeight:700}}>✓ {Object.keys(quizQuestions).length} soru yüklendi</span>
                    : 'Dosya yüklendikten sonra sorular görünür.'
                  }
                </div>
              </div>
            </button>
            {/* Puantör kartı */}
            <button
              onClick={() => setQuizRole('scorer')}
              style={{
                width:'100%',display:'flex',alignItems:'center',gap:18,
                padding:'24px 22px',borderRadius:18,border:'1px solid #1a2035',
                cursor:'pointer',textAlign:'left',background:'#0d1120',
                marginBottom:14,transition:'all 0.2s'
              }}
              onMouseOver={e=>{e.currentTarget.style.borderColor='#fbbf24';e.currentTarget.style.background='#12100a';}}
              onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.background='#0d1120';}}>
              <div style={{width:56,height:56,borderRadius:14,background:'linear-gradient(135deg,#fbbf2422,#f59e0b22)',
                border:'1px solid #fbbf2444',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{fontSize:28}}>📊</span>
              </div>
              <div>
                <div style={{fontSize:17,fontWeight:800,color:'#fbbf24',marginBottom:4}}>Puantör</div>
                <div style={{fontSize:12,color:'#64748b',lineHeight:1.5}}>
                  Grupların cevaplarını işaretle ve<br/>
                  anlık puan tablosunu takip et.
                </div>
              </div>
            </button>
          </div>
        </div>
      );
    }

    // ── SUNUCU MODU ───────────────────────────────────────────────────────────
    if (quizRole === 'host') {
      const totalQCount = Object.keys(quizQuestions).length;
      const currentQ = quizQuestions[quizHostQ];
      const hasQuestions = totalQCount > 0;

      // Soru yok → dosya yükleme ekranı
      if (!hasQuestions) {
        return (
          <div style={S.page}>
            <div style={S.header}>
              <div style={S.headerLeft}>
                <button style={{...S.smallBtn, marginRight:4}} onClick={() => setQuizRole(null)}>← Geri</button>
                <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>🎤 SUNUCU</span>
              </div>
            </div>
            <div style={{maxWidth:480,margin:'0 auto',padding:'32px 18px'}}>
              <div style={{textAlign:'center',marginBottom:32}}>
                <div style={{fontSize:44,marginBottom:10}}>📄</div>
                <div style={{fontSize:18,fontWeight:800,color:'#fff',marginBottom:6}}>Soru Dosyası Yükle</div>
                <div style={{fontSize:12,color:'#64748b',lineHeight:1.6}}>
                  .docx veya .txt formatında soru dosyası yükleyin.<br/>
                  Format: <span style={{color:'#4fc9ff',fontWeight:700}}>Soru1 bla bla</span> ardından <span style={{color:'#22c55e',fontWeight:700}}>Cevap: bla bla</span>
                </div>
              </div>
              <label style={{
                display:'flex',flexDirection:'column',alignItems:'center',gap:14,
                padding:'32px 24px',borderRadius:16,border:'2px dashed #1a2035',
                cursor:'pointer',background:'#0a0e1a',transition:'all 0.2s',marginBottom:16
              }}
                onMouseOver={e=>{e.currentTarget.style.borderColor='#b47cff';}}
                onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';}}>
                <span style={{fontSize:36}}>📂</span>
                {quizQLoading
                  ? <span style={{fontSize:14,color:'#b47cff',fontWeight:700}}>⟳ Okunuyor…</span>
                  : <span style={{fontSize:14,color:'#475569'}}>Dosya seç (.docx veya .txt)</span>
                }
                <input type="file" accept=".txt,.docx" style={{display:'none'}}
                  onChange={e => { if(e.target.files[0]) handleQuestionFileUpload(e.target.files[0]); }} />
              </label>
              {quizQError && (
                <div style={{background:'#1f0f0f',border:'1px solid #7f1d1d',borderRadius:10,
                  padding:'10px 14px',color:'#fca5a5',fontSize:13,marginBottom:12}}>
                  ❌ {quizQError}
                </div>
              )}
            </div>
          </div>
        );
      }

      // Sorular yüklendi → soru gösterim ekranı
      // Bölüm bilgisi
      const sectionName = currentQ?.section || '';
      const progressPct = Math.round((quizHostQ / totalQCount) * 100);

      return (
        <div style={S.page}>
          <div style={S.header}>
            <div style={S.headerLeft}>
              <button style={{...S.smallBtn, marginRight:4}} onClick={() => setQuizRole(null)}>← Geri</button>
              <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>🎤 SUNUCU</span>
            </div>
            <div style={S.headerRight}>
              <button
                onClick={() => { setQuizQFile(null); setQuizQuestions({}); setQuizHostQ(1); }}
                style={{...S.smallBtn, color:'#f87171', borderColor:'#7f1d1d22'}}>
                🗑 Dosyayı Değiştir
              </button>
            </div>
          </div>

          <div style={{maxWidth:560,margin:'0 auto',padding:'16px 18px'}}>
            {/* Progress */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <span style={{fontSize:11,color:'#475569'}}>{quizQFile}</span>
              <span style={{fontSize:11,color:'#475569'}}>{quizHostQ} / {totalQCount}</span>
            </div>
            <div style={{background:'#1a2035',borderRadius:6,height:5,marginBottom:20,overflow:'hidden'}}>
              <div style={{height:'100%',background:'linear-gradient(90deg,#b47cff,#7c3aff)',
                width:progressPct+'%',borderRadius:6,transition:'width 0.3s'}}/>
            </div>

            {/* Bölüm etiketi */}
            {sectionName && (
              <div style={{display:'inline-flex',alignItems:'center',gap:6,
                background:'#1a0a2a',border:'1px solid #b47cff44',borderRadius:8,
                padding:'4px 12px',marginBottom:14}}>
                <span style={{fontSize:11,fontWeight:700,color:'#b47cff',textTransform:'uppercase',letterSpacing:1}}>
                  📌 {sectionName}
                </span>
              </div>
            )}

            {/* Soru kartı */}
            <div style={{background:'#0d1120',border:'1px solid #1a2035',borderRadius:18,
              padding:'24px 22px',marginBottom:16,position:'relative'}}>
              {/* Soru numarası rozeti */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                <div style={{background:'#b47cff22',border:'1px solid #b47cff44',borderRadius:10,padding:'5px 14px'}}>
                  <span style={{fontSize:13,fontWeight:800,color:'#b47cff'}}>Soru {quizHostQ}</span>
                </div>
              </div>

              {/* Soru metni */}
              <div style={{fontSize:16,fontWeight:700,color:'#e2e8f0',lineHeight:1.65,marginBottom:0}}>
                {currentQ?.question || '—'}
              </div>
            </div>

            {/* Cevap kartı — ayrı, tıklanabilir reveal */}
            <HostAnswerCard answer={currentQ?.answer} />

            {/* Navigasyon */}
            <div style={{display:'flex',gap:10,marginTop:16}}>
              <button
                onClick={() => setQuizHostQ(q => Math.max(1, q-1))}
                disabled={quizHostQ <= 1}
                style={{flex:1,padding:'14px',borderRadius:12,border:'1px solid #1a2035',cursor:'pointer',
                  background:'#0d1120',color:quizHostQ<=1?'#1a2035':'#94a3b8',fontWeight:700,fontSize:14}}>
                ← Önceki
              </button>
              <button
                onClick={() => setQuizHostQ(q => Math.min(totalQCount, q+1))}
                disabled={quizHostQ >= totalQCount}
                style={{flex:2,padding:'14px',borderRadius:12,border:'none',cursor:'pointer',fontWeight:800,fontSize:14,
                  background: quizHostQ >= totalQCount
                    ? '#111827'
                    : 'linear-gradient(135deg,#b47cff,#7c3aff)',
                  color: quizHostQ >= totalQCount ? '#374151' : '#fff'}}>
                {quizHostQ >= totalQCount ? '✅ Son Soru' : 'Sonraki →'}
              </button>
            </div>

            {/* Tüm sorulara hızlı erişim */}
            <div style={{marginTop:20}}>
              <div style={{fontSize:11,color:'#374151',fontWeight:700,letterSpacing:1,
                textTransform:'uppercase',marginBottom:8}}>Tüm Sorular</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {Object.keys(quizQuestions).map(n => {
                  const no = parseInt(n);
                  const isActive = no === quizHostQ;
                  return (
                    <button key={no} onClick={() => setQuizHostQ(no)}
                      style={{
                        width:36,height:36,borderRadius:8,border:'1px solid',
                        fontSize:12,fontWeight:800,cursor:'pointer',flexShrink:0,
                        background: isActive ? '#b47cff' : '#0d1120',
                        color: isActive ? '#fff' : '#475569',
                        borderColor: isActive ? '#b47cff' : '#1a2035',
                        transition:'all 0.15s'
                      }}>
                      {no}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Etkinlik seçim ekranı
    if (quizStep === 'select') {
      return (
        <div style={S.page}>
          <div style={S.header}>
            <div style={S.headerLeft}>
              <button style={{...S.smallBtn, marginRight:4}} onClick={() => { setQuizRole(null); }}>← Geri</button>
              <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>📊 PUANTÖR</span>
            </div>
          </div>
          <div style={{maxWidth:480,margin:'0 auto',padding:'32px 18px'}}>
            <div style={{textAlign:'center',marginBottom:32}}>
              <div style={{fontSize:48,marginBottom:8}}>🏆</div>
              <div style={{fontSize:20,fontWeight:800,color:'#fff',marginBottom:4}}>Quiz Night</div>
              <div style={{fontSize:13,color:'#475569'}}>Etkinlik türünü seçin</div>
            </div>
            {Object.entries(QUIZ_EVENTS).map(([key, evt]) => (
              <button key={key}
                onClick={() => { setQuizEventType(key); setQuizGroups([{no:'1',name:''},{no:'2',name:''}]); setQuizStep('groups'); setQuizScores({}); setQuizMyGroups([]); setQuizCurrentQ(1); }}
                style={{
                  width:'100%',display:'flex',alignItems:'center',gap:16,
                  padding:'22px 24px',borderRadius:16,border:'1px solid #1a2035',
                  cursor:'pointer',textAlign:'left',background:'#0d1120',
                  marginBottom:14,transition:'all 0.2s'
                }}
                onMouseOver={e=>{e.currentTarget.style.borderColor='#fbbf24';e.currentTarget.style.background='#12100a';}}
                onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.background='#0d1120';}}>
                <span style={{fontSize:40}}>{evt.icon}</span>
                <div>
                  <div style={{fontSize:17,fontWeight:800,color:'#fff',marginBottom:4}}>{evt.label}</div>
                  <div style={{fontSize:12,color:'#64748b'}}>
                    {key === 'genelkultur'
                      ? `${evt.totalQ} soru · Her soru ${evt.pointPerQ} puan · Toplam ${evt.totalQ * evt.pointPerQ} puan`
                      : `${evt.totalQ} soru · 1-10: 10pt  11-20: 20pt  21-30: 30pt  31-40: 40pt · Toplam 1000 puan`
                    }
                  </div>
                </div>
              </button>
            ))}
            {quizData && (
              <div style={{marginTop:8,padding:'14px 18px',background:'#0a1a0a',border:'1px solid #22c55e33',borderRadius:12}}>
                <div style={{fontSize:12,color:'#22c55e',fontWeight:700,marginBottom:8}}>✓ Kayıtlı etkinlik mevcut</div>
                <div style={{fontSize:12,color:'#64748b',marginBottom:10}}>
                  {QUIZ_EVENTS[quizData.eventType]?.label} · {quizData.groups?.length || 0} grup
                </div>
                <button
                  onClick={() => { setQuizEventType(quizData.eventType); setQuizGroups(quizData.groups||[]); setQuizScores(quizData.scores||{}); setQuizMyGroups(quizData.myGroups||[]); setQuizCurrentQ(quizData.currentQ||1); setQuizGroupCountSet(true); setQuizGroupCount(String((quizData.groups||[]).length)); setQuizStep('groups'); }}
                  style={{width:'100%',padding:'10px',borderRadius:10,border:'none',cursor:'pointer',
                    background:'linear-gradient(135deg,#22c55e,#16a34a)',color:'#fff',fontWeight:700,fontSize:13,marginBottom:8}}>
                  Devam Et →
                </button>
                <button
                  onClick={() => setQuizDeleteConfirm(true)}
                  style={{width:'100%',padding:'9px',borderRadius:10,border:'1px solid #7f1d1d',cursor:'pointer',
                    background:'#1f0f0f',color:'#f87171',fontWeight:600,fontSize:12}}>
                  {quizDeleteConfirm ? '⚠️ Emin misin? Tekrar bas' : '🗑 Etkinliği Sil'}
                </button>
                {quizDeleteConfirm && (
                  <button onClick={deleteQuizData}
                    style={{width:'100%',marginTop:6,padding:'9px',borderRadius:10,border:'none',cursor:'pointer',
                      background:'#7f1d1d',color:'#fca5a5',fontWeight:700,fontSize:12}}>
                    ✗ Evet, Sil
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Grup ayarlama ekranı
    if (quizStep === 'groups') {
      const updateGroup = (idx, field, val) => {
        const updated = quizGroups.map((g,i)=>i===idx?{...g,[field]:val}:g);
        setQuizGroups(updated);
        // Anlık kaydet — diğer puantörler görsün
        const data = { eventType: quizEventType, groups: updated, scores: quizScores, myGroups: quizMyGroups };
        saveQuizData(data);
      };
      const toggleMyGroup = (no) => {
        setQuizMyGroups(prev => prev.includes(no) ? prev.filter(n=>n!==no) : [...prev, no]);
      };

      const handleStart = () => {
        const newScores = {...quizScores};
        quizGroups.forEach(g => {
          if (!newScores[g.no]) newScores[g.no] = {};
        });
        setQuizScores(newScores);
        const data = { eventType: quizEventType, groups: quizGroups, scores: newScores, myGroups: quizMyGroups };
        setQuizData(data);
        saveQuizData(data);
        setQuizCurrentQ(1);
        setQuizStep('scoring');
      };

      // Grup sayısı henüz belirlenmedi
      if (!quizGroupCountSet && !quizData) {
        const cnt = parseInt(quizGroupCount);
        const isValid = cnt >= 1 && cnt <= 50;
        return (
          <div style={S.page}>
            <div style={S.header}>
              <div style={S.headerLeft}>
                <button style={{...S.smallBtn, marginRight:4}} onClick={() => setQuizStep('select')}>← Geri</button>
                <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>{ev?.icon} {ev?.label}</span>
              </div>
            </div>
            <div style={{maxWidth:480,margin:'0 auto',padding:'40px 18px',textAlign:'center'}}>
              <div style={{fontSize:48,marginBottom:12}}>👥</div>
              <div style={{fontSize:20,fontWeight:800,color:'#fff',marginBottom:6}}>Kaç grup katılıyor?</div>
              <div style={{fontSize:13,color:'#475569',marginBottom:28}}>Grup sayısını girin, sonra her grubun adını girebilirsiniz.</div>
              <input
                type="number" min="1" max="50"
                value={quizGroupCount}
                onChange={e => setQuizGroupCount(e.target.value)}
                placeholder="Örn: 8"
                style={{...S.input, fontSize:28, padding:'18px', textAlign:'center', marginBottom:20, maxWidth:200, margin:'0 auto 20px'}}
              />
              <br/>
              <button
                onClick={() => {
                  const n = parseInt(quizGroupCount);
                  if (isValid) {
                    const groups = Array.from({length:n}, (_,i) => ({no: String(i+1), name:''}));
                    setQuizGroups(groups);
                    setQuizGroupCountSet(true);
                  }
                }}
                disabled={!isValid}
                style={{padding:'15px 40px',borderRadius:12,border:'none',cursor:isValid?'pointer':'default',fontWeight:800,fontSize:16,
                  background: isValid ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : '#111827',
                  color: isValid ? '#000' : '#374151'}}>
                Grupları Oluştur →
              </button>
            </div>
          </div>
        );
      }

      // Gruplar oluşturuldu — slot seçimi + isim girişi
      // Polling: her 3 saniyede sunucudan grup verilerini al
      return (
        <div style={S.page}>
          <div style={S.header}>
            <div style={S.headerLeft}>
              <button style={{...S.smallBtn, marginRight:4}} onClick={() => {
                if (!quizData) { setQuizGroupCountSet(false); }
                else { setQuizStep('select'); }
              }}>← Geri</button>
              <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>{ev?.icon} {ev?.label}</span>
            </div>
            <div style={S.headerRight}>
              <span style={{fontSize:10,color:'#22c55e'}}>🔄 Canlı</span>
            </div>
          </div>
          <div style={{maxWidth:480,margin:'0 auto',padding:'20px 18px'}}>
            <div style={{fontSize:13,fontWeight:700,color:'#94a3b8',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>
              Gruplar · {quizGroups.length} grup
            </div>
            <div style={{fontSize:11,color:'#475569',marginBottom:16}}>
              Bir slotu seçerek o gruba bakacağınızı belirtin. Seçili slotlar kilitlenir.
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:20}}>
              {quizGroups.map((g, idx) => {
                const isMine = quizMyGroups.includes(g.no);
                return (
                  <div key={idx} style={{
                    background: isMine ? '#12100a' : '#0d1120',
                    border: '2px solid ' + (isMine ? '#fbbf24' : '#1a2035'),
                    borderRadius:12, padding:'12px 14px',
                    display:'flex', alignItems:'center', gap:10, transition:'all 0.2s'
                  }}>
                    {/* Slot numarası / kilit butonu */}
                    <button
                      onClick={() => toggleMyGroup(g.no)}
                      style={{
                        width:42,height:42,borderRadius:10,border:'2px solid',flexShrink:0,
                        cursor:'pointer',fontSize:16,fontWeight:800,
                        background: isMine ? '#fbbf24' : '#111827',
                        color: isMine ? '#000' : '#475569',
                        borderColor: isMine ? '#fbbf24' : '#374151',
                        transition:'all 0.15s'
                      }}>
                      {isMine ? '✓' : g.no}
                    </button>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,color: isMine ? '#fbbf24' : '#475569',fontWeight:700,marginBottom:3}}>
                        {isMine ? '🔒 Sizin Slotunuz' : `Grup ${g.no}`}
                      </div>
                      <input
                        value={g.name}
                        onChange={e => updateGroup(idx,'name',e.target.value)}
                        placeholder={`Grup ${g.no} adı (opsiyonel)`}
                        style={{...S.input, marginBottom:0, padding:'6px 10px', fontSize:13,
                          background: isMine ? '#1a1000' : '#07090f',
                          border: '1px solid ' + (isMine ? '#fbbf2444' : '#1a2035')}}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{background:'#0a1a0a',border:'1px solid #22c55e22',borderRadius:10,padding:'10px 14px',marginBottom:16}}>
              <div style={{fontSize:11,color:'#22c55e',fontWeight:700,marginBottom:4}}>✓ Seçili Slotlarınız</div>
              <div style={{fontSize:12,color:'#64748b'}}>
                {quizMyGroups.length === 0
                  ? 'Henüz slot seçmediniz. Yukarıdan bir grup numarasına tıklayın.'
                  : quizMyGroups.map(no => {
                    const g = quizGroups.find(x=>x.no===no);
                    return `Grup ${no}${g?.name ? ' · ' + g.name : ''}`;
                  }).join(' / ')
                }
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={quizGroups.length === 0 || quizMyGroups.length === 0}
              style={{width:'100%',padding:'15px',borderRadius:12,border:'none',cursor:'pointer',fontWeight:800,fontSize:15,
                background: (quizGroups.length > 0 && quizMyGroups.length > 0)
                  ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : '#111827',
                color: (quizGroups.length > 0 && quizMyGroups.length > 0) ? '#000' : '#374151',
                marginBottom:10
              }}>
              Puanlamayı Başlat →
            </button>
            <button
              onClick={() => { setQuizStep('results'); }}
              style={{width:'100%',padding:'11px',borderRadius:10,border:'1px solid #1a2035',cursor:'pointer',
                background:'#0d1120',color:'#94a3b8',fontSize:13,fontWeight:600}}>
              📊 Sonuçları Gör
            </button>
          </div>
        </div>
      );
    }

    // Puanlama ekranı
    if (quizStep === 'scoring') {
      const myGroupObjs = quizGroups.filter(g => quizMyGroups.includes(g.no));
      const qPoint = getQuizPoint(quizEventType, quizCurrentQ);

      const toggleAnswer = (groupNo) => {
        setQuizScores(prev => {
          const gs = prev[groupNo] || {};
          const newGs = {...gs, [quizCurrentQ]: !gs[quizCurrentQ]};
          const newScores = {...prev, [groupNo]: newGs};
          quizScoresRef.current = newScores;
          return newScores;
        });
      };

      const goNext = () => {
        // Sonraki'ye basınca kaydet
        const latestScores = quizScoresRef.current;
        const nextQ = quizCurrentQ < totalQ ? quizCurrentQ + 1 : quizCurrentQ;
        const data = { eventType: quizEventType, groups: quizGroups, scores: latestScores, myGroups: quizMyGroups, currentQ: nextQ };
        setQuizData(data);
        saveQuizData(data);
        if (quizCurrentQ < totalQ) setQuizCurrentQ(q => q + 1);
        else setQuizStep('results');
      };
      const goPrev = () => {
        if (quizCurrentQ > 1) setQuizCurrentQ(q => q - 1);
      };

      const progressPct = Math.round((quizCurrentQ / totalQ) * 100);
      const currentQuestion = quizQuestions[quizCurrentQ];

      return (
        <div style={S.page}>
          <div style={S.header}>
            <div style={S.headerLeft}>
              <button style={{...S.smallBtn, marginRight:4}} onClick={() => setQuizStep('groups')}>← Geri</button>
              <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>🎯 PUANLAMA</span>
            </div>
            <div style={S.headerRight}>
              {quizSaving && <span style={{fontSize:10,color:'#22c55e'}}>⟳ Kaydediliyor</span>}
              <button onClick={() => setQuizStep('results')}
                style={{...S.smallBtn,color:'#fbbf24',borderColor:'#fbbf2444'}}>📊 Sonuçlar</button>
            </div>
          </div>

          <div style={{maxWidth:480,margin:'0 auto',padding:'16px 18px'}}>
            {/* Progress bar */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <span style={{fontSize:11,color:'#475569'}}>{ev?.label}</span>
              <span style={{fontSize:11,color:'#475569'}}>{quizCurrentQ} / {totalQ}</span>
            </div>
            <div style={{background:'#1a2035',borderRadius:6,height:6,marginBottom:16,overflow:'hidden'}}>
              <div style={{height:'100%',background:'linear-gradient(90deg,#fbbf24,#f59e0b)',
                width:progressPct+'%',borderRadius:6,transition:'width 0.3s'}}/>
            </div>

            {/* Soru kartı */}
            <div style={{background:'#0d1120',border:'1px solid #1a2035',borderRadius:16,padding:'16px 18px 14px',marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{background:'#fbbf2422',border:'1px solid #fbbf2444',borderRadius:8,padding:'4px 12px'}}>
                  <span style={{fontSize:12,fontWeight:800,color:'#fbbf24'}}>Soru {quizCurrentQ}</span>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  {/* Soruyu Göster butonu */}
                  {currentQuestion && (
                    <button
                      onClick={() => setQuizShowQuestion(q => !q)}
                      style={{background:'#1a0a2e',border:'1px solid #b47cff44',borderRadius:8,padding:'4px 10px',
                        color:'#b47cff',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                      {quizShowQuestion ? '🙈 Soruyu Gizle' : '👁 Soruyu Göster'}
                    </button>
                  )}
                  <div style={{background:'#b47cff22',border:'1px solid #b47cff44',borderRadius:8,padding:'4px 12px'}}>
                    <span style={{fontSize:12,fontWeight:800,color:'#b47cff'}}>{qPoint} puan</span>
                  </div>
                </div>
              </div>

              {/* Soru metni (göster butonuna basılınca açılır) */}
              {quizShowQuestion && currentQuestion && (
                <div style={{background:'#0a0e1a',border:'1px solid #b47cff33',borderRadius:10,
                  padding:'12px 14px',marginBottom:12}}>
                  <div style={{fontSize:11,color:'#b47cff',fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:1}}>Soru</div>
                  <div style={{fontSize:14,color:'#e2e8f0',lineHeight:1.6,fontWeight:600}}>{currentQuestion.question}</div>
                </div>
              )}

              {quizAnswers[quizCurrentQ] && (
                <div style={{background:'#0a1a2e',border:'1px solid #0ea5e933',borderRadius:10,
                  padding:'10px 14px',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:13,color:'#4fc9ff',fontWeight:800,flexShrink:0}}>Cevap:</span>
                  <span style={{fontSize:14,color:'#e2e8f0',fontWeight:700}}>{quizAnswers[quizCurrentQ]}</span>
                </div>
              )}

              {/* Grup kutucukları */}
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {myGroupObjs.map(g => {
                  const correct = !!(quizScores[g.no]?.[quizCurrentQ]);
                  return (
                    <button key={g.no} onClick={() => toggleAnswer(g.no)}
                      style={{
                        display:'flex',alignItems:'center',justifyContent:'space-between',
                        padding:'14px 16px',borderRadius:12,border:'2px solid',cursor:'pointer',
                        background: correct ? '#0a1a0a' : '#0a0e1a',
                        borderColor: correct ? '#22c55e' : '#1a2035',
                        transition:'all 0.15s'
                      }}>
                      <span style={{fontSize:14,fontWeight:700,color: correct ? '#22c55e' : '#64748b'}}>
                        {g.no} No'lu Grup{g.name ? ` · ${g.name}` : ''}
                      </span>
                      <div style={{
                        width:28,height:28,borderRadius:6,border:'2px solid',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        background: correct ? '#22c55e' : 'transparent',
                        borderColor: correct ? '#22c55e' : '#374151',
                        transition:'all 0.15s',flexShrink:0
                      }}>
                        {correct && <span style={{fontSize:16,color:'#fff',fontWeight:900}}>✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kaydediliyor göstergesi */}
            {quizSaving && (
              <div style={{textAlign:'center',marginBottom:8}}>
                <span style={{fontSize:11,color:'#22c55e',fontWeight:600}}>⟳ Kaydediliyor…</span>
              </div>
            )}

            {/* Navigasyon */}
            <div style={{display:'flex',gap:10}}>
              <button onClick={goPrev} disabled={quizCurrentQ === 1}
                style={{flex:1,padding:'13px',borderRadius:12,border:'1px solid #1a2035',cursor:'pointer',
                  background:'#0d1120',color: quizCurrentQ===1 ? '#1a2035' : '#94a3b8',fontWeight:700,fontSize:14}}>
                ← Önceki
              </button>
              <button onClick={goNext}
                style={{flex:2,padding:'13px',borderRadius:12,border:'none',cursor:'pointer',fontWeight:800,fontSize:14,
                  background: quizCurrentQ === totalQ
                    ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                    : 'linear-gradient(135deg,#fbbf24,#f59e0b)',
                  color: '#000'}}>
                {quizCurrentQ === totalQ ? '🏁 Bitir' : 'Sonraki →'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Sonuçlar ekranı
    if (quizStep === 'results') {
      // quizLiveScores/quizLiveGroups top-level state'ten gelir (hooks if içinde olmaz)
      const displayScores = Object.keys(quizLiveScores).length > 0 ? quizLiveScores : quizScores;
      const displayGroups = quizLiveGroups.length > 0 ? quizLiveGroups : quizGroups;

      // Tüm grupların toplam puanını hesapla
      const allGroupScores = displayGroups.map(g => ({
        ...g,
        score: calcGroupScore(g.no, quizEventType, displayScores)
      })).sort((a, b) => b.score - a.score);

      const maxScore = allGroupScores.length > 0 ? allGroupScores[0].score : 0;
      const medals = ['🥇','🥈','🥉'];

      return (
        <div style={S.page}>
          <div style={S.header}>
            <div style={S.headerLeft}>
              <button style={{...S.smallBtn, marginRight:4}} onClick={() => setQuizStep(quizData ? 'groups' : 'select')}>← Geri</button>
              <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>📊 SONUÇLAR</span>
            </div>
            <div style={S.headerRight}>
              {quizResultsLoading && <span style={{fontSize:11,color:'#4fc9ff'}}>⟳ Yükleniyor…</span>}
              <button onClick={() => setQuizDeleteConfirm(true)}
                style={{...S.smallBtn,color:'#f87171',borderColor:'#7f1d1d22'}}>🗑 Sıfırla</button>
            </div>
          </div>

          {quizDeleteConfirm && (
            <div style={{maxWidth:480,margin:'0 auto',padding:'12px 18px 0'}}>
              <div style={{background:'#1f0f0f',border:'1px solid #7f1d1d',borderRadius:12,padding:'14px 18px'}}>
                <div style={{fontSize:13,color:'#fca5a5',fontWeight:700,marginBottom:10}}>
                  ⚠️ Tüm quiz verileri silinecek. Emin misin?
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={() => setQuizDeleteConfirm(false)}
                    style={{flex:1,padding:'9px',borderRadius:8,border:'1px solid #1a2035',cursor:'pointer',
                      background:'#0d1120',color:'#94a3b8',fontWeight:600,fontSize:13}}>İptal</button>
                  <button onClick={deleteQuizData}
                    style={{flex:1,padding:'9px',borderRadius:8,border:'none',cursor:'pointer',
                      background:'#7f1d1d',color:'#fca5a5',fontWeight:700,fontSize:13}}>Evet, Sil</button>
                </div>
              </div>
            </div>
          )}

          <div style={{maxWidth:480,margin:'0 auto',padding:'16px 18px'}}>
            <div style={{textAlign:'center',marginBottom:16}}>
              <div style={{fontSize:11,color:'#475569',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>
                {ev?.label} · {quizGroups.length} Grup
              </div>
            </div>

            {/* Sıralama seçeneği */}
            <div style={{display:'flex',gap:8,marginBottom:16}}>
              <button
                onClick={() => setQuizSortMode('score')}
                style={{flex:1,padding:'9px',borderRadius:9,fontSize:12,fontWeight:700,cursor:'pointer',
                  background: quizSortMode==='score' ? '#12100a' : '#0d1120',
                  color: quizSortMode==='score' ? '#fbbf24' : '#475569',
                  border: '1px solid ' + (quizSortMode==='score' ? '#fbbf2444' : '#1a2035')}}>
                🏆 Puana Göre
              </button>
              <button
                onClick={() => setQuizSortMode('groupno')}
                style={{flex:1,padding:'9px',borderRadius:9,fontSize:12,fontWeight:700,cursor:'pointer',
                  background: quizSortMode==='groupno' ? '#0a1a2e' : '#0d1120',
                  color: quizSortMode==='groupno' ? '#4fc9ff' : '#475569',
                  border: '1px solid ' + (quizSortMode==='groupno' ? '#4fc9ff44' : '#1a2035')}}>
                🔢 Grup No'ya Göre
              </button>
            </div>

            {allGroupScores.length === 0 && (
              <div style={{textAlign:'center',color:'#374151',padding:'40px 0'}}>Henüz skor yok</div>
            )}

            {(() => {
              // Sıralama: puana veya grup no'suna göre
              const sorted = quizSortMode === 'groupno'
                ? [...allGroupScores].sort((a,b) => (parseInt(a.no)||0) - (parseInt(b.no)||0))
                : allGroupScores; // allGroupScores zaten puana göre sıralı

              // Dense ranking: aynı puana eşit sıra, bir sonraki sıra atlanmaz
              // Örn: 370, 370, 300 → 1., 1., 2. (3. yok)
              const sortedByScore = [...allGroupScores].sort((a,b) => b.score - a.score);
              const rankMap = {};
              let currentRankVal = 1;
              sortedByScore.forEach((g, i) => {
                if (i === 0) {
                  rankMap[g.no] = 1;
                } else {
                  // Öncekiyle aynı puan → aynı rank
                  if (g.score === sortedByScore[i-1].score) {
                    rankMap[g.no] = rankMap[sortedByScore[i-1].no];
                  } else {
                    // Kaç tane aynı puanlı varsa o kadar artar: dense = count of unique ranks below
                    const higherCount = Object.values(rankMap).filter(r => r < rankMap[sortedByScore[i-1].no] + 1).length;
                    // Dense ranking: her farklı puan bir sonraki rakamı alır
                    rankMap[g.no] = Object.values(rankMap).reduce((acc, r) => Math.max(acc, r), 0) + 
                      (g.score < sortedByScore[i-1].score ? 1 : 0);
                    // Simplified: just count distinct score groups above this one + 1
                    const distinctHigher = new Set(sortedByScore.slice(0, i).map(x=>x.score)).size;
                    rankMap[g.no] = distinctHigher + 1;
                  }
                }
              });

              return sorted.map((g) => {
                const currentRank = quizSortMode === 'score' ? rankMap[g.no] : null;
                const isTop = currentRank !== null && currentRank <= 3 && g.score > 0;
                const medal = currentRank !== null ? medals[currentRank - 1] : null;
                const isMe = quizMyGroups.includes(g.no);
                const barWidth = maxScore > 0 ? Math.round((g.score / maxScore) * 100) : 0;
                const isExpanded = quizExpandedGroup === g.no;
                const groupScoreMap = displayScores[g.no] || {};
                const totalQ = ev ? ev.totalQ : 50;

                return (
                  <div key={g.no} style={{marginBottom:8}}>
                    {/* Ana kart — tıklanabilir */}
                    <div
                      onClick={() => setQuizExpandedGroup(isExpanded ? null : g.no)}
                      style={{
                        background: isTop && currentRank===1 && g.score>0 ? '#12100a' : '#0d1120',
                        border: '1px solid ' + (isExpanded ? '#fbbf2466' : isTop && currentRank===1 && g.score>0 ? '#fbbf2444' : isMe ? '#4fc9ff33' : '#0f1525'),
                        borderRadius: isExpanded ? '12px 12px 0 0' : 12,
                        padding:'14px 16px',
                        position:'relative', overflow:'hidden', cursor:'pointer'
                      }}>
                      <div style={{position:'absolute',left:0,top:0,bottom:0,
                        width:barWidth+'%',background: isTop&&currentRank===1&&g.score>0 ? '#fbbf2408' : '#ffffff04',
                        transition:'width 0.5s ease'}}/>
                      <div style={{position:'relative',display:'flex',alignItems:'center',gap:12}}>
                        <div style={{fontSize:20,minWidth:28,textAlign:'center',flexShrink:0}}>
                          {isTop && medal
                            ? medal
                            : currentRank !== null
                              ? <span style={{fontSize:13,color:'#374151',fontWeight:700}}>#{currentRank}</span>
                              : <span style={{fontSize:13,color:'#374151',fontWeight:700}}>G{g.no}</span>
                          }
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                            <span style={{fontSize:14,fontWeight:800,color: isTop&&currentRank===1&&g.score>0 ? '#fbbf24' : '#e2e8f0'}}>
                              {g.no} No{g.name ? ' · ' + g.name : ''}
                            </span>
                            {isMe && <span style={{fontSize:10,color:'#4fc9ff',background:'#4fc9ff11',
                              border:'1px solid #4fc9ff33',borderRadius:4,padding:'1px 6px',fontWeight:700}}>Benim</span>}
                          </div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontSize:22,fontWeight:900,
                              color: currentRank===1&&g.score>0 ? '#fbbf24' : g.score>0 ? '#e2e8f0' : '#374151',
                              lineHeight:1}}>{g.score.toLocaleString('tr')}</div>
                            <div style={{fontSize:10,color:'#475569'}}>puan</div>
                          </div>
                          <span style={{fontSize:16,color:'#475569',transition:'transform 0.2s',
                            display:'inline-block',transform: isExpanded ? 'rotate(90deg)' : 'none'}}>›</span>
                        </div>
                      </div>
                    </div>

                    {/* Detay paneli — soru bazlı doğru/yanlış */}
                    {isExpanded && (
                      <div style={{
                        background:'#090d17',border:'1px solid #fbbf2422',
                        borderTop:'none',borderRadius:'0 0 12px 12px',
                        padding:'12px 14px'
                      }}>
                        <div style={{fontSize:11,color:'#64748b',fontWeight:700,textTransform:'uppercase',
                          letterSpacing:1,marginBottom:10}}>Soru Detayı</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                          {Array.from({length: totalQ}, (_, i) => i+1).map(qNo => {
                            const correct = !!groupScoreMap[qNo];
                            const hasAnswer = quizAnswers[qNo];
                            return (
                              <div key={qNo}
                                title={hasAnswer ? ('S' + qNo + ': ' + quizAnswers[qNo]) : 'Soru ' + qNo}
                                style={{
                                  width:32, height:32, borderRadius:6,
                                  display:'flex', alignItems:'center', justifyContent:'center',
                                  fontSize:10, fontWeight:800,
                                  background: correct ? '#0a1a0a' : groupScoreMap[qNo]===false ? '#1a0a0a' : '#111827',
                                  border: '1px solid ' + (correct ? '#22c55e66' : groupScoreMap[qNo]===false ? '#ef444466' : '#1e293b'),
                                  color: correct ? '#22c55e' : groupScoreMap[qNo]===false ? '#ef4444' : '#374151',
                                  cursor: hasAnswer ? 'help' : 'default',
                                  flexShrink: 0
                                }}>
                                {correct ? '✓' : groupScoreMap[qNo]===false ? '✗' : qNo}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{display:'flex',gap:16,marginTop:10,fontSize:11,color:'#64748b'}}>
                          <span><span style={{color:'#22c55e'}}>✓</span> Doğru: {Object.values(groupScoreMap).filter(v=>v===true).length}</span>
                          <span><span style={{color:'#ef4444'}}>✗</span> Yanlış/Boş: {totalQ - Object.values(groupScoreMap).filter(v=>v===true).length}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            <button
              onClick={() => {
                setQuizResultsLoading(true);
                fetch('/api/quiz')
                  .then(r=>r.json())
                  .then(d => {
                    if (d.quizData) {
                      setQuizLiveScores(d.quizData.scores || {});
                      setQuizLiveGroups(d.quizData.groups || []);
                      setQuizScores(d.quizData.scores || {});
                      setQuizGroups(d.quizData.groups || []);
                    }
                  })
                  .catch(()=>{})
                  .finally(() => setQuizResultsLoading(false));
              }}
              style={{width:'100%',marginTop:8,padding:'13px',borderRadius:12,border:'1px solid #4fc9ff44',cursor:'pointer',
                background:'#0d1a2e',color:'#4fc9ff',fontWeight:700,fontSize:14,marginBottom:8}}>
              ⟳ Tüm Puantör Verilerini Güncelle
            </button>
            <button onClick={() => { setQuizStep('scoring'); }}
              style={{width:'100%',padding:'13px',borderRadius:12,border:'none',cursor:'pointer',
                background:'linear-gradient(135deg,#fbbf24,#f59e0b)',color:'#000',fontWeight:800,fontSize:14}}>
              ← Puanlamaya Dön (Soru {quizCurrentQ})
            </button>
          </div>
        </div>
      );
    }

    return null;
  }

  // ─── MALZEME TAKİBİ EKRANI ─────────────────────────────────────────────────
  if (mode === 'malzeme') {

    // Sunucuya otomatik kaydet (debounce — 800ms sonra)
    const saveMalzeme = (newStock) => {
      if (malzemeSaving) return;
      setMalzemeSaving(true);
      fetch('/api/malzeme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock })
      })
        .catch(() => {})
        .finally(() => setMalzemeSaving(false));
    };

    const CAT_ICON_M = {
      '3D Figürler':'🪆','Resim Malzemeleri':'🎨',
      'Punch Malzemeleri':'🧶','Mum Malzemeleri':'🧁','Diğer Malzemeler':'📦'
    };

    // Sayaç tipi için sayıyı artır/azalt
    const adjustStock = (cat, key, delta) => {
      setMalzemeStock(prev => {
        const next = {
          ...prev,
          [cat]: { ...prev[cat], [key]: Math.max(0, (prev[cat][key] || 0) + delta) }
        };
        saveMalzeme(next);
        return next;
      });
    };

    // Metin tipi için değer güncelle
    const setText = (cat, key, val) => {
      setMalzemeStock(prev => {
        const next = { ...prev, [cat]: { ...prev[cat], [key]: val } };
        saveMalzeme(next);
        return next;
      });
    };

    // Toggle tipi için durum değiştir
    const toggleItem = (cat, key, options) => {
      setMalzemeStock(prev => {
        const cur = prev[cat]?.[key] || options[0];
        const nextIdx = (options.indexOf(cur) + 1) % options.length;
        const next = { ...prev, [cat]: { ...prev[cat], [key]: options[nextIdx] } };
        saveMalzeme(next);
        return next;
      });
    };

    // Bir kategorinin özet badge'ini hesapla
    const getCatSummary = (cat, items) => {
      const counters = items.filter(i => i.type === 'counter');
      const total = counters.reduce((sum, i) => sum + (malzemeStock[cat]?.[i.key] || 0), 0);
      const warnings = items.filter(i => {
        if (i.type === 'toggle2') return malzemeStock[cat]?.[i.key] === 'yetmez';
        if (i.type === 'toggle3') return malzemeStock[cat]?.[i.key] === 'azaldı';
        if (i.type === 'text')    return (malzemeStock[cat]?.[i.key] || '').trim().length > 0;
        return false;
      }).length;
      return { total, warnings };
    };

    // Tek satır renderer — tipe göre farklı kontrol
    const renderItem = (cat, item, idx, items) => {
      const val = malzemeStock[cat]?.[item.key];
      const isLast = idx === items.length - 1;

      if (item.type === 'counter') {
        const qty = val || 0;
        const unit = item.unit || 'adet';
        return (
          <div key={item.key} style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'13px 18px',
            borderBottom: isLast ? 'none' : '1px solid #0f1525',
            background: idx%2===0 ? '#0a0e1a' : '#0d1120'
          }}>
            <span style={{fontSize:13,color:'#94a3b8',fontWeight:600,flex:1}}>{item.label}</span>
            <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
              <button onClick={() => adjustStock(cat,item.key,-1)} disabled={qty===0}
                style={{width:36,height:36,borderRadius:8,border:'1px solid #1e293b',
                  background:qty===0?'#0a0e1a':'#1a0a0a',color:qty===0?'#1e293b':'#ef4444',
                  fontSize:20,fontWeight:700,cursor:qty===0?'default':'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',minWidth:42}}>
                <span style={{fontSize:18,fontWeight:800,textAlign:'center',lineHeight:1,
                  color:qty===0?'#334155':qty<=2?'#ef4444':qty<=5?'#f59e0b':'#22c55e'}}>{qty}</span>
                <span style={{fontSize:9,color:'#475569',marginTop:1}}>{unit}</span>
              </div>
              <button onClick={() => adjustStock(cat,item.key,1)}
                style={{width:36,height:36,borderRadius:8,border:'1px solid #1e293b',
                  background:'#0a1a0a',color:'#22c55e',fontSize:20,fontWeight:700,
                  cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
            </div>
          </div>
        );
      }

      if (item.type === 'text') {
        return (
          <div key={item.key} style={{
            display:'flex', flexDirection:'column', gap:6,
            padding:'12px 18px',
            borderBottom: isLast ? 'none' : '1px solid #0f1525',
            background: idx%2===0 ? '#0a0e1a' : '#0d1120'
          }}>
            <span style={{fontSize:13,color:'#94a3b8',fontWeight:600}}>{item.label}</span>
            <textarea
              value={val || ''}
              onChange={e => setText(cat, item.key, e.target.value)}
              placeholder={item.placeholder || ''}
              rows={2}
              style={{width:'100%',padding:'8px 12px',background:'#07090f',color:'#e2e8f0',
                border:'1px solid #1a2035',borderRadius:8,fontSize:13,resize:'vertical',
                outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}
            />
          </div>
        );
      }

      if (item.type === 'toggle2') {
        // 'yeterli' ↔ 'yetmez'
        const isOk = (val || 'yeterli') === 'yeterli';
        return (
          <div key={item.key} style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'13px 18px',
            borderBottom: isLast ? 'none' : '1px solid #0f1525',
            background: idx%2===0 ? '#0a0e1a' : '#0d1120'
          }}>
            <span style={{fontSize:13,color:'#94a3b8',fontWeight:600,flex:1}}>{item.label}</span>
            <button onClick={() => toggleItem(cat, item.key, ['yeterli','yetmez'])}
              style={{
                padding:'8px 18px', borderRadius:10, border:'none', cursor:'pointer',
                fontWeight:700, fontSize:13, transition:'all 0.15s',
                background: isOk ? '#0a1a0a' : '#1a0a0a',
                color: isOk ? '#22c55e' : '#ef4444',
                boxShadow: isOk ? '0 0 0 1px #22c55e44' : '0 0 0 1px #ef444444'
              }}>
              {isOk ? '✓ Yeteri kadar var' : '✗ Yetmez'}
            </button>
          </div>
        );
      }

      if (item.type === 'toggle3') {
        // 'yeterli' ↔ 'azaldı'
        const cur = val || 'yeterli';
        const isOk = cur === 'yeterli';
        return (
          <div key={item.key} style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'13px 18px',
            borderBottom: isLast ? 'none' : '1px solid #0f1525',
            background: idx%2===0 ? '#0a0e1a' : '#0d1120'
          }}>
            <span style={{fontSize:13,color:'#94a3b8',fontWeight:600,flex:1}}>{item.label}</span>
            <button onClick={() => toggleItem(cat, item.key, ['yeterli','azaldı'])}
              style={{
                padding:'8px 18px', borderRadius:10, border:'none', cursor:'pointer',
                fontWeight:700, fontSize:13, transition:'all 0.15s',
                background: isOk ? '#0a1a0a' : '#1a100a',
                color: isOk ? '#22c55e' : '#f59e0b',
                boxShadow: isOk ? '0 0 0 1px #22c55e44' : '0 0 0 1px #f59e0b44'
              }}>
              {isOk ? '✓ Yeteri kadar var' : '⚠ Azaldı'}
            </button>
          </div>
        );
      }

      return null;
    };

    return (
      <div style={S.page}>
        <div style={S.header}>
          <div style={S.headerLeft}>
            <button style={{...S.smallBtn, marginRight:4}} onClick={() => { setMode(null); setMalzemeCat(null); }}>← Geri</button>
            <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>🧰 MALZEME TAKİBİ</span>
          </div>
        </div>
        <div style={{maxWidth:720,margin:'0 auto',padding:'18px'}}>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
            {Object.entries(MALZEME_CATS).map(([cat, items]) => {
              const { total, warnings } = getCatSummary(cat, items);
              const active = malzemeCat === cat;

              // 3D Figürler için hedef stok sayıları
              const FIGUR_HEDEF = {
                'Spiderman': 3, 'Spiderman Çocuk': 3, 'Winnie the Pooh': 4, 'Stitch': 4,
                'Yoda': 4, 'Pikaçu': 4, 'Bart': 2, 'Mickey Mouse': 4, 'Ironman': 2,
                'Groot': 3, 'Superman': 3, 'Batman Yeni': 0, 'Batman': 2, 'Mike': 2,
                'Donald': 2, 'Minnie': 5, 'Bugs Bunny': 2, 'Shrek': 3, 'Shrek Gözlük': 3,
                'Fiona': 3, 'Süngerbob': 4, 'Tom': 3, 'Jerry': 3, 'Ninja Kaplumbağa': 4,
                'Labubu': 3, 'Labubu Kalpli': 3, 'Garfield': 3, 'Minion': 4, 'Goku': 2,
                'Chucky': 2, 'Garen': 1, 'Eşşek': 3, 'Dobby': 3, 'Dumbledore': 1,
                'Hagrid': 1, 'Harry Potter Bust': 2, 'Harry Potter Kuşlu': 2, 'Hulk': 2,
                'Vecna': 1, 'Şirine': 2, 'Hello Kitty': 2, 'Buzz': 0,
                'Rick & Morty': 2, 'Sullivan': 2,
              };

              // Kategoriye göre WhatsApp numarası
              const CAT_WA_NUMBER = {
                '3D Figürler': '905050523801',
                'Mum Malzemeleri': '905050523801',
                'Resim Malzemeleri': '905453964756',
                'Punch Malzemeleri': '905453964756',
                'Diğer Malzemeler': '905453964756',
              };

              const sendCatWhatsApp = () => {
                const now = new Date().toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
                const catIconMap = {'3D Figürler':'🪆','Resim Malzemeleri':'🎨','Punch Malzemeleri':'🧶','Mum Malzemeleri':'🧁','Diğer Malzemeler':'📦'};
                const icon = catIconMap[cat] || '📦';
                let msg = icon + ' *' + cat.toUpperCase() + ' STOK RAPORU*\n' + now + '\n\n';
                const catLines = [];

                if (cat === '3D Figürler') {
                  items.forEach(function(item) {
                    const val = malzemeStock[cat] && malzemeStock[cat][item.key];
                    const stok = val || 0;
                    const hedef = FIGUR_HEDEF[item.key] || 0;
                    const eksik = hedef - stok;
                    if (eksik > 0) {
                      catLines.push(item.label + ' ' + eksik);
                    }
                  });
                  if (catLines.length === 0) {
                    msg += '✅ Tüm figürler tam!';
                  } else {
                    msg += '*Eksik figürler:*\n';
                    catLines.forEach(function(l){ msg += l + '\n'; });
                  }
                } else {
                  items.forEach(function(item) {
                    const val = malzemeStock[cat] && malzemeStock[cat][item.key];
                    if (item.type === 'counter') {
                      const qty = val || 0;
                      catLines.push('📦 ' + item.label + ': ' + qty + ' ' + (item.unit || 'adet'));
                    } else if (item.type === 'text') {
                      const txt = (val || '').trim();
                      if (txt) catLines.push('📝 ' + item.label + ': ' + txt);
                    } else if (item.type === 'toggle2') {
                      const st = val || 'yeterli';
                      if (st === 'yetmez') catLines.push('❌ ' + item.label + ': Yetmez');
                    } else if (item.type === 'toggle3') {
                      const st = val || 'yeterli';
                      if (st === 'azaldı') catLines.push('⚠️ ' + item.label + ': Azaldı');
                    }
                  });
                  if (catLines.length === 0) {
                    msg += '✅ Tüm malzemeler tam!';
                  } else {
                    catLines.forEach(function(l){ msg += l + '\n'; });
                  }
                }

                const waNumber = CAT_WA_NUMBER[cat] || '905050523801';
                const url = 'https://wa.me/' + waNumber + '?text=' + encodeURIComponent(msg);
                window.open(url, '_blank');
              };

              return (
                <div key={cat}>
                  <button
                    onClick={() => setMalzemeCat(active ? null : cat)}
                    style={{
                      width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'16px 18px', borderRadius: active ? '12px 12px 0 0' : 12,
                      border: active ? '2px solid #b47cff44' : '1px solid #1a2035',
                      background: active ? '#0f1130' : '#0d1120', cursor:'pointer', transition:'all 0.15s'
                    }}>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <span style={{fontSize:22}}>{CAT_ICON_M[cat] || '📦'}</span>
                      <span style={{fontSize:14,fontWeight:700,color:active?'#b47cff':'#e2e8f0'}}>{cat}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      {total > 0 && (
                        <span style={{fontSize:12,fontWeight:700,color:'#ff9f4a',background:'#1a1206',
                          border:'1px solid #ff9f4a44',borderRadius:8,padding:'2px 10px'}}>{total}</span>
                      )}
                      {warnings > 0 && (
                        <span style={{fontSize:12,fontWeight:700,color:'#ef4444',background:'#1a0808',
                          border:'1px solid #ef444444',borderRadius:8,padding:'2px 10px'}}>⚠ {warnings}</span>
                      )}
                      <span style={{fontSize:18,color:'#374151',display:'inline-block',
                        transform:active?'rotate(90deg)':'none',transition:'transform 0.2s'}}>›</span>
                    </div>
                  </button>
                  {active && (
                    <div style={{background:'#0a0e1a',border:'2px solid #b47cff44',borderTop:'none',
                      borderRadius:'0 0 12px 12px',overflow:'hidden'}}>
                      {items.map((item, idx) => renderItem(cat, item, idx, items))}
                      <div style={{padding:'10px 14px',borderTop:'1px solid #0f1525',display:'flex',flexDirection:'column',gap:8}}>
                        <button
                          onClick={sendCatWhatsApp}
                          style={{
                            width:'100%', padding:'11px 14px', borderRadius:10, border:'none',
                            background:'linear-gradient(135deg,#25d366,#128c7e)',
                            color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer',
                            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                            transition:'all 0.2s'
                          }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          WhatsApp'tan Gönder
                        </button>
                        <button
                          onClick={() => {
                            const reset = {};
                            items.forEach(i => {
                              if (i.type === 'counter') reset[i.key] = 0;
                              else if (i.type === 'text') reset[i.key] = '';
                              else if (i.type === 'toggle2' || i.type === 'toggle3') reset[i.key] = 'yeterli';
                            });
                            setMalzemeStock(prev => {
                              const next = {...prev, [cat]: reset};
                              saveMalzeme(next);
                              return next;
                            });
                          }}
                          style={{padding:'7px 16px',borderRadius:8,fontSize:11,fontWeight:700,
                            background:'#1a0808',color:'#64748b',border:'1px solid #1e293b',cursor:'pointer'}}>
                          Sıfırla
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{fontSize:11,color:'#1e293b',textAlign:'center',paddingTop:8,paddingBottom:4}}>
            ✓ Stok verileri otomatik kaydedilir
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
            <span style={{fontSize:11, color: role==='admin'?'#b47cff': role==='quiznight'?'#fbbf24':'#0ea5e9',
              background: role==='admin'?'#1a0a2e': role==='quiznight'?'#1a1000':'#0a1a2e',
              border:'1px solid '+(role==='admin'?'#b47cff44': role==='quiznight'?'#fbbf2444':'#0ea5e944'),
              borderRadius:6, padding:'3px 10px', fontWeight:700}}>
              {role === 'admin' ? '🔐 Yönetici' : role === 'quiznight' ? '🏆 Quiz Night' : '👤 Çalışan'}
            </span>
          )}
          <button style={S.smallBtn} onClick={()=>{setLoggedIn(false);setMode(null);setSalesData(null);setRole(null);setRoleScreen(false);setQuizNightMode(false);setQuizRole(null);}}>Çıkış</button>
        </div>
      </div>

      {/* Ana Butonlar */}
      {role === 'staff' ? (
        /* Çalışan: satışlar + malzeme takibi */
        <div style={{padding:'18px',maxWidth:720,margin:'0 auto',display:'flex',flexDirection:'column',gap:12}}>
          <button
            style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:14,
              padding:'22px 24px',borderRadius:16,border:'none',cursor:'pointer',
              background: 'linear-gradient(135deg,#b47cff,#7c3aff)',
              boxShadow: 'none', transition:'all 0.2s'}}
            onClick={()=>{ setMode('sales'); if(!salesData && !salesLoading) fetchSales(); }}
          >
            <span style={{fontSize:32}}>📊</span>
            <div style={{textAlign:'left'}}>
              <div style={{fontSize:16,fontWeight:800,color:'#fff',marginBottom:2}}>
                {salesLoading ? '⟳ Yükleniyor…' : 'Satışları Getir'}
              </div>
              <div style={{fontSize:12,color:'#e2e8f0',opacity:0.75}}>3 platformdaki seans satışlarını listele</div>
            </div>
          </button>
          <button
            onClick={() => { setMode('malzeme'); setMalzemeCat(null); }}
            style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'15px 22px',
              borderRadius:14,border:'1px solid #1a2035',cursor:'pointer',textAlign:'left',
              background:'#0d1120',transition:'all 0.2s'}}
            onMouseOver={e=>{e.currentTarget.style.borderColor='#22c55e';e.currentTarget.style.background='#0f1525';}}
            onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.background='#0d1120';}}>
            <span style={{fontSize:26}}>🧰</span>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start'}}>
              <span style={{fontSize:14,fontWeight:700,color:'#94a3b8',marginBottom:4}}>Malzeme Takibi</span>
              <span style={{fontSize:11,color:'#374151',lineHeight:1.5}}>Atölye malzeme stoklarını takip et</span>
            </div>
            <span style={{marginLeft:'auto',fontSize:18,color:'#374151'}}>›</span>
          </button>
          <button
            onClick={() => { setMode('quiz'); setQuizStep(quizData ? 'groups' : 'select'); if(quizData){setQuizEventType(quizData.eventType);setQuizGroups(quizData.groups||[]);setQuizScores(quizData.scores||{});} }}
            style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'15px 22px',
              borderRadius:14,border:'1px solid #1a2035',cursor:'pointer',textAlign:'left',
              background:'#0d1120',transition:'all 0.2s'}}
            onMouseOver={e=>{e.currentTarget.style.borderColor='#fbbf24';e.currentTarget.style.background='#0f1525';}}
            onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.background='#0d1120';}}>
            <span style={{fontSize:26}}>🏆</span>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start'}}>
              <span style={{fontSize:14,fontWeight:700,color:'#94a3b8',marginBottom:4}}>Quiz Night</span>
              <span style={{fontSize:11,color:'#374151',lineHeight:1.5}}>Grup puanlarını takip et ve sırala</span>
            </div>
            <span style={{marginLeft:'auto',fontSize:18,color:'#374151'}}>›</span>
          </button>
        </div>
      ) : (
        /* Yönetici: iki kart yan yana + Seans Yazdır bar */
        <>
          <div style={S.mainActions}>
            <ActionCard icon="📊" title="Satışları Getir" desc="3 platformdaki seans satışlarını listele"
              color="#b47cff" active={false} loading={salesLoading}
              onClick={()=>{ setMode('sales'); if(!salesData && !salesLoading) fetchSales(); }} />
            <ActionCard icon="📦" title="Stok Güncelle" desc="İdeasoft ürün stoklarını düzenle"
              color="#4fc9ff" active={false}
              onClick={()=>setMode('stock')} />
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
          {/* Malzeme Takibi */}
          <div style={{padding:'0 18px 6px', maxWidth:720, margin:'0 auto'}}>
            <button
              onClick={() => { setMode('malzeme'); setMalzemeCat(null); }}
              style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'15px 22px',
                borderRadius:14,border:'1px solid #1a2035',cursor:'pointer',textAlign:'left',
                background:'#0d1120',boxShadow:'none',transition:'all 0.2s'}}
              onMouseOver={e=>{e.currentTarget.style.borderColor='#22c55e';e.currentTarget.style.background='#0f1525';}}
              onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.background='#0d1120';}}>
              <span style={{fontSize:26}}>🧰</span>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start'}}>
                <span style={{fontSize:14,fontWeight:700,color:'#94a3b8',marginBottom:4}}>Malzeme Takibi</span>
                <span style={{fontSize:11,color:'#374151',lineHeight:1.5}}>Atölye malzeme stoklarını takip et</span>
              </div>
              <span style={{marginLeft:'auto',fontSize:18,color:'#374151'}}>›</span>
            </button>
          </div>
          {/* Quiz Night */}
          <div style={{padding:'0 18px 6px', maxWidth:720, margin:'0 auto'}}>
            <button
              onClick={() => { setMode('quiz'); setQuizStep(quizData ? 'groups' : 'select'); if(quizData){setQuizEventType(quizData.eventType);setQuizGroups(quizData.groups||[]);setQuizScores(quizData.scores||{});} }}
              style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'15px 22px',
                borderRadius:14,border:'1px solid #1a2035',cursor:'pointer',textAlign:'left',
                background:'#0d1120',boxShadow:'none',transition:'all 0.2s'}}
              onMouseOver={e=>{e.currentTarget.style.borderColor='#fbbf24';e.currentTarget.style.boxShadow='0 0 18px #fbbf2422';e.currentTarget.style.background='#0f1525';}}
              onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.boxShadow='none';e.currentTarget.style.background='#0d1120';}}>
              <span style={{fontSize:26}}>🏆</span>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start'}}>
                <span style={{fontSize:14,fontWeight:700,color:'#94a3b8',marginBottom:4}}>Quiz Night</span>
                <span style={{fontSize:11,color:'#374151',lineHeight:1.5}}>Grup puanlarını takip et ve sırala</span>
              </div>
              <span style={{marginLeft:'auto',fontSize:18,color:'#374151'}}>›</span>
            </button>
          </div>
        </>
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
function HostAnswerCard({answer}) {
  const [revealed, setRevealed] = useState(false);
  // Reset when answer changes (new question)
  useEffect(() => { setRevealed(false); }, [answer]);
  return (
    <div style={{borderRadius:14,overflow:'hidden',border:'1px solid',
      borderColor: revealed ? '#22c55e66' : '#1a2035',
      transition:'border-color 0.3s'}}>
      <button
        onClick={() => setRevealed(r => !r)}
        style={{
          width:'100%',padding:'16px 20px',
          background: revealed ? '#0a1a0a' : '#0d1120',
          border:'none',cursor:'pointer',
          display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,
          transition:'background 0.3s'
        }}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:14,fontWeight:800,
            color: revealed ? '#22c55e' : '#475569'}}>
            {revealed ? '✓ Cevap' : '🔒 Cevabı Göster'}
          </span>
        </div>
        <span style={{fontSize:18,color: revealed ? '#22c55e' : '#374151',
          transition:'transform 0.3s',display:'inline-block',
          transform: revealed ? 'rotate(90deg)' : 'none'}}>›</span>
      </button>
      {revealed && (
        <div style={{padding:'16px 20px',background:'#071a07',borderTop:'1px solid #22c55e33'}}>
          <span style={{fontSize:16,fontWeight:800,color:'#4ade80',lineHeight:1.5}}>
            {answer || '—'}
          </span>
        </div>
      )}
    </div>
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
  page:       {minHeight:'100vh',width:'100%',background:'#07090f',color:'#e2e8f0',fontFamily:'"DM Sans",system-ui,sans-serif',paddingBottom:60,margin:0,padding:0,boxSizing:'border-box',overflowX:'hidden'},
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
