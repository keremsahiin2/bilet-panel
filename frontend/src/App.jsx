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
          const loadSalesWithRetry = async (fromRefresh = false, retries = 0) => {
            try {
              const endpoint = fromRefresh ? "/api/sales/refresh" : "/api/sales";
              const opts = fromRefresh ? { method: "POST" } : undefined;
              const r = await fetch(endpoint, opts);
              const d = await r.json();
              if (!d.error) {
                const ideasoftOk = (d.ideasoft || []).length > 0;
                if (!ideasoftOk && retries < 3) {
                  await new Promise(res => setTimeout(res, 2000));
                  return loadSalesWithRetry(true, retries + 1);
                }
                setSalesData(d);
                setLastUpdated(new Date().toLocaleTimeString("tr-TR"));
              }
            } catch(e) {}
            setSalesLoading(false);
          };
          if (json.ready) {
            loadSalesWithRetry(false);
          } else {
            const poll = setInterval(() => {
              fetch('/api/login-status').then(r=>r.json()).then(s => {
                if (s.ready) {
                  clearInterval(poll);
                  loadSalesWithRetry(false);
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
      const loadAfterLogin = async (retries = 0) => {
        try {
          const r = await fetch("/api/sales");
          const d = await r.json();
          if (!d.error) {
            const ideasoftOk = (d.ideasoft || []).length > 0;
            if (!ideasoftOk && retries < 3) {
              await new Promise(res => setTimeout(res, 2000));
              const r2 = await fetch("/api/sales/refresh", { method: "POST" });
              const d2 = await r2.json();
              if (!d2.error) {
                const ok2 = (d2.ideasoft || []).length > 0;
                if (!ok2 && retries < 2) return loadAfterLogin(retries + 1);
                setSalesData(d2); setLastUpdated(new Date().toLocaleTimeString("tr-TR"));
              } else { setSalesData(d); setLastUpdated(new Date().toLocaleTimeString("tr-TR")); }
            } else {
              setSalesData(d); setLastUpdated(new Date().toLocaleTimeString("tr-TR"));
            }
          }
        } catch(e) {}
        setSalesLoading(false);
      };
      const poll = setInterval(() => {
        fetch('/api/login-status').then(r=>r.json()).then(s => {
          if (s.ready) {
            clearInterval(poll);
            loadAfterLogin();
          } else if (s.status === 'error') {
            clearInterval(poll);
            setSalesLoading(false);
          }
        }).catch(()=>{});
      }, 800);
    } catch(e) { setLoginError(e.message); }
    finally { setLoginLoading(false); }
  };

  const fetchSales = async (retryCount = 0) => {
    setSalesLoading(true); setSalesError(null);
    setSalesData(null); // Eski cache'i temizle
    try {
      const res  = await fetch("/api/sales/refresh", { method: "POST" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      // İdeasoft verisi gelmemişse max 3 kez otomatik yenile
      const ideasoftOk = (json.ideasoft || []).length > 0;
      if (!ideasoftOk && retryCount < 3) {
        setSalesData(null);
        setSalesLoading(false);
        await new Promise(r => setTimeout(r, 2000));
        return fetchSales(retryCount + 1);
      }
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
              <img src="data:image/png;base64,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" alt="sosyal sanathane logo" style={{width:72, height:72, objectFit:"contain"}} />
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
              <>
                <div style={{display:'flex',gap:6,marginBottom:ideasoftOk?14:8}}>
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
                {!ideasoftOk && !salesLoading && (
                  <div style={{background:'#1a0d00',border:'1px solid #f59e0b44',borderRadius:8,padding:'8px 12px',
                    display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:14}}>
                    <span style={{fontSize:12,color:'#f59e0b',fontWeight:600}}>⚠ İdeasoft verisi alınamadı</span>
                    <button onClick={fetchSales} style={{padding:'4px 12px',borderRadius:6,border:'none',
                      background:'linear-gradient(135deg,#f59e0b,#d97706)',color:'#000',
                      fontSize:11,fontWeight:800,cursor:'pointer'}}>⟳ Yenile</button>
                  </div>
                )}
              </>
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
                    // Soru sayısını yüklü dosyadan otomatik tespit et
                    const detectedQ = Object.keys(quizQuestions).length;
                    if (detectedQ === 50 || detectedQ === 55) {
                      QUIZ_EVENTS.genelkultur.totalQ = detectedQ;
                    }
                    setQuizEventType(key);
                    setQuizGroups([]); setQuizGroupCountSet(false); setQuizGroupCount('');
                    setQuizScores({}); setQuizMyGroups([]); setQuizCurrentQ(1);
                    setQuizStep('groups');
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
