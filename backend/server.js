// FIXED SERVER.JS (IdeaSoft session creator - optimized)

const axios = require('axios');

async function createSession({
  baseUrl,
  token,
  productId,
  mekanOption,   // { id, name }
  newOptionId,   // created date option id
  price = 0,
  stock = 999
}) {
  try {
    // ✅ FIX 1: correct option order (Mekan first, then Date)
    const optionIds = `${mekanOption.id}_${newOptionId}`;

    const batchBody =
`--batch
Content-Type: application/http
Content-Transfer-Encoding: binary

POST /admin-app/products HTTP/1.1
Content-Type: application/json

{
  "productId": ${productId},
  "optionIds": "${optionIds}",
  "price": ${price},
  "stock": ${stock}
}
--batch--`;

    const res = await axios.post(
      `${baseUrl}/admin-app/batch`,
      batchBody,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/batch; boundary=batch"
        }
      }
    );

    const data = res.data.toString();

    // ✅ FIX 2: detect ANY error inside batch
    if (data.includes('HTTP/1.1 4') || data.includes('HTTP/1.1 5')) {
      console.error("BATCH ERROR FULL RESPONSE:\n", data);
      throw new Error("Batch içinde hata var");
    }

    console.log("✅ Seans başarıyla oluşturuldu:", optionIds);
    return true;

  } catch (err) {
    console.error("❌ Seans oluşturma hatası:", err.message);

    // ✅ FIX 3: simple retry for 429
    if (err.response && err.response.status === 429) {
      console.log("⏳ Rate limit - 2 saniye sonra tekrar denenecek...");
      await new Promise(r => setTimeout(r, 2000));
      return createSession(arguments[0]);
    }

    return false;
  }
}

module.exports = { createSession };
