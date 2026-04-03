const fs = require('fs');
const axios = require('axios');

const PRODUCTS = {
  12671:'Seramik', 4252:'Cupcake Mum', 4278:'Punch', 4251:'Quiz Night',
  4249:'Plak Boyama', 4247:'Heykel', 4245:'Maske', 4243:'Bez Çanta',
  4241:'Resim', 4234:'3D Figür', 5135:'Mekanda Seç'
};

async function main() {
  const cookies = JSON.parse(fs.readFileSync('./ideasoft_cookies.json'));
  const cStr = cookies.cookies.map(c => c.name+'='+c.value).join('; ');
  const headers = { 'Cookie': cStr, 'X-CSRF-TOKEN': cookies.csrfToken||'', 'Accept': 'application/json', 'x-ideasoft-locale': 'tr' };

  for (const [pid, cat] of Object.entries(PRODUCTS)) {
    try {
      const r = await axios.get('https://berkayalabalik.myideasoft.com/admin-app/optioned-products/'+pid, { headers });
      const data = r.data.data || [r.data];
      data.forEach(s => console.log(cat, '|', s.name, '| stock:', s.stockAmount, '| status:', s.status));
    } catch(e) { console.log(cat, '| HATA:', e.message); }
    await new Promise(r=>setTimeout(r,200));
  }
}
main();
