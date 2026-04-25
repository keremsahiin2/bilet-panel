require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const axios    = require('axios');
const fs       = require('fs');
const path     = require('path');
const mammoth  = require('mammoth');
const multer   = require('multer');
const upload   = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json());

let bubiletData    = null;
let biletinialData = null;
let ideasoftData   = null;
let lastFetch      = null;
let ideasoftCookies    = null;
let ideasoftCsrfToken  = null;

// Options cache — fetchAllOptions sonucunu memory'de tut, her bulk'ta tekrar çekme
let cachedAllOptions     = [];
let cachedAllOptionsTime = 0;
const OPTIONS_CACHE_TTL  = 30 * 60 * 1000; // 30 dakika — options nadiren değişir

// JSONBin in-memory cache — her /api/sales çağrısında JSONBin'e gitmeyi önler
let jsonbinCache     = null; // { baseline:{}, monthlySales:{} }
let jsonbinCacheDirty = false; // memory ↔ remote fark var mı

// Seans yazdırma progress tracking — jobId → { total, done, errors, current, finished, results }
const bulkProgressMap = {};


// ─── Cloudinary ────────────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD = 'dmjlegofm';
const CLOUDINARY_API_KEY = '458914864563979';
const CLOUDINARY_API_SECRET = 'foICaTxRH3pPOlItnj3AdLDTCrk';
const cloudinaryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });




const STOCK_BASELINE_FILE = path.join(__dirname, 'stock_baseline.json');
const SAVED_CREDS_FILE    = path.join(__dirname, 'saved_credentials.json');
const COOKIES_FILE        = path.join(__dirname, 'ideasoft_cookies.json');
const DEFAULT_BASELINE    = 8;
const CATEGORY_BASELINE = {
  'Heykel': 10, 'Bez Çanta': 10, 'Resim': 10, '3D Figür': 10,
  'Maske': 10, 'Plak Boyama': 10, 'Seramik': 8, 'Cupcake Mum': 8,
  'Punch': 8, 'Quiz Night': 50, 'Mekanda Seç': 10
};

// Eş zamanlı istek sınırlayıcı — max N istek aynı anda uçar
async function pLimit(items, fn, concurrency) {
  var results = new Array(items.length);
  var idx = 0;
  async function worker() {
    while (idx < items.length) {
      var i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  var workers = [];
  for (var w = 0; w < Math.min(concurrency, items.length); w++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

// Array kullanıyoruz — object key'leri numerik olunca JS küçükten büyüğe sıralar
// ve Seramik (12671) hep sona kalıp rate limit yiyordu. Array sırayı korur.
const IDEASOFT_PRODUCTS = [
  [12671,'Seramik'],   // önce çek — en büyük ID, object'te hep sona düşüyordu
  [4234,'3D Figür'],
  [4241,'Resim'],
  [4243,'Bez Çanta'],
  [4245,'Maske'],
  [4247,'Heykel'],
  [4249,'Plak Boyama'],
  [4251,'Quiz Night'],
  [4252,'Cupcake Mum'],
  [4278,'Punch'],
  [5135,'Mekanda Seç'],
];

// ─── JSONBin — kalıcı baseline storage ────────────────────────────────────────
const JSONBIN_BIN_ID  = '69cef0d036566621a8740cdb';
const JSONBIN_API_KEY = '$2a$10$cip66R4w.2tIzZWE8g9YkO1PUm.m8qnmKKKb0lZFEFGAoXyxqIPZm';
// Seramik için AYRI bin — quiz/baseline ile çakışmaz, daha hızlı
const CERAMICS_BIN_ID = '69e7b2a4856a6821895a1d4b';
var ceramicsBinId = CERAMICS_BIN_ID;
var ceramicsCache = null; // { records:[], nextNo:1 }

async function loadCeramicsFromBin() {
  if (ceramicsCache) return ceramicsCache;
  try {
    var res = await axios.get('https://api.jsonbin.io/v3/b/' + ceramicsBinId + '/latest',
      { headers: { 'X-Master-Key': JSONBIN_API_KEY } }
    );
    ceramicsCache = res.data.record || { records: [], nextNo: 1 };
    if (!ceramicsCache.records) ceramicsCache.records = [];
    if (!ceramicsCache.nextNo) ceramicsCache.nextNo = 1;
    console.log('Ceramics: yuklendi,', ceramicsCache.records.length, 'kayit');
  } catch(e) {
    console.error('Ceramics okuma hatasi:', e.message);
    ceramicsCache = { records: [], nextNo: 1 };
  }
  return ceramicsCache;
}

// Arka planda yaz — kullanıcıyı beklettirme
function saveCeramicsAsync() {
  if (!ceramicsCache) return;
  axios.put('https://api.jsonbin.io/v3/b/' + ceramicsBinId,
    ceramicsCache,
    { headers: { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' } }
  ).then(() => {
    console.log('Ceramics: kaydedildi,', ceramicsCache.records.length, 'kayit');
  }).catch(e => {
    console.error('Ceramics yazma hatasi:', e.message);
  });
}


const MONTHLY_SALES_BIN_ID = '';

// JSONBin kayıtını memory cache'den döndür; yoksa bir kez çek
async function getJsonbinRecord() {
  if (jsonbinCache) return jsonbinCache;
  try {
    var res = await axios.get('https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID + '/latest', {
      headers: { 'X-Master-Key': JSONBIN_API_KEY }
    });
    jsonbinCache = res.data.record || {};
    if (!jsonbinCache.baseline)     jsonbinCache.baseline     = {};
    if (!jsonbinCache.monthlySales) jsonbinCache.monthlySales = {};
    console.log('JSONBin: cache yuklendi (baseline kayit sayisi:', Object.keys(jsonbinCache.baseline).length, ')');
  } catch(e) {
    console.error('JSONBin okuma hatasi:', e.message);
    jsonbinCache = { baseline:{}, monthlySales:{} };
  }
  return jsonbinCache;
}

// Cache\'i remote\'a yaz (sadece degisiklik varsa cagir)
async function flushJsonbinCache() {
  if (!jsonbinCache) return;
  try {
    await axios.put('https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID,
      { baseline: jsonbinCache.baseline, monthlySales: jsonbinCache.monthlySales, malzemeStock: jsonbinCache.malzemeStock || {}, quizData: jsonbinCache.quizData || null },
      { headers: { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' } });
    jsonbinCacheDirty = false;
    console.log('JSONBin: cache remote\'a yazildi');
  } catch(e) {
    console.error('JSONBin yazma hatasi:', e.message);
  }
}

async function loadBaseline() {
  var rec = await getJsonbinRecord();
  return rec.baseline || {};
}

async function saveBaseline(baseline) {
  var rec = await getJsonbinRecord();
  rec.baseline = baseline;
  jsonbinCacheDirty = true;
  await flushJsonbinCache();
}

// ─── Aylik satis arsivi (kalici — seanslar silinse bile korunur) ───────────────
async function loadMonthlySales() {
  var rec = await getJsonbinRecord();
  return rec.monthlySales || {};
}

async function saveMonthlySalesAndBaseline(baseline, monthlySales) {
  var rec = await getJsonbinRecord();
  rec.baseline     = baseline;
  rec.monthlySales = monthlySales;
  jsonbinCacheDirty = true;
  await flushJsonbinCache();
}

// İdeasoft seanslarından aylık satış verisini çıkarıp mevcut arşivle birleştir
// KURAL: Sadece başlangıç saati geçmiş seanslar aylık toplama yansır.
// Seans başlamadan bilet iptali olabilir → seans başlayana kadar aylık raporlara ekleme.
function mergeIdeasoftIntoMonthlySales(existing, ideasoftSeances, baseline) {
  var TR_MONTHS_SRV = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  var merged = JSON.parse(JSON.stringify(existing)); // derin kopya
  var now = new Date();

  ideasoftSeances.forEach(function(s) {
    if (!s.fullName || !s.seanceId) return;
    // fullName'den ay ve saat bilgisini çıkar
    var m = s.fullName.match(/- (\d+) (\w+) (\w+) (\d{2}:\d{2})/u);
    if (!m) return;
    var dayNum   = parseInt(m[1]);
    var monthKey = m[2]; // "Nisan"
    var startTimeStr = m[4]; // "17:00"
    if (!TR_MONTHS_SRV.includes(monthKey)) return;

    // Başlangıç saatini hesapla
    var monIdx = TR_MONTHS_SRV.indexOf(monthKey);
    var timeParts = startTimeStr.split(':');
    var startH = parseInt(timeParts[0]);
    var startMin = parseInt(timeParts[1]);
    // Yıl tahmini: geçen yıl mı bu yıl mı? Basit yaklaşım: şu an ile karşılaştır
    var candidateYear = now.getFullYear();
    var seanceStart = new Date(candidateYear, monIdx, dayNum, startH, startMin, 0);
    // Eğer seans bu yılda geleceğe ait görünüyorsa (ama ay geçmişse) → geçen yıl olabilir
    // En basit: eğer seans başlamamışsa atla
    if (now < seanceStart) {
      // Seans henüz başlamadı — aylık toplama ekleme
      return;
    }

    var cat = s.category;
    var base = (baseline && baseline[s.seanceId]) || CATEGORY_BASELINE[cat] || DEFAULT_BASELINE;
    var sold = Math.max(0, base - (s.stockAmount !== null ? s.stockAmount : base));
    if (sold === 0) return;

    if (!merged[monthKey]) merged[monthKey] = {};
    // Seansa özel key — her seans bir kez sayılır, üzerine yazılır (mevcut sold ile max alınır)
    var seanceKey = '_s_' + s.seanceId;
    var prevSold = (merged[monthKey][seanceKey] && merged[monthKey][seanceKey]._sold) || 0;
    // Daha fazla satış varsa güncelle (azalmaz — seans silinse bile önceki değer korunur)
    if (sold >= prevSold) {
      if (!merged[monthKey][seanceKey]) merged[monthKey][seanceKey] = { cat, _sold: 0 };
      merged[monthKey][seanceKey]._sold = sold;
    }
  });

  return merged;
}

// monthlySales'i UI için düz { ay: { kategori: toplam } } formatına çevir
function flattenMonthlySales(monthlySales) {
  var result = {};
  Object.keys(monthlySales).forEach(function(month) {
    result[month] = {};
    Object.keys(monthlySales[month]).forEach(function(seanceKey) {
      var entry = monthlySales[month][seanceKey];
      var cat  = entry.cat;
      var sold = entry._sold || 0;
      result[month][cat] = (result[month][cat] || 0) + sold;
    });
  });
  return result;
}

// ─── Yardımcı ──────────────────────────────────────────────────────────────────
function loadJson(file) {
  try {
    if (fs.existsSync(file)) {
      var raw = fs.readFileSync(file,'utf8').trim();
      if (raw) return JSON.parse(raw);
    }
  } catch(e){}
  return null;
}
function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function toCookieStr(cookies) {
  return cookies.map(c => c.name+'='+c.value).join('; ');
}

// ─── Bubilet ───────────────────────────────────────────────────────────────────

// Bubilet biletAdi → kategori adı eşleştirmesi (ticket-list detayı için)
function bubiletBiletAdiToCategory(biletAdi) {
  if (!biletAdi) return null;
  if (biletAdi.includes('3D') || biletAdi.toLowerCase().includes('3d figür')) return '3D Figür';
  if (biletAdi.includes('Punch') || biletAdi.toLowerCase().includes('punch')) return 'Punch';
  if (biletAdi.includes('Seramik')) return 'Seramik';
  if (biletAdi.includes('Cupcake') || biletAdi.includes('Mum')) return 'Cupcake Mum';
  if (biletAdi.includes('Quiz')) return 'Quiz Night';
  if (biletAdi.includes('Plak')) return 'Plak Boyama';
  if (biletAdi.includes('Maske')) return 'Maske';
  if (biletAdi.includes('Heykel')) return 'Heykel';
  if (biletAdi.includes('Bez')) return 'Bez Çanta';
  if (biletAdi.includes('Resim')) return 'Resim';
  if (biletAdi.includes('Mekanda')) return 'Mekanda Seç';
  return biletAdi; // tanınmıyorsa biletAdi'ni olduğu gibi döndür
}

async function fetchBubilet(username, password) {
  const BUBILET_HEADERS = {
    'Content-Type':    'application/json',
    'Origin':          'https://panel.bubilet.com.tr',
    'Referer':         'https://panel.bubilet.com.tr/',
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'application/json, text/plain, */*',
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
  };

  const tokenRes = await axios.post(
    'https://oldpanel.api.bubilet.com.tr/token',
    { username, password },
    { headers: BUBILET_HEADERS }
  );
  const token = tokenRes.data.access_token;
  if (!token) throw new Error('Bubilet token alinamadi');

  const authHeaders = { ...BUBILET_HEADERS, 'Authorization': 'Bearer ' + token };

  const result = await axios.post(
    'https://oldpanel.api.bubilet.com.tr/api/Satis/SeansGrupluSatislars',
    { page:0, perPage:100000, order:'tarih', descending:false,
      filter:{ etkinlikAdi:'', tarih_BasTarih:null, tarih_BitTarih:null, seansAktif:null, koltukSecimi:null }},
    { headers: authHeaders }
  );
  const seanslar = result.data.data || [];

  // Bugünün başlangıcı — geçmiş seanslar için detay çekme
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Workshop: bugün/gelecek, biletAdet>0, seansId var
  const workshopSeanslar = seanslar.filter(s => {
    if (!s.etkinlikAdi || !s.etkinlikAdi.toLowerCase().includes('workshop')) return false;
    if (!s.seansId || !s.biletAdet || s.biletAdet === 0) return false;
    if (s.tarih && new Date(s.tarih) < todayStart) return false;
    return true;
  });

  const normalSeanslar = seanslar.filter(s => !workshopSeanslar.includes(s));

  console.log('Workshop detay cekilecek:', workshopSeanslar.length, 'seans (paralel)');

  // Workshop detaylarını eş zamanlı en fazla 8 istekle çek
  async function fetchWorkshopDetail(s) {
    try {
      const detayRes = await axios.get(
        'https://oldpanel.api.bubilet.com.tr/api/v2/ticket-list/' + s.seansId,
        { headers: { ...authHeaders, 'Content-Type': 'application/json; charset=utf-8' },
          timeout: 8000 }
      );
      const detay = detayRes.data;
      if (detay && detay.success && detay.data && Array.isArray(detay.data.detaySatisRaporlar)) {
        const rows = [];
        for (const bilet of detay.data.detaySatisRaporlar) {
          if (!bilet.biletAdet || bilet.biletAdet === 0) continue;
          const cat = bubiletBiletAdiToCategory(bilet.biletAdi);
          rows.push({ ...s, _workshopCat: cat, _workshopBiletAdi: bilet.biletAdi,
            biletAdet: bilet.biletAdet, etkinlikAdi: cat });
        }
        console.log('Workshop OK:', s.seansId, rows.length, 'tur');
        return rows.length > 0 ? rows : [s];
      }
      return [s];
    } catch (err) {
      console.error('Workshop ticket-list hatasi seansId=' + s.seansId + ':', err.message);
      return [s];
    }
  }
  const workshopDetaylar = await pLimit(workshopSeanslar, fetchWorkshopDetail, 8);

  return [...normalSeanslar, ...workshopDetaylar.flat()];
}

// Biletini Al TicketTypeName → kategori adı eşleştirmesi (workshop kırılımları için)
function biletinialTicketTypeToCategory(ticketTypeName) {
  if (!ticketTypeName) return null;
  // Yok sayılacak bilet tipleri (davetli, kupon, toplu satış vb.)
  const ignored = ['davetli','kupon','toplu satış'];
  if (ignored.some(i => ticketTypeName.toLowerCase().includes(i))) return null;
  // "Bez Çanta Boyama Workshop", "Heykel Workshop", "Resim Workshop" vb. — suffix Workshop var
  // Önce spesifik eşleşmeleri yap, suffix önemli değil
  if (ticketTypeName.includes('3D Figür') || ticketTypeName.toLowerCase().includes('3d')) return '3D Figür';
  if (ticketTypeName.includes('Punch')) return 'Punch';
  if (ticketTypeName.includes('Seramik')) return 'Seramik';
  if (ticketTypeName.includes('Cupcake') || (ticketTypeName.includes('Mum') && !ticketTypeName.includes('Workshop'))) return 'Cupcake Mum';
  if (ticketTypeName.includes('Quiz')) return 'Quiz Night';
  if (ticketTypeName.includes('Plak')) return 'Plak Boyama';
  if (ticketTypeName.includes('Maske')) return 'Maske';
  if (ticketTypeName.includes('Heykel')) return 'Heykel';
  if (ticketTypeName.includes('Bez')) return 'Bez Çanta';
  if (ticketTypeName.includes('Resim')) return 'Resim';
  if (ticketTypeName.includes('Mekanda')) return 'Mekanda Seç';
  return null;
}

// ─── Biletini Al ───────────────────────────────────────────────────────────────
async function fetchBiletinial(token) {
  if (!token) return [];

  const biletinialHeaders = {
    'Authorization': 'Bearer ' + token,
    'xapikey': 'TPJDtRG0cP',
    'allow-origin': 'http://localhost:3000',
    'origin': 'https://partner.biletinial.com',
    'referer': 'https://partner.biletinial.com/'
  };

  var now = new Date();
  var future = new Date();
  future.setDate(future.getDate() + 30);

  // ── 1) Aktif seanslar (GetActiveEventDetailList) ──────────────────────────
  var activeSeances = [];
  try {
    var activeRes = await axios.get(
      'https://reportapi2.biletinial.com/api/Report/GetActiveEventDetailList' +
      '?FirstDate=' + encodeURIComponent(now.toUTCString()) +
      '&LastDate='  + encodeURIComponent(future.toUTCString()) + '&lang=tr',
      { headers: biletinialHeaders }
    );
    activeSeances = activeRes.data.Data || [];
    console.log('Biletini Al: aktif seans sayisi:', activeSeances.length);
  } catch (err) {
    console.error('Biletini Al GetActiveEventDetailList hatasi:', err.message);
  }

  // ── 2) Tamamlanmış seanslar (GetSeanceListWithCapacityByDate) ─────────────
  // Bugünden 7 gün geriye + bugüne kadar olan tamamlanmışları çek
  // (etkinlik saati gelince aktiften buraya geçiyor, TotalSoldTicketCount doğru kalıyor)
  var completedSeances = [];
  try {
    var pastFrom = new Date();
    pastFrom.setDate(pastFrom.getDate() - 7);
    var firstDate = pastFrom.toISOString().slice(0, 10);   // "YYYY-MM-DD"
    var lastDate  = now.toISOString().slice(0, 10);         // bugün

    var completedRes = await axios.get(
      'https://reportapi2.biletinial.com/api/Report/GetSeanceListWithCapacityByDate' +
      '?firstDate=' + firstDate + '&lastDate=' + lastDate,
      { headers: biletinialHeaders, timeout: 10000 }
    );
    var rawCompleted = completedRes.data.Data || [];
    // Sadece satışı > 0 olanları al (0 olan tamamlanmışları göstermeye gerek yok)
    completedSeances = rawCompleted.filter(s => s.TotalSoldTicketCount > 0);
    console.log('Biletini Al: tamamlanmis seans sayisi (satisli):', completedSeances.length, '/', rawCompleted.length);
  } catch (err) {
    console.error('Biletini Al GetSeanceListWithCapacityByDate hatasi:', err.message);
  }

  // ── 3) İki listeyi birleştir — SeanceId bazında aktif öncelikli ──────────
  // Aynı SeanceId aktif listede varsa tamamlanmış listeden alma (henüz bitmemiş)
  const activeIds = new Set(activeSeances.map(s => s.SeanceId));
  const mergedSeances = [
    ...activeSeances,
    ...completedSeances
      .filter(s => !activeIds.has(s.SeanceId))
      .map(s => ({
        ...s,
        // Aktif seanslar SalesTicketTotalCount, tamamlananlar TotalSoldTicketCount dondurur
        // App.jsx SalesTicketTotalCount'u bekliyor — normalize et
        SalesTicketTotalCount: s.SalesTicketTotalCount || s.TotalSoldTicketCount || 0,
        // Tamamlanan seans isaretcisi — App.jsx yanlis eslestirmeyi onlemek icin kullanir
        _isCompleted: true
      }))
  ];

  // ── 4) Workshop kırılımı — her iki listede de aynı mantık ────────────────
  const workshopSeances = mergedSeances.filter(s =>
    s.EventName && s.EventName.startsWith('Workshop: Etkinlik Takvimi')
  );
  const normalSeances = mergedSeances.filter(s =>
    !s.EventName || !s.EventName.startsWith('Workshop: Etkinlik Takvimi')
  );

  console.log('Biletini Al: Workshop seans sayisi:', workshopSeances.length);

  // Workshop seansları için GetTicketTypeSalesReport çek (eş zamanlı max 8)
  const workshopExpanded = await pLimit(workshopSeances, async (s) => {
    if (!s.SeanceId) return [s];
    try {
      const detayRes = await axios.get(
        'https://reportapi2.biletinial.com/api/Report/GetTicketTypeSalesReport?SeanceId=' + s.SeanceId + '&lang=tr',
        { headers: biletinialHeaders, timeout: 8000 }
      );
      const detay = detayRes.data;
      if (!detay || !detay.Success || !Array.isArray(detay.Data)) return [s];

      const rows = [];
      for (const item of detay.Data) {
        if (!item.TotalSoldTicketCount || item.TotalSoldTicketCount === 0) continue;
        const cat = biletinialTicketTypeToCategory(item.TicketTypeName);
        if (!cat) continue;
        rows.push({
          ...s,
          _workshopCat: cat,
          _biletinialTicketTypeName: item.TicketTypeName,
          SalesTicketTotalCount: item.TotalSoldTicketCount
        });
      }
      console.log('Biletini Al Workshop SeanceId=' + s.SeanceId + ':', rows.length, 'tur');
      return rows.length > 0 ? rows : [s];
    } catch (err) {
      console.error('Biletini Al GetTicketTypeSalesReport hatasi SeanceId=' + s.SeanceId + ':', err.message);
      return [s];
    }
  }, 8);

  return [...normalSeances, ...workshopExpanded.flat()];
}

// ─── İdeasoft: seansları çek ───────────────────────────────────────────────────
// Tek bir seansı fullName string'e çeviren yardımcı
function ideasoftSeanceToEntry(seance, categoryName, productId) {
  var TR_MONTHS_SRV = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  var TR_DAYS_SRV   = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  var fname = seance.name || '';
  if (!fname || fname.trim() === categoryName) {
    var startField = seance.startDate || seance.beginDate || seance.start_date || seance.begin_date || '';
    if (startField) {
      var sd = new Date(startField);
      var hh = String(sd.getHours()).padStart(2,'0');
      var mm = String(sd.getMinutes()).padStart(2,'0');
      var endField = seance.endDate || seance.finishDate || seance.end_date || '';
      var timeSlotStr = hh + ':' + mm;
      if (endField) {
        var ed = new Date(endField);
        timeSlotStr += ' - ' + String(ed.getHours()).padStart(2,'0') + ':' + String(ed.getMinutes()).padStart(2,'0');
      }
      fname = 'Farabi Sokak: Sosyal Sanathane - ' +
        sd.getDate() + ' ' + TR_MONTHS_SRV[sd.getMonth()] + ' ' + TR_DAYS_SRV[sd.getDay()] +
        ' ' + timeSlotStr;
    } else {
      fname = categoryName + ' #' + seance.id;
    }
  }
  return { seanceId: seance.id, productId: parseInt(productId), category: categoryName,
    fullName: fname, stockAmount: seance.stockAmount,
    price: seance.price1 || '0', status: seance.status };
}

// Ürün başına son başarılı veriyi tutan cache
// 429 gelince bu kullanılır — hiç göstermemekten iyidir
var ideasoftProductCache = {};

async function fetchOneIdeasoftProduct(productId, categoryName, headers) {
  try {
    var res = await axios.get(
      'https://berkayalabalik.myideasoft.com/admin-app/optioned-products/' + productId,
      { headers, timeout: 10000 }
    );
    // CSRF token güncelle (paralel isteklerde her biri kendi token'ını alır)
    var sc = (res.headers['set-cookie'] || []).join(' ');
    var cm = sc.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
    if (cm) { ideasoftCsrfToken = cm[1]; }

    var body = res.data;
    var entries = [];
    if (body && body.data && Array.isArray(body.data)) {
      entries = body.data.map(s => ideasoftSeanceToEntry(s, categoryName, productId));
    } else if (body && body.data && typeof body.data === 'object') {
      entries = [ideasoftSeanceToEntry(body.data, categoryName, productId)];
    } else if (body && body.stockAmount !== undefined) {
      entries = [ideasoftSeanceToEntry(body, categoryName, productId)];
    } else {
      console.warn('Ideasoft', categoryName, 'beklenmeyen format:', JSON.stringify(body).slice(0,100));
      // Cache varsa onu döndür
      if (ideasoftProductCache[productId]) {
        console.log('Ideasoft', categoryName, '— beklenmeyen format, cache kullanıldı');
        return ideasoftProductCache[productId];
      }
      return [];
    }

    // Başarılı — cache'e kaydet
    ideasoftProductCache[productId] = entries;
    console.log('Ideasoft', categoryName, '(' + productId + '):', entries.length, 'seans');
    return entries;

  } catch (err) {
    var status = err.response && err.response.status;
    if (status === 429) {
      // 429: cache varsa onu kullan, yoksa boş döndür
      if (ideasoftProductCache[productId]) {
        console.warn('Ideasoft 429 (' + categoryName + ') — önceki cache kullanıldı (' + ideasoftProductCache[productId].length + ' seans)');
        return ideasoftProductCache[productId];
      }
      console.warn('Ideasoft 429 (' + categoryName + ') — cache yok, atlanıyor');
      return [];
    }
    console.error('Ideasoft', categoryName, 'hatasi:', err.message);
    if (ideasoftProductCache[productId]) return ideasoftProductCache[productId];
    return [{ seanceId: null, productId: parseInt(productId), category: categoryName,
      fullName: categoryName, stockAmount: null, error: true }];
  }
}

async function fetchIdeasoftSeances(cookies, csrf) {
  var cStr = toCookieStr(cookies);
  var headers = {
    'Cookie': cStr, 'X-CSRF-TOKEN': csrf || '', 'Accept': 'application/json',
    'x-ideasoft-locale': 'tr', 'navigate-on-error': 'false',
    'disabled-success-toastr': 'false', 'disabled-error-toastr': 'false'
  };

  // Tüm ürünleri PARALEL çek — seri bekleme yok, rate limit riski azalır
  // (Aynı anda 11 istek → İdeasoft'un pencere sayacı tek seferde dolabilir)
  // Bu yüzden 2'li gruplar halinde gönderiyoruz: hız + rate limit dengesi
  var allEntries = [];
  var BATCH = 6; // 429 gelirse product cache devreye girer, 6 güvenli
  for (var i = 0; i < IDEASOFT_PRODUCTS.length; i += BATCH) {
    var batch = IDEASOFT_PRODUCTS.slice(i, i + BATCH);
    var results = await Promise.all(
      batch.map(([pid, cat]) => fetchOneIdeasoftProduct(pid, cat, { ...headers, 'X-CSRF-TOKEN': ideasoftCsrfToken || csrf || '' }))
    );
    results.forEach(r => allEntries.push(...r));
    // Gruplar arası kısa nefes — rate limit için yeterli
    if (i + BATCH < IDEASOFT_PRODUCTS.length) {
      await new Promise(r => setTimeout(r, 150));
    }
  }
  return allEntries;
}

// ─── İdeasoft: Puppeteer girişi (sadece lokalden çalışır) ─────────────────────
async function loginIdeasoftPuppeteer(username, password) {
  throw new Error('İdeasoft ilk girişi için uygulamayı lokalde çalıştırın ve cookie kaydedin.');
}

// ─── Ortak login işlevi ────────────────────────────────────────────────────────
async function doLogin(bubiletUser, bubiletPass, biletToken, ideasoftUser, ideasoftPass) {
  const t0 = Date.now();

  // İdeasoft fetch promise'i hazırla
  let ideasoftPromise = Promise.resolve(null);
  if (ideasoftUser && ideasoftPass) {
    var savedCookies = loadJson(COOKIES_FILE);
    if (savedCookies && savedCookies.cookies && savedCookies.cookies.length > 0) {
      ideasoftCookies   = savedCookies.cookies;
      ideasoftCsrfToken = savedCookies.csrfToken;
      ideasoftPromise = fetchIdeasoftSeances(ideasoftCookies, ideasoftCsrfToken)
        .then(seances => {
          var hasReal = seances.some(s => s.stockAmount !== null && !s.error);
          if (!hasReal && seances.every(s => s.error)) throw new Error('Cookie gecersiz');
          console.log('Ideasoft: cookie ile cekildi,', seances.length, 'seans', Date.now()-t0, 'ms');
          return seances;
        })
        .catch(async e => {
          console.log('Ideasoft: cookie gecersiz, puppeteer deneniyor...');
          var lg = await loginIdeasoftPuppeteer(ideasoftUser, ideasoftPass);
          return fetchIdeasoftSeances(lg.cookies, lg.csrfToken);
        });
    } else {
      ideasoftPromise = loginIdeasoftPuppeteer(ideasoftUser, ideasoftPass)
        .then(lg => fetchIdeasoftSeances(lg.cookies, lg.csrfToken));
    }
  }

  // Her kaynak biter bitmez global state'e yaz — polling anında görsün
  const bubiletP = fetchBubilet(bubiletUser, bubiletPass)
    .then(d => {
      bubiletData = d;
      lastFetch = new Date().toISOString();
      // Bubilet + Biletinial ikisi de geldiyse ready işaretle
      if (biletinialData !== null) loginState = { status:'done', error:null };
      console.log('Bubilet tamamlandi:', d.length, 'kayit,', Date.now()-t0, 'ms');
      return d;
    });

  const biletinialP = fetchBiletinial(biletToken)
    .then(d => {
      biletinialData = d;
      lastFetch = new Date().toISOString();
      if (bubiletData !== null) loginState = { status:'done', error:null };
      console.log('Biletini Al tamamlandi:', d.length, 'kayit,', Date.now()-t0, 'ms');
      return d;
    });

  const ideasoftP = ideasoftPromise
    ? ideasoftPromise.then(d => {
        if (d) { ideasoftData = d; }
        console.log('Ideasoft tamamlandi,', Date.now()-t0, 'ms');
        return d;
      })
    : Promise.resolve(null);

  await Promise.all([bubiletP, biletinialP, ideasoftP]);

  console.log('Toplam login suresi:', Date.now() - t0, 'ms');
  lastFetch = new Date().toISOString();
}

// ─── Endpoints ─────────────────────────────────────────────────────────────────

// Kayıtlı credentials var mı kontrol et
app.get('/api/saved-credentials', function(req, res) {
  const creds = loadJson(SAVED_CREDS_FILE);
  if (!creds || !creds.bubiletUser) return res.json({ exists:false });
  res.json({
    exists:true,
    bubiletUser:      creds.bubiletUser      || '',
    biletinialToken:  creds.biletinialToken  || '',
    ideasoftUser:     creds.ideasoftUser     || '',
    mailUser:         creds.mailUser         || '',
    bubiletPassFilled:   !!(creds.bubiletPass),
    ideasoftPassFilled:  !!(creds.ideasoftPass),
    mailPassFilled:      !!(creds.mailPass)
  });
});

// DEBUG: Biletini Al workshop kırılım ham yanıtı
app.get('/api/debug/workshop-counts', async function(req, res) {
  var seanceId = req.query.seanceId || 17749527;
  var creds = loadJson(SAVED_CREDS_FILE);
  if (!creds || !creds.biletinialToken) return res.json({ error: 'Biletinial token yok' });
  try {
    var detayRes = await axios.get(
      'https://reportapi2.biletinial.com/api/Report/GetTicketTypeSalesReport?SeanceId=' + seanceId + '&lang=tr',
      { headers: {
          'Authorization': 'Bearer ' + creds.biletinialToken,
          'xapikey': 'TPJDtRG0cP',
          'allow-origin': 'http://localhost:3000',
          'origin': 'https://partner.biletinial.com',
          'referer': 'https://partner.biletinial.com/'
      }}
    );
    res.json(detayRes.data);
  } catch(e) {
    res.json({ error: e.message, status: e.response && e.response.status });
  }
});

// DEBUG: Seramik ham yanıtını göster
app.get('/api/debug/seramik', async function(req, res) {
  if (!ideasoftCookies) return res.json({ error: 'Ideasoft oturumu yok, once giris yapin' });
  try {
    var cStr = toCookieStr(ideasoftCookies);
    var response = await axios.get(
      'https://berkayalabalik.myideasoft.com/admin-app/optioned-products/12671',
      { headers: { 'Cookie': cStr, 'X-CSRF-TOKEN': ideasoftCsrfToken || '',
          'Accept': 'application/json', 'x-ideasoft-locale': 'tr' }, timeout: 10000 }
    );
    var body = response.data;
    res.json({
      httpStatus: response.status,
      isDataArray: Array.isArray(body && body.data),
      isDataObject: !!(body && body.data && typeof body.data === 'object' && !Array.isArray(body.data)),
      hasDirectStockAmount: !!(body && body.stockAmount !== undefined),
      dataLength: Array.isArray(body && body.data) ? body.data.length : null,
      rawBody: body
    });
  } catch(e) {
    res.json({ error: e.message, httpStatus: e.response && e.response.status });
  }
});

// Credentials kaydet
app.post('/api/save-credentials', function(req, res) {
  try {
    const existing = loadJson(SAVED_CREDS_FILE) || {};
    saveJson(SAVED_CREDS_FILE, {
      bubiletUser:     req.body.bubiletUser     || existing.bubiletUser     || '',
      bubiletPass:     req.body.bubiletPass     || existing.bubiletPass     || '',
      biletinialToken: req.body.biletinialToken || existing.biletinialToken || '',
      ideasoftUser:    req.body.ideasoftUser    || existing.ideasoftUser    || '',
      ideasoftPass:    req.body.ideasoftPass    || existing.ideasoftPass    || '',
      mailUser:        req.body.mailUser        || existing.mailUser        || '',
      mailPass:        req.body.mailPass        || existing.mailPass        || ''
    });
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Credentials sil
app.post('/api/clear-credentials', function(req, res) {
  try {
    if (fs.existsSync(SAVED_CREDS_FILE)) fs.unlinkSync(SAVED_CREDS_FILE);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Login işleminin durumunu tutan global state
// 'idle' | 'loading' | 'done' | 'error'
var loginState = { status:'idle', error:null };

// Otomatik login — uygulama açılınca kaydedilmiş bilgilerle giriş yap
// Hemen yanıt döner (loading:true), veri arka planda çekilir.
// Frontend /api/login-status ile tamamlanmasını polling eder.
app.post('/api/auto-login', function(req, res) {
  const creds = loadJson(SAVED_CREDS_FILE);
  if (!creds || !creds.bubiletUser || !creds.bubiletPass) {
    return res.json({ success:false, reason:'Kayıtlı bilgi yok' });
  }

  // Her uygulama açılışında daima taze veri çek — cache'i temizle
  bubiletData    = null;
  biletinialData = null;
  ideasoftData   = null;

  // Arka planda doLogin başlat (await yok — hemen yanıt dön)
  loginState = { status:'loading', error:null };
  doLogin(creds.bubiletUser, creds.bubiletPass, creds.biletinialToken||'', creds.ideasoftUser||'', creds.ideasoftPass||'')
    .then(function() {
      loginState = { status:'done', error:null };
      console.log('Auto-login: tamamlandi');
      // Cache ısıt
      getJsonbinRecord().then(function(rec) {
        console.log('Auto-login: JSONBin cache ısıtıldı, baseline kayit sayisi:', Object.keys(rec.baseline||{}).length);
      }).catch(function(e) { console.warn('Auto-login: JSONBin cache ısıtma basarisiz:', e.message); });
      if (ideasoftCookies) {
        var cStr = toCookieStr(ideasoftCookies);
        var warmHeaders = { 'Cookie':cStr, 'X-CSRF-TOKEN':ideasoftCsrfToken||'', 'Accept':'application/json', 'x-ideasoft-locale':'tr', 'navigate-on-error':'false', 'disabled-success-toastr':'true', 'disabled-error-toastr':'false' };
        fetchAllOptions(warmHeaders, true).then(function(opts){ console.log('Auto-login: options cache ısıtıldı, adet:', opts.length); }).catch(function(e){ console.warn('Auto-login: options cache ısıtma basarisiz:', e.message); });
      }
    })
    .catch(function(err) {
      loginState = { status:'error', error:err.message };
      console.error('Auto-login arka plan hatasi:', err.message);
    });

  // Hemen yanıt dön — frontend polling başlatsın
  res.json({ success:true, ready:false, loading:true });
});

// Login durumu sorgulama — frontend polling için
// Bubilet + Biletinial ikisi de gelince ready:true — İdeasoft arka planda gelmeye devam eder
app.get('/api/login-status', function(req, res) {
  var coreReady = bubiletData !== null && biletinialData !== null;
  res.json({
    status: loginState.status,
    ready:  coreReady,
    ideasoftReady: ideasoftData !== null,
    error:  loginState.error
  });
});

// Manuel login — hemen yanıt döner, veri arka planda çekilir
app.post('/api/login', function(req, res) {
  try {
    const saved = loadJson(SAVED_CREDS_FILE) || {};
    const bubiletUser    = req.body.bubiletUser    || saved.bubiletUser    || '';
    const bubiletPass    = req.body.bubiletPass    || saved.bubiletPass    || '';
    const biletToken     = req.body.biletinialToken|| saved.biletinialToken|| '';
    const ideasoftUser   = req.body.ideasoftUser   || saved.ideasoftUser   || '';
    const ideasoftPass   = req.body.ideasoftPass   || saved.ideasoftPass   || '';

    // Şifre boşsa kayıtlı şifreyi kullan
    if (!bubiletPass && !bubiletUser) {
      return res.status(400).json({ error:'Kullanıcı adı ve şifre gerekli' });
    }

    if (req.body.rememberMe) {
      saveJson(SAVED_CREDS_FILE, { bubiletUser, bubiletPass, biletinialToken:biletToken, ideasoftUser, ideasoftPass, mailUser: saved.mailUser||'', mailPass: saved.mailPass||'' });
    }

    // Arka planda doLogin başlat — hemen yanıt dön
    loginState = { status:'loading', error:null };
    doLogin(bubiletUser, bubiletPass, biletToken, ideasoftUser, ideasoftPass)
      .then(function() {
        loginState = { status:'done', error:null };
        console.log('Login: tamamlandi');
        getJsonbinRecord().catch(function(e){ console.warn('Login: JSONBin cache ısıtma basarisiz:', e.message); });
      })
      .catch(function(err) {
        loginState = { status:'error', error:err.message };
        console.error('Login arka plan hatasi:', err.message);
      });

    res.json({ success:true, ready:false, loading:true });
  } catch(err) {
    console.error('Login hatasi:', err.message);
    res.status(500).json({ error:err.message });
  }
});

// İdeasoft oturumu sıfırla
app.post('/api/ideasoft/reset-session', function(req, res) {
  try {
    if (fs.existsSync(COOKIES_FILE)) fs.unlinkSync(COOKIES_FILE);
    ideasoftCookies = null; ideasoftCsrfToken = null; ideasoftData = null;
    cachedAllOptions = []; cachedAllOptionsTime = 0;
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ─── Toggle queue — eş zamanlı istekleri sıralı gönder, İdeasoft rate limit'ini aşma ──
var toggleQueue = [];
var toggleRunning = false;

function runToggleQueue() {
  if (toggleRunning || toggleQueue.length === 0) return;
  toggleRunning = true;
  var job = toggleQueue.shift();
  job().finally(function() {
    toggleRunning = false;
    // Sonraki isteği 2.5 saniye sonra işle — rate limit için nefes al (otomatik kapatmada çok toggle gelir)
    setTimeout(runToggleQueue, 2500);
  });
}

async function doToggleSeance(seanceId, active, retries) {
  if (retries === undefined) retries = 2;
  var cStr = toCookieStr(ideasoftCookies);
  var productRes = await axios.get(
    'https://berkayalabalik.myideasoft.com/admin-app/optioned-products/'+seanceId,
    { headers:{ 'Cookie':cStr, 'X-CSRF-TOKEN':ideasoftCsrfToken||'', 'Accept':'application/json', 'x-ideasoft-locale':'tr' }}
  );
  var sc = (productRes.headers['set-cookie']||[]).join(' ');
  var m  = sc.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
  if (m) { ideasoftCsrfToken=m[1]; saveJson(COOKIES_FILE, { cookies:ideasoftCookies, csrfToken:ideasoftCsrfToken }); }

  try {
    await axios.put(
      'https://berkayalabalik.myideasoft.com/admin-app/optioned-products/'+seanceId,
      Object.assign({}, productRes.data, { status: active ? 1 : 0 }),
      { headers:{ 'Cookie':cStr, 'X-CSRF-TOKEN':ideasoftCsrfToken||'', 'Content-Type':'application/json', 'Accept':'application/json', 'x-ideasoft-locale':'tr' }}
    );
  } catch(putErr) {
    // 429 gelirse bekle ve tekrar dene
    if (putErr.response && putErr.response.status === 429 && retries > 0) {
      console.log('Toggle 429 rate limit — 8 saniye bekleniyor, kalan deneme:', retries);
      await new Promise(function(r){ setTimeout(r, 8000); });
      return doToggleSeance(seanceId, active, retries - 1);
    }
    throw putErr;
  }

  ideasoftData = await fetchIdeasoftSeances(ideasoftCookies, ideasoftCsrfToken);
  lastFetch    = new Date().toISOString();
}

// Seans deaktif et / aktif et
app.post('/api/ideasoft/toggle-seance', async function(req, res) {
  if (!ideasoftCookies) return res.status(401).json({ error:'İdeasoft oturumu yok - tekrar giriş yapın' });
  var seanceId = req.body.seanceId;
  var active   = req.body.active; // true = aktif, false = pasif

  // Queue'ya ekle — eş zamanlı istekler sıraya girer
  toggleQueue.push(function() {
    return doToggleSeance(seanceId, active)
      .then(function() { res.json({ success:true }); })
      .catch(function(err) {
        console.error('Seans toggle hatasi:', err.message);
        if (err.response && (err.response.status===401||err.response.status===403))
          return res.status(401).json({ error:'İdeasoft oturumu sona erdi - tekrar giriş yapın' });
        if (err.response && err.response.status===429)
          return res.status(429).json({ error:'İdeasoft rate limit — lütfen birkaç saniye bekleyip tekrar deneyin' });
        res.status(500).json({ error:err.message });
      });
  });
  runToggleQueue();
});

// Seansı sil (ideasoft options endpoint)
// DEBUG: Belirli bir seansın ham verisini göster (hangi ID'lerin olduğunu anlamak için)
app.get('/api/debug/seance-raw/:seanceId', async function(req, res) {
  if (!ideasoftCookies) return res.json({ error: 'Ideasoft oturumu yok' });
  var seanceId = req.params.seanceId;
  var cStr = toCookieStr(ideasoftCookies);
  try {
    // optioned-products endpoint'inden bu seans objesini bul
    // Önce seansın ait olduğu ürünü bul (ideasoftData'da ara)
    var found = null;
    if (ideasoftData) {
      found = ideasoftData.find(function(s) { return String(s.seanceId) === String(seanceId); });
    }
    if (!found) return res.json({ error: 'Seans local data\'da bulunamadı', seanceId });

    // optioned-products/{productId} den ham veriyi çek
    var rawRes = await axios.get(
      'https://berkayalabalik.myideasoft.com/admin-app/optioned-products/' + found.productId,
      { headers: { 'Cookie': cStr, 'X-CSRF-TOKEN': ideasoftCsrfToken || '',
          'Accept': 'application/json', 'x-ideasoft-locale': 'tr' }, timeout: 10000 }
    );
    var body = rawRes.data;
    // seanceId ile eşleşen alt objeyi bul
    var seanceRaw = null;
    if (body && body.data && Array.isArray(body.data)) {
      seanceRaw = body.data.find(function(s) { return String(s.id) === String(seanceId); });
    } else if (body && body.data) {
      seanceRaw = body.data;
    } else {
      seanceRaw = body;
    }
    res.json({ found, seanceRaw, bodyKeys: body ? Object.keys(body) : [], seanceRawKeys: seanceRaw ? Object.keys(seanceRaw) : [] });
  } catch(e) {
    res.json({ error: e.message, status: e.response && e.response.status });
  }
});

// Seansı sil — İdeasoft'un kullandığı gerçek akış:
// 1) seanceId ile ideasoftData'dan productId'yi bul
// 2) GET optioned-products/{productId} → seansları çek, seanceId eşleşeni bul
// 3) O seans objesindeki alt ürün ID'lerini topla (products[] veya seanceId kendisi)
// 4) POST /admin-app/batch ile multipart/batch formatında DELETE /admin-app/products/{id} gönder
// 5) Local cache ve ideasoftData'dan temizle
app.delete('/api/ideasoft/delete-option/:seanceId', async function(req, res) {
  if (!ideasoftCookies) return res.status(401).json({ error:'İdeasoft oturumu yok - tekrar giriş yapın' });
  var seanceId = req.params.seanceId;
  if (!seanceId) return res.status(400).json({ error:'seanceId gerekli' });
  var cStr = toCookieStr(ideasoftCookies);

  // 1) ideasoftData'da bu seanceId'ye ait kaydı bul → productId'yi al
  var localEntry = null;
  if (ideasoftData) {
    localEntry = ideasoftData.find(function(s) { return String(s.seanceId) === String(seanceId); });
  }
  if (!localEntry || !localEntry.productId) {
    return res.status(404).json({ error: 'Seans bulunamadı, önce veriyi yenileyin', seanceId });
  }
  var productId = localEntry.productId;

  var baseHeaders = {
    'Cookie': cStr,
    'X-CSRF-TOKEN': ideasoftCsrfToken || '',
    'Accept': 'application/json',
    'x-ideasoft-locale': 'tr',
    'navigate-on-error': 'false'
  };

  try {
    // 2) Ürünün tüm seanslarını çek + CSRF token tazele
    var productRes = await axios.get(
      'https://berkayalabalik.myideasoft.com/admin-app/optioned-products/' + productId,
      { headers: baseHeaders, timeout: 12000 }
    );
    var sc = (productRes.headers['set-cookie'] || []).join(' ');
    var cm = sc.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
    if (cm) {
      ideasoftCsrfToken = cm[1];
      saveJson(COOKIES_FILE, { cookies: ideasoftCookies, csrfToken: ideasoftCsrfToken });
    }
    var csrf = ideasoftCsrfToken || '';

    var body = productRes.data;
    var allSeances = [];
    if (body && body.data && Array.isArray(body.data)) {
      allSeances = body.data;
    } else if (body && body.data && typeof body.data === 'object') {
      allSeances = [body.data];
    } else if (body && body.id !== undefined) {
      allSeances = [body];
    }

    // 3) seanceId eşleşen seans objesini bul → içindeki alt ürün ID'lerini topla
    var targetSeance = allSeances.find(function(s) { return String(s.id) === String(seanceId); });

    var productIdsToDelete = [];
    if (targetSeance) {
      console.log('Silinecek seans bulundu:', JSON.stringify(Object.keys(targetSeance)));
      // products[] array varsa onları kullan (İdeasoft panelindeki gibi)
      if (targetSeance.products && Array.isArray(targetSeance.products) && targetSeance.products.length > 0) {
        productIdsToDelete = targetSeance.products.map(function(p) { return p.id || p; });
      }
      // options[] varsa ekle
      if (targetSeance.options && Array.isArray(targetSeance.options) && targetSeance.options.length > 0) {
        targetSeance.options.forEach(function(o) {
          var oid = o.id || o;
          if (!productIdsToDelete.includes(oid)) productIdsToDelete.push(oid);
        });
      }
      // Hiçbiri yoksa seanceId'nin kendisini dene
      if (productIdsToDelete.length === 0) {
        productIdsToDelete = [seanceId];
      }
    } else {
      // Seans artık İdeasoft'ta yok — sadece local'den temizle
      console.warn('Seans İdeasoft\'ta bulunamadı, seanceId=' + seanceId);
      productIdsToDelete = [seanceId];
    }

    console.log('Batch\'e gönderilecek product ID\'ler:', productIdsToDelete);

    // 4) multipart/batch formatında POST /admin-app/batch
    var boundary = Date.now().toString();
    var batchBody = '';
    productIdsToDelete.forEach(function(pid, i) {
      batchBody += '--' + boundary + '\r\n';
      batchBody += 'Content-Type: application/http; msgtype=request\r\n';
      batchBody += 'Content-ID: <delete-seance-' + seanceId + '+' + i + '>\r\n';
      batchBody += '\r\n';
      batchBody += 'DELETE /admin-app/products/' + pid + ' HTTP/1.1\r\n';
      batchBody += 'Host: berkayalabalik.myideasoft.com\r\n';
      batchBody += 'Accept: application/json, text/plain, */*\r\n';
      batchBody += 'Content-Type: application/http\r\n';
      batchBody += 'Accept: application/json\r\n';
      batchBody += 'Access-Control-Allow-Headers: Content-Type\r\n';
      batchBody += 'navigate-on-error: false\r\n';
      batchBody += 'disabled-success-toastr: true\r\n';
      batchBody += 'disabled-error-toastr: false\r\n';
      batchBody += 'should-batch: true\r\n';
      batchBody += 'x-ideasoft-locale: tr\r\n';
      batchBody += 'X-CSRF-TOKEN: ' + csrf + '\r\n';
      batchBody += '\r\n';
      batchBody += '\r\n';
    });
    batchBody += '--' + boundary + '--';

    var batchRes = await axios.post(
      'https://berkayalabalik.myideasoft.com/admin-app/batch',
      batchBody,
      {
        headers: {
          'Cookie': cStr,
          'X-CSRF-TOKEN': csrf,
          'Content-Type': 'multipart/batch; boundary=' + boundary,
          'Accept': 'application/json',
          'x-ideasoft-locale': 'tr',
          'navigate-on-error': 'false',
          'use-return-carriage': 'true',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        timeout: 15000
      }
    );

    console.log('Batch yanıtı HTTP status:', batchRes.status);
    console.log('Batch yanıtı body:', JSON.stringify(batchRes.data).slice(0, 500));

    // 5) Local cache ve ideasoftData'dan temizle
    if (ideasoftProductCache[productId]) {
      ideasoftProductCache[productId] = ideasoftProductCache[productId].filter(function(s) {
        return String(s.seanceId) !== String(seanceId);
      });
    }
    if (ideasoftData) {
      ideasoftData = ideasoftData.filter(function(s) { return String(s.seanceId) !== String(seanceId); });
    }

    console.log('Seans silme batch gönderildi: seanceId=' + seanceId + ', productId=' + productId);
    res.json({ success: true, batchStatus: batchRes.status, deletedProductIds: productIdsToDelete });

  } catch(err) {
    console.error('Seans silme hatasi:', err.message, err.response && err.response.status, err.response && JSON.stringify(err.response.data).slice(0,300));
    if (err.response && (err.response.status === 401 || err.response.status === 403))
      return res.status(401).json({ error:'İdeasoft oturumu sona erdi - tekrar giriş yapın' });
    res.status(500).json({ error: err.message, status: err.response && err.response.status, body: err.response && err.response.data });
  }
});

// ─── Tüm options sayfalarını çek (paginated, rate-limit safe, memory cached) ──
// Memory cache: aynı session içinde 5 dakika boyunca tekrar çekilmez → bulk çok hızlanır
// 429 gelince exponential backoff ile retry (max 3 deneme)
async function fetchAllOptions(headersObj, forceRefresh) {
  // Cache geçerliyse direkt döndür
  var now = Date.now();
  if (!forceRefresh && cachedAllOptions.length > 0 && (now - cachedAllOptionsTime) < OPTIONS_CACHE_TTL) {
    console.log('fetchAllOptions: cache hit, adet:', cachedAllOptions.length);
    return cachedAllOptions;
  }

  var allOptions = [];
  var page = 1;
  var limit = 100;

  async function getPageWithRetry(p, retries) {
    retries = retries || 0;
    try {
      var res = await axios.get(
        'https://berkayalabalik.myideasoft.com/admin-app/options?page=' + p + '&limit=' + limit + '&optionGroup=9',
        { headers: headersObj, timeout: 20000 }
      );
      var sc = (res.headers['set-cookie'] || []).join(' ');
      var cm = sc.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
      if (cm) { ideasoftCsrfToken = cm[1]; saveJson(COOKIES_FILE, { cookies: ideasoftCookies, csrfToken: ideasoftCsrfToken }); }
      return res;
    } catch(e) {
      var status = e.response && e.response.status;
      if (status === 429 && retries < 3) {
        var waitMs = 5000 * Math.pow(2, retries);
        console.warn('fetchAllOptions sayfa=' + p + ' 429 — ' + (waitMs/1000) + 's bekleniyor (deneme ' + (retries+1) + '/3)');
        await new Promise(r => setTimeout(r, waitMs));
        return getPageWithRetry(p, retries + 1);
      }
      throw e;
    }
  }

  while (true) {
    try {
      var res = await getPageWithRetry(page);
      var body = res.data;
      var items = Array.isArray(body) ? body : (Array.isArray(body.data) ? body.data : []);
      if (items.length === 0) break;
      allOptions = allOptions.concat(items);
      if (items.length < limit) break;
      page++;
      await new Promise(r => setTimeout(r, 400)); // sayfa arası bekleme
    } catch(e) {
      console.warn('fetchAllOptions sayfa=' + page + ' hata:', e.message, e.response && e.response.status);
      break;
    }
  }

  // Cache güncelle
  if (allOptions.length > 0) {
    cachedAllOptions = allOptions;
    cachedAllOptionsTime = Date.now();
  }
  console.log('fetchAllOptions: toplam', allOptions.length, 'option,', page, 'sayfa');
  return allOptions;
}

// ─── Seans oluşturma yardımcısı ───────────────────────────────────────────────
// Her çağrıda İdeasoft'tan fresh CSRF alır + /admin-app/options ile gerçek option ID üretir
async function createOneSeance(payload) {
  var parentId = payload.parent && payload.parent.id;
  var cStr = toCookieStr(ideasoftCookies);
  var headers = function() {
    return {
      'Cookie': cStr,
      'X-CSRF-TOKEN': ideasoftCsrfToken || '',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-ideasoft-locale': 'tr',
      'navigate-on-error': 'false',
      'disabled-success-toastr': 'true',
      'disabled-error-toastr': 'false',
    };
  };

  // 1) Parent ürünü GET — gerçek veriyi al + CSRF tazele
  var parentRes = await axios.get(
    'https://berkayalabalik.myideasoft.com/admin-app/products/' + parentId,
    { headers: headers(), timeout: 15000 }
  );
  var sc1 = (parentRes.headers['set-cookie'] || []).join(' ');
  var cm1 = sc1.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
  if (cm1) { ideasoftCsrfToken = cm1[1]; saveJson(COOKIES_FILE, { cookies: ideasoftCookies, csrfToken: ideasoftCsrfToken }); }

  var parentData = parentRes.data;

  // 1b) optionGroups'u products endpoint'inden al; yoksa optioned-products'tan çek
  // products/{id} bazen optionGroups döndürmez — optioned-products/{id} kesinlikle döndürür
  var existingGroups = parentData.optionGroups || [];
  if (existingGroups.length === 0) {
    try {
      var opRes = await axios.get(
        'https://berkayalabalik.myideasoft.com/admin-app/optioned-products/' + parentId,
        { headers: headers(), timeout: 15000 }
      );
      var sc1b = (opRes.headers['set-cookie'] || []).join(' ');
      var cm1b = sc1b.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
      if (cm1b) { ideasoftCsrfToken = cm1b[1]; saveJson(COOKIES_FILE, { cookies: ideasoftCookies, csrfToken: ideasoftCsrfToken }); }
      // optioned-products yanıtı: { data: [...seanslar...] } — her seansta optionGroups var
      var opBody = opRes.data;
      var opSeances = [];
      if (opBody && Array.isArray(opBody.data)) opSeances = opBody.data;
      else if (opBody && Array.isArray(opBody))  opSeances = opBody;
      else if (opBody && opBody.data)             opSeances = [opBody.data];
      // İlk seanstan optionGroups al
      if (opSeances.length > 0 && opSeances[0].optionGroups) {
        existingGroups = opSeances[0].optionGroups;
        console.log('optionGroups optioned-products\'tan alındı, grup sayısı:', existingGroups.length);
      }
      // parentData'yı eksik alanlar için tamamla
      if (!parentData.prices  && opSeances[0]) parentData.prices  = opSeances[0].prices;
      if (!parentData.currency && opSeances[0]) parentData.currency = opSeances[0].currency;
      if (!parentData.price1   && opSeances[0]) parentData.price1   = opSeances[0].price1;
      if (!parentData.tax      && opSeances[0]) parentData.tax      = opSeances[0].tax;
      if (!parentData.slug     && opSeances[0]) parentData.slug     = opSeances[0].slug ? opSeances[0].slug.split('-').slice(0,-3).join('-') : '';
    } catch(e) {
      console.warn('optioned-products fallback hatası:', e.message);
    }
  }

  // 2) Mevcut optionGroups'u işle — "Tarih & Saat" (id=9) ve "Mekan" (id=8) grubunu bul
  var tarihSaatGroup = existingGroups.find(function(g) { return g.id === 9; });
  var mekanGroup     = existingGroups.find(function(g) { return g.id === 8; });

  // Seans adından "Tarih & Saat" option title'ını çıkar
  // "Farabi Sokak: Sosyal Sanathane - 12 Nisan Pazar 19:00 - 21:00" → "12 Nisan Pazar 19:00 - 21:00"
  var tarihSaatTitle = payload.name.replace(/^[^-]*- /, '').trim();

  // Mekan option: mevcut 632'yi koru
  var mekanOption = { id: 632, title: 'Farabi Sokak: Sosyal Sanathane' };
  if (mekanGroup && mekanGroup.options && mekanGroup.options.length > 0) {
    mekanOption = mekanGroup.options[0];
  }

  // ── OPTION ID AL: önce mevcut listede ara, yoksa POST ────────────────────────
  var existingTarihOptions = (tarihSaatGroup && tarihSaatGroup.options) ? tarihSaatGroup.options : [];
  try {
    var allFetchedOptions = await fetchAllOptions(headers());
    if (allFetchedOptions.length > 0) existingTarihOptions = allFetchedOptions;
    console.log('✓ GET options başarılı, toplam:', existingTarihOptions.length);
  } catch(e) {
    console.warn('GET options başarısız, mevcut liste kullanılıyor:', e.message);
  }

  // Bu title daha önce oluşturulmuş mu? Varsa yeni POST atma, ID'yi kullan
  var existingOption = existingTarihOptions.find(function(o) {
    return o.title && o.title.trim().toLowerCase() === tarihSaatTitle.trim().toLowerCase();
  });

  var newOptionId;
  if (existingOption) {
    newOptionId = existingOption.id;
    console.log('✓ Option zaten mevcut, ID kullanılıyor:', newOptionId, '→', tarihSaatTitle);
  } else {
    var optionRes = await axios.post(
      'https://berkayalabalik.myideasoft.com/admin-app/options',
      {
        title: tarihSaatTitle,
        sortOrder: 9999,
        size: '16',
        optionGroup: {
          id: 9,
          title: 'Tarih & Saat',
          options: existingTarihOptions.map(function(o) {
            return { id: o.id, title: o.title, sortOrder: o.sortOrder || 9999, optionGroup: { id: 9, title: 'Tarih & Saat' } };
          })
        }
      },
      { headers: headers(), timeout: 15000 }
    );
    var scOpt = (optionRes.headers['set-cookie'] || []).join(' ');
    var cmOpt = scOpt.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
    if (cmOpt) { ideasoftCsrfToken = cmOpt[1]; saveJson(COOKIES_FILE, { cookies: ideasoftCookies, csrfToken: ideasoftCsrfToken }); }
    newOptionId = optionRes.data && optionRes.data.id;
    if (!newOptionId) throw new Error('Option ID alınamadı — yanıt: ' + JSON.stringify(optionRes.data).slice(0, 200));
    console.log('✓ Yeni option oluşturuldu, ID:', newOptionId, '→', tarihSaatTitle);
  }
  // ─────────────────────────────────────────────────────────────────────────────

  var newTarihOptions = existingTarihOptions.filter(function(o) { return o.id !== newOptionId; })
    .concat([{ id: newOptionId, title: tarihSaatTitle, sortOrder: 9999, optionGroup: { id: 9, title: 'Tarih & Saat' } }]);

  // prices: parent'tan al (value=0 bırak — varyant override eder)
  var realPrices = (parentData.prices || []).map(function(p) {
    return { id: p.id, type: p.type, value: p.value || '0' };
  });
  var realSpecialInfo = parentData.specialInfo || { id: null, title: '', content: '', status: 0 };
  var realSku = (parentData.sku || 'bilet') + '_' + Math.floor(Math.random() * 90000 + 10000);
  var realParentSlug = parentData.slug || '';

  // Slug oluştur
  var seansSlug = realParentSlug + '-' + payload.name.toLowerCase()
    .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

  // optionIds: mevcut tüm tarih&saat ID'leri + mekan ID kombinasyonu
  // İdeasoft formatı: "tarihId_mekanId" — her yeni seans için ayrı kombinasyon
  var newOptionIds = mekanOption.id + '_' + newOptionId;

  // 3) PUT /admin-app/products/{parentId} — yeni seansı ekle
  // parentData'yı olduğu gibi al, sadece gereken alanları override et
  var putPayload = Object.assign({}, parentData, {
    // Yeni varyant (optioned product) bilgileri
    // İdeasoft'ta yeni option group listesi gönderilir; mevcut varyantlar korunur
    optionGroups: [
      // Mekan grubu — mevcut ya da varsayılan
      { id: 8, title: 'Mekan', options: [mekanOption] },
      // Tarih & Saat grubu — mevcut liste + yeni
      { id: 9, title: 'Tarih & Saat', options: newTarihOptions }
    ],
    // Yeni varyantın stok/fiyat bilgileri
    // Bu alanlar varyant oluşturmak için parent payload'ına eklenir
    addedOptions: [{
      id: null,
      name: payload.name,
      sku: realSku,
      slug: seansSlug,
      barcode: null,
      stockAmount: String(payload.stockAmount || '10'),
      price1: String(payload.price1 || parentData.price1 || '450'),
      currency: payload.currency || parentData.currency,
      discount: '0',
      discountType: 1,
      moneyOrderDiscount: 0,
      buyingPrice: '0',
      taxIncluded: 1,
      tax: payload.tax || parentData.tax || 20,
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
      prices: realPrices,
      specialInfo: realSpecialInfo,
      parent: { id: parentId, name: parentData.name },
      optionGroups: [
        { id: 8, title: 'Mekan', options: [mekanOption] },
        { id: 9, title: 'Tarih & Saat', options: [{ id: newOptionId, title: tarihSaatTitle }] }
      ],
      optionIds: newOptionIds,
    }]
  });

  // 4) multipart/batch ile POST — İdeasoft'un beklediği format bu
  // (Direkt PUT products/{id} varyant eklemez; batch içinde POST /admin-app/products kullanılır)
  var boundary = Date.now().toString() + Math.random().toString(36).slice(2);
  var csrf = ideasoftCsrfToken || '';

  // Batch içine yeni varyantı POST olarak gönder
  var variantPayload = {
    id: null,
    name: payload.name,
    sku: realSku,
    slug: seansSlug,
    barcode: null,
    stockAmount: String(payload.stockAmount || '10'),
    price1: String(payload.price1 || parentData.price1 || '450'),
    currency: payload.currency || parentData.currency,
    discount: '0',
    discountType: 1,
    moneyOrderDiscount: 0,
    buyingPrice: '0',
    marketPriceDetail: null,
    taxIncluded: 1,
    tax: payload.tax || parentData.tax || 20,
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
    prices: realPrices,
    specialInfo: realSpecialInfo,
    parent: { id: parentId, name: parentData.name },
    optionGroups: [
      { id: 8, title: 'Mekan', options: [mekanOption] },
      { id: 9, title: 'Tarih & Saat', options: [{ id: newOptionId, title: tarihSaatTitle }] }
    ],
    optionIds: newOptionIds,
  };

  var innerLines = [
    'POST /admin-app/products HTTP/1.1',
    'Host: berkayalabalik.myideasoft.com',
    'Accept: application/json, text/plain, */*',
    'Content-Type: application/http',
    'Access-Control-Allow-Headers: Content-Type',
    'navigate-on-error: false',
    'disabled-success-toastr: true',
    'disabled-error-toastr: false',
    'should-batch: true',
    'x-ideasoft-locale: tr',
    'X-CSRF-TOKEN: ' + csrf,
  ].join('\r\n');

  var jsonBody = JSON.stringify(variantPayload);
  var batchBody =
    '--' + boundary + '\r\n' +
    'Content-Type: application/http; msgtype=request\r\n' +
    'Content-ID: <create-seance-' + newOptionId + '+0>\r\n' +
    '\r\n' +
    innerLines + '\r\n' +
    '\r\n' +
    jsonBody + '\r\n' +
    '\r\n' +
    '--' + boundary + '--';

  var batchRes = await axios.post(
    'https://berkayalabalik.myideasoft.com/admin-app/batch',
    batchBody,
    {
      headers: {
        'Cookie': cStr,
        'X-CSRF-TOKEN': csrf,
        'Content-Type': 'multipart/batch; boundary=' + boundary,
        'Accept': 'application/json',
        'x-ideasoft-locale': 'tr',
        'navigate-on-error': 'false',
        'use-return-carriage': 'true',
        'access-control-allow-headers': 'Content-Type',
      },
      timeout: 25000
    }
  );

  // CSRF güncelle
  var sc3 = (batchRes.headers['set-cookie'] || []).join(' ');
  var cm3 = sc3.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
  if (cm3) { ideasoftCsrfToken = cm3[1]; saveJson(COOKIES_FILE, { cookies: ideasoftCookies, csrfToken: ideasoftCsrfToken }); }

  // Batch response'u parse et — 200 olsa da içinde hata olabilir
  var batchResponseStr = typeof batchRes.data === 'string' ? batchRes.data : JSON.stringify(batchRes.data);
  if (batchResponseStr.includes('HTTP/1.1 4') || batchResponseStr.includes('HTTP/1.1 5')) {
    console.error('DETAYLI BATCH HATA:', batchResponseStr);
    throw new Error('Batch içinde hata var');
  }

  console.log('✓ Seans oluşturuldu:', payload.name, 'optionId:', newOptionId, 'batchStatus:', batchRes.status);

  // 5) PUT /admin-app/products/{parentId} — parent ürünü güncelle
  // optionGroups boş gönderilmeli — panelde de böyle yapılıyor, doldurunca 400 alınıyor
  try {
    var putParentPayload = Object.assign({}, parentData, { optionGroups: [] });
    var putRes = await axios.put(
      'https://berkayalabalik.myideasoft.com/admin-app/products/' + parentId,
      putParentPayload,
      {
        headers: {
          'Cookie': cStr,
          'X-CSRF-TOKEN': ideasoftCsrfToken || '',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-ideasoft-locale': 'tr',
          'navigate-on-error': 'false',
          'disabled-success-toastr': 'true',
          'disabled-error-toastr': 'false',
          'use-return-carriage': 'true',
        },
        timeout: 20000
      }
    );
    var sc5 = (putRes.headers['set-cookie'] || []).join(' ');
    var cm5 = sc5.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
    if (cm5) { ideasoftCsrfToken = cm5[1]; saveJson(COOKIES_FILE, { cookies: ideasoftCookies, csrfToken: ideasoftCsrfToken }); }
    console.log('✓ Parent ürün güncellendi:', parentId, 'status:', putRes.status);
  } catch(e) {
    // PUT başarısız olsa bile seans batch'te oluştu — sadece logla
    console.warn('Parent PUT başarısız (seans yine de oluştu):', e.message, e.response && e.response.status);
  }

  return { success: true, optionId: newOptionId, innerStatus };
}

// Yeni seans oluştur — frontend'den tek payload alır, sıralı işler
app.post('/api/ideasoft/create-seance', async function(req, res) {
  if (!ideasoftCookies) return res.status(401).json({ error:'İdeasoft oturumu yok - tekrar giriş yapın' });

  var payload = req.body;
  if (!payload || !payload.name) return res.status(400).json({ error:'Geçersiz payload — name gerekli' });
  if (!payload.parent || !payload.parent.id) return res.status(400).json({ error:'parent.id gerekli' });

  try {
    var result = await createOneSeance(payload);
    res.status(201).json(result);
  } catch(err) {
    console.error('Seans oluşturma hatası:', err.message,
      err.response && err.response.status,
      err.response && JSON.stringify(err.response.data).slice(0, 400));
    if (err.response && (err.response.status === 401 || err.response.status === 403))
      return res.status(401).json({ error:'İdeasoft oturumu sona erdi — tekrar giriş yapın' });
    res.status(500).json({
      error: err.message,
      status: err.response && err.response.status,
      body: err.response && err.response.data
    });
  }
});

// ─── Toplu seans oluşturma — tüm liste frontend'den gelir ─────────────────────
// Parent verisi + options listesi bir kez çekilir, sonra her seans için sadece
// POST options (veya mevcut ID) + POST batch atılır → rate limit çok daha düşük
app.post('/api/ideasoft/create-seances-bulk', async function(req, res) {
  if (!ideasoftCookies) return res.status(401).json({ error:'İdeasoft oturumu yok - tekrar giriş yapın' });

  var payloads = req.body.seances; // array of payload objects
  if (!Array.isArray(payloads) || payloads.length === 0)
    return res.status(400).json({ error:'seances array gerekli' });

  var jobId = req.body.jobId || null;
  if (jobId) {
    bulkProgressMap[jobId] = { total: payloads.length, done: 0, errors: 0, current: '', finished: false, results: [] };
  }

  var parentId = payloads[0].parent && payloads[0].parent.id;
  if (!parentId) return res.status(400).json({ error:'parent.id gerekli' });

  var cStr = toCookieStr(ideasoftCookies);
  var hdrs = function() {
    return {
      'Cookie': cStr,
      'X-CSRF-TOKEN': ideasoftCsrfToken || '',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-ideasoft-locale': 'tr',
      'navigate-on-error': 'false',
      'disabled-success-toastr': 'true',
      'disabled-error-toastr': 'false',
    };
  };

  // ── A) Parent veriyi çek — products ve optioned-products paralel ──────────
  // İkisini aynı anda başlatarak bekleme süresini yarıya indiriyoruz
  var parentData, existingGroups = [], mekanOption, realPrices, realSpecialInfo, realParentSlug;
  try {
    var [pRes, opRes2] = await Promise.all([
      axios.get(
        'https://berkayalabalik.myideasoft.com/admin-app/products/' + parentId,
        { headers: hdrs(), timeout: 12000 }
      ).catch(function(e) { console.warn('Bulk: products GET hatası:', e.message); return null; }),
      axios.get(
        'https://berkayalabalik.myideasoft.com/admin-app/optioned-products/' + parentId,
        { headers: hdrs(), timeout: 12000 }
      ).catch(function(e) { console.warn('Bulk: optioned-products GET hatası:', e.message); return null; }),
    ]);

    // CSRF güncelle
    if (pRes) {
      var sc = (pRes.headers['set-cookie'] || []).join(' ');
      var cm = sc.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
      if (cm) { ideasoftCsrfToken = cm[1]; saveJson(COOKIES_FILE, { cookies: ideasoftCookies, csrfToken: ideasoftCsrfToken }); }
      parentData = pRes.data;
      existingGroups = parentData.optionGroups || [];
    }
    if (opRes2) {
      var sc2 = (opRes2.headers['set-cookie'] || []).join(' ');
      var cm2 = sc2.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
      if (cm2) { ideasoftCsrfToken = cm2[1]; saveJson(COOKIES_FILE, { cookies: ideasoftCookies, csrfToken: ideasoftCsrfToken }); }
      var opBody2 = opRes2.data;
      var opSeances2 = Array.isArray(opBody2.data) ? opBody2.data : Array.isArray(opBody2) ? opBody2 : opBody2.data ? [opBody2.data] : [];
      // optionGroups boşsa optioned-products'tan doldur
      if (existingGroups.length === 0 && opSeances2.length > 0 && opSeances2[0].optionGroups) {
        existingGroups = opSeances2[0].optionGroups;
      }
      // parentData eksikse optioned-products'tan tamamla
      if (!parentData) parentData = {};
      if (!parentData.prices   && opSeances2[0]) parentData.prices   = opSeances2[0].prices;
      if (!parentData.currency && opSeances2[0]) parentData.currency = opSeances2[0].currency;
      if (!parentData.price1   && opSeances2[0]) parentData.price1   = opSeances2[0].price1;
      if (!parentData.tax      && opSeances2[0]) parentData.tax      = opSeances2[0].tax;
      if (!parentData.slug     && opSeances2[0]) parentData.slug     = opSeances2[0].slug ? opSeances2[0].slug.split('-').slice(0,-3).join('-') : '';
      if (!parentData.name     && opSeances2[0]) parentData.name     = opSeances2[0].parent && opSeances2[0].parent.name;
    }
    if (!parentData) return res.status(500).json({ error: 'Parent ürün çekilemedi: her iki endpoint de başarısız' });
  } catch(e) {
    return res.status(500).json({ error: 'Parent ürün çekilemedi: ' + e.message });
  }

  var tarihSaatGroup = existingGroups.find(function(g) { return g.id === 9; });
  var mekanGrp       = existingGroups.find(function(g) { return g.id === 8; });
  mekanOption        = (mekanGrp && mekanGrp.options && mekanGrp.options.length > 0)
                         ? mekanGrp.options[0]
                         : { id: 632, title: 'Farabi Sokak: Sosyal Sanathane' };
  realPrices         = (parentData.prices || []).map(function(p) { return { id: p.id, type: p.type, value: p.value || '0' }; });
  realSpecialInfo    = parentData.specialInfo || { id: null, title: '', content: '', status: 0 };
  realParentSlug     = parentData.slug || '';

  // ── B) Mevcut options listesini bir kez çek ───────────────────────────────
  var cachedOptions = (tarihSaatGroup && tarihSaatGroup.options) ? [...tarihSaatGroup.options] : [];
  try {
    var fetched = await fetchAllOptions(hdrs());
    if (fetched.length > 0) cachedOptions = fetched;
    console.log('Bulk: options listesi çekildi, adet:', cachedOptions.length);
  } catch(e) {
    console.warn('Bulk: options listesi çekilemedi, optionGroups kullanılıyor:', e.message);
  }

  // ── C) Her seans için sırayla işle ───────────────────────────────────────
  var results = [];
  for (var si = 0; si < payloads.length; si++) {
    var payload = payloads[si];
    var tarihSaatTitle = payload.name.replace(/^[^-]*- /, '').trim();
    var realSku = (parentData.sku || 'bilet') + '_' + Math.floor(Math.random() * 90000 + 10000);
    var seansSlug = realParentSlug + '-' + payload.name.toLowerCase()
      .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

    // 400ms bekle — seanslar arası (hız/rate-limit dengesi)
    if (si > 0) await new Promise(r => setTimeout(r, 400));

    // Progress: bu seans ekleniyor
    if (jobId && bulkProgressMap[jobId]) {
      bulkProgressMap[jobId].current = tarihSaatTitle;
    }

    try {
      // C1) Option ID — mevcut listede ara, yoksa POST
      var existingOpt = cachedOptions.find(function(o) {
        return o.title && o.title.trim().toLowerCase() === tarihSaatTitle.trim().toLowerCase();
      });
      var newOptionId;
      if (existingOpt) {
        newOptionId = existingOpt.id;
        console.log('Bulk [' + (si+1) + '/' + payloads.length + '] Mevcut option:', newOptionId, tarihSaatTitle);
      } else {
        // POST options — 429 gelirse exponential backoff, 400 "Tekrarlanan" gelirse listeyi yenile
        var optRes;
        var optRetries = 0;
        while (true) {
          try {
            optRes = await axios.post(
              'https://berkayalabalik.myideasoft.com/admin-app/options',
              {
                title: tarihSaatTitle,
                sortOrder: 9999,
                size: '16',
                optionGroup: {
                  id: 9,
                  title: 'Tarih & Saat',
                  options: cachedOptions.map(function(o) {
                    return { id: o.id, title: o.title, sortOrder: o.sortOrder || 9999, optionGroup: { id: 9, title: 'Tarih & Saat' } };
                  })
                }
              },
              { headers: hdrs(), timeout: 15000 }
            );
            break; // başarılı
          } catch(optErr) {
            var optStatus = optErr.response && optErr.response.status;
            // 429: rate limit — exponential backoff (6s, 12s, 24s)
            if (optStatus === 429 && optRetries < 3) {
              var waitMs = 4000 * Math.pow(2, optRetries);
              console.warn('Bulk [' + (si+1) + '] options POST 429 — ' + (waitMs/1000) + 's bekleniyor (deneme ' + (optRetries+1) + '/3)');
              await new Promise(r => setTimeout(r, waitMs));
              optRetries++;
              continue;
            }
            // 400 "Tekrarlanan giriş": option zaten var ama cache'de yok — listeyi tazele
            if (optStatus === 400) {
              var errBody = optErr.response && optErr.response.data;
              var errMsg = errBody && (errBody.errorMessage || JSON.stringify(errBody));
              if (errMsg && errMsg.includes('Tekrarlanan')) {
                console.warn('Bulk [' + (si+1) + '] Tekrarlanan giriş — options listesi yenileniyor:', tarihSaatTitle);
                await new Promise(r => setTimeout(r, 2000));
                try {
                  var refreshed = await fetchAllOptions(hdrs());
                  if (refreshed.length > 0) cachedOptions = refreshed;
                  var foundOpt = cachedOptions.find(function(o) {
                    return o.title && o.title.trim().toLowerCase() === tarihSaatTitle.trim().toLowerCase();
                  });
                  if (foundOpt) {
                    newOptionId = foundOpt.id;
                    optRes = null; // ID set edildi, while döngüsünden çık
                    console.log('Bulk [' + (si+1) + '] Tekrarlanan → mevcut ID bulundu:', newOptionId);
                    break;
                  }
                } catch(re) { console.warn('Bulk options refresh hatası:', re.message); }
              }
            }
            throw optErr; // beklenmeyen hata — catch(e)'ye düş
          }
        }
        if (optRes !== null) {
          var scOr = (optRes.headers['set-cookie'] || []).join(' ');
          var cmOr = scOr.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
          if (cmOr) { ideasoftCsrfToken = cmOr[1]; saveJson(COOKIES_FILE, { cookies: ideasoftCookies, csrfToken: ideasoftCsrfToken }); }
          newOptionId = optRes.data && optRes.data.id;
          if (!newOptionId) throw new Error('Option ID alınamadı: ' + JSON.stringify(optRes.data).slice(0,200));
          cachedOptions.push({ id: newOptionId, title: tarihSaatTitle, sortOrder: 9999 });
          console.log('Bulk [' + (si+1) + '/' + payloads.length + '] Yeni option:', newOptionId, tarihSaatTitle);
        }
      }

      // C2) Batch POST (varyant oluştur)
      var newOptionIds = mekanOption.id + '_' + newOptionId;
      var variantPayload = {
        id: null,
        name: payload.name,
        sku: realSku,
        slug: seansSlug,
        barcode: null,
        stockAmount: String(payload.stockAmount || '10'),
        price1: String(payload.price1 || parentData.price1 || '450'),
        currency: payload.currency || parentData.currency,
        discount: '0', discountType: 1, moneyOrderDiscount: 0, buyingPrice: '0',
        marketPriceDetail: null, taxIncluded: 1,
        tax: payload.tax || parentData.tax || 20,
        warranty: 0, volumetricWeight: '0', stockTypeLabel: 'Piece',
        customShippingDisabled: 1, customShippingCost: 0,
        customizationGroups: [], gift: null, hasGift: 0,
        installmentThreshold: '-', selectionGroups: [], extraInfos: [],
        status: 1,
        prices: realPrices,
        specialInfo: realSpecialInfo,
        parent: { id: parentId, name: parentData.name },
        optionGroups: [
          { id: 8, title: 'Mekan', options: [{ id: mekanOption.id, title: mekanOption.title }] },
          { id: 9, title: 'Tarih & Saat', options: [{ id: newOptionId, title: tarihSaatTitle }] }
        ],
        optionIds: newOptionIds,
      };

      var boundary = Date.now().toString() + Math.random().toString(36).slice(2);
      var csrf = ideasoftCsrfToken || '';
      var innerLines = [
        'POST /admin-app/products HTTP/1.1',
        'Host: berkayalabalik.myideasoft.com',
        'Accept: application/json, text/plain, */*',
        'Content-Type: application/http',
        'Access-Control-Allow-Headers: Content-Type',
        'navigate-on-error: false',
        'disabled-success-toastr: true',
        'disabled-error-toastr: false',
        'should-batch: true',
        'x-ideasoft-locale: tr',
        'X-CSRF-TOKEN: ' + csrf,
      ].join('\r\n');
      var jsonBody = JSON.stringify(variantPayload);
      var batchBody =
        '--' + boundary + '\r\n' +
        'Content-Type: application/http; msgtype=request\r\n' +
        'Content-ID: <create-seance-' + newOptionId + '+0>\r\n' +
        '\r\n' +
        innerLines + '\r\n' +
        '\r\n' +
        jsonBody + '\r\n' +
        '\r\n' +
        '--' + boundary + '--';

      // Batch POST — 429 gelirse retry
      var batchRes;
      var batchRetries = 0;
      while (true) {
        try {
          batchRes = await axios.post(
            'https://berkayalabalik.myideasoft.com/admin-app/batch',
            batchBody,
            {
              headers: {
                'Cookie': cStr,
                'X-CSRF-TOKEN': csrf,
                'Content-Type': 'multipart/batch; boundary=' + boundary,
                'Accept': 'application/json',
                'x-ideasoft-locale': 'tr',
                'navigate-on-error': 'false',
                'use-return-carriage': 'true',
                'access-control-allow-headers': 'Content-Type',
              },
              timeout: 25000
            }
          );
          break;
        } catch(batchErr) {
          if (batchErr.response && batchErr.response.status === 429 && batchRetries < 3) {
            var bWait = 8000 * Math.pow(2, batchRetries);
            console.warn('Bulk [' + (si+1) + '] batch 429 — ' + (bWait/1000) + 's bekleniyor (deneme ' + (batchRetries+1) + '/3)');
            await new Promise(r => setTimeout(r, bWait));
            batchRetries++;
            continue;
          }
          throw batchErr;
        }
      }
      var sc4 = (batchRes.headers['set-cookie'] || []).join(' ');
      var cm4 = sc4.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
      if (cm4) { ideasoftCsrfToken = cm4[1]; saveJson(COOKIES_FILE, { cookies: ideasoftCookies, csrfToken: ideasoftCsrfToken }); }

      var batchStr = typeof batchRes.data === 'string' ? batchRes.data : JSON.stringify(batchRes.data);
      console.log('Bulk [' + (si+1) + '] batch yanıtı (ilk 500 karakter):', batchStr.slice(0, 500));
      if (batchStr.includes('HTTP/1.1 4') || batchStr.includes('HTTP/1.1 5')) {
        throw new Error('Batch içinde hata: ' + batchStr.slice(0, 300));
      }

      console.log('Bulk [' + (si+1) + '/' + payloads.length + '] ✓ batch OK, status:', batchRes.status);
      results.push({ success: true, name: payload.name, optionId: newOptionId });
      if (jobId && bulkProgressMap[jobId]) {
        bulkProgressMap[jobId].done++;
        bulkProgressMap[jobId].results.push({ success: true, name: tarihSaatTitle });
      }

    } catch(e) {
      console.error('Bulk [' + (si+1) + '/' + payloads.length + '] HATA:', e.message,
        e.response && e.response.status, e.response && JSON.stringify(e.response.data).slice(0,200));
      results.push({ success: false, name: payload.name, error: e.message,
        status: e.response && e.response.status });
      if (jobId && bulkProgressMap[jobId]) {
        bulkProgressMap[jobId].done++;
        bulkProgressMap[jobId].errors++;
        bulkProgressMap[jobId].results.push({ success: false, name: tarihSaatTitle, error: e.message });
      }
    }
  }

  // ── D) Parent ürünü PUT ile güncelle (tüm seanslar bittikten sonra bir kez) ──
  // optionGroups boş gönderilmeli — doldurunca 400 alınıyor
  try {
    await new Promise(r => setTimeout(r, 1500));
    var putPayload = Object.assign({}, parentData, { optionGroups: [] });
    var putRes2 = await axios.put(
      'https://berkayalabalik.myideasoft.com/admin-app/products/' + parentId,
      putPayload,
      {
        headers: {
          'Cookie': cStr, 'X-CSRF-TOKEN': ideasoftCsrfToken || '',
          'Content-Type': 'application/json', 'Accept': 'application/json',
          'x-ideasoft-locale': 'tr', 'navigate-on-error': 'false',
          'disabled-success-toastr': 'true', 'use-return-carriage': 'true',
        },
        timeout: 20000
      }
    );
    console.log('Bulk: Parent PUT OK, status:', putRes2.status);
  } catch(e) {
    console.warn('Bulk: Parent PUT başarısız (seanslar yine oluştu):', e.message);
  }

  if (jobId && bulkProgressMap[jobId]) {
    bulkProgressMap[jobId].finished = true;
    bulkProgressMap[jobId].current = '';
    // 5 dakika sonra temizle
    setTimeout(function() { delete bulkProgressMap[jobId]; }, 5 * 60 * 1000);
  }

  var successCount = results.filter(function(r) { return r.success; }).length;
  res.json({ total: payloads.length, success: successCount, errors: payloads.length - successCount, results });
});

// Progress sorgulama — frontend polling ile takip eder
app.get('/api/ideasoft/bulk-progress/:jobId', function(req, res) {
  var p = bulkProgressMap[req.params.jobId];
  if (!p) return res.json({ found: false });
  res.json({ found: true, total: p.total, done: p.done, errors: p.errors, current: p.current, finished: p.finished });
});

// Stok güncelle
app.post('/api/ideasoft/update-stock', async function(req, res) {
  if (!ideasoftCookies) return res.status(401).json({ error:'İdeasoft oturumu yok - tekrar giriş yapın' });
  var seanceId        = req.body.seanceId;
  var newStock        = parseInt(req.body.newStock);        // kullanıcının girdiği "kalan kontenjan"
  var currentSoldCount = parseInt(req.body.currentSoldCount) || 0; // şu ana kadar satılan (ideasoft satışları)
  var cStr            = toCookieStr(ideasoftCookies);

  try {
    // 1) İdeasoft GET + JSONBin cache — ikisini paralel yap (gecikmenin yarısı burada kazanılır)
    var [productRes, cachedRec2] = await Promise.all([
      axios.get(
        'https://berkayalabalik.myideasoft.com/admin-app/optioned-products/'+seanceId,
        { headers:{ 'Cookie':cStr, 'X-CSRF-TOKEN':ideasoftCsrfToken||'', 'Accept':'application/json', 'x-ideasoft-locale':'tr' }}
      ),
      getJsonbinRecord()
    ]);

    var sc3 = (productRes.headers['set-cookie']||[]).join(' ');
    var m3  = sc3.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
    if (m3) { ideasoftCsrfToken=m3[1]; saveJson(COOKIES_FILE, { cookies:ideasoftCookies, csrfToken:ideasoftCsrfToken }); }

    // 2) İdeasoft'a stok yaz
    await axios.put(
      'https://berkayalabalik.myideasoft.com/admin-app/optioned-products/'+seanceId,
      Object.assign({}, productRes.data, { stockAmount:newStock }),
      { headers:{ 'Cookie':cStr, 'X-CSRF-TOKEN':ideasoftCsrfToken||'', 'Content-Type':'application/json', 'Accept':'application/json', 'x-ideasoft-locale':'tr' }}
    );

    // 3) Baseline güncelle — bellekteki ideasoftData'yı da anında yansıt
    // Yeni baseline: kullanıcının girdiği kalan + ideasoft'un şu ana kadar sattığı
    // Örnek: Başlangıç 10, ideasoft 3 sattı (kalan 7), bubilet 3 sattı.
    //   Kullanıcı kalan = 4 giriyor → baseline = 4 + 3 = 7, soldCount = 3 ✓
    var baseline2     = cachedRec2.baseline     || {};
    var monthlySales2 = cachedRec2.monthlySales || {};
    baseline2[seanceId] = newStock + currentSoldCount;

    // Bellekteki ideasoftData'yı hemen güncelle (yenile butonuna basmadan ekranda doğru görünsün)
    if (ideasoftData) {
      ideasoftData = ideasoftData.map(function(s) {
        if (s.seanceId !== seanceId) return s;
        return Object.assign({}, s, {
          stockAmount: newStock,
          baselineStock: baseline2[seanceId],
          soldCount: currentSoldCount
        });
      });
    }

    // 4) Kullanıcıya hemen başarı dön — arka plan işleri bekletme
    res.json({ success:true });

    // 5) Arka planda: JSONBin kaydet + seansları yenile
    setImmediate(async function() {
      try {
        // Önce baseline'ı kaydet — sonra çekince soldCount doğru hesaplanır
        var updatedMonthly2 = mergeIdeasoftIntoMonthlySales(monthlySales2, ideasoftData, baseline2);
        // Cache'i güncelle ve remote'a yaz
        if (jsonbinCache) {
          jsonbinCache.baseline     = baseline2;
          jsonbinCache.monthlySales = updatedMonthly2;
        }
        await flushJsonbinCache();

        // Sonra seansları yenile — artık güncel baseline ile soldCount hesaplanacak
        var freshIdeasoft = await fetchIdeasoftSeances(ideasoftCookies, ideasoftCsrfToken);
        ideasoftData = freshIdeasoft.map(function(s) {
          if (!s.seanceId) return Object.assign({},s,{soldCount:null});
          var base = baseline2[s.seanceId] || CATEGORY_BASELINE[s.category] || DEFAULT_BASELINE;
          return Object.assign({},s,{ baselineStock:base, soldCount: Math.max(0, base-(s.stockAmount!==null?s.stockAmount:base)) });
        });
        lastFetch = new Date().toISOString();
      } catch(e) { console.error('Stok güncelleme arka plan hatasi:', e.message); }
    });

  } catch(err) {
    console.error('Stok guncelleme hatasi:', err.message);
    if (err.response && (err.response.status===401||err.response.status===403))
      return res.status(401).json({ error:'İdeasoft oturumu sona erdi - tekrar giriş yapın' });
    res.status(500).json({ error:err.message });
  }
});

// ─── Satışları yenile — tüm API'lerden taze veri çeker ───────────────────────
// Yenile butonuna basınca çağrılır; Bubilet token'ı yeniler, tüm veriyi tazeler.
app.post('/api/sales/refresh', async function(req, res) {
  const creds = loadJson(SAVED_CREDS_FILE);
  if (!creds || !creds.bubiletUser || !creds.bubiletPass) {
    return res.status(401).json({ error: 'Kayıtlı kimlik bilgisi yok, tekrar giriş yapın' });
  }

  try {
    // Bubilet ve Biletinial'ı paralel, taze token alarak çek
    const [newBubilet, newBiletinial] = await Promise.all([
      fetchBubilet(creds.bubiletUser, creds.bubiletPass)
        .then(d => { console.log('Refresh: Bubilet', d.length, 'kayit'); return d; })
        .catch(e => {
          console.error('Refresh: Bubilet hatasi:', e.message);
          return bubiletData || [];  // hata olursa eski veriyi koru
        }),
      fetchBiletinial(creds.biletinialToken || '')
        .then(d => { console.log('Refresh: Biletinial', d.length, 'kayit'); return d; })
        .catch(e => {
          console.error('Refresh: Biletinial hatasi:', e.message);
          return biletinialData || [];
        })
    ]);

    bubiletData    = newBubilet;
    biletinialData = newBiletinial;

    // İdeasoft: mevcut cookie ile seansları yenile
    if (ideasoftCookies) {
      try {
        const freshIdeasoft = await fetchIdeasoftSeances(ideasoftCookies, ideasoftCsrfToken);
        ideasoftData = freshIdeasoft;
        console.log('Refresh: Ideasoft', ideasoftData.length, 'seans');
      } catch(e) {
        console.error('Refresh: Ideasoft hatasi:', e.message);
        // ideasoftCookies süresi dolmuşsa hata mesajını yolla
        if (e.response && (e.response.status === 401 || e.response.status === 403)) {
          return res.status(401).json({ error: 'İdeasoft oturumu sona erdi — uygulamayı yeniden başlatın' });
        }
        // diğer hatada eski veri kalsın
      }
    }

    lastFetch = new Date().toISOString();
  } catch(err) {
    console.error('Refresh genel hatasi:', err.message);
    return res.status(500).json({ error: err.message });
  }

  // Aynı /api/sales formatında yanıt dön — baseline + monthlySales hesapla
  var ideasoftSales = null;
  var monthlySalesFlat = {};
  if (ideasoftData) {
    var rec2r = await getJsonbinRecord();
    var baseline2r     = rec2r.baseline;
    var monthlySales2r = rec2r.monthlySales;
    var changed2r = false;

    ideasoftSales = ideasoftData.map(function(s) {
      if (!s.seanceId) return Object.assign({}, s, { baselineStock: null, soldCount: null });
      if (baseline2r[s.seanceId] === undefined) {
        baseline2r[s.seanceId] = CATEGORY_BASELINE[s.category] || DEFAULT_BASELINE;
        changed2r = true;
      }
      var base = baseline2r[s.seanceId] || CATEGORY_BASELINE[s.category] || DEFAULT_BASELINE;
      return Object.assign({}, s, {
        baselineStock: base,
        soldCount: Math.max(0, base - (s.stockAmount !== null ? s.stockAmount : base))
      });
    });

    var updatedMonthly2r = mergeIdeasoftIntoMonthlySales(monthlySales2r, ideasoftSales, baseline2r);
    var monthlyChanged2r = JSON.stringify(updatedMonthly2r) !== JSON.stringify(monthlySales2r);

    if (changed2r || monthlyChanged2r) {
      rec2r.baseline     = baseline2r;
      rec2r.monthlySales = updatedMonthly2r;
      jsonbinCacheDirty = true;
      flushJsonbinCache().catch(function(e){ console.error('JSONBin flush hatasi (refresh):', e.message); });
    }

    monthlySalesFlat = flattenMonthlySales(updatedMonthly2r);
  }

  res.json({
    bubilet: bubiletData,
    biletinial: biletinialData,
    ideasoft: ideasoftSales,
    lastFetch,
    monthlySales: monthlySalesFlat
  });
});

// Satış verileri (bellekteki son veriyi döndürür — refresh için POST /api/sales/refresh kullanın)
app.get('/api/sales', async function(req, res) {
  if (!bubiletData) return res.status(401).json({ error:'Giris yapilmadi' });

  var ideasoftSales = null;
  var monthlySalesFlat = {};
  if (ideasoftData) {
    var rec = await getJsonbinRecord();
    var baseline     = rec.baseline;
    var monthlySales = rec.monthlySales;
    var changed = false;

    ideasoftSales = ideasoftData.map(function(s) {
      if (!s.seanceId) return Object.assign({},s,{baselineStock:null,soldCount:null});
      if (baseline[s.seanceId]===undefined) { baseline[s.seanceId]=CATEGORY_BASELINE[s.category]||DEFAULT_BASELINE; changed=true; }
      var base = baseline[s.seanceId] || CATEGORY_BASELINE[s.category] || DEFAULT_BASELINE;
      return Object.assign({},s,{
        baselineStock: base,
        soldCount: Math.max(0, base-(s.stockAmount!==null?s.stockAmount:base))
      });
    });

    // Aylık satış arşivini güncelle — seanslar sonradan silinse bile korunur
    var updatedMonthlySales = mergeIdeasoftIntoMonthlySales(monthlySales, ideasoftSales, baseline);
    var monthlyChanged = JSON.stringify(updatedMonthlySales) !== JSON.stringify(monthlySales);

    if (changed || monthlyChanged) {
      rec.baseline     = baseline;
      rec.monthlySales = updatedMonthlySales;
      jsonbinCacheDirty = true;
      flushJsonbinCache().catch(function(e){ console.error('JSONBin flush hatasi:', e.message); });
    }

    monthlySalesFlat = flattenMonthlySales(updatedMonthlySales);
  }

  res.json({ bubilet:bubiletData, biletinial:biletinialData, ideasoft:ideasoftSales, lastFetch, monthlySales: monthlySalesFlat });
});

// ─── Mail Etiketleri (kalıcı) ──────────────────────────────────────────────────
const MAIL_LABELS_FILE = path.join(__dirname, 'mail_labels.json');

app.get('/api/mail-labels', function(req, res) {
  const labels = loadJson(MAIL_LABELS_FILE) || {};
  res.json({ labels });
});

app.post('/api/mail-labels', function(req, res) {
  try {
    saveJson(MAIL_LABELS_FILE, req.body.labels || {});
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── Mail Gönder ───────────────────────────────────────────────────────────────
app.post('/api/send-mail', async function(req, res) {
  const { platform, platforms, eventName, seansLabel, islemTipi, kontenjan } = req.body;

  // Platform mail adresleri
  const MAIL_TARGETS = {
   bubilet:    ['info@bubilet.com.tr', 'zeynep@bubilet.com.tr'],
   biletinial: ['info@biletinial.com', 'etkinlik@biletinial.com', 'deniz.gozeler@biletinial.com']
 };
  // Platform linkleri
  const PLATFORM_LINKS = {
    bubilet: {
      'Heykel':      'https://www.bubilet.com.tr/ankara/etkinlik/workshop-etkinlik-takvimi-sosyal-sanathane-ankara',
      'Bez Çanta':   'https://www.bubilet.com.tr/ankara/etkinlik/workshop-etkinlik-takvimi-sosyal-sanathane-ankara',
      'Plak Boyama': 'https://www.bubilet.com.tr/ankara/etkinlik/workshop-etkinlik-takvimi-sosyal-sanathane-ankara',
      'Maske':       'https://www.bubilet.com.tr/ankara/etkinlik/workshop-etkinlik-takvimi-sosyal-sanathane-ankara',
      'Resim':       'https://www.bubilet.com.tr/ankara/etkinlik/workshop-etkinlik-takvimi-sosyal-sanathane-ankara',
      'Mekanda Seç': 'https://www.bubilet.com.tr/ankara/etkinlik/workshop-etkinlik-takvimi-sosyal-sanathane-ankara',
      'Cupcake Mum': 'https://www.bubilet.com.tr/ankara/etkinlik/cupcake-mum-workshop-sosyal-sanathane-ankara--etkinlik-takvimi',
      'Punch':       'https://www.bubilet.com.tr/ankara/etkinlik/punch-workshop-sosyal-sanathane-ankara-etkinlik-takvimi',
      'Seramik':     'https://www.bubilet.com.tr/ankara/etkinlik/seramik-workshop-sosyal-sanathane-ankara-etkinlik-takvimi',
      '3D Figür':    'https://www.bubilet.com.tr/ankara/etkinlik/3d-figur-boyama-workshop-sosyal-sanathane-ankara-etkinlik-takvimi',
      'Quiz Night':  'https://www.bubilet.com.tr/mekan/ara-sokak-pub',
    },
    biletinial: {
      'Heykel':      'https://biletinial.com/tr-tr/egitim/workshop-etkinlik-takvimi-sosyal-sanathane-ankara',
      'Bez Çanta':   'https://biletinial.com/tr-tr/egitim/workshop-etkinlik-takvimi-sosyal-sanathane-ankara',
      'Plak Boyama': 'https://biletinial.com/tr-tr/egitim/workshop-etkinlik-takvimi-sosyal-sanathane-ankara',
      'Maske':       'https://biletinial.com/tr-tr/egitim/workshop-etkinlik-takvimi-sosyal-sanathane-ankara',
      'Resim':       'https://biletinial.com/tr-tr/egitim/workshop-etkinlik-takvimi-sosyal-sanathane-ankara',
      'Mekanda Seç': 'https://biletinial.com/tr-tr/egitim/workshop-etkinlik-takvimi-sosyal-sanathane-ankara',
      'Cupcake Mum': 'https://biletinial.com/tr-tr/egitim/cupcake-mum-workshop-sosyal-sanathane-ankara',
      'Seramik':     'https://biletinial.com/tr-tr/egitim/seramik-workshop-sosyal-sanathane-ankara',
      'Punch':       'https://biletinial.com/tr-tr/egitim/punch-workshop-sosyal-sanathane-ankara',
      '3D Figür':    'https://biletinial.com/tr-tr/egitim/3d-figur-boyama-workshop-sosyal-sanathane-ankara',
      'Quiz Night':  'https://biletinial.com/tr-tr/tiyatro/sosyal-sanathane-ankara-quiz-night',
    },
  };

  // platforms array veya tekil platform — ikisini de destekle
  var platformList = Array.isArray(platforms) && platforms.length > 0
    ? platforms
    : (platform ? [platform] : []);

  if (platformList.length === 0) return res.status(400).json({ error: 'Platform belirtilmedi' });

  // Etkinlik adından base kategori bul (Quiz Night - Konsept → Quiz Night)
  var baseCat = eventName;
  if (eventName && eventName.startsWith('Quiz Night')) baseCat = 'Quiz Night';

  // Mail içeriği oluştur
  function buildMailContent(p) {
    var link = (PLATFORM_LINKS[p] && PLATFORM_LINKS[p][baseCat]) || '(link bulunamadı)';
    var subject, body;
    if (islemTipi === 'kontenjan') {
      subject = 'ACİL KONTENJAN DÜZENLEME İŞLEMİ';
      body = link + '\n' +
        seansLabel + ' bu seansın kalan kontenjanının ' + kontenjan + ' olarak güncellenmesini talep ediyoruz.\n\n' +
        'Sosyal Sanathane Ekibi';
    } else if (islemTipi === 'tukendi') {
      subject = 'ACİL TÜKENDİ YAPMA İŞLEMİ';
      body = link + '\n' +
        seansLabel + ' bu seansın kalan kontenjanının 0 yapılmasını (tükendi) olarak güncellenmesini talep ediyoruz.\n\n' +
        'Sosyal Sanathane Ekibi';
    } else if (islemTipi === 'iptal') {
      subject = 'ACİL ETKİNLİK İPTALİ';
      body = link + '\n' +
        seansLabel + ' bu seansın iptalinin gerçekleşmesini ve varsa bilet satışlarının ücret iadesi yapılmasını talep ediyoruz.\n\n' +
        'Sosyal Sanathane Ekibi';
    } else {
      return null;
    }
    return { subject, body };
  }

  if (!['kontenjan','tukendi','iptal'].includes(islemTipi)) {
    return res.status(400).json({ error: 'Geçersiz işlem tipi' });
  }

  // Gmail API ile gönder
  var { google } = require('googleapis');
  var GMAIL_USER          = process.env.GMAIL_USER;
  var GMAIL_CLIENT_ID     = process.env.GMAIL_CLIENT_ID;
  var GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
  var GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

  var oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, 'https://developers.google.com/oauthplayground');
  oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });

  var gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  function makeMailBody(to, subject, body) {
    var rawLines = [
      'From: "Sosyal Sanathane" <' + GMAIL_USER + '>',
      'To: ' + to,
      'Subject: =?UTF-8?B?' + Buffer.from(subject).toString('base64') + '?=',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(body).toString('base64')
    ].join('\r\n');
    return Buffer.from(rawLines).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // Her platform için mail gönder
  var results = [];
  for (var i = 0; i < platformList.length; i++) {
    var p = platformList[i];
    var toEmail = MAIL_TARGETS[p];
    if (!toEmail) { results.push({ platform: p, error: 'Geçersiz platform' }); continue; }

    var content = buildMailContent(p);
    if (!content) { results.push({ platform: p, error: 'Geçersiz işlem tipi' }); continue; }

    try {
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: makeMailBody(toEmail, content.subject, content.body) }
      });
      results.push({ platform: p, success: true, to: toEmail });
    } catch(err) {
      console.error('Mail gönderme hatasi (' + p + '):', err.message);
      results.push({ platform: p, error: err.message });
    }
  }

  res.json({ results });
});


// ─── Malzeme Stok Kalıcı Kayıt (JSONBin) ─────────────────────────────────────
app.get("/api/malzeme", async function(req, res) {
  try {
    var rec = await getJsonbinRecord();
    res.json({ stock: rec.malzemeStock || {} });
  } catch(e) {
    res.json({ stock: {} });
  }
});

app.post("/api/malzeme", async function(req, res) {
  try {
    const stock = req.body.stock;
    if (!stock) return res.status(400).json({ error: "stock gerekli" });
    var rec = await getJsonbinRecord();
    rec.malzemeStock = stock;
    jsonbinCacheDirty = true;
    await flushJsonbinCache();
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// WhatsApp telefon numarası — kayıtlı credentials'dan al veya güncelle
app.get('/api/whatsapp-phone', function(req, res) {
  try {
    const creds = loadJson(SAVED_CREDS_FILE) || {};
    res.json({ phone: creds.whatsappPhone || '' });
  } catch(e) { res.json({ phone: '' }); }
});

app.post('/api/whatsapp-phone', function(req, res) {
  try {
    const existing = loadJson(SAVED_CREDS_FILE) || {};
    existing.whatsappPhone = (req.body.phone || '').replace(/\D/g, '');
    saveJson(SAVED_CREDS_FILE, existing);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── Quiz Night API ────────────────────────────────────────────────────────────

// In-memory slot locks: { groupNo: clientId }
var quizSlotLocks = {};

// Quiz Night verilerini getir
app.get('/api/quiz', async function(req, res) {
  try {
    var rec = await getJsonbinRecord();
    res.json({ quizData: rec.quizData || null, slotLocks: quizSlotLocks });
  } catch(e) {
    res.json({ quizData: null, slotLocks: {} });
  }
});

// Quiz Night puanlarını kaydet — sunucudaki scores ile merge et (çoklu puantör desteği)
app.post('/api/quiz', async function(req, res) {
  try {
    const quizData = req.body.quizData;
    if (!quizData) return res.status(400).json({ error: 'quizData gerekli' });
    var rec = await getJsonbinRecord();
    var existing = rec.quizData;

    if (existing && existing.eventType === quizData.eventType) {
      // Mevcut scores ile gelen scores merge: her iki puantörün skorları korunur
      var mergedScores = Object.assign({}, existing.scores || {});
      Object.keys(quizData.scores || {}).forEach(function(groupNo) {
        mergedScores[groupNo] = Object.assign({}, mergedScores[groupNo] || {}, quizData.scores[groupNo] || {});
      });
      // Grup isimlerini merge et (en son gelen isim kazanır)
      var mergedGroups = existing.groups || [];
      if (quizData.groups && quizData.groups.length > 0) {
        mergedGroups = quizData.groups.map(function(g) {
          var found = (existing.groups || []).find(function(eg) { return eg.no === g.no; });
          return g.name ? g : (found || g);
        });
      }
      rec.quizData = Object.assign({}, existing, quizData, { scores: mergedScores, groups: mergedGroups });
    } else {
      rec.quizData = quizData;
    }

    jsonbinCacheDirty = true;
    var mergedScores = rec.quizData.scores;
    // Once yanit ver, flush arka planda gitsin
    res.json({ success: true, mergedScores: mergedScores });
    flushJsonbinCache().catch(function(e) { console.error('Quiz POST flush hatasi:', e.message); });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Quiz Night verilerini sil
app.delete('/api/quiz', function(req, res) {
  // UI hemen yanit bekliyor — once yanit ver, sonra arka planda kaydet
  if (jsonbinCache) {
    jsonbinCache.quizData = null;
    jsonbinCacheDirty = true;
  }
  quizSlotLocks = {};
  res.json({ success: true });
  // Arka planda JSONBin'e yaz (yanit beklenmez)
  flushJsonbinCache().catch(function(e) { console.error('Quiz delete flush hatasi:', e.message); });
});

// Quiz Night — DOCX/TXT cevap dosyası parse et (sunucu tarafında mammoth kullanır)
app.post('/api/quiz/parse-answers', upload.single('file'), async function(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya bulunamadı' });
    var ext = req.file.originalname.split('.').pop().toLowerCase();
    var text = '';

    if (ext === 'txt') {
      text = req.file.buffer.toString('utf-8');
    } else if (ext === 'docx') {
      var result = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = result.value;
    } else {
      return res.status(400).json({ error: 'Sadece .txt veya .docx desteklenir' });
    }

    // Parse: "1- Ankara", "2. B) Van Gogh", "3) Bilgisayar" formatlarını destekle
    var answers = {};
    var lines = text.split(/\r?\n/);
    lines.forEach(function(line) {
      line = line.trim();
      if (!line) return;
      var m = line.match(/^(\d+)[\-\.\)\s]+(.+)$/);
      if (m) {
        answers[parseInt(m[1])] = m[2].trim();
      }
    });

    res.json({ answers: answers, count: Object.keys(answers).length });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Quiz Night — DOCX/TXT soru dosyası parse et (sunucu modu)
// Format: "Soru1 bla bla\nCevap: bla bla" veya bölüm başlığı satırları
app.post('/api/quiz/parse-questions', upload.single('file'), async function(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya bulunamadı' });
    var ext = req.file.originalname.split('.').pop().toLowerCase();
    var text = '';

    if (ext === 'txt') {
      text = req.file.buffer.toString('utf-8');
    } else if (ext === 'docx') {
      var result = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = result.value;
    } else {
      return res.status(400).json({ error: 'Sadece .txt veya .docx desteklenir' });
    }

    // Parse: "1- soru metni" + "Cevap: cevap" formatı
    // Bölüm başlıkları: soru/cevap olmayan kısa satırlar
    // Şık satırları (örn. "4- Arap Baharı"): soru numarası artan sırada değilse şık sayılır
    var lines = text.split(/\r?\n/);
    var questions = {};
    var currentNo = null;
    var currentQuestion = '';
    var currentSection = '';
    var lastQuestionNo = 0;

    function isOptionLine(line) {
      // Tek satırda birden fazla "N- kelime" kalıbı varsa şık satırı
      var matches = line.match(/(?<!\d)\d+[-.)]\s*[^\d\s]/g);
      return matches && matches.length > 1;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      // Cevap satırı?
      var ansMatch = line.match(/^[Cc]evap\s*:(.+)$/);
      if (ansMatch) {
        if (currentNo !== null && currentQuestion.trim()) {
          questions[currentNo] = {
            question: currentQuestion.trim(),
            answer: ansMatch[1].trim(),
            section: currentSection
          };
          currentNo = null;
          currentQuestion = '';
        }
        continue;
      }

      // Soru satırı? — şık değil VE numarası artan sırada olmalı
      var qMatch = line.match(/^(\d+)[-.)]\s*(.+)$/);
      if (qMatch && !isOptionLine(line)) {
        var no = parseInt(qMatch[1]);
        // Sadece son sorudan büyük numaraysa yeni soru, yoksa şık satırı gibi işle
        if (no > lastQuestionNo) {
          // Önceki soruyu cevapsız kaydet
          if (currentNo !== null && currentQuestion.trim() && !questions[currentNo]) {
            questions[currentNo] = {
              question: currentQuestion.trim(),
              answer: '',
              section: currentSection
            };
          }
          currentNo = no;
          lastQuestionNo = no;
          currentQuestion = qMatch[2];
          continue;
        }
        // Artan sırada değilse şık satırı — mevcut soruya ekle
      }

      // Mevcut soruya append et
      if (currentNo !== null) {
        currentQuestion += '\n' + line;
        continue;
      }

      // Bölüm başlığı — kısa ve rakamla başlamayan satır
      if (line.length < 60 && !/^\d/.test(line)) {
        currentSection = line;
      }
    }

    // Son soruyu kaydet
    if (currentNo !== null && currentQuestion.trim() && !questions[currentNo]) {
      questions[currentNo] = {
        question: currentQuestion.trim(),
        answer: '',
        section: currentSection
      };
    }

    res.json({ questions: questions, count: Object.keys(questions).length });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Seramik Takip API ────────────────────────────────────────────────────────

app.get('/api/ceramics', async function(req, res) {
  try { res.json(await loadCeramicsFromBin()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── Cloudinary yardımcı fonksiyonlar ─────────────────────────────────────────

// Cloudinary context değerlerinden | ve = karakterlerini temizle
function sanitizeCtx(val) {
  return String(val || '').replace(/[|=]/g, ' ').trim();
}

// Kayıt bilgilerinden context string oluştur
function buildCeramicsContext(record) {
  return [
    'no='          + sanitizeCtx(record.no),
    'firstName='   + sanitizeCtx(record.firstName),
    'lastName='    + sanitizeCtx(record.lastName),
    'phone='       + sanitizeCtx(record.phone),
    'notes='       + sanitizeCtx(record.notes),
    'status='      + sanitizeCtx(record.status),
    'createdAt='   + sanitizeCtx(record.createdAt),
  ].join('|');
}

// Cloudinary Admin API ile mevcut bir görselin context'ini güncelle
async function updateCloudinaryContext(publicId, contextStr) {
  if (!publicId) return;
  try {
    var crypto = require('crypto');
    var timestamp = Math.floor(Date.now() / 1000);
    // Admin API imzası: context + public_ids + timestamp sırasıyla
    var sigStr = 'context=' + contextStr + '&public_ids[]=' + publicId + '&timestamp=' + timestamp + CLOUDINARY_API_SECRET;
    var signature = crypto.createHash('sha1').update(sigStr).digest('hex');
    await axios.post(
      'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/resources/context',
      {
        context:    contextStr,
        public_ids: [publicId],
        timestamp:  String(timestamp),
        api_key:    CLOUDINARY_API_KEY,
        signature:  signature,
      }
    );
    console.log('Cloudinary context güncellendi:', publicId);
  } catch(e) {
    // Context güncellemesi başarısız olsa bile kayıt işlemi devam eder
    console.error('Cloudinary context güncelleme hatası:', e.response?.data || e.message);
  }
}

// public_id'yi imageUrl'den çıkar  (ör. ".../ceramics/5_1234567890.jpg" → "ceramics/5_1234567890")
function publicIdFromUrl(url) {
  if (!url) return null;
  try {
    var m = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z]+)?$/i);
    return m ? m[1] : null;
  } catch(e) { return null; }
}

// ─── Ceramics API ──────────────────────────────────────────────────────────────

app.post('/api/ceramics/record', cloudinaryUpload.single('image'), async function(req, res) {
  try {
    var data = await loadCeramicsFromBin();
    var { firstName, lastName, phone, notes } = req.body;
    var no = data.nextNo;
    data.nextNo = no + 1;

    var imageUrl = null;
    var publicId = null;

    if (req.file) {
      var crypto = require('crypto');
      var timestamp = Math.floor(Date.now() / 1000);
      publicId = 'ceramics/' + no + '_' + Date.now();

      // Context string — katılımcı bilgilerini görsele göm
      var contextStr = [
        'no='        + sanitizeCtx(no),
        'firstName=' + sanitizeCtx(firstName),
        'lastName='  + sanitizeCtx(lastName),
        'phone='     + sanitizeCtx(phone),
        'notes='     + sanitizeCtx(notes),
        'status=firinda',
        'createdAt=' + sanitizeCtx(new Date().toISOString()),
      ].join('|');

      // İmzaya context'i de ekle (alfabetik sıra zorunlu)
      var sigStr = 'context=' + contextStr + '&public_id=' + publicId + '&timestamp=' + timestamp + CLOUDINARY_API_SECRET;
      var signature = crypto.createHash('sha1').update(sigStr).digest('hex');

      var FormData = require('form-data');
      var form = new FormData();
      form.append('file',      req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });
      form.append('api_key',   CLOUDINARY_API_KEY);
      form.append('timestamp', String(timestamp));
      form.append('public_id', publicId);
      form.append('context',   contextStr);   // ← katılımcı bilgileri görsele işleniyor
      form.append('signature', signature);

      var uploadRes = await axios.post(
        'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload',
        form, { headers: form.getHeaders(), maxBodyLength: Infinity }
      );
      imageUrl = uploadRes.data.secure_url;
    }

    var record = {
      id: no, no: String(no),
      firstName: firstName || '', lastName: lastName || '',
      phone: phone || '', notes: notes || '',
      imageUrl: imageUrl, publicId: publicId,
      status: 'firinda',
      statusHistory: [{ status: 'firinda', date: new Date().toISOString() }],
      createdAt: new Date().toISOString()
    };

    data.records = data.records || [];
    data.records.push(record);
    saveCeramicsAsync(); // arka planda JSONBin'e yaz
    res.json({ success: true, record }); // anında yanıt
  } catch(e) {
    console.error('Ceramics record error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/ceramics/record/:no/status', async function(req, res) {
  try {
    var data = await loadCeramicsFromBin();
    var record = data.records.find(function(r) { return String(r.no) === String(req.params.no); });
    if (!record) return res.status(404).json({ error: 'Kayıt bulunamadı' });
    record.status = req.body.status;
    record.statusHistory = record.statusHistory || [];
    record.statusHistory.push({ status: req.body.status, date: new Date().toISOString() });
    saveCeramicsAsync();

    // Cloudinary context'i de güncelle (arka planda, hata kayıtı engellemez)
    var pid = record.publicId || publicIdFromUrl(record.imageUrl);
    if (pid) updateCloudinaryContext(pid, buildCeramicsContext(record)).catch(function(){});

    res.json({ success: true, record });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/ceramics/record/:no', async function(req, res) {
  try {
    var data = await loadCeramicsFromBin();
    var record = data.records.find(function(r) { return String(r.no) === String(req.params.no); });
    if (!record) return res.status(404).json({ error: 'Kayıt bulunamadı' });
    ['firstName','lastName','phone','notes'].forEach(function(k) {
      if (req.body[k] !== undefined) record[k] = req.body[k];
    });
    saveCeramicsAsync();

    // Cloudinary context'i de güncelle
    var pid = record.publicId || publicIdFromUrl(record.imageUrl);
    if (pid) updateCloudinaryContext(pid, buildCeramicsContext(record)).catch(function(){});

    res.json({ success: true, record });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/ceramics/record/:no', async function(req, res) {
  try {
    var data = await loadCeramicsFromBin();
    data.records = data.records.filter(function(r) { return String(r.no) !== String(req.params.no); });
    saveCeramicsAsync();
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── Cloudinary'den kurtarma — JSONBin boşalırsa tüm kayıtları geri yükle ────
// Kullanım: GET /api/ceramics/recover
// Cloudinary'deki tüm ceramics/ fotoğraflarını tarar, context'ten kayıtları yeniden oluşturur.
app.get('/api/ceramics/recover', async function(req, res) {
  try {
    var crypto = require('crypto');
    var timestamp = Math.floor(Date.now() / 1000);
    // Search API — tüm ceramics klasörünü çek
    var sigStr = 'expression=folder%3Aceramics&max_results=500&timestamp=' + timestamp + CLOUDINARY_API_SECRET;
    var signature = crypto.createHash('sha1').update(
      'expression=folder:ceramics&max_results=500&timestamp=' + timestamp + CLOUDINARY_API_SECRET
    ).digest('hex');

    var searchRes = await axios.post(
      'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/resources/search',
      {
        expression:  'folder:ceramics',
        max_results: 500,
        with_field:  ['context'],
        sort_by:     [{ created_at: 'asc' }],
      },
      {
        headers: {
          Authorization: 'Basic ' + Buffer.from(CLOUDINARY_API_KEY + ':' + CLOUDINARY_API_SECRET).toString('base64')
        }
      }
    );

    var resources = searchRes.data.resources || [];
    var recovered = [];

    resources.forEach(function(r) {
      var ctx = (r.context && r.context.custom) ? r.context.custom : {};
      recovered.push({
        id:        parseInt(ctx.no) || 0,
        no:        ctx.no        || r.public_id,
        firstName: ctx.firstName || '',
        lastName:  ctx.lastName  || '',
        phone:     ctx.phone     || '',
        notes:     ctx.notes     || '',
        status:    ctx.status    || 'firinda',
        imageUrl:  r.secure_url,
        publicId:  r.public_id,
        createdAt: ctx.createdAt || r.created_at,
        statusHistory: [{ status: ctx.status || 'firinda', date: ctx.createdAt || r.created_at }],
        _recovered: true
      });
    });

    // Sadece önizleme mi, gerçekten geri yükle mi?
    if (req.query.apply === 'true') {
      // Mevcut JSONBin'i kurtarılan kayıtlarla değiştir
      var maxNo = recovered.reduce(function(m, r) { return Math.max(m, parseInt(r.no) || 0); }, 0);
      ceramicsCache = { records: recovered, nextNo: maxNo + 1 };
      saveCeramicsAsync();
      console.log('Ceramics kurtarma: ' + recovered.length + ' kayıt JSONBin\'e yazıldı.');
      return res.json({ success: true, recovered: recovered.length, records: recovered });
    }

    // Varsayılan: sadece önizle, yazmadan göster
    res.json({ preview: true, found: recovered.length, records: recovered });
  } catch(e) {
    console.error('Ceramics recover hatası:', e.response?.data || e.message);
    res.status(500).json({ error: e.message });
  }
});


app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('/{*path}', function(req, res) {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  }
});

app.listen(3001, '0.0.0.0', function() { console.log('Server 3001 portunda calisiyor'); });