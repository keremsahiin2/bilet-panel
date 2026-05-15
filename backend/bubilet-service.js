/**
 * BUBILET SERVICE - Production (Render Uyumlu)
 * 1. İlk açılış: JSONBin'den token oku → geçerliyse axios ile veri çek (~2sn)
 * 2. Token yoksa / expire ise: Puppeteer browser ile CF bypass + token al
 * 3. Token alınınca JSONBin'e kaydet — Render restart'larında da korunur
 * 4. Refresh: önce mevcut token ile dene → 401/403 ise Puppeteer
 * Veri 55 dakika cache'lenir.
 */
const puppeteer = require("rebrowser-puppeteer");
const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");

const API_BASE  = "https://oldpanel.api.bubilet.com.tr";
const PANEL_URL = "https://panel.bubilet.com.tr/sign-in";

// ─── Veri Cache ────────────────────────────────────────────────────────────
let _cachedData   = null;
let _cacheExpiry  = null;
let _fetchPromise = null;
const CACHE_TTL = 55 * 60 * 1000; // 55 dakika

// ─── Token + Cookie Cache (memory) ────────────────────────────────────────
let _cachedToken       = null;
let _cachedTokenExpiry = null;
let _cachedCookies     = null;

// ─── JSONBin config ────────────────────────────────────────────────────────
const JSONBIN_BIN_ID  = process.env.JSONBIN_BIN_ID  || '69cef0d036566621a8740cdb';
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY  || '$2a$10$cip66R4w.2tIzZWE8g9YkO1PUm.m8qnmKKKb0lZFEFGAoXyxqIPZm';

// ─── JSONBin'den token oku ─────────────────────────────────────────────────
async function loadTokenFromJsonbin() {
  try {
    const res = await axios.get('https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID + '/latest', {
      headers: { 'X-Master-Key': JSONBIN_API_KEY },
      timeout: 10000
    });
    const record = res.data.record || {};
    if (record.bubiletToken && record.bubiletTokenExpiry) {
      console.log('[Bubilet] JSONBin token yuklendi, expire:', new Date(record.bubiletTokenExpiry).toISOString());
      return {
        token:       record.bubiletToken,
        tokenExpiry: record.bubiletTokenExpiry,
        cookies:     record.bubiletCookies || []
      };
    }
  } catch(e) {
    console.warn('[Bubilet] JSONBin token okuma hatasi:', e.message);
  }
  return null;
}

}

// ─── Proxy Config ──────────────────────────────────────────────────────────
function getProxyAgent() {
  const host = process.env.BUBILET_PROXY_HOST || process.env.PROXY_HOST;
  const port = process.env.BUBILET_PROXY_PORT || process.env.PROXY_PORT;
  const user = process.env.BUBILET_PROXY_USER || process.env.PROXY_USER;
  const pass = process.env.BUBILET_PROXY_PASS || process.env.PROXY_PASS;
  if (!host || !port) return null;
  const auth = user && pass ? `${user}:${pass}@` : '';
  return new HttpsProxyAgent(`http://${auth}${host}:${port}`);
}

function getAxiosConfig() {
  const agent = getProxyAgent();
  return agent ? { httpsAgent: agent, proxy: false } : {};
}

// ─── Token geçerli mi? ─────────────────────────────────────────────────────
function isTokenValid() {
  if (!_cachedToken || !_cachedTokenExpiry) return false;
  return Date.now() < _cachedTokenExpiry - 60000; // 1 dk önce expire say
}

// ─── Cookie string oluştur ─────────────────────────────────────────────────
function cookiesToString(cookies) {
  if (!cookies || !cookies.length) return '';
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

// ─── Browser olmadan axios ile veri çek ───────────────────────────────────
async function fetchWithToken(token, cookies) {
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': 'https://panel.bubilet.com.tr',
    'Referer': 'https://panel.bubilet.com.tr/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
  if (cookies) headers['Cookie'] = cookiesToString(cookies);

  const res = await axios.post(
    API_BASE + '/api/Satis/SeansGrupluSatislars',
    { page: 0, perPage: 100000, order: 'tarih', descending: false,
      filter: { etkinlikAdi: '', tarih_BasTarih: null, tarih_BitTarih: null, seansAktif: true, koltukSecimi: null }
    },
    { headers, ...getAxiosConfig(), timeout: 30000 }
  );
  return res.data;
}

// ─── Puppeteer ile login + token + cookie al ──────────────────────────────
async function loginWithBrowser(username, password) {
  console.log("[Bubilet] Puppeteer baslatiliyor...");
  const isRender = !!process.env.RENDER;
  const proxyHost = process.env.BUBILET_PROXY_HOST || process.env.PROXY_HOST;
  const proxyPort = process.env.BUBILET_PROXY_PORT || process.env.PROXY_PORT;
  const proxyUser = process.env.BUBILET_PROXY_USER || process.env.PROXY_USER;
  const proxyPass = process.env.BUBILET_PROXY_PASS || process.env.PROXY_PASS;

  const args = [
    "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled", "--disable-web-security",
    "--disable-features=IsolateOrigins,site-per-process", "--allow-running-insecure-content",
    "--disable-infobars", "--window-size=1366,768", "--start-maximized",
    "--ignore-certificate-errors", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions"
  ];

  if (proxyHost && proxyPort) {
    args.push(`--proxy-server=http://${proxyHost}:${proxyPort}`);
    console.log(`[Bubilet] Proxy kullaniliyor: ${proxyHost}:${proxyPort}`);
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: isRender ? (process.env.PUPPETEER_EXECUTABLE_PATH || undefined) : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: args
  });

  try {
    const page = await browser.newPage();

    if (proxyUser && proxyPass) {
      await page.authenticate({ username: proxyUser, password: proxyPass });
    }

    await page.setViewport({ width: 1366, height: 768 });
    await page.evaluateOnNewDocument(function() {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR','tr','en-US','en'] });
      window.chrome = { runtime: {} };
    });
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    let capturedToken = null;
    page.on("response", async function(res) {
      if (res.url().includes("/token") && res.status() === 200) {
        try {
          const data = await res.json();
          if (data.access_token) {
            capturedToken = data.access_token;
            console.log("[Bubilet] Token yakalandi");
          }
        } catch (e) {}
      }
    });

    await page.goto(PANEL_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForSelector("#email", { timeout: 30000 });
    await page.evaluate(function(u) {
      var el = document.querySelector("#email");
      el.focus();
      var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(el, u);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, username);

    await page.waitForSelector("input[type='password']", { timeout: 30000 });
    await page.evaluate(function(p) {
      var el = document.querySelector("input[type='password']");
      el.focus();
      var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(el, p);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    }, password);

    await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(function() {
      var btn = document.querySelector("button[mat-flat-button]");
      if (!btn) {
        var btns = Array.from(document.querySelectorAll("button"));
        btn = btns.find(function(b) {
          return b.textContent.includes("Giri") || b.type === "submit";
        });
      }
      if (btn) btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    await new Promise(function(resolve, reject) {
      var t = setTimeout(function() { reject(new Error("Token bekleme suresi doldu.")); }, 60000);
      var i = setInterval(function() {
        if (capturedToken) { clearTimeout(t); clearInterval(i); resolve(); }
      }, 300);
    });

    const cookies = await page.cookies();
    const cfCookies = cookies.filter(c =>
      c.name.includes('cf_') || c.name.includes('__cf') || c.domain.includes('bubilet')
    );
    console.log("[Bubilet] CF cookies alindi:", cfCookies.length);

    let tokenExpiry = Date.now() + 60 * 60 * 1000; // default 1 saat
    try {
      const payload = JSON.parse(Buffer.from(capturedToken.split('.')[1], 'base64').toString());
      if (payload.exp) tokenExpiry = payload.exp * 1000;
      console.log("[Bubilet] Token expire:", new Date(tokenExpiry).toISOString());
    } catch(e) {}

    return { token: capturedToken, cookies: cfCookies, tokenExpiry };

  } finally {
    await browser.close();
  }
}

// ─── Ana login + fetch fonksiyonu ─────────────────────────────────────────
async function loginAndFetch(username, password) {
  // 1. Memory'de geçerli token var mı?
  if (isTokenValid() && _cachedCookies) {
    console.log("[Bubilet] Memory token gecerli, axios ile deneniyor...");
    try {
      const raw = await fetchWithToken(_cachedToken, _cachedCookies);
      console.log("[Bubilet] Axios basarili (memory token)!");
      return raw;
    } catch(e) {
      const status = e.response && e.response.status;
      console.log("[Bubilet] Axios basarisiz (" + (status||e.message) + "), token sifirlaniyor...");
      _cachedToken = null;
      _cachedTokenExpiry = null;
      _cachedCookies = null;
    }
  }

  // 2. JSONBin'den token yükle (Render restart sonrası)
  if (!_cachedToken) {
    console.log("[Bubilet] JSONBin'den token yukleniyor...");
    const saved = await loadTokenFromJsonbin();
    if (saved && saved.token && saved.tokenExpiry && Date.now() < saved.tokenExpiry - 60000) {
      console.log("[Bubilet] JSONBin token gecerli, axios ile deneniyor...");
      try {
        const raw = await fetchWithToken(saved.token, saved.cookies);
        // Başarılı — memory'e al
        _cachedToken       = saved.token;
        _cachedTokenExpiry = saved.tokenExpiry;
        _cachedCookies     = saved.cookies;
        console.log("[Bubilet] Axios basarili (JSONBin token)!");
        return raw;
      } catch(e) {
        const status = e.response && e.response.status;
        console.log("[Bubilet] JSONBin token basarisiz (" + (status||e.message) + "), browser login gerekli...");
      }
    } else {
      console.log("[Bubilet] JSONBin'de gecerli token yok, browser login gerekli.");
    }
  }

  // 3. Puppeteer ile taze login
  console.log("[Bubilet] Browser ile login olunuyor...");
  const { token, cookies, tokenExpiry } = await loginWithBrowser(username, password);

  _cachedToken       = token;
  _cachedTokenExpiry = tokenExpiry;
  _cachedCookies     = cookies;

  // JSONBin'e kaydet (async, bekleme yok)
  saveTokenToJsonbin(token, tokenExpiry, cookies);

  console.log("[Bubilet] Token alindi, seans verisi cekiliyor...");
  const raw = await fetchWithToken(token, cookies);
  console.log("[Bubilet] Axios ile veri alindi (taze token)");
  return raw;
}

// ─── Ana Fonksiyon ─────────────────────────────────────────────────────────
async function fetchBubiletData(forceRefresh, username, password) {
  if (forceRefresh) {
    _cachedData  = null;
    _cacheExpiry = null;
    // Token'ı SILMIYORUZ — önce mevcut token ile deneyeceğiz
    console.log("[Bubilet] Data cache temizlendi, token korunuyor.");
  }
  const now = Date.now();
  if (_cachedData && _cacheExpiry && now < _cacheExpiry) {
    console.log("[Bubilet] Cache'den donuluyor.");
    return _cachedData;
  }
  if (_fetchPromise) {
    console.log("[Bubilet] Fetch devam ediyor, bekleniyor...");
    return _fetchPromise;
  }
  _fetchPromise = (async function() {
    try {
      var u = username || process.env.BUBILET_USER;
      var p = password || process.env.BUBILET_PASS;
      if (!u || !p) throw new Error("BUBILET_USER ve BUBILET_PASS eksik.");
      console.log("[Bubilet] Veri cekimi basladi...");
      const raw = await loginAndFetch(u, p);
      const seanslar = (raw.data || []).map(function(s) {
        return {
          seansId:     s.seansId,
          eventId:     s.eventId,
          etkinlikAdi: s.etkinlikAdi || "Bilinmeyen",
          mekan:       s.mekanAdi   || null,
          tarih:       s.tarih      || null,
          biletAdet:   s.biletAdet  || 0,
          ciro:        s.ciro       || 0,
          netKar:      s.netKar     || 0,
          stok:        s.stok       || 0,
          kalan:       s.kalan      || 0,
          seansAktif:  s.seansAktif || false,
          platform:    "bubilet"
        };
      });
      var toplamBilet = seanslar.reduce(function(a, x) { return a + x.biletAdet; }, 0);
      console.log("[Bubilet] OK: " + seanslar.length + " seans, " + toplamBilet + " bilet");
      var result = { success: true, seanslar: seanslar, workshopDetaylar: [], error: null };
      _cachedData  = result;
      _cacheExpiry = Date.now() + CACHE_TTL;
      return result;
    } catch (err) {
      console.error("[Bubilet] Hata:", err.message);
      return { success: false, seanslar: [], workshopDetaylar: [], error: err.message };
    }
  })();
  try { return await _fetchPromise; } finally { _fetchPromise = null; }
}

function clearBubiletCache() {
  _cachedData  = null;
  _cacheExpiry = null;
  _fetchPromise = null;
  console.log("[Bubilet] Cache temizlendi.");
}

async function getTokenAndCookies(username, password) {
  return { token: null };
}

let _saveTokenCallback = null;
function setSaveTokenCallback(fn) { _saveTokenCallback = fn; }

async function saveTokenToJsonbin(token, tokenExpiry, cookies) {
  if (_saveTokenCallback) {
    try {
      await _saveTokenCallback(token, tokenExpiry, cookies);
    } catch(e) {
      console.warn('[Bubilet] Token kaydetme hatasi:', e.message);
    }
  }
}

module.exports = { fetchBubiletData, getTokenAndCookies, clearBubiletCache, setSaveTokenCallback };