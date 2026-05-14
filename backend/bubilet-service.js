/**
 * BUBILET SERVICE - Production (Render Uyumlu)
 * Hem token hem seans verisi Puppeteer browser içinden çekilir.
 * Cloudflare bypass: page.evaluate ile fetch yapılır.
 * Veri 55 dakika cache'lenir — her istekte Puppeteer açılmaz.
 */

const puppeteer = require("rebrowser-puppeteer");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const API_BASE  = "https://oldpanel.api.bubilet.com.tr";
const PANEL_URL = "https://panel.bubilet.com.tr/sign-in";

// ─── Veri Cache ────────────────────────────────────────────────────────────
let _cachedData   = null;
let _cacheExpiry  = null;
let _fetchPromise = null;

const CACHE_TTL = 55 * 60 * 1000; // 55 dakika

// ─── Puppeteer ile login + veri çek ───────────────────────────────────────
async function loginAndFetch(username, password) {
  console.log("[Bubilet] Puppeteer baslatiliyor...");

  const isRender = !!process.env.RENDER;

  const proxyHost = process.env.PROXY_HOST;
  const proxyPort = process.env.PROXY_PORT;
  const proxyUser = process.env.PROXY_USER;
  const proxyPass = process.env.PROXY_PASS;

  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--disable-web-security",
    "--disable-features=IsolateOrigins,site-per-process",
    "--allow-running-insecure-content",
    "--disable-infobars",
    "--window-size=1366,768",
    "--start-maximized",
    "--ignore-certificate-errors",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions"
  ];

  if (proxyHost && proxyPort && !process.env.BRIGHTDATA_WS) {
    args.push(`--proxy-server=http://${proxyHost}:${proxyPort}`);
    console.log(`[Bubilet] Proxy kullaniliyor: ${proxyHost}:${proxyPort}`);
  }

  const browser = await puppeteer.launch({
    headless: isRender ? "new" : false,
    executablePath: isRender ? (process.env.PUPPETEER_EXECUTABLE_PATH || undefined) : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: args
  });

  try {
    const page = await browser.newPage();

    if (proxyUser && proxyPass) {
      await page.authenticate({
        username: proxyUser,
        password: proxyPass
      });
    }

    await page.setViewport({ width: 1366, height: 768 });
    await page.evaluateOnNewDocument(function() {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['tr-TR','tr','en-US','en'] });
      window.chrome = { runtime: {} };
    });
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    // Token'ı yakala
    let capturedToken = null;
    page.on("response", async function(res) {
      console.log("[Bubilet] Response:", res.url(), res.status());
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

    // API subdomain için CF clearance al
    console.log("[Bubilet] API subdomain CF clearance aliniyor...");
    try {
      await page.goto("https://oldpanel.api.bubilet.com.tr", { waitUntil: "domcontentloaded", timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));
      console.log("[Bubilet] API subdomain ziyaret edildi");
    } catch(e) {
      console.log("[Bubilet] API subdomain ziyaret hatasi (devam):", e.message);
    }

    await page.goto(PANEL_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

    // Sayfanın ne döndürdüğünü logla
    const pageContent = await page.content();
    console.log("[Bubilet] Sayfa icerigi:", pageContent.substring(0, 500));

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
    // Butonu bul ve tıkla
    await new Promise(r => setTimeout(r, 1500)); // Angular reactive form settle
    const clicked = await page.evaluate(function() {
      var btn = document.querySelector("button[mat-flat-button]");
      if (!btn) {
        var btns = Array.from(document.querySelectorAll("button"));
        btn = btns.find(function(b) {
          return b.textContent.includes("Giri") || b.type === "submit";
        });
      }
      if (btn) {
        btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        return true;
      }
      return false;
    });
    console.log("[Bubilet] Buton tiklandi mi:", clicked);

    // Token bekle
    await new Promise(function(resolve, reject) {
      var t = setTimeout(function() { reject(new Error("Token bekleme suresi doldu.")); }, 60000);
      var i = setInterval(function() {
        if (capturedToken) { clearTimeout(t); clearInterval(i); resolve(); }
      }, 300);
    });

    console.log("[Bubilet] Token alindi, seans verisi cekiliyor...");

    // Seans verisini AYNI browser session'ından çek (Cloudflare bypass)
    const raw = await page.evaluate(async function(apiBase, token) {
      const res = await fetch(apiBase + "/api/Satis/SeansGrupluSatislars", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          page: 0, perPage: 100000, order: "tarih", descending: false,
          filter: { etkinlikAdi: "", tarih_BasTarih: null, tarih_BitTarih: null, seansAktif: true, koltukSecimi: null }
        })
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }, API_BASE, capturedToken);

    return raw;
  } finally {
    await browser.close();
  }
}

// ─── Ana Fonksiyon ─────────────────────────────────────────────────────────
async function fetchBubiletData(forceRefresh, username, password) {
  if (forceRefresh) {
    _cachedData  = null;
    _cacheExpiry = null;
    console.log("[Bubilet] Cache temizlendi.");
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

module.exports = { fetchBubiletData: fetchBubiletData, getTokenAndCookies: getTokenAndCookies, clearBubiletCache: clearBubiletCache };
