#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');
const APP  = path.join(__dirname, 'frontend', 'src', 'App.jsx');

let src = fs.readFileSync(APP, 'utf8');

const OLD = `  // \u2500\u2500\u2500 SATI\u015e EKRANI (tam sayfa) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (mode === 'sales') {
    const seancesSales = buildSeanceMap(salesData);`;

if (!src.includes(OLD)) {
  console.error('❌ Eşleşme bulunamadı — satır 2643 tam metnini kontrol edin.');
  process.exit(1);
}

const REPORT_SCREEN = `  // \u2500\u2500\u2500 SATI\u015e RAPORU EKRANI \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (mode === 'report') {
    const TR_MONTHS_R=['\u004f\u0063\u0061\u006b','\u015e\u0075\u0062\u0061\u0074','\u004d\u0061\u0072\u0074','\u004e\u0069\u0073\u0061\u006e','\u004d\u0061\u0079\u0131\u0073','\u0048\u0061\u007a\u0069\u0072\u0061\u006e','\u0054\u0065\u006d\u006d\u0075\u007a','\u0041\u011f\u0075\u0073\u0074\u006f\u0073','\u0045\u0079\u006c\u00fc\u006c','\u0045\u006b\u0069\u006d','\u004b\u0061\u0073\u0131\u006d','\u0041\u0072\u0061\u006c\u0131\u006b'];
    const TR_DAYS_R=['\u0050\u0061\u007a\u0061\u0072','\u0050\u0061\u007a\u0061\u0072\u0074\u0065\u0073\u0069','\u0053\u0061\u006c\u0131','\u00c7\u0061\u0072\u015f\u0061\u006d\u0062\u0061','\u0050\u0065\u0072\u015f\u0065\u006d\u0062\u0065','\u0043\u0075\u006d\u0061','\u0043\u0075\u006d\u0061\u0072\u0074\u0065\u0073\u0069'];
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

  // \u2500\u2500\u2500 SATI\u015e EKRANI (tam sayfa) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (mode === 'sales') {
    const seancesSales = buildSeanceMap(salesData);`;

fs.writeFileSync(APP, src.replace(OLD, REPORT_SCREEN), 'utf8');
console.log('✅  [mode=report ekranı eklendi]');
console.log('🎉  Tamamlandı! Sunucu ve frontend\'i yeniden başlat.');
