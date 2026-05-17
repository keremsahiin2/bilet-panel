#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');

const SERVER = path.join(__dirname, 'backend',  'server.js');
const APP    = path.join(__dirname, 'frontend', 'src', 'App.jsx');

let errors = 0;

function patch(file, label, oldStr, newStr) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes(oldStr)) {
    console.error('❌  [' + label + '] — ESKİ KOD BULUNAMADI. Atlandı.');
    errors++;
    return;
  }
  const count = src.split(oldStr).length - 1;
  if (count > 1) console.warn('⚠️  [' + label + '] — ' + count + ' eşleşme, ilki değiştiriliyor.');
  fs.writeFileSync(file, src.replace(oldStr, newStr), 'utf8');
  console.log('✅  [' + label + ']');
}

// ─── 1) server.js — startDate yoksa fullName'den parse et ────────────────────
patch(SERVER, 'server: startDate fullName fallback',
`    if (!s.seanceId || !s.category) return;
    if (!s.startDate) return;

    var seanceStart = new Date(s.startDate);`,

`    if (!s.seanceId || !s.category) return;

    var seanceStart = null;
    if (s.startDate) {
      seanceStart = new Date(s.startDate);
    } else if (s.fullName) {
      var _TR_M = ['Ocak','\u015eubat','Mart','Nisan','May\u0131s','Haziran','Temmuz','A\u011fustos','Eyl\u00fcl','Ekim','Kas\u0131m','Aral\u0131k'];
      var _mFB  = s.fullName.match(/- (\d+) ([\w\u00c0-\u024f]+) [\w\u00c0-\u024f]+ (\d{2}:\d{2})/);
      if (_mFB) {
        var _mi = _TR_M.indexOf(_mFB[2]);
        if (_mi >= 0) {
          var _t  = _mFB[3].split(':');
          var _yr = now.getFullYear();
          seanceStart = new Date(_yr, _mi, parseInt(_mFB[1]), parseInt(_t[0]), parseInt(_t[1]));
          if (seanceStart > new Date(now.getTime() + 30*24*3600*1000)) {
            seanceStart = new Date(_yr - 1, _mi, parseInt(_mFB[1]), parseInt(_t[0]), parseInt(_t[1]));
          }
        }
      }
    }
    if (!seanceStart) return;`
);

// ─── 2) App.jsx — raporu mode=sales içinden çıkar ────────────────────────────
patch(APP, 'App: raporu sales ekranından çıkar',
`          {/* \u0130deasoft Toplam Sat\u0131\u015f Raporu */}
          {salesData && (() => {`,
`          {/* \u0130deasoft Toplam Sat\u0131\u015f Raporu \u2014 mode='report' ekran\u0131na ta\u015f\u0131nd\u0131 */}
          {false && (() => {`
);

// ─── 3) App.jsx — mode=report ekranı + mode=sales başlığı ───────────────────
patch(APP, 'App: mode=report ekranı',
`  // \u2500\u2500\u2500 SATI\u015e EKRANI (tam sayfa) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (mode === 'sales') {
    const seancesSales = buildSeanceMap(salesData);`,

`  // \u2500\u2500\u2500 SATI\u015e RAPORU EKRANI \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (mode === 'report') {
    const TR_MONTHS_R=['Ocak','\u015eubat','Mart','Nisan','May\u0131s','Haziran','Temmuz','A\u011fustos','Eyl\u00fcl','Ekim','Kas\u0131m','Aral\u0131k'];
    const TR_DAYS_R=['Pazar','Pazartesi','Sal\u0131','\u00c7ar\u015famba','Per\u015fembe','Cuma','Cumartesi'];
    const fmtDate=(dk)=>{const d=new Date(dk+'T12:00:00');return d.getDate()+' '+TR_MONTHS_R[d.getMonth()]+' '+TR_DAYS_R[d.getDay()];};
    const fmtMonth=(mk)=>{const[y,m]=mk.split('-');return TR_MONTHS_R[parseInt(m)-1]+' '+y;};
    const dailyMap  =salesData?(salesData.dailySales||{}):{};
    const monthlyMap=salesData?(salesData.monthlySales||{}):{};
    const sortedDays=Object.keys(dailyMap).sort().reverse();
    const nowR=new Date();
    const curMK=nowR.getFullYear()+'-'+String(nowR.getMonth()+1).padStart(2,'0');
    const doneMo=Object.keys(monthlyMap).filter(m=>m<curMK).sort().reverse();
    const hasSalesR=sortedDays.length>0||doneMo.length>0;
    return (
      <div style={S.page}>
        <div style={S.topBar}>
          <button style={{...S.smallBtn,marginRight:4}} onClick={()=>setMode(null)}>\u2190 Geri</button>
          <span style={{fontSize:14,fontWeight:700,color:'#e2e8f0'}}>\ud83d\udcc8 Sat\u0131\u015f Raporu</span>
          <button style={S.smallBtn} onClick={()=>fetchSales()}>\ud83d\udd04 Yenile</button>
        </div>
        <div style={{padding:'12px 18px',maxWidth:720,margin:'0 auto',paddingBottom:40}}>
          {salesLoading&&<div style={S.empty}>\u23f3 Y\u00fckleniyor\u2026</div>}
          {salesError&&<div style={{...S.empty,color:'#ef4444'}}>\u26a0\ufe0f {salesError}</div>}
          {!salesData&&!salesLoading&&(
            <div style={{textAlign:'center',padding:'40px 20px'}}>
              <div style={{fontSize:48,marginBottom:12}}>\ud83d\udcca</div>
              <div style={{color:'#64748b',fontSize:14,marginBottom:16}}>Sat\u0131\u015f verisi hen\u00fcz y\u00fcklenmedi.</div>
              <button style={{...S.primaryBtn}} onClick={()=>fetchSales()}>Veriyi Y\u00fckle</button>
            </div>
          )}
          {salesData&&(
            <div>
              {!hasSalesR&&(
                <div style={{...S.empty,flexDirection:'column',gap:8,paddingTop:40}}>
                  <span style={{fontSize:36}}>\ud83d\udcca</span>
                  <span>Hen\u00fcz sat\u0131\u015f kaydedilmemi\u015f.</span>
                  <span style={{fontSize:11,color:'#475569',textAlign:'center'}}>Ge\u00e7mi\u015f seanslar veri y\u00fcklendikten sonra otomatik kaydedilir.</span>
                </div>
              )}
              {monthlyMap[curMK]&&(()=>{
                const cats=Object.entries(monthlyMap[curMK]).sort((a,b)=>b[1]-a[1]);
                const total=cats.reduce((s,[,v])=>s+v,0);
                return(
                  <div style={{...S.reportMonthBlock,border:'1px solid #1e40af',background:'rgba(30,64,175,0.10)',borderRadius:12,marginBottom:12}}>
                    <div style={{...S.reportMonthTitle,color:'#60a5fa'}}>\ud83d\udcca {fmtMonth(curMK).toUpperCase()} \u2014 G\u00dcNEL TOPLAM</div>
                    {cats.map(([cat,count])=>(<div key={cat} style={S.reportMonthRow}><span style={S.reportCat}>{getCatIcon(cat)} {cat}</span><span style={{...S.reportCount,color:'#60a5fa',fontSize:16,fontWeight:800}}>{count}</span></div>))}
                    <div style={{...S.reportMonthRow,borderTop:'1px solid #1e293b',marginTop:4,paddingTop:8}}><span style={{...S.reportCat,color:'#fff',fontWeight:700}}>Toplam</span><span style={{...S.reportCount,color:'#fff',fontSize:17,fontWeight:800}}>{total}</span></div>
                  </div>
                );
              })()}
              {doneMo.map(mk=>{
                const cats=Object.entries(monthlyMap[mk]).sort((a,b)=>b[1]-a[1]);
                const total=cats.reduce((s,[,v])=>s+v,0);
                return(
                  <div key={mk} style={S.reportMonthBlock}>
                    <div style={S.reportMonthTitle}>\ud83d\udcc5 {fmtMonth(mk).toUpperCase()} AYI TOPLAMI</div>
                    {cats.map(([cat,count])=>(<div key={cat} style={S.reportMonthRow}><span style={S.reportCat}>{getCatIcon(cat)} {cat}</span><span style={{...S.reportCount,color:'#b47cff',fontSize:16,fontWeight:800}}>{count}</span></div>))}
                    <div style={{...S.reportMonthRow,borderTop:'1px solid #1e293b',marginTop:4,paddingTop:8}}><span style={{...S.reportCat,color:'#fff',fontWeight:700}}>Toplam</span><span style={{...S.reportCount,color:'#fff',fontSize:17,fontWeight:800}}>{total}</span></div>
                  </div>
                );
              })}
              {sortedDays.map(dk=>{
                const cats=Object.entries(dailyMap[dk]).sort((a,b)=>b[1]-a[1]);
                const total=cats.reduce((s,[,v])=>s+v,0);
                return(
                  <div key={dk} style={S.reportDayBlock}>
                    <div style={S.reportDayTitle}>\ud83d\uddd3 {fmtDate(dk)}</div>
                    {cats.map(([cat,count])=>(<div key={cat} style={S.reportRow}><span style={S.reportCat}>{getCatIcon(cat)} {cat}</span><span style={S.reportCount}>{count}</span></div>))}
                    <div style={{...S.reportRow,borderTop:'1px solid #1e293b',marginTop:4,paddingTop:6}}><span style={{...S.reportCat,color:'#475569',fontSize:11}}>Toplam</span><span style={{...S.reportCount,color:'#94a3b8',fontSize:13,fontWeight:700}}>{total}</span></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // \u2500\u2500\u2500 SATI\u015e EKRANI (tam sayfa) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (mode === 'sales') {
    const seancesSales = buildSeanceMap(salesData);`
);

// ─── 4) Staff nav butonu — Quiz Night sonrası ─────────────────────────────────
patch(APP, 'App: staff nav Satış Raporu butonu',
`            <span style={{marginLeft:'auto',fontSize:18,color:'#374151'}}>\u203a</span>
          </button>
        </div>
      ) : (`,

`            <span style={{marginLeft:'auto',fontSize:18,color:'#374151'}}>\u203a</span>
          </button>
          <button
            onClick={()=>{if(!salesData&&!salesLoading)fetchSales();setMode('report');}}
            style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'15px 22px',
              borderRadius:14,border:'1px solid #1a2035',cursor:'pointer',textAlign:'left',
              background:'#0d1120',transition:'all 0.2s'}}
            onMouseOver={e=>{e.currentTarget.style.borderColor='#b47cff';e.currentTarget.style.background='#0f1525';}}
            onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.background='#0d1120';}}>
            <span style={{fontSize:26}}>\ud83d\udcc8</span>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start'}}>
              <span style={{fontSize:14,fontWeight:700,color:'#94a3b8',marginBottom:4}}>Sat\u0131\u015f Raporu</span>
              <span style={{fontSize:11,color:'#374151',lineHeight:1.5}}>\u0130deasoft g\u00fcnl\u00fck ve ayl\u0131k sat\u0131\u015f ar\u015fivi</span>
            </div>
            <span style={{marginLeft:'auto',fontSize:18,color:'#374151'}}>\u203a</span>
          </button>
        </div>
      ) : (`
);

// ─── 5) Admin nav butonu — Quiz Night sonrası ─────────────────────────────────
patch(APP, 'App: admin nav Satış Raporu butonu',
`              onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.boxShadow='none';e.currentTarget.style.background='#0d1120';}}>
              <span style={{fontSize:26}}>\ud83c\udfc6</span>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start'}}>
                <span style={{fontSize:14,fontWeight:700,color:'#94a3b8',marginBottom:4}}>Quiz Night</span>
                <span style={{fontSize:11,color:'#374151',lineHeight:1.5}}>Grup puanlar\u0131n\u0131 takip et ve s\u0131rala</span>
              </div>
              <span style={{marginLeft:'auto',fontSize:18,color:'#374151'}}>\u203a</span>
            </button>
          </div>`,

`              onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.boxShadow='none';e.currentTarget.style.background='#0d1120';}}>
              <span style={{fontSize:26}}>\ud83c\udfc6</span>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start'}}>
                <span style={{fontSize:14,fontWeight:700,color:'#94a3b8',marginBottom:4}}>Quiz Night</span>
                <span style={{fontSize:11,color:'#374151',lineHeight:1.5}}>Grup puanlar\u0131n\u0131 takip et ve s\u0131rala</span>
              </div>
              <span style={{marginLeft:'auto',fontSize:18,color:'#374151'}}>\u203a</span>
            </button>
          </div>
          <div style={{padding:'0 18px 6px',maxWidth:720,margin:'0 auto'}}>
            <button
              onClick={()=>{if(!salesData&&!salesLoading)fetchSales();setMode('report');}}
              style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'15px 22px',
                borderRadius:14,border:'1px solid #1a2035',cursor:'pointer',textAlign:'left',
                background:'#0d1120',boxShadow:'none',transition:'all 0.2s'}}
              onMouseOver={e=>{e.currentTarget.style.borderColor='#b47cff';e.currentTarget.style.boxShadow='0 0 18px #b47cff22';e.currentTarget.style.background='#0f1525';}}
              onMouseOut={e=>{e.currentTarget.style.borderColor='#1a2035';e.currentTarget.style.boxShadow='none';e.currentTarget.style.background='#0d1120';}}>
              <span style={{fontSize:26}}>\ud83d\udcc8</span>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start'}}>
                <span style={{fontSize:14,fontWeight:700,color:'#94a3b8',marginBottom:4}}>Sat\u0131\u015f Raporu</span>
                <span style={{fontSize:11,color:'#374151',lineHeight:1.5}}>\u0130deasoft g\u00fcnl\u00fck ve ayl\u0131k sat\u0131\u015f ar\u015fivi</span>
              </div>
              <span style={{marginLeft:'auto',fontSize:18,color:'#374151'}}>\u203a</span>
            </button>
          </div>`
);

console.log('');
if (errors === 0) {
  console.log('🎉  Tüm değişiklikler başarıyla uygulandı!');
  console.log('  1. cd backend && node server.js');
  console.log('  2. cd frontend && npm run dev');
  console.log('  3. Ana menüde "Satış Raporu" butonu görünmeli');
} else {
  console.log('⚠️  ' + errors + ' değişiklik uygulanamadı.');
}
