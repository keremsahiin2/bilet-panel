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
    // Buton focus outline'ı kaldır (tarayıcı varsayılan sarı/mavi çerçeve)
    if (!document.getElementById('__quiz_no_focus')) {
      const style = document.createElement('style');
      style.id = '__quiz_no_focus';
      style.textContent = 'button:focus{outline:none!important;box-shadow:none!important;}button:focus-visible{outline:none!important;box-shadow:none!important;}';
      document.head.appendChild(style);
    }
  }
  const [loggedIn, setLoggedIn]             = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);   // başlangıçta login ekranı gizle
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

  // ─── Seramik Takip ────────────────────────────────────────────────────────────
  const [ceramicsData, setCeramicsData]       = useState(null);
  const [ceramicsLoading, setCeramicsLoading] = useState(false);
  const [ceramicsSearch, setCeramicsSearch]   = useState('');
  const [ceramicsView, setCeramicsView]       = useState('list'); // 'list' | 'new' | 'detail' | 'session'
  const [ceramicsSelected, setCeramicsSelected] = useState(null);
  const [ceramicsForm, setCeramicsForm]       = useState({ firstName:'', lastName:'', phone:'', notes:'', sessionId:'' });
  const [ceramicsImageFile, setCeramicsImageFile] = useState(null);
  const [ceramicsImagePreview, setCeramicsImagePreview] = useState(null);
  const [ceramicsSaving, setCeramicsSaving]   = useState(false);
  const [ceramicsSessionForm, setCeramicsSessionForm] = useState({ date: new Date().toISOString().slice(0,10), category:'Seramik', participantCount:'', notes:'' });
  const [ceramicsStatusFilter, setCeramicsStatusFilter] = useState('all');
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
  const [quizPickerOpen, setQuizPickerOpen] = useState(false);
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
    genelkultur: { label: 'Genel Kültür', totalQ: 55, pointPerQ: 10, icon: '🧠', altTotalQ: 50 },
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
          // Grup sayısı ayarlandıysa — grup ekranına al, select'te kalma
          if (d.quizData.groups && d.quizData.groups.length > 0) {
            setQuizGroupCountSet(true);
            setQuizGroupCount(String(d.quizData.groups.length));
            setQuizStep('groups'); // ← YENİ: yeni puantör de groups ekranını görsün
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

  // ─── Seramik Takip ────────────────────────────────────────────────────────────
  const fetchCeramics = async () => {
    setCeramicsLoading(true);
    try {
      const r = await fetch('/api/ceramics');
      const d = await r.json();
      setCeramicsData(d);
    } catch(e) { console.error(e); }
    setCeramicsLoading(false);
  };

  // Real-time polling — her 1.5 saniyede sunucudan güncel veriyi çek
  const quizGroupEditingRef = useRef(false); // input focus sırasında grup isimlerini ezme
  useEffect(() => {
    if (mode !== 'quiz' && role !== 'quiznight') return;
    const poll = setInterval(() => {
      fetch('/api/quiz')
        .then(r => r.json())
        .then(d => {
          if (!d.quizData) return;
          const srv = d.quizData;
          // Grupları güncelle — ama kullanıcı input'a yazıyorsa grup isimlerini ezme
          if (srv.groups && srv.groups.length > 0) {
            setQuizGroups(prev => {
              if (quizGroupEditingRef.current) {
                // Sadece yeni grup eklendiyse (uzunluk farkı) yeni grupları ekle, mevcut isimleri koru
                if (srv.groups.length > prev.length) {
                  return [...prev, ...srv.groups.slice(prev.length)];
                }
                return prev;
              }
              if (JSON.stringify(prev) !== JSON.stringify(srv.groups)) return srv.groups;
              return prev;
            });
            setQuizGroupCountSet(true);
            setQuizGroupCount(prev => prev || String(srv.groups.length));
            // quizStep 'select'te kalmışsa 'groups'a geç (yeni puantör için)
            setQuizStep(prev => prev === 'select' ? 'groups' : prev);
          }
          // eventType güncelle
          if (srv.eventType) setQuizEventType(srv.eventType);
          // Skorları merge et — ama aktif puanlama sırasında mevcut local değeri koru
          setQuizScores(prev => {
            const merged = { ...(srv.scores||{}) };
            // Her grup için: local'daki değerler sunucudakinden daha güncel olabilir (yeni toggle)
            // Bu yüzden local'ı server üzerine yaz (local öncelikli merge)
            Object.keys(prev).forEach(gno => {
              merged[gno] = { ...(merged[gno]||{}), ...prev[gno] };
            });
            if (JSON.stringify(merged) === JSON.stringify(prev)) return prev;
            return merged;
          });
          // Cevapları güncelle
          if (srv.answers && Object.keys(srv.answers).length > 0) {
            setQuizAnswers(prev => Object.keys(prev).length > 0 ? prev : srv.answers);
          }
          // Sorular — her puantör görsün (sunucudan yükle)
          if (srv.questions && Object.keys(srv.questions).length > 0) {
            setQuizQuestions(prev => Object.keys(prev).length > 0 ? prev : srv.questions);
            setQuizQFile(prev => prev || ((srv.questionsFile || 'Sunucudan yüklendi') + ' (' + Object.keys(srv.questions).length + ' soru)'));
          }
        })
        .catch(() => {});
    }, 1500);
    quizPollRef.current = poll;
    return () => clearInterval(poll);
  }, [mode, role]);

  const saveQuizData = async (newData, includeCurrentQ = false) => {
    setQuizSaving(true);
    try {
      // Önce sunucudaki güncel veriyi çek — questions/answers/answers gibi alanları korumak için
      let serverBase = {};
      try {
        const cur = await fetch('/api/quiz').then(r => r.json());
        if (cur.quizData) serverBase = cur.quizData;
      } catch {}

      // Sunucu verisiyle merge et: sunucu önce, sonra yeni veri üzerine yaz
      // questions/answers sunucuda varsa koru; local'da varsa local'ı kullan
      const merged = {
        ...serverBase,
        ...newData,
        // questions: local varsa local, yoksa sunucudan al
        questions: Object.keys(quizQuestions).length > 0
          ? quizQuestions
          : (serverBase.questions || {}),
        questionsFile: quizQFile || serverBase.questionsFile || null,
        // answers: local varsa local, yoksa sunucudan al
        answers: Object.keys(quizAnswers).length > 0
          ? quizAnswers
          : (serverBase.answers || {}),
        answersFile: quizAnswerFile || serverBase.answersFile || null,
      };

      const dataToSend = includeCurrentQ ? { ...merged, currentQ: quizCurrentQ } : merged;
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizData: dataToSend })
      });
      const json = await res.json();
      if (json.mergedScores) {
        setQuizScores(json.mergedScores);
        setQuizData(prev => prev ? {...prev, scores: json.mergedScores} : prev);
      }
    } catch {}
    setQuizSaving(false);
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

      // parse-questions'dan gelen {question, answer} çiftlerinden cevap anahtarı oluştur
      const answersFromQuestions = {};
      Object.entries(qJson.questions || {}).forEach(([no, q]) => {
        if (q.answer && q.answer.trim()) {
          answersFromQuestions[parseInt(no)] = q.answer.trim();
        }
      });
      const answersCount = Object.keys(answersFromQuestions).length;

      if (answersCount > 0) {
        // Cevapları questions parse'dan al (daha güvenilir)
        setQuizAnswers(answersFromQuestions);
        setQuizAnswerFile(file.name + ' (' + answersCount + ' cevap)');
        const current = await fetch('/api/quiz').then(r=>r.json()).catch(()=>({quizData:null}));
        const base = current.quizData || { eventType: quizEventType, groups: quizGroups, scores: quizScores, myGroups: quizMyGroups };
        const updated = {...base, answers: answersFromQuestions, answersFile: file.name, questions: qJson.questions, questionsFile: file.name};
        await fetch('/api/quiz', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({quizData: updated})
        }).catch(()=>{});
        setQuizCombinedFile(file.name + ' (' + qJson.count + ' soru, ' + answersCount + ' cevap)');
      } else {
        // Fallback: parse-answers ile dene
        const formData2 = new FormData();
        formData2.append('file', file);
        const aRes = await fetch('/api/quiz/parse-answers', { method: 'POST', body: formData2 });
        const aJson = await aRes.json();
        const answers = (!aJson.error && aJson.count > 0) ? aJson.answers : {};
        const cnt = Object.keys(answers).length;
        if (cnt > 0) {
          setQuizAnswers(answers);
          setQuizAnswerFile(file.name + ' (' + cnt + ' cevap)');
        }
        const current = await fetch('/api/quiz').then(r=>r.json()).catch(()=>({quizData:null}));
        const base = current.quizData || { eventType: quizEventType, groups: quizGroups, scores: quizScores, myGroups: quizMyGroups };
        const updated = {...base, answers, answersFile: file.name, questions: qJson.questions, questionsFile: file.name};
        await fetch('/api/quiz', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({quizData: updated})
        }).catch(()=>{});
        setQuizCombinedFile(file.name + ' (' + qJson.count + ' soru, ' + cnt + ' cevap)');
      }    } catch(e) {
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
  useEffect(() => {
    fetch('/api/auto-login', { method:'POST' })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setLoggedIn(true);
          setRoleScreen(true);
          setInitialLoading(false);
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
            }).catch(()=>{})
            .finally(() => setInitialLoading(false));
        }
      })
      .catch(() => { setInitialLoading(false); });
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
  // initialLoading sırasında hiçbir ekran gösterme — koyu boş sayfa
  if (initialLoading) {
    return <div style={{background:'#07090f',minHeight:'100vh',width:'100%'}} />;
  }

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
    const PINS = { admin: '2580', staff: '1225' };
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
            {/* Sosyal Sanathane Logosu */}
            <div style={{display:'flex', justifyContent:'center', marginBottom:12}}>
              <img src="data:image/png;base64,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TKstRNJNIvNz3K5V96nGCgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//2Q==" alt="sosyal sanathane" style={{width:100, height:100, objectFit:'contain'}} />
            </div>
            <div style={{fontSize:12, color:'#475569', marginBottom:16}}>Devam etmek için rolünüzü seçin</div>
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
                  // quiznight rolünden çık → rol seçim ekranına dön (loggedIn kalır)
                  setRole(null); setRoleScreen(true);
                  setQuizNightMode(false); setQuizRole(null); setMode(null);
                } else {
                  setMode(null); setQuizNightMode(false);
                }
              }}>← Geri</button>
              <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>🏆 QUIZ NIGHT</span>            </div>
          </div>
          <div style={{maxWidth:480,margin:'0 auto',padding:'24px 18px'}}>

            <div style={{textAlign:'center',marginBottom:24}}>
              <div style={{fontSize:13,color:'#475569'}}>Rolünüzü seçin</div>
            </div>

            {/* ── KOMBINE DOSYA YÜKLEME ─────────────────────────── */}
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
            {/* Sunucu kartı */}
            <button
              onClick={() => setQuizRole('host')}
              style={{
                width:'100%',display:'flex',alignItems:'center',gap:18,
                padding:'24px 22px',borderRadius:18,border:'1px solid #1a2035',
                cursor:'pointer',textAlign:'left',background:'#0d1120',
                marginBottom:14,transition:'all 0.2s',outline:'none'
              }}
              onMouseOver={e=>{e.currentTarget.style.borderColor='#b47cff';e.currentTarget.style.background='#0e0a1a';}}
              onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.background='#0d1120';}}
              onFocus={e=>{e.currentTarget.style.outline='none';}}>
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
                marginBottom:14,transition:'all 0.2s',outline:'none'
              }}
              onMouseOver={e=>{e.currentTarget.style.borderColor='#fbbf24';e.currentTarget.style.background='#12100a';}}
              onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.background='#0d1120';}}
              onFocus={e=>{e.currentTarget.style.outline='none';}}>              <div style={{width:56,height:56,borderRadius:14,background:'linear-gradient(135deg,#fbbf2422,#f59e0b22)',
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
      // ── Puan durumu ekranı (host içinde) ──────────────────────────────────
      if (quizStep === 'results') {
        const displayScores = Object.keys(quizLiveScores).length > 0 ? quizLiveScores : quizScores;
        const displayGroups = quizLiveGroups.length > 0 ? quizLiveGroups : quizGroups;
        const allGroupScores = displayGroups.map(g => ({
          ...g,
          score: calcGroupScore(g.no, quizEventType, displayScores)
        })).sort((a, b) => b.score - a.score);
        const maxScore = allGroupScores.length > 0 ? allGroupScores[0].score : 0;
        const medals = ['🥇','🥈','🥉'];
        const sortedByScore = [...allGroupScores].sort((a,b) => b.score - a.score);
        const rankMap = {};
        sortedByScore.forEach((g, i) => {
          if (i === 0) { rankMap[g.no] = 1; }
          else if (g.score === sortedByScore[i-1].score) { rankMap[g.no] = rankMap[sortedByScore[i-1].no]; }
          else { const d = new Set(sortedByScore.slice(0,i).map(x=>x.score)).size; rankMap[g.no] = d + 1; }
        });
        return (
          <div style={S.page}>
            <div style={S.header}>
              <div style={S.headerLeft}>
                <button style={{...S.smallBtn, marginRight:4}} onClick={() => setQuizStep('done')}>← Geri</button>
                <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>📊 PUAN DURUMU</span>
              </div>
              <div style={S.headerRight}>
                {quizResultsLoading && <span style={{fontSize:11,color:'#4fc9ff'}}>⟳ Yükleniyor…</span>}
                <button onClick={() => {
                  setQuizResultsLoading(true);
                  fetch('/api/quiz').then(r=>r.json()).then(d => {
                    if (d.quizData) { setQuizLiveScores(d.quizData.scores||{}); setQuizLiveGroups(d.quizData.groups||[]); }
                  }).catch(()=>{}).finally(()=>setQuizResultsLoading(false));
                }} style={{...S.smallBtn}}>⟳ Güncelle</button>
              </div>
            </div>
            <div style={{maxWidth:480,margin:'0 auto',padding:'16px 18px'}}>
              <div style={{fontSize:11,color:'#475569',textTransform:'uppercase',letterSpacing:1,marginBottom:16,textAlign:'center'}}>
                {ev?.label} · {displayGroups.length} Grup
              </div>
              {allGroupScores.map(g => {
                const rank = rankMap[g.no];
                const isTop = rank <= 3 && g.score > 0;
                const medal = medals[rank - 1];
                const barWidth = maxScore > 0 ? Math.round((g.score / maxScore) * 100) : 0;
                return (
                  <div key={g.no} style={{
                    background: isTop && rank===1 && g.score>0 ? '#12100a' : '#0d1120',
                    border: '1px solid ' + (isTop && rank===1 && g.score>0 ? '#fbbf2444' : '#0f1525'),
                    borderRadius:12, padding:'14px 16px', marginBottom:8, position:'relative', overflow:'hidden'
                  }}>
                    <div style={{position:'absolute',left:0,top:0,bottom:0,width:barWidth+'%',
                      background: isTop&&rank===1&&g.score>0 ? '#fbbf2408' : '#ffffff04', transition:'width 0.5s'}}/>
                    <div style={{position:'relative',display:'flex',alignItems:'center',gap:12}}>
                      <div style={{fontSize:20,minWidth:28,textAlign:'center',flexShrink:0}}>
                        {isTop && medal ? medal : <span style={{fontSize:13,color:'#374151',fontWeight:700}}>#{rank}</span>}
                      </div>
                      <div style={{flex:1}}>
                        <span style={{fontSize:14,fontWeight:800,color: isTop&&rank===1&&g.score>0 ? '#fbbf24' : '#e2e8f0'}}>
                          {g.no} No{g.name ? ' · ' + g.name : ''}
                        </span>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontSize:22,fontWeight:900,
                          color: rank===1&&g.score>0 ? '#fbbf24' : g.score>0 ? '#e2e8f0' : '#374151',
                          lineHeight:1}}>{g.score.toLocaleString('tr')}</div>
                        <div style={{fontSize:10,color:'#475569'}}>puan</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {allGroupScores.length === 0 && (
                <div style={{textAlign:'center',color:'#374151',padding:'40px 0'}}>Henüz skor yok</div>
              )}
            </div>
          </div>
        );
      }

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
                  .docx veya .txt formatında soru dosyası yükleyin.
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
                onClick={() => setQuizStep('results')}
                style={{...S.smallBtn, color:'#fbbf24', borderColor:'#fbbf2444'}}>
                📊 Puan Durumu
              </button>
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
                onClick={() => {
                  if (key === 'genelkultur') {
                    // Soru sayısı seçimi için state — modal yerine inline seçim
                    setQuizEventType(key);
                    setQuizGroups([]); setQuizGroupCountSet(false); setQuizGroupCount('');
                    setQuizScores({}); setQuizMyGroups([]); setQuizCurrentQ(1);
                    setQuizStep('qcount');
                  } else {
                    setQuizEventType(key); setQuizGroups([]); setQuizGroupCountSet(false); setQuizGroupCount(''); setQuizStep('groups'); setQuizScores({}); setQuizMyGroups([]); setQuizCurrentQ(1);
                  }
                }}
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
                      ? `50 veya 55 Soru · 10 puan/soru`
                      : `40 Soru · 1000 Puan`
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

    // Genel Kültür soru sayısı seçimi
    if (quizStep === 'qcount') {
      return (
        <div style={S.page}>
          <div style={S.header}>
            <div style={S.headerLeft}>
              <button style={{...S.smallBtn, marginRight:4}} onClick={() => setQuizStep('select')}>← Geri</button>
              <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>🧠 Genel Kültür</span>
            </div>
          </div>
          <div style={{maxWidth:480,margin:'0 auto',padding:'40px 18px',textAlign:'center'}}>
            <div style={{fontSize:48,marginBottom:12}}>❓</div>
            <div style={{fontSize:20,fontWeight:800,color:'#fff',marginBottom:6}}>Kaç soru?</div>
            <div style={{fontSize:13,color:'#475569',marginBottom:32}}>Bu gecenin soru sayısını seçin</div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {[50, 55].map(count => (
                <button key={count}
                  onClick={() => {
                    // totalQ'yu override et — quizData ile merge olacak
                    QUIZ_EVENTS.genelkultur.totalQ = count;
                    setQuizGroups([]); setQuizGroupCountSet(false); setQuizGroupCount('');
                    setQuizScores({}); setQuizMyGroups([]); setQuizCurrentQ(1);
                    setQuizStep('groups');
                  }}
                  style={{
                    width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
                    padding:'22px 28px',borderRadius:16,border:'1px solid #1a2035',
                    cursor:'pointer',textAlign:'left',background:'#0d1120',transition:'all 0.2s'
                  }}
                  onMouseOver={e=>{e.currentTarget.style.borderColor='#fbbf24';e.currentTarget.style.background='#12100a';}}
                  onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.background='#0d1120';}}>
                  <div>
                    <div style={{fontSize:28,fontWeight:900,color:'#fbbf24',marginBottom:4}}>{count} Soru</div>
                    <div style={{fontSize:13,color:'#64748b'}}>
                      {count} × 10 puan = <span style={{color:'#fff',fontWeight:700}}>{count * 10} toplam puan</span>
                    </div>
                  </div>
                  <span style={{fontSize:24,color:'#374151'}}>›</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Grup ayarlama ekranı
    if (quizStep === 'groups') {
      const updateGroup = (idx, field, val) => {
        const updated = quizGroups.map((g,i)=>i===idx?{...g,[field]:val}:g);
        setQuizGroups(updated);
      };
      const saveGroups = (updated) => {
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

      // Grup sayısı henüz belirlenmedi — quizGroups da boşsa sor
      if (!quizGroupCountSet && quizGroups.length === 0) {
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
                setQuizStep('select');
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
              Bir gruba tıklayarak o gruba bakacağınızı belirtin.
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
                    {/* Grup numarası / seçim butonu */}
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
                        {isMine ? '✓ Seçildi' : `Grup ${g.no}`}
                      </div>
                      <input
                        value={g.name}
                        onChange={e => updateGroup(idx,'name',e.target.value)}
                        onFocus={() => { quizGroupEditingRef.current = true; }}
                        onBlur={e => {
                          quizGroupEditingRef.current = false;
                          saveGroups(quizGroups.map((gr,i)=>i===idx?{...gr,name:e.target.value}:gr));
                        }}
                        placeholder={`Grup ${g.no} adı (opsiyonel)`}
                        style={{...S.input, marginBottom:0, padding:'6px 10px', fontSize:13,
                          background: isMine ? '#1a1000' : '#07090f',
                          border: '1px solid ' + (isMine ? '#fbbf2444' : '#1a2035')}}
                      />
                    </div>
                    {/* Grup sil butonu — sadece sonraki eklenenler için (son grup silinebilir) */}
                    {idx === quizGroups.length - 1 && quizGroups.length > 1 && (
                      <button
                        onClick={() => {
                          const updated = quizGroups.slice(0, -1);
                          setQuizGroups(updated);
                          setQuizMyGroups(prev => prev.filter(n => n !== g.no));
                          saveGroups(updated);
                        }}
                        style={{width:36,height:36,borderRadius:8,border:'1px solid #374151',cursor:'pointer',
                          background:'#1f0f0f',color:'#f87171',fontSize:16,fontWeight:700,flexShrink:0}}>
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Ekstra Grup Ekle butonu */}
            <button
              onClick={() => {
                const nextNo = String(quizGroups.length + 1);
                const updated = [...quizGroups, {no: nextNo, name:''}];
                setQuizGroups(updated);
                saveGroups(updated);
              }}
              style={{width:'100%',padding:'11px',borderRadius:10,border:'1px dashed #374151',cursor:'pointer',
                background:'transparent',color:'#475569',fontSize:13,fontWeight:600,marginBottom:12,
                display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              ＋ Ekstra Grup Ekle
            </button>

            <div style={{background:'#0a1a0a',border:'1px solid #22c55e22',borderRadius:10,padding:'10px 14px',marginBottom:16}}>
              <div style={{fontSize:11,color:'#22c55e',fontWeight:700,marginBottom:4}}>✓ Seçili Gruplarınız</div>
              <div style={{fontSize:12,color:'#64748b'}}>
                {quizMyGroups.length === 0
                  ? 'Henüz grup seçmediniz. Yukarıdan bir grup numarasına tıklayın.'
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

      const toggleAnswer = async (groupNo) => {
        // State'i önce güncelle (hızlı UI feedback)
        const gs = quizScoresRef.current[groupNo] || {};
        const newGs = {...gs, [quizCurrentQ]: !gs[quizCurrentQ]};
        const newScores = {...quizScoresRef.current, [groupNo]: newGs};
        quizScoresRef.current = newScores;
        setQuizScores(newScores);
        // Sunucudan güncel veriyi çek, merge edip kaydet — questions/answers korunsun
        try {
          let serverBase = {};
          try { const cur = await fetch('/api/quiz').then(r=>r.json()); if (cur.quizData) serverBase = cur.quizData; } catch {}
          const data = {
            ...serverBase,
            eventType: quizEventType, groups: quizGroups, scores: newScores,
            myGroups: quizMyGroups, currentQ: quizCurrentQ,
            questions: Object.keys(quizQuestions).length > 0 ? quizQuestions : (serverBase.questions||{}),
            questionsFile: quizQFile || serverBase.questionsFile || null,
            answers: Object.keys(quizAnswers).length > 0 ? quizAnswers : (serverBase.answers||{}),
            answersFile: quizAnswerFile || serverBase.answersFile || null,
          };
          await fetch('/api/quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quizData: data })
          });
        } catch {}
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
              <button style={{...S.smallBtn, marginRight:4}} onClick={() => {
                setQuizStep('groups');
              }}>← Geri</button>
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
                <button
                  onClick={() => setQuizPickerOpen(true)}
                  style={{background:'#fbbf2422',border:'1px solid #fbbf2444',borderRadius:8,
                    padding:'4px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:12,fontWeight:800,color:'#fbbf24'}}>Soru {quizCurrentQ}</span>
                  <span style={{fontSize:10,color:'#f59e0b'}}>▼</span>
                </button>
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

          {/* Soru Seçici Modal */}
          {quizPickerOpen && (
            <div
              onClick={() => setQuizPickerOpen(false)}
              style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:50,
                display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
              <div
                onClick={e => e.stopPropagation()}
                style={{background:'#0d1120',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,
                  maxHeight:'70vh',display:'flex',flexDirection:'column',
                  boxShadow:'0 -8px 40px rgba(0,0,0,0.6)'}}>
                {/* Handle */}
                <div style={{width:40,height:4,borderRadius:2,background:'#1e293b',margin:'14px auto 0'}}/>
                {/* Başlık */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'14px 20px 10px'}}>
                  <span style={{fontSize:14,fontWeight:800,color:'#fff'}}>Soruya Git</span>
                  <button onClick={() => setQuizPickerOpen(false)}
                    style={{background:'#1a2035',border:'none',borderRadius:8,padding:'5px 12px',
                      color:'#94a3b8',fontSize:13,cursor:'pointer',fontWeight:600}}>✕</button>
                </div>
                {/* Soru grid */}
                <div style={{overflowY:'auto',padding:'8px 16px 32px',flex:1}}>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
                    {Array.from({length: totalQ}, (_, i) => i + 1).map(qNo => {
                      const isCurrent = qNo === quizCurrentQ;
                      // Bu puantörün sorumlu olduğu gruplarda doğru/yanlış durumu
                      const answered = myGroupObjs.some(g => quizScores[g.no]?.[qNo] !== undefined);
                      const allCorrect = myGroupObjs.length > 0 && myGroupObjs.every(g => quizScores[g.no]?.[qNo] === true);
                      const someCorrect = myGroupObjs.some(g => quizScores[g.no]?.[qNo] === true);
                      return (
                        <button
                          key={qNo}
                          onClick={() => { setQuizCurrentQ(qNo); setQuizPickerOpen(false); setQuizShowQuestion(false); }}
                          style={{
                            aspectRatio:'1',borderRadius:10,border:'2px solid',
                            fontSize:13,fontWeight:800,cursor:'pointer',
                            background: isCurrent
                              ? '#fbbf24'
                              : allCorrect
                                ? '#0a1a0a'
                                : someCorrect
                                  ? '#0d1a10'
                                  : answered
                                    ? '#0a0e1a'
                                    : '#111827',
                            color: isCurrent
                              ? '#000'
                              : allCorrect
                                ? '#22c55e'
                                : someCorrect
                                  ? '#4ade80'
                                  : '#475569',
                            borderColor: isCurrent
                              ? '#fbbf24'
                              : allCorrect
                                ? '#22c55e66'
                                : someCorrect
                                  ? '#22c55e33'
                                  : '#1e293b',
                            transition:'all 0.1s'
                          }}>
                          {qNo}
                        </button>
                      );
                    })}
                  </div>
                  {/* Renk açıklaması */}
                  <div style={{display:'flex',gap:14,marginTop:16,flexWrap:'wrap'}}>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <div style={{width:12,height:12,borderRadius:3,background:'#fbbf24'}}/>
                      <span style={{fontSize:11,color:'#64748b'}}>Mevcut soru</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <div style={{width:12,height:12,borderRadius:3,background:'#0a1a0a',border:'1px solid #22c55e66'}}/>
                      <span style={{fontSize:11,color:'#64748b'}}>Tümü doğru</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <div style={{width:12,height:12,borderRadius:3,background:'#111827',border:'1px solid #1e293b'}}/>
                      <span style={{fontSize:11,color:'#64748b'}}>İşaretlenmedi</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Sonuçlar ekranı
    if (quizStep === 'results' && quizRole !== 'host') {
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
              <button style={{...S.smallBtn, marginRight:4}} onClick={() => {
                setQuizStep('scoring');
              }}>← Geri</button>
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
  // ─── SERAMİK TAKİP EKRANI ────────────────────────────────────────────────────
  if (mode === 'ceramics') {
    const STATUS_LABELS = {
      firinda:     { label:'Fırında',      color:'#f59e0b', bg:'#1a1000' },
      hazir:       { label:'Hazır',        color:'#4fc9ff', bg:'#001a2a' },
      arandi:      { label:'Arandı',       color:'#a78bfa', bg:'#0f0020' },
      ulasilamadi: { label:'Ulaşılamadı', color:'#f87171', bg:'#1a0000' },
      teslimaldi:  { label:'Teslim Aldı', color:'#22c55e', bg:'#001a00' },
    };

    const records = (ceramicsData?.records || []);
    const sessions = (ceramicsData?.sessions || []);

    const filtered = records.filter(r => {
      const q = ceramicsSearch.toLowerCase();
      const matchSearch = !q ||
        r.firstName?.toLowerCase().includes(q) ||
        r.lastName?.toLowerCase().includes(q) ||
        r.phone?.includes(q) ||
        String(r.no).includes(q);
      const matchStatus = ceramicsStatusFilter === 'all' || r.status === ceramicsStatusFilter;
      return matchSearch && matchStatus;
    });

    const saveRecord = async () => {
      if (!ceramicsForm.firstName && !ceramicsForm.lastName) return alert('İsim veya soyisim gerekli');
      setCeramicsSaving(true);
      try {
        const fd = new FormData();
        fd.append('firstName', ceramicsForm.firstName);
        fd.append('lastName', ceramicsForm.lastName);
        fd.append('phone', ceramicsForm.phone);
        fd.append('notes', ceramicsForm.notes);
        fd.append('sessionId', ceramicsForm.sessionId);
        if (ceramicsImageFile) fd.append('image', ceramicsImageFile);
        const r = await fetch('/api/ceramics/record', { method:'POST', body: fd });
        const d = await r.json();
        if (d.success) {
          await fetchCeramics();
          setCeramicsView('list');
          setCeramicsForm({ firstName:'', lastName:'', phone:'', notes:'', sessionId:'' });
          setCeramicsImageFile(null); setCeramicsImagePreview(null);
        } else { alert('Hata: ' + d.error); }
      } catch(e) { alert('Bağlantı hatası'); }
      setCeramicsSaving(false);
    };

    const updateStatus = async (no, status) => {
      await fetch('/api/ceramics/record/' + no + '/status', {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status })
      });
      // Local state zaten optimistic olarak güncellendi, fetchCeramics sadece detay view için çağrılır
      if (ceramicsView === 'detail') {
        await fetchCeramics();
      }
    };

    const saveSession = async () => {
      if (!ceramicsSessionForm.participantCount) return alert('Katılımcı sayısı gerekli');
      setCeramicsSaving(true);
      try {
        const r = await fetch('/api/ceramics/session', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify(ceramicsSessionForm)
        });
        const d = await r.json();
        if (d.success) { await fetchCeramics(); setCeramicsView('list'); }
      } catch(e) { alert('Hata'); }
      setCeramicsSaving(false);
    };

    return (
      <div style={S.page}>
        <div style={S.header}>
          <div style={S.headerLeft}>
            <button style={{...S.smallBtn, marginRight:4}} onClick={() => {
              if (ceramicsView === 'detail') { setCeramicsView('list'); setCeramicsSelected(null); }
              else if (ceramicsView === 'new') { setCeramicsView('list'); }
              else { setMode(null); }
            }}>← Geri</button>
          </div>
          <span style={{fontSize:13,fontWeight:800,letterSpacing:2,color:'#fff'}}>🏺 SERAMİK TAKİP</span>
          <div style={{display:'flex',gap:6}}>
            <button style={{...S.smallBtn, background:'#4fc9ff22', color:'#4fc9ff', border:'1px solid #4fc9ff44'}}
              onClick={() => { setCeramicsView('new'); }}>+ Kayıt</button>
          </div>
        </div>

        <div style={{maxWidth:600,margin:'0 auto',padding:'16px 14px'}}>

          {/* YENİ KAYIT FORMU */}
          {ceramicsView === 'new' && (
            <div style={{background:'#0d1120',border:'1px solid #1a2035',borderRadius:16,padding:'18px 18px',marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:800,color:'#4fc9ff',marginBottom:16}}>Yeni Ürün Kaydı</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                <div>
                  <div style={{fontSize:11,color:'#475569',marginBottom:4}}>Ad</div>
                  <input value={ceramicsForm.firstName} onChange={e=>setCeramicsForm(p=>({...p,firstName:e.target.value}))}
                    placeholder="Ad" style={{...S.input,marginBottom:0}} />
                </div>
                <div>
                  <div style={{fontSize:11,color:'#475569',marginBottom:4}}>Soyad</div>
                  <input value={ceramicsForm.lastName} onChange={e=>setCeramicsForm(p=>({...p,lastName:e.target.value}))}
                    placeholder="Soyad" style={{...S.input,marginBottom:0}} />
                </div>
              </div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:'#475569',marginBottom:4}}>Telefon</div>
                <input value={ceramicsForm.phone} onChange={e=>setCeramicsForm(p=>({...p,phone:e.target.value}))}
                  placeholder="05xx xxx xx xx" style={{...S.input,marginBottom:0}} type="tel" />
              </div>
              {sessions.length > 0 && (
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:'#475569',marginBottom:4}}>Etkinlik (opsiyonel)</div>
                  <select value={ceramicsForm.sessionId} onChange={e=>setCeramicsForm(p=>({...p,sessionId:e.target.value}))}
                    style={{...S.input,marginBottom:0}}>
                    <option value="">Seçilmedi</option>
                    {sessions.map(s=>(
                      <option key={s.id} value={s.id}>{s.date} · {s.category} · {s.participantCount} kişi</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:'#475569',marginBottom:4}}>Not (opsiyonel)</div>
                <input value={ceramicsForm.notes} onChange={e=>setCeramicsForm(p=>({...p,notes:e.target.value}))}
                  placeholder="Ürün detayı, renk vb." style={{...S.input,marginBottom:0}} />
              </div>
              {/* Görsel yükleme */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,color:'#475569',marginBottom:4}}>Ürün Görseli</div>
                <label style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
                  borderRadius:10,border:'2px dashed ' + (ceramicsImagePreview ? '#22c55e' : '#1a2035'),
                  cursor:'pointer',background:'#07090f'}}>
                  <span style={{fontSize:20}}>{ceramicsImagePreview ? '✅' : '📷'}</span>
                  <span style={{fontSize:12,color: ceramicsImagePreview ? '#22c55e' : '#475569'}}>
                    {ceramicsImageFile ? ceramicsImageFile.name : 'Fotoğraf seç veya çek'}
                  </span>
                  <input type="file" accept="image/*" capture="environment" style={{display:'none'}}
                    onChange={e=>{
                      const f = e.target.files[0];
                      if (!f) return;
                      setCeramicsImageFile(f);
                      const reader = new FileReader();
                      reader.onload = ev => setCeramicsImagePreview(ev.target.result);
                      reader.readAsDataURL(f);
                    }} />
                </label>
                {ceramicsImagePreview && (
                  <img src={ceramicsImagePreview} alt="önizleme"
                    style={{marginTop:8,width:'100%',maxHeight:200,objectFit:'cover',borderRadius:8}} />
                )}
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={() => { setCeramicsView('list'); setCeramicsImageFile(null); setCeramicsImagePreview(null); }}
                  style={{...S.smallBtn,flex:1}}>İptal</button>
                <button onClick={saveRecord} disabled={ceramicsSaving}
                  style={{flex:2,padding:'10px',borderRadius:10,border:'none',cursor:'pointer',
                    background:'#4fc9ff',color:'#000',fontWeight:800,fontSize:14}}>
                  {ceramicsSaving ? '⟳ Kaydediliyor…' : '✓ Kaydet'}
                </button>
              </div>
            </div>
          )}

          {/* DETAY EKRANI */}
          {ceramicsView === 'detail' && ceramicsSelected && (
            <div style={{background:'#0d1120',border:'1px solid #1a2035',borderRadius:16,padding:'18px',marginBottom:16}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                <div style={{fontSize:16,fontWeight:800,color:'#fff',flex:1}}>
                  #{ceramicsSelected.no} · {ceramicsSelected.firstName} {ceramicsSelected.lastName}
                </div>
                <button onClick={async ()=>{
                  if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
                  await fetch('/api/ceramics/record/' + ceramicsSelected.no, { method:'DELETE' });
                  await fetchCeramics();
                  setCeramicsView('list'); setCeramicsSelected(null);
                }} style={{padding:'6px 12px',borderRadius:8,border:'1px solid #f8717144',cursor:'pointer',
                  background:'#1a0000',color:'#f87171',fontSize:12,fontWeight:700}}>🗑 Sil</button>
              </div>
              {ceramicsSelected.imageUrl && (
                <img src={ceramicsSelected.imageUrl} alt="ürün"
                  style={{width:'100%',maxHeight:260,objectFit:'cover',borderRadius:12,marginBottom:14}} />
              )}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
                <div style={{background:'#07090f',borderRadius:10,padding:'10px 12px'}}>
                  <div style={{fontSize:10,color:'#475569',marginBottom:3}}>TELEFON</div>
                  {ceramicsSelected.phone
                    ? <a href={'tel:' + ceramicsSelected.phone}
                        style={{fontSize:14,color:'#4fc9ff',fontWeight:700,textDecoration:'none'}}>
                        📞 {ceramicsSelected.phone}
                      </a>
                    : <div style={{fontSize:14,color:'#475569'}}>—</div>
                  }
                </div>
                <div style={{background:'#07090f',borderRadius:10,padding:'10px 12px'}}>
                  <div style={{fontSize:10,color:'#475569',marginBottom:3}}>KAYIT TARİHİ</div>
                  <div style={{fontSize:12,color:'#fff'}}>{ceramicsSelected.createdAt?.slice(0,10)}</div>
                </div>
              </div>
              {ceramicsSelected.notes && (
                <div style={{background:'#07090f',borderRadius:10,padding:'10px 12px',marginBottom:14}}>
                  <div style={{fontSize:10,color:'#475569',marginBottom:3}}>NOT</div>
                  <div style={{fontSize:13,color:'#94a3b8'}}>{ceramicsSelected.notes}</div>
                </div>
              )}
              <div style={{fontSize:11,color:'#475569',marginBottom:8,fontWeight:700}}>DURUM GÜNCELLE</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14}}>
                {Object.entries(STATUS_LABELS).map(([k,v])=>(
                  <button key={k} onClick={async ()=>{
                    await updateStatus(ceramicsSelected.no, k);
                    setCeramicsSelected(p=>({...p, status:k}));
                  }}
                    style={{padding:'8px 14px',borderRadius:10,border:'2px solid',cursor:'pointer',fontSize:12,fontWeight:700,
                      background: ceramicsSelected.status===k ? v.bg : '#07090f',
                      color: ceramicsSelected.status===k ? v.color : '#475569',
                      borderColor: ceramicsSelected.status===k ? v.color : '#1a2035'}}>
                    {v.label}
                  </button>
                ))}
              </div>
              {/* Durum geçmişi */}
              {ceramicsSelected.statusHistory?.length > 0 && (
                <div>
                  <div style={{fontSize:11,color:'#475569',marginBottom:6,fontWeight:700}}>GEÇMİŞ</div>
                  {[...ceramicsSelected.statusHistory].reverse().map((h,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',
                      borderBottom:'1px solid #0d1120',fontSize:12}}>
                      <span style={{color: STATUS_LABELS[h.status]?.color || '#94a3b8'}}>{STATUS_LABELS[h.status]?.label || h.status}</span>
                      <span style={{color:'#475569'}}>{h.date?.slice(0,16).replace('T',' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LİSTE */}
          {ceramicsView === 'list' && (
            <>
              {/* Arama */}
              <div style={{position:'relative',marginBottom:10}}>
                <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'#475569'}}>🔍</span>
                <input value={ceramicsSearch} onChange={e=>setCeramicsSearch(e.target.value)}
                  placeholder="Ad, soyad, telefon veya ürün no ile ara…"
                  style={{...S.input,marginBottom:0,paddingLeft:36}} />
              </div>
              {/* Durum filtresi */}
              <div style={{display:'flex',gap:6,marginBottom:14,overflowX:'auto',paddingBottom:2}}>
                {[['all','Tümü','#94a3b8'], ...Object.entries(STATUS_LABELS).map(([k,v])=>[k,v.label,v.color])].map(([k,label,color])=>(
                  <button key={k} onClick={()=>setCeramicsStatusFilter(k)}
                    style={{padding:'5px 12px',borderRadius:20,border:'1px solid',cursor:'pointer',
                      fontSize:11,fontWeight:700,whiteSpace:'nowrap',
                      background: ceramicsStatusFilter===k ? '#0f1525' : 'transparent',
                      color: ceramicsStatusFilter===k ? color : '#374151',
                      borderColor: ceramicsStatusFilter===k ? color : '#1a2035'}}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Özet */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
                {[
                  {label:'Toplam Ürün', value: records.length, color:'#4fc9ff'},
                  {label:'Fırında', value: records.filter(r=>r.status==='firinda').length, color:'#f59e0b'},
                  {label:'Teslim Aldı', value: records.filter(r=>r.status==='teslimaldi').length, color:'#22c55e'},
                ].map(s=>(
                  <div key={s.label} style={{background:'#0d1120',border:'1px solid #1a2035',borderRadius:12,padding:'10px',textAlign:'center'}}>
                    <div style={{fontSize:20,fontWeight:800,color:s.color}}>{s.value}</div>
                    <div style={{fontSize:10,color:'#475569'}}>{s.label}</div>
                  </div>
                ))}
              </div>

              {ceramicsLoading && <div style={{textAlign:'center',color:'#475569',padding:20}}>⟳ Yükleniyor…</div>}

              {filtered.length === 0 && !ceramicsLoading && (
                <div style={{textAlign:'center',color:'#475569',padding:30}}>
                  {ceramicsSearch ? 'Aramanızla eşleşen kayıt yok.' : 'Henüz kayıt yok. + Kayıt butonuna basın.'}
                </div>
              )}

              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {filtered.map(r=>{
                  const st = STATUS_LABELS[r.status] || STATUS_LABELS.firinda;
                  return (
                    <div key={r.no} style={{borderRadius:14,border:'1px solid #1a2035',background:'#0d1120',overflow:'hidden',marginBottom:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px'}}>
                        <button onClick={()=>{ setCeramicsSelected(r); setCeramicsView('detail'); }}
                          style={{display:'flex',alignItems:'center',gap:12,flex:1,background:'transparent',border:'none',cursor:'pointer',textAlign:'left',padding:0}}>
                          {r.imageUrl
                            ? <img src={r.imageUrl} alt="" style={{width:48,height:48,borderRadius:8,objectFit:'cover',flexShrink:0}} />
                            : <div style={{width:48,height:48,borderRadius:8,background:'#0a0e1a',display:'flex',alignItems:'center',
                                justifyContent:'center',fontSize:20,flexShrink:0}}>🏺</div>
                          }
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:14,fontWeight:700,color:'#fff',marginBottom:2}}>
                              #{r.no} · {r.firstName} {r.lastName}
                            </div>
                            <div style={{fontSize:12,color:'#475569'}}>{r.phone || '—'}</div>
                          </div>
                        </button>
                        {/* Durum dropdown — sağda */}
                        <select
                          value={r.status}
                          onChange={async(e)=>{
                            const newStatus = e.target.value;
                            // Optimistic update — önce local state'i güncelle
                            setCeramicsData(prev => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                records: prev.records.map(rec =>
                                  rec.no === r.no ? {...rec, status: newStatus} : rec
                                )
                              };
                            });
                            await updateStatus(r.no, newStatus);
                          }}
                          onClick={e=>e.stopPropagation()}
                          style={{
                            padding:'6px 24px 6px 10px', borderRadius:20,
                            border:'1px solid ' + st.color,
                            background: st.bg, color: st.color,
                            fontSize:11, fontWeight:700, cursor:'pointer', flexShrink:0,
                            appearance:'none', WebkitAppearance:'none',
                            backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='${encodeURIComponent(st.color)}'/%3E%3C/svg%3E")`,
                            backgroundRepeat:'no-repeat', backgroundPosition:'right 8px center'
                          }}>
                          {Object.entries(STATUS_LABELS).map(([k,v])=>(
                            <option key={k} value={k} style={{background:'#0d1120',color:v.color}}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Etkinlikler özeti */}
              {sessions.length > 0 && (
                <div style={{marginTop:20}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#475569',marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>
                    Etkinlikler
                  </div>
                  {[...sessions].reverse().slice(0,5).map(s=>(
                    <div key={s.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                      padding:'10px 14px',borderRadius:12,background:'#0d1120',border:'1px solid #1a2035',marginBottom:6}}>
                      <div>
                        <div style={{fontSize:13,color:'#fff',fontWeight:700}}>{s.category}</div>
                        <div style={{fontSize:11,color:'#475569'}}>{s.date} {s.notes ? '· ' + s.notes : ''}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:18,fontWeight:800,color:'#4fc9ff'}}>{s.participantCount}</div>
                        <div style={{fontSize:10,color:'#475569'}}>katılımcı</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

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
            onClick={() => { setMode('ceramics'); fetchCeramics(); }}
            style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'15px 22px',
              borderRadius:14,border:'1px solid #1a2035',cursor:'pointer',textAlign:'left',
              background:'#0d1120',transition:'all 0.2s'}}
            onMouseOver={e=>{e.currentTarget.style.borderColor='#f59e0b';e.currentTarget.style.background='#0f1525';}}
            onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.background='#0d1120';}}>
            <span style={{fontSize:26}}>🏺</span>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start'}}>
              <span style={{fontSize:14,fontWeight:700,color:'#94a3b8',marginBottom:4}}>Seramik Takip</span>
              <span style={{fontSize:11,color:'#374151',lineHeight:1.5}}>Ürün kayıt, durum ve teslim takibi</span>
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
          {/* Seramik Takip */}
          <div style={{padding:'0 18px 6px', maxWidth:720, margin:'0 auto'}}>
            <button
              onClick={() => { setMode('ceramics'); fetchCeramics(); }}
              style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'15px 22px',
                borderRadius:14,border:'1px solid #1a2035',cursor:'pointer',textAlign:'left',
                background:'#0d1120',boxShadow:'none',transition:'all 0.2s'}}
              onMouseOver={e=>{e.currentTarget.style.borderColor='#f59e0b';e.currentTarget.style.background='#0f1525';}}
              onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.background='#0d1120';}}>
              <span style={{fontSize:26}}>🏺</span>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start'}}>
                <span style={{fontSize:14,fontWeight:700,color:'#94a3b8',marginBottom:4}}>Seramik Takip</span>
                <span style={{fontSize:11,color:'#374151',lineHeight:1.5}}>Ürün kayıt, durum ve teslim takibi</span>
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
