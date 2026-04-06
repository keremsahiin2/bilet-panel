const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const fs   = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

let bubiletData    = null;
let biletinialData = null;
let ideasoftData   = null;
let lastFetch      = null;
let ideasoftCookies    = null;
let ideasoftCsrfToken  = null;

const COOKIES_FILE        = path.join(__dirname, 'ideasoft_cookies.json');
const STOCK_BASELINE_FILE = path.join(__dirname, 'stock_baseline.json');
const SAVED_CREDS_FILE    = path.join(__dirname, 'saved_credentials.json');
const DEFAULT_BASELINE    = 8;
const CATEGORY_BASELINE = {
  'Heykel': 10, 'Bez Çanta': 10, 'Resim': 10, '3D Figür': 10,
  'Maske': 10, 'Plak Boyama': 10, 'Seramik': 8, 'Cupcake Mum': 8,
  'Punch': 8, 'Quiz Night': 50, 'Mekanda Seç': 10
};

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
const MONTHLY_SALES_BIN_ID = ''; // İlk çalıştırmada otomatik oluşturulacak
// Not: monthly sales ayrı bir JSONBin bin'inde saklanır.
// Eğer MONTHLY_SALES_BIN_ID boşsa baseline bin'i içinde "monthlySales" key'i kullanılır.

async function loadBaseline() {
  try {
    var res = await axios.get('https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID + '/latest', {
      headers: { 'X-Master-Key': JSONBIN_API_KEY }
    });
    return res.data.record.baseline || {};
  } catch(e) {
    console.error('JSONBin okuma hatasi:', e.message);
    return {};
  }
}

async function saveBaseline(baseline) {
  try {
    await axios.put('https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID, { baseline }, {
      headers: { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' }
    });
  } catch(e) {
    console.error('JSONBin yazma hatasi:', e.message);
  }
}

// ─── Aylık satış arşivi (kalıcı — seanslar silinse bile korunur) ───────────────
async function loadMonthlySales() {
  try {
    var res = await axios.get('https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID + '/latest', {
      headers: { 'X-Master-Key': JSONBIN_API_KEY }
    });
    return res.data.record.monthlySales || {};
  } catch(e) {
    console.error('JSONBin monthlySales okuma hatasi:', e.message);
    return {};
  }
}

async function saveMonthlySalesAndBaseline(baseline, monthlySales) {
  try {
    await axios.put('https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID, { baseline, monthlySales }, {
      headers: { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' }
    });
  } catch(e) {
    console.error('JSONBin yazma hatasi:', e.message);
  }
}

// İdeasoft seanslarından aylık satış verisini çıkarıp mevcut arşivle birleştir
function mergeIdeasoftIntoMonthlySales(existing, ideasoftSeances, baseline) {
  var TR_MONTHS_SRV = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  var merged = JSON.parse(JSON.stringify(existing)); // derin kopya

  ideasoftSeances.forEach(function(s) {
    if (!s.fullName || !s.seanceId) return;
    // fullName'den ay bilgisini çıkar
    var m = s.fullName.match(/- (\d+) (\w+) (\w+)/u);
    if (!m) return;
    var monthKey = m[2]; // "Nisan"
    if (!TR_MONTHS_SRV.includes(monthKey)) return;

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

  // Tüm workshop detaylarını PARALEL çek — seri değil!
  const workshopDetaylar = await Promise.all(
    workshopSeanslar.map(async (s) => {
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
    })
  );

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
  var now = new Date();
  var future = new Date();
  future.setDate(future.getDate() + 30);
  var res = await axios.get(
    'https://reportapi2.biletinial.com/api/Report/GetActiveEventDetailList' +
    '?FirstDate=' + encodeURIComponent(now.toUTCString()) +
    '&LastDate=' + encodeURIComponent(future.toUTCString()) + '&lang=tr',
    { headers:{ 'Authorization':'Bearer '+token, 'xapikey':'TPJDtRG0cP',
        'allow-origin':'http://localhost:3000', 'origin':'https://partner.biletinial.com',
        'referer':'https://partner.biletinial.com/' }}
  );
  const biletinialHeaders = {
    'Authorization':'Bearer '+token, 'xapikey':'TPJDtRG0cP',
    'allow-origin':'http://localhost:3000', 'origin':'https://partner.biletinial.com',
    'referer':'https://partner.biletinial.com/'
  };
  const allSeances = res.data.Data || [];

  // Workshop kırılım seanslarını bul: sadece "Workshop: Etkinlik Takvimi" ile başlayanlar
  // Punch Workshop, Seramik Workshop vb. ayrı etkinlikler — onlara kırılım gerekmez
  const workshopSeances = allSeances.filter(s =>
    s.EventName && s.EventName.startsWith('Workshop: Etkinlik Takvimi')
  );
  const normalSeances = allSeances.filter(s =>
    !s.EventName || !s.EventName.startsWith('Workshop: Etkinlik Takvimi')
  );

  console.log('Biletini Al: Workshop seans sayisi:', workshopSeances.length);

  // Workshop seansları için GetSeanceTicketTypeCounts çek (paralel)
  const workshopExpanded = await Promise.all(
    workshopSeances.map(async (s) => {
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
          if (!cat) continue; // Davetli/Kupon/Toplu Satis vb. yoksay
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
        console.error('Biletini Al GetSeanceTicketTypeCounts hatasi SeanceId=' + s.SeanceId + ':', err.message);
        return [s];
      }
    })
  );

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
  var BATCH = 3; // aynı anda kaç istek — 429 cache ile korunuyor, 3 güvenli
  for (var i = 0; i < IDEASOFT_PRODUCTS.length; i += BATCH) {
    var batch = IDEASOFT_PRODUCTS.slice(i, i + BATCH);
    var results = await Promise.all(
      batch.map(([pid, cat]) => fetchOneIdeasoftProduct(pid, cat, { ...headers, 'X-CSRF-TOKEN': ideasoftCsrfToken || csrf || '' }))
    );
    results.forEach(r => allEntries.push(...r));
    // Gruplar arası bekleme
    if (i + BATCH < IDEASOFT_PRODUCTS.length) {
      await new Promise(r => setTimeout(r, 400));
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
  // Bubilet + Biletinial + İdeasoft paralel başlat
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
          console.log('Ideasoft: cookie ile cekildi,', seances.length, 'seans');
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

  // Üçünü paralel çalıştır
  const [bubilet, biletinial, ideasoft] = await Promise.all([
    fetchBubilet(bubiletUser, bubiletPass)
      .then(d => { console.log('Bubilet tamamlandi:', d.length, 'kayit'); return d; }),
    fetchBiletinial(biletToken)
      .then(d => { console.log('Biletini Al tamamlandi:', d.length, 'kayit'); return d; }),
    ideasoftPromise
  ]);

  bubiletData    = bubilet;
  biletinialData = biletinial;
  if (ideasoft) ideasoftData = ideasoft;

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
    bubiletPassFilled:   !!(creds.bubiletPass),
    ideasoftPassFilled:  !!(creds.ideasoftPass)
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
      ideasoftPass:    req.body.ideasoftPass    || existing.ideasoftPass    || ''
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

// Otomatik login — uygulama açılınca kaydedilmiş bilgilerle giriş yap
app.post('/api/auto-login', async function(req, res) {
  const creds = loadJson(SAVED_CREDS_FILE);
  if (!creds || !creds.bubiletUser || !creds.bubiletPass) {
    return res.json({ success:false, reason:'Kayıtlı bilgi yok' });
  }
  try {
    await doLogin(creds.bubiletUser, creds.bubiletPass, creds.biletinialToken||'', creds.ideasoftUser||'', creds.ideasoftPass||'');
    res.json({ success:true });
  } catch(err) {
    console.error('Auto-login hatasi:', err.message);
    res.status(500).json({ error:err.message });
  }
});

// Manuel login
app.post('/api/login', async function(req, res) {
  try {
    const saved = loadJson(SAVED_CREDS_FILE) || {};
    const bubiletUser    = req.body.bubiletUser    || saved.bubiletUser    || '';
    const bubiletPass    = req.body.bubiletPass    || saved.bubiletPass    || '';
    const biletToken     = req.body.biletinialToken|| saved.biletinialToken|| '';
    const ideasoftUser   = req.body.ideasoftUser   || saved.ideasoftUser   || '';
    const ideasoftPass   = req.body.ideasoftPass   || saved.ideasoftPass   || '';

    if (req.body.rememberMe) {
      saveJson(SAVED_CREDS_FILE, { bubiletUser, bubiletPass, biletinialToken:biletToken, ideasoftUser, ideasoftPass });
    }

    await doLogin(bubiletUser, bubiletPass, biletToken, ideasoftUser, ideasoftPass);
    res.json({ success:true });
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
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Seans deaktif et / aktif et
app.post('/api/ideasoft/toggle-seance', async function(req, res) {
  if (!ideasoftCookies) return res.status(401).json({ error:'İdeasoft oturumu yok - tekrar giriş yapın' });
  var seanceId = req.body.seanceId;
  var active   = req.body.active; // true = aktif, false = pasif
  var cStr     = toCookieStr(ideasoftCookies);
  try {
    var productRes = await axios.get(
      'https://berkayalabalik.myideasoft.com/admin-app/optioned-products/'+seanceId,
      { headers:{ 'Cookie':cStr, 'X-CSRF-TOKEN':ideasoftCsrfToken||'', 'Accept':'application/json', 'x-ideasoft-locale':'tr' }}
    );
    var sc = (productRes.headers['set-cookie']||[]).join(' ');
    var m  = sc.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
    if (m) { ideasoftCsrfToken=m[1]; saveJson(COOKIES_FILE, { cookies:ideasoftCookies, csrfToken:ideasoftCsrfToken }); }

    await axios.put(
      'https://berkayalabalik.myideasoft.com/admin-app/optioned-products/'+seanceId,
      Object.assign({}, productRes.data, { status: active ? 1 : 0 }),
      { headers:{ 'Cookie':cStr, 'X-CSRF-TOKEN':ideasoftCsrfToken||'', 'Content-Type':'application/json', 'Accept':'application/json', 'x-ideasoft-locale':'tr' }}
    );

    ideasoftData = await fetchIdeasoftSeances(ideasoftCookies, ideasoftCsrfToken);
    lastFetch    = new Date().toISOString();
    res.json({ success:true });
  } catch(err) {
    console.error('Seans toggle hatasi:', err.message);
    if (err.response && (err.response.status===401||err.response.status===403))
      return res.status(401).json({ error:'İdeasoft oturumu sona erdi - tekrar giriş yapın' });
    res.status(500).json({ error:err.message });
  }
});

// Seansı sil (ideasoft options endpoint)
app.delete('/api/ideasoft/delete-option/:optionId', async function(req, res) {
  if (!ideasoftCookies) return res.status(401).json({ error:'İdeasoft oturumu yok - tekrar giriş yapın' });
  var optionId = req.params.optionId;
  if (!optionId) return res.status(400).json({ error:'optionId gerekli' });
  var cStr = toCookieStr(ideasoftCookies);
  try {
    // Önce CSRF token'ı tazele
    try {
      var csrfRes = await axios.get(
        'https://berkayalabalik.myideasoft.com/admin-app/options?page=1&limit=1&optionGroup=9&fields=id',
        { headers: { 'Cookie': cStr, 'X-CSRF-TOKEN': ideasoftCsrfToken || '',
            'Accept': 'application/json', 'x-ideasoft-locale': 'tr',
            'navigate-on-error': 'false' }, timeout: 8000 }
      );
      var sc = (csrfRes.headers['set-cookie'] || []).join(' ');
      var m = sc.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
      if (m) { ideasoftCsrfToken = m[1]; saveJson(COOKIES_FILE, { cookies: ideasoftCookies, csrfToken: ideasoftCsrfToken }); }
    } catch(e) { /* token tazeleme başarısız olsa da devam et */ }

    await axios.delete(
      'https://berkayalabalik.myideasoft.com/admin-app/options/' + optionId,
      { headers: {
          'Cookie': cStr,
          'X-CSRF-TOKEN': ideasoftCsrfToken || '',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'x-ideasoft-locale': 'tr',
          'navigate-on-error': 'false',
          'disabled-success-toastr': 'false',
          'disabled-error-toastr': 'false'
      }, timeout: 10000 }
    );

    // Local cache'den de sil
    Object.keys(ideasoftProductCache).forEach(function(pid) {
      ideasoftProductCache[pid] = ideasoftProductCache[pid].filter(function(s) {
        return String(s.seanceId) !== String(optionId);
      });
    });
    // ideasoftData'dan da kaldır
    if (ideasoftData) {
      ideasoftData = ideasoftData.filter(function(s) {
        return String(s.seanceId) !== String(optionId);
      });
    }

    console.log('Seans silindi: optionId=' + optionId);
    res.json({ success: true });
  } catch(err) {
    console.error('Seans silme hatasi:', err.message, err.response && err.response.status);
    if (err.response && (err.response.status === 401 || err.response.status === 403))
      return res.status(401).json({ error:'İdeasoft oturumu sona erdi - tekrar giriş yapın' });
    res.status(500).json({ error: err.message, status: err.response && err.response.status });
  }
});

// Stok güncelle
app.post('/api/ideasoft/update-stock', async function(req, res) {
  if (!ideasoftCookies) return res.status(401).json({ error:'İdeasoft oturumu yok - tekrar giriş yapın' });
  var seanceId        = req.body.seanceId;
  var newStock        = parseInt(req.body.newStock);        // kullanıcının girdiği "kalan kontenjan"
  var currentSoldCount = parseInt(req.body.currentSoldCount) || 0; // şu ana kadar satılan
  var cStr            = toCookieStr(ideasoftCookies);

  try {
    var productRes = await axios.get(
      'https://berkayalabalik.myideasoft.com/admin-app/optioned-products/'+seanceId,
      { headers:{ 'Cookie':cStr, 'X-CSRF-TOKEN':ideasoftCsrfToken||'', 'Accept':'application/json', 'x-ideasoft-locale':'tr' }}
    );
    var sc3 = (productRes.headers['set-cookie']||[]).join(' ');
    var m3  = sc3.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
    if (m3) { ideasoftCsrfToken=m3[1]; saveJson(COOKIES_FILE, { cookies:ideasoftCookies, csrfToken:ideasoftCsrfToken }); }

    // İdeasoft'a direkt "kalan kontenjan" gönder (stockAmount = kalan)
    await axios.put(
      'https://berkayalabalik.myideasoft.com/admin-app/optioned-products/'+seanceId,
      Object.assign({}, productRes.data, { stockAmount:newStock }),
      { headers:{ 'Cookie':cStr, 'X-CSRF-TOKEN':ideasoftCsrfToken||'', 'Content-Type':'application/json', 'Accept':'application/json', 'x-ideasoft-locale':'tr' }}
    );

    // Baseline = yeni kalan + mevcut satılan
    // Örnek: kullanıcı 2 girdi, 3 satılmış → baseline=5, soldCount=5-2=3 ✓
    var record2 = {};
    try {
      var br2 = await axios.get('https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID + '/latest', {
        headers: { 'X-Master-Key': JSONBIN_API_KEY }
      });
      record2 = br2.data.record || {};
    } catch(e) {}
    var baseline2      = record2.baseline      || {};
    var monthlySales2  = record2.monthlySales  || {};
    baseline2[seanceId] = newStock + currentSoldCount;
    // Aylık arşivi de güncelle
    ideasoftData = await fetchIdeasoftSeances(ideasoftCookies, ideasoftCsrfToken);
    lastFetch    = new Date().toISOString();
    var tmpSales = ideasoftData.map(function(s) {
      if (!s.seanceId) return Object.assign({},s,{soldCount:null});
      var base = baseline2[s.seanceId] || CATEGORY_BASELINE[s.category] || DEFAULT_BASELINE;
      return Object.assign({},s,{ baselineStock:base, soldCount: Math.max(0, base-(s.stockAmount!==null?s.stockAmount:base)) });
    });
    var updatedMonthly2 = mergeIdeasoftIntoMonthlySales(monthlySales2, tmpSales, baseline2);
    try {
      await axios.put('https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID,
        { baseline: baseline2, monthlySales: updatedMonthly2 },
        { headers: { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' } });
    } catch(e) { console.error('JSONBin yazma hatasi:', e.message); }
    res.json({ success:true });
  } catch(err) {
    console.error('Stok guncelleme hatasi:', err.message);
    if (err.response && (err.response.status===401||err.response.status===403))
      return res.status(401).json({ error:'İdeasoft oturumu sona erdi - tekrar giriş yapın' });
    res.status(500).json({ error:err.message });
  }
});

// Satış verileri
app.get('/api/sales', async function(req, res) {
  if (!bubiletData) return res.status(401).json({ error:'Giris yapilmadi' });

  var ideasoftSales = null;
  var monthlySalesFlat = {};
  if (ideasoftData) {
    var record = {};
    try {
      var binRes = await axios.get('https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID + '/latest', {
        headers: { 'X-Master-Key': JSONBIN_API_KEY }
      });
      record = binRes.data.record || {};
    } catch(e) { console.error('JSONBin okuma hatasi:', e.message); }

    var baseline      = record.baseline      || {};
    var monthlySales  = record.monthlySales  || {};
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
      try {
        await axios.put('https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID,
          { baseline, monthlySales: updatedMonthlySales },
          { headers: { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' } });
      } catch(e) { console.error('JSONBin yazma hatasi:', e.message); }
    }

    monthlySalesFlat = flattenMonthlySales(updatedMonthlySales);
  }

  res.json({ bubilet:bubiletData, biletinial:biletinialData, ideasoft:ideasoftSales, lastFetch, monthlySales: monthlySalesFlat });
});

// Frontend dist klasörünü servis et (PWA için)
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('/{*path}', function(req, res) {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  }
});

app.listen(3001, '0.0.0.0', function() { console.log('Server 3001 portunda calisiyor'); });
