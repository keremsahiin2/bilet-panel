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

const IDEASOFT_PRODUCTS = {
  12671:'Seramik', 5135:'Mekanda Seç', 4278:'Punch', 4252:'Cupcake Mum',
  4251:'Quiz Night', 4249:'Plak Boyama', 4247:'Heykel', 4245:'Maske',
  4243:'Bez Çanta', 4241:'Resim', 4234:'3D Figür'
};

// ─── JSONBin — kalıcı baseline storage ────────────────────────────────────────
const JSONBIN_BIN_ID  = '69cef0d036566621a8740cdb';
const JSONBIN_API_KEY = '$2a$10$cip66R4w.2tIzZWE8g9YkO1PUm.m8qnmKKKb0lZFEFGAoXyxqIPZm';

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

  // Workshop etkinlikleri için alt kırılımları çek
  // etkinlikAdi'nde "Workshop" geçen ve biletAdet > 0 olan seanslar
  const expandedSeanslar = [];
  for (const s of seanslar) {
    const isWorkshop = s.etkinlikAdi && s.etkinlikAdi.toLowerCase().includes('workshop');
    if (isWorkshop && s.biletAdet > 0 && s.seansId) {
      try {
        // ticket-list API'si seansId ile çağrılıyor
        const detayRes = await axios.get(
          'https://oldpanel.api.bubilet.com.tr/api/v2/ticket-list/' + s.seansId,
          { headers: { ...authHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
        );
        const detay = detayRes.data;
        if (detay && detay.success && detay.data && Array.isArray(detay.data.detaySatisRaporlar)) {
          // Her bilet türü için ayrı bir kayıt üret
          for (const bilet of detay.data.detaySatisRaporlar) {
            if (!bilet.biletAdet || bilet.biletAdet === 0) continue;
            const cat = bubiletBiletAdiToCategory(bilet.biletAdi);
            expandedSeanslar.push({
              ...s,
              // Orijinal etkinlikAdi'ni saklıyoruz, ama kategori bilgisini _workshopCat olarak ekliyoruz
              _workshopCat: cat,
              _workshopBiletAdi: bilet.biletAdi,
              biletAdet: bilet.biletAdet,
              // Workshop satışları bu kırılımda geldiği için etkinlikAdi'ni de cat olarak set ediyoruz
              etkinlikAdi: cat,
            });
          }
          console.log('Workshop detay cekildi:', s.seansId, '→', detay.data.detaySatisRaporlar.length, 'bilet türü');
        } else {
          // Detay gelmezse orijinali ekle
          expandedSeanslar.push(s);
        }
        // Rate limit için kısa bekleme
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        console.error('Workshop ticket-list hatasi seansId=' + s.seansId + ':', err.message);
        // Hata olursa orijinali ekle
        expandedSeanslar.push(s);
      }
    } else {
      expandedSeanslar.push(s);
    }
  }

  return expandedSeanslar;
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
  return res.data.Data || [];
}

// ─── İdeasoft: seansları çek ───────────────────────────────────────────────────
async function fetchIdeasoftSeances(cookies, csrf) {
  var cStr = toCookieStr(cookies);
  var headers = {
    'Cookie':cStr, 'X-CSRF-TOKEN':csrf||'', 'Accept':'application/json',
    'x-ideasoft-locale':'tr', 'navigate-on-error':'false',
    'disabled-success-toastr':'false', 'disabled-error-toastr':'false'
  };
  var allSeances = [];
  for (var productId of Object.keys(IDEASOFT_PRODUCTS)) {
    var categoryName = IDEASOFT_PRODUCTS[productId];
    try {
      var res = await axios.get(
        'https://berkayalabalik.myideasoft.com/admin-app/optioned-products/'+productId,
        { headers }
      );
      var sc = (res.headers['set-cookie']||[]).join(' ');
      var cm = sc.match(/X-CSRF-TOKEN=([a-f0-9]{64})/);
      if (cm) { csrf=cm[1]; ideasoftCsrfToken=csrf; headers['X-CSRF-TOKEN']=csrf; }

      var body = res.data;
      if (body && body.data && Array.isArray(body.data)) {
        for (var seance of body.data) {
          var fname = seance.name || '';
          // name yoksa ya da sadece kategori adıysa startDate'den tarih üret
          if (!fname || fname.trim() === categoryName) {
            var startField = seance.startDate || seance.beginDate || seance.start_date || seance.begin_date || '';
            if (startField) {
              var sd = new Date(startField);
              var TR_MONTHS_SRV = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
              var TR_DAYS_SRV   = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
              var hh = String(sd.getHours()).padStart(2,'0');
              var mm = String(sd.getMinutes()).padStart(2,'0');
              // Bitiş saatini de ekle (genellikle +2 saat)
              var endField = seance.endDate || seance.finishDate || seance.end_date || '';
              var timeSlotStr = hh + ':' + mm;
              if (endField) {
                var ed = new Date(endField);
                var ehh = String(ed.getHours()).padStart(2,'0');
                var emm = String(ed.getMinutes()).padStart(2,'0');
                timeSlotStr += ' - ' + ehh + ':' + emm;
              }
              fname = 'Farabi Sokak: Sosyal Sanathane - ' +
                sd.getDate() + ' ' + TR_MONTHS_SRV[sd.getMonth()] + ' ' + TR_DAYS_SRV[sd.getDay()] +
                ' ' + timeSlotStr;
            } else {
              fname = categoryName + ' #' + seance.id;
            }
          }
          allSeances.push({ seanceId:seance.id, productId:parseInt(productId), category:categoryName,
            fullName:fname, stockAmount:seance.stockAmount,
            price:seance.price1||'0', status:seance.status,
            _rawFields: Object.keys(seance) }); // debug için
        }
      } else if (body && body.stockAmount !== undefined) {
        var fname2 = body.name || '';
        if (!fname2 || fname2.trim() === categoryName) {
          var startField2 = body.startDate || body.beginDate || body.start_date || body.begin_date || '';
          if (startField2) {
            var sd2 = new Date(startField2);
            var TR_MONTHS_SRV2 = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
            var TR_DAYS_SRV2   = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
            var hh2 = String(sd2.getHours()).padStart(2,'0');
            var mm2 = String(sd2.getMinutes()).padStart(2,'0');
            var endField2 = body.endDate || body.finishDate || body.end_date || '';
            var timeSlotStr2 = hh2 + ':' + mm2;
            if (endField2) {
              var ed2 = new Date(endField2);
              var ehh2 = String(ed2.getHours()).padStart(2,'0');
              var emm2 = String(ed2.getMinutes()).padStart(2,'0');
              timeSlotStr2 += ' - ' + ehh2 + ':' + emm2;
            }
            fname2 = 'Farabi Sokak: Sosyal Sanathane - ' +
              sd2.getDate() + ' ' + TR_MONTHS_SRV2[sd2.getMonth()] + ' ' + TR_DAYS_SRV2[sd2.getDay()] +
              ' ' + timeSlotStr2;
          } else {
            fname2 = categoryName + ' #' + body.id;
          }
        }
        allSeances.push({ seanceId:body.id, productId:parseInt(productId), category:categoryName,
          fullName:fname2, stockAmount:body.stockAmount,
          price:body.price1||'0', status:body.status,
          _rawFields: Object.keys(body) });
      }
      await new Promise(r=>setTimeout(r,150));
    } catch(err) {
      console.error('İdeasoft urun '+productId+' hatasi:', err.message);
      allSeances.push({ seanceId:null, productId:parseInt(productId), category:categoryName,
        fullName:categoryName, stockAmount:null, error:true });
    }
  }
  return allSeances;
}

// ─── İdeasoft: Puppeteer girişi (sadece lokalden çalışır) ─────────────────────
async function loginIdeasoftPuppeteer(username, password) {
  throw new Error('İdeasoft ilk girişi için uygulamayı lokalde çalıştırın ve cookie kaydedin.');
}

// ─── Ortak login işlevi ────────────────────────────────────────────────────────
async function doLogin(bubiletUser, bubiletPass, biletToken, ideasoftUser, ideasoftPass) {
  console.log('Bubilet giris yapiliyor...');
  bubiletData = await fetchBubilet(bubiletUser, bubiletPass);
  console.log('Bubilet tamamlandi:', bubiletData.length, 'kayit');

  console.log('Biletini Al token kullaniliyor...');
  biletinialData = await fetchBiletinial(biletToken);
  console.log('Biletini Al tamamlandi:', biletinialData.length, 'kayit');

  if (ideasoftUser && ideasoftPass) {
    var savedCookies = loadJson(COOKIES_FILE);
    if (savedCookies && savedCookies.cookies && savedCookies.cookies.length > 0) {
      console.log('İdeasoft: kayitli cookie deneniyor...');
      try {
        ideasoftCookies   = savedCookies.cookies;
        ideasoftCsrfToken = savedCookies.csrfToken;
        var seances = await fetchIdeasoftSeances(ideasoftCookies, ideasoftCsrfToken);
        var hasReal = seances.some(s => s.stockAmount !== null && !s.error);
        if (!hasReal && seances.every(s => s.error)) throw new Error('Cookie gecersiz');
        ideasoftData = seances;
        console.log('İdeasoft: cookie ile cekildi,', seances.length, 'seans');
      } catch(e) {
        console.log('İdeasoft: yeniden giris yapiliyor...');
        var lg = await loginIdeasoftPuppeteer(ideasoftUser, ideasoftPass);
        ideasoftData = await fetchIdeasoftSeances(lg.cookies, lg.csrfToken);
      }
    } else {
      console.log('İdeasoft: ilk giris...');
      var lg2 = await loginIdeasoftPuppeteer(ideasoftUser, ideasoftPass);
      ideasoftData = await fetchIdeasoftSeances(lg2.cookies, lg2.csrfToken);
    }
  }

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
    var baseline = await loadBaseline();
    baseline[seanceId] = newStock + currentSoldCount;
    await saveBaseline(baseline);

    ideasoftData = await fetchIdeasoftSeances(ideasoftCookies, ideasoftCsrfToken);
    lastFetch    = new Date().toISOString();
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
  if (ideasoftData) {
    var baseline = await loadBaseline();
    var changed  = false;
    ideasoftSales = ideasoftData.map(function(s) {
      if (!s.seanceId) return Object.assign({},s,{baselineStock:null,soldCount:null});
      if (baseline[s.seanceId]===undefined) { baseline[s.seanceId]=CATEGORY_BASELINE[s.category]||DEFAULT_BASELINE; changed=true; }
      var base = baseline[s.seanceId] || CATEGORY_BASELINE[s.category] || DEFAULT_BASELINE;
      return Object.assign({},s,{
        baselineStock: base,
        soldCount: Math.max(0, base-(s.stockAmount!==null?s.stockAmount:base))
      });
    });
    if (changed) await saveBaseline(baseline);
  }

  res.json({ bubilet:bubiletData, biletinial:biletinialData, ideasoft:ideasoftSales, lastFetch });
});

// Frontend dist klasörünü servis et (PWA için)
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('/{*path}', function(req, res) {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  }
});

app.listen(3001, '0.0.0.0', function() { console.log('Server 3001 portunda calisiyor'); });
