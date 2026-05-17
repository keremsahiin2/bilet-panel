#!/usr/bin/env node
/**
 * patch_sales.js — İdeasoft Günlük Satış Kaydı Sistemi
 * Çalıştır: node patch_sales.js
 * Proje kökünde (bilet-panel/) çalıştırılmalı.
 */

const fs = require('fs');
const path = require('path');

const SERVER = path.join(__dirname, 'backend', 'server.js');
const APP    = path.join(__dirname, 'frontend', 'src', 'App.jsx');

let errors = 0;

function patch(file, label, oldStr, newStr) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes(oldStr)) {
    console.error(`❌  [${label}] — ESKİ KOD BULUNAMADI. Atlandı.`);
    errors++;
    return;
  }
  const count = src.split(oldStr).length - 1;
  if (count > 1) {
    console.warn(`⚠️  [${label}] — ${count} eşleşme bulundu, ilki değiştiriliyor.`);
  }
  fs.writeFileSync(file, src.replace(oldStr, newStr), 'utf8');
  console.log(`✅  [${label}]`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER.JS DEĞİŞİKLİKLERİ
// ─────────────────────────────────────────────────────────────────────────────

// 1) ideasoftSeanceToEntry — startDate ekle
patch(SERVER, 'ideasoftSeanceToEntry: startDate ekle',
`  return { seanceId: seance.id, productId: parseInt(productId), category: categoryName,
    fullName: fname, stockAmount: seance.stockAmount,
    price: seance.price1 || '0', status: seance.status };`,
`  var rawStart = seance.startDate || seance.beginDate || seance.start_date || seance.begin_date || null;
  return { seanceId: seance.id, productId: parseInt(productId), category: categoryName,
    fullName: fname, stockAmount: seance.stockAmount,
    price: seance.price1 || '0', status: seance.status,
    startDate: rawStart };`
);

// 2) getJsonbinRecord — dailySales alanı ekle
patch(SERVER, 'getJsonbinRecord: dailySales init',
`    if (!jsonbinCache.monthlySales) jsonbinCache.monthlySales = {};`,
`    if (!jsonbinCache.monthlySales) jsonbinCache.monthlySales = {};
    if (!jsonbinCache.dailySales)   jsonbinCache.dailySales   = {};`
);

// 3) flushJsonbinCache — dailySales kaydet
patch(SERVER, 'flushJsonbinCache: dailySales ekle',
`      { baseline: jsonbinCache.baseline, monthlySales: jsonbinCache.monthlySales, malzemeStock: jsonbinCache.malzemeStock || {}, quizData: jsonbinCache.quizData || null, bubiletToken: jsonbinCache.bubiletToken || null, bubiletTokenExpiry: jsonbinCache.bubiletTokenExpiry || null, bubiletCookies: jsonbinCache.bubiletCookies || [] },`,
`      { baseline: jsonbinCache.baseline, monthlySales: jsonbinCache.monthlySales, dailySales: jsonbinCache.dailySales || {}, malzemeStock: jsonbinCache.malzemeStock || {}, quizData: jsonbinCache.quizData || null, bubiletToken: jsonbinCache.bubiletToken || null, bubiletTokenExpiry: jsonbinCache.bubiletTokenExpiry || null, bubiletCookies: jsonbinCache.bubiletCookies || [] },`
);

// 4) Eski merge + flatten fonksiyonlarını yenileriyle değiştir
patch(SERVER, 'mergeIdeasoftIntoMonthlySales + flattenMonthlySales → yeni fonksiyonlar',
`// İdeasoft seanslarından aylık satış verisini çıkarıp mevcut arşivle birleştir
// KURAL: Sadece başlangıç saati geçmiş seanslar aylık toplama yansır.
// Seans başlamadan bilet iptali olabilir → seans başlayana kadar aylık raporlara ekleme.
function mergeIdeasoftIntoMonthlySales(existing, ideasoftSeances, baseline) {
  var TR_MONTHS_SRV = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  var merged = JSON.parse(JSON.stringify(existing)); // derin kopya
  var now = new Date();

  ideasoftSeances.forEach(function(s) {
    if (!s.fullName || !s.seanceId) return;
    // fullName'den ay ve saat bilgisini çıkar
    var m = s.fullName.match(/- (\\d+) (\\w+) (\\w+) (\\d{2}:\\d{2})/u);
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
}`,

`// Günlük satış arşivi — seans başladıktan sonra kaydedilir, silinse bile korunur
// KURAL: Sadece başlangıç saati geçmiş seanslar kaydedilir.
function mergeIdeasoftIntoDailySales(existing, ideasoftSeances, baseline) {
  var merged = JSON.parse(JSON.stringify(existing));
  var now = new Date();

  ideasoftSeances.forEach(function(s) {
    if (!s.seanceId || !s.category) return;
    if (!s.startDate) return;

    var seanceStart = new Date(s.startDate);
    if (now < seanceStart) return; // Seans henüz başlamadı

    var cat  = s.category;
    var base = (baseline && baseline[s.seanceId]) || CATEGORY_BASELINE[cat] || DEFAULT_BASELINE;
    var sold = Math.max(0, base - (s.stockAmount !== null ? s.stockAmount : base));
    if (sold === 0) return;

    // "YYYY-MM-DD" formatında günlük key
    var dateKey = seanceStart.getFullYear() + '-' +
      String(seanceStart.getMonth() + 1).padStart(2, '0') + '-' +
      String(seanceStart.getDate()).padStart(2, '0');

    if (!merged[dateKey]) merged[dateKey] = {};

    var seanceKey = '_s_' + s.seanceId;
    var prev = merged[dateKey][seanceKey] || { cat: cat, _sold: 0 };

    // Satış sayısı asla azalmaz — seans silinse bile önceki değer korunur
    if (sold >= prev._sold) {
      merged[dateKey][seanceKey] = { cat: cat, _sold: sold };
    }
  });

  return merged;
}

// dailySales → düz { "YYYY-MM-DD": { kategori: toplam } }
function flattenDailySales(dailySales) {
  var result = {};
  Object.keys(dailySales).sort().forEach(function(dateKey) {
    result[dateKey] = {};
    Object.keys(dailySales[dateKey]).forEach(function(seanceKey) {
      var entry = dailySales[dateKey][seanceKey];
      if (entry._sold > 0) result[dateKey][entry.cat] = (result[dateKey][entry.cat] || 0) + entry._sold;
    });
    if (Object.keys(result[dateKey]).length === 0) delete result[dateKey];
  });
  return result;
}

// dailySales → aylık toplam { "2025-05": { kategori: toplam } }
function computeMonthlySalesFromDaily(dailySales) {
  var result = {};
  Object.keys(dailySales).forEach(function(dateKey) {
    var monthKey = dateKey.slice(0, 7); // "2025-05"
    if (!result[monthKey]) result[monthKey] = {};
    Object.keys(dailySales[dateKey]).forEach(function(seanceKey) {
      var entry = dailySales[dateKey][seanceKey];
      if (entry._sold > 0) result[monthKey][entry.cat] = (result[monthKey][entry.cat] || 0) + entry._sold;
    });
  });
  return result;
}`
);

// 5) /api/sales/refresh — yeni fonksiyonlarla güncelle
patch(SERVER, '/api/sales/refresh: dailySales kullan',
`  // Aynı /api/sales formatında yanıt dön — baseline + monthlySales hesapla
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
  });`,

`  // Aynı /api/sales formatında yanıt dön — dailySales + monthlySales hesapla
  var ideasoftSales = null;
  var dailySalesFlat = {};
  var monthlySalesFlat = {};
  if (ideasoftData) {
    var rec2r = await getJsonbinRecord();
    var baseline2r   = rec2r.baseline;
    var dailySales2r = rec2r.dailySales || {};
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

    var updatedDaily2r  = mergeIdeasoftIntoDailySales(dailySales2r, ideasoftSales, baseline2r);
    var dailyChanged2r  = JSON.stringify(updatedDaily2r) !== JSON.stringify(dailySales2r);

    if (changed2r || dailyChanged2r) {
      rec2r.baseline   = baseline2r;
      rec2r.dailySales = updatedDaily2r;
      jsonbinCacheDirty = true;
      flushJsonbinCache().catch(function(e){ console.error('JSONBin flush hatasi (refresh):', e.message); });
    }

    dailySalesFlat   = flattenDailySales(updatedDaily2r);
    monthlySalesFlat = computeMonthlySalesFromDaily(updatedDaily2r);
  }

  res.json({
    bubilet: bubiletData,
    biletinial: biletinialData,
    ideasoft: ideasoftSales,
    lastFetch,
    dailySales: dailySalesFlat,
    monthlySales: monthlySalesFlat
  });`
);

// 6) /api/sales GET — yeni fonksiyonlarla güncelle
patch(SERVER, '/api/sales GET: dailySales kullan',
`  var ideasoftSales = null;
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

  res.json({ bubilet:bubiletData, biletinial:biletinialData, ideasoft:ideasoftSales, lastFetch, monthlySales: monthlySalesFlat });`,

`  var ideasoftSales = null;
  var dailySalesFlat = {};
  var monthlySalesFlat = {};
  if (ideasoftData) {
    var rec = await getJsonbinRecord();
    var baseline   = rec.baseline;
    var dailySales = rec.dailySales || {};
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

    // Günlük satış arşivini güncelle — seanslar sonradan silinse bile korunur
    var updatedDaily = mergeIdeasoftIntoDailySales(dailySales, ideasoftSales, baseline);
    var dailyChanged = JSON.stringify(updatedDaily) !== JSON.stringify(dailySales);

    if (changed || dailyChanged) {
      rec.baseline   = baseline;
      rec.dailySales = updatedDaily;
      jsonbinCacheDirty = true;
      flushJsonbinCache().catch(function(e){ console.error('JSONBin flush hatasi:', e.message); });
    }

    dailySalesFlat   = flattenDailySales(updatedDaily);
    monthlySalesFlat = computeMonthlySalesFromDaily(updatedDaily);
  }

  res.json({ bubilet:bubiletData, biletinial:biletinialData, ideasoft:ideasoftSales, lastFetch, dailySales: dailySalesFlat, monthlySales: monthlySalesFlat });`
);


// ─────────────────────────────────────────────────────────────────────────────
// APP.JSX DEĞİŞİKLİKLERİ
// ─────────────────────────────────────────────────────────────────────────────

// 7) Rapor UI — dailySales kullan, günlük + aylık göster
patch(APP, 'Rapor UI: dailySales + aylık toplam',
`          {/* İdeasoft Toplam Satış Raporu */}
          {salesData && salesData.ideasoft && (() => {
            const dayMap = {};
            const TR_MONTHS_SHORT = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
            salesData.ideasoft.forEach(s => {
              if (!s.soldCount || s.soldCount === 0) return;
              const m = s.fullName.match(/- (\\d+) (\\w+) (\\w+)/u);
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
          })()}`,

`          {/* İdeasoft Toplam Satış Raporu */}
          {salesData && (() => {
            const TR_MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
            const TR_DAYS   = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

            const formatDate = (dateKey) => {
              const d = new Date(dateKey + 'T12:00:00');
              return d.getDate() + ' ' + TR_MONTHS[d.getMonth()] + ' ' + TR_DAYS[d.getDay()];
            };
            const formatMonth = (mk) => {
              const [y, m] = mk.split('-');
              return TR_MONTHS[parseInt(m) - 1] + ' ' + y;
            };

            const dailyMap   = salesData.dailySales  || {};
            const monthlyMap = salesData.monthlySales || {};

            // En yeni tarih üstte
            const sortedDays = Object.keys(dailyMap).sort().reverse();

            // Geçmiş aylar (bu ay hariç)
            const now = new Date();
            const currentMonthKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
            const completedMonths = Object.keys(monthlyMap).filter(m => m < currentMonthKey).sort().reverse();

            const hasSales = sortedDays.length > 0 || completedMonths.length > 0;

            return (
              <div style={{marginTop:16}}>
                <button style={{...S.ideasoftReportBtn}} onClick={()=>setShowIdeasoftReport(p=>!p)}>
                  <span>📈 İdeasoft Toplam Satış Raporu</span>
                  <span style={{...S.chevron,...(showIdeasoftReport?{transform:'rotate(90deg)',color:'#94a3b8'}:{}),...{fontSize:16}}}>›</span>
                </button>
                {showIdeasoftReport && (
                  <div style={S.reportPanel}>
                    {!hasSales && <div style={S.empty}>Henüz İdeasoft satışı yok.</div>}

                    {/* Bu ayın güncel toplamı */}
                    {monthlyMap[currentMonthKey] && (() => {
                      const cats  = Object.entries(monthlyMap[currentMonthKey]).sort((a,b)=>b[1]-a[1]);
                      const total = cats.reduce((s,[,v])=>s+v, 0);
                      return (
                        <div style={{...S.reportMonthBlock, border:'1px solid #1e40af', background:'rgba(30,64,175,0.10)', borderRadius:12, marginBottom:12}}>
                          <div style={{...S.reportMonthTitle, color:'#60a5fa'}}>
                            📊 {formatMonth(currentMonthKey).toUpperCase()} — GÜNCEL TOPLAM
                          </div>
                          {cats.map(([cat, count]) => (
                            <div key={cat} style={S.reportMonthRow}>
                              <span style={S.reportCat}>{getCatIcon(cat)} {cat}</span>
                              <span style={{...S.reportCount,color:'#60a5fa',fontSize:16,fontWeight:800}}>{count}</span>
                            </div>
                          ))}
                          <div style={{...S.reportMonthRow,borderTop:'1px solid #1e293b',marginTop:4,paddingTop:8}}>
                            <span style={{...S.reportCat,color:'#fff',fontWeight:700}}>Toplam</span>
                            <span style={{...S.reportCount,color:'#fff',fontSize:17,fontWeight:800}}>{total}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Geçmiş ayların toplam raporları */}
                    {completedMonths.map(monthKey => {
                      const cats  = Object.entries(monthlyMap[monthKey]).sort((a,b)=>b[1]-a[1]);
                      const total = cats.reduce((s,[,v])=>s+v, 0);
                      return (
                        <div key={monthKey} style={S.reportMonthBlock}>
                          <div style={S.reportMonthTitle}>📅 {formatMonth(monthKey).toUpperCase()} AYI TOPLAMI</div>
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

                    {/* Günlük satışlar */}
                    {sortedDays.map(dateKey => {
                      const cats  = Object.entries(dailyMap[dateKey]).sort((a,b)=>b[1]-a[1]);
                      const total = cats.reduce((s,[,v])=>s+v, 0);
                      return (
                        <div key={dateKey} style={S.reportDayBlock}>
                          <div style={S.reportDayTitle}>🗓 {formatDate(dateKey)}</div>
                          {cats.map(([cat, count]) => (
                            <div key={cat} style={S.reportRow}>
                              <span style={S.reportCat}>{getCatIcon(cat)} {cat}</span>
                              <span style={S.reportCount}>{count}</span>
                            </div>
                          ))}
                          <div style={{...S.reportRow,borderTop:'1px solid #1e293b',marginTop:4,paddingTop:6}}>
                            <span style={{...S.reportCat,color:'#475569',fontSize:11}}>Toplam</span>
                            <span style={{...S.reportCount,color:'#94a3b8',fontSize:13,fontWeight:700}}>{total}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}`
);

// ─────────────────────────────────────────────────────────────────────────────
console.log('');
if (errors === 0) {
  console.log('🎉  Tüm değişiklikler başarıyla uygulandı!');
  console.log('');
  console.log('Sonraki adımlar:');
  console.log('  1. cd backend && node server.js   (sunucuyu yeniden başlat)');
  console.log('  2. cd frontend && npm run dev      (frontend\'i yeniden başlat)');
  console.log('  3. Uygulamada "Veriyi Yükle" butonuna bas');
  console.log('  4. İdeasoft Toplam Satış Raporu\'nu aç — günlük kayıtlar görünmeli');
} else {
  console.log('⚠️  ' + errors + ' değişiklik uygulanamadı. Yukarıdaki hataları kontrol et.');
}
