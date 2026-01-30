require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.BANXICO_TOKEN;

app.use(cors());

const CACHE_FILE = './cache.json';
const CACHE_MINUTES = 30;

/* ==========================
   Función de cache
========================== */
function isCacheValid() {
  if (!fs.existsSync(CACHE_FILE)) return false;
  const stats = fs.statSync(CACHE_FILE);
  const ageMinutes = (Date.now() - stats.mtimeMs) / 60000;
  return ageMinutes < CACHE_MINUTES;
}

/* ==========================
   Consulta Banxico
========================== */
async function getSerie(idSerie, ultimos = 1) {
  const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${idSerie}/datos/ultimos/${ultimos}?token=${TOKEN}`;
  const res = await axios.get(url);
  return res.data.bmx.series[0].datos;
}

/* ==========================
   Endpoint principal
========================== */
app.get('/api/indicadores', async (req, res) => {
  try {

    // 1. Cache
    if (isCacheValid()) {
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE));
      return res.json(cached);
    }

    // 2. Series Banxico
    const dolar = await getSerie('SF43718', 2);
    const tasa = await getSerie('SF61745', 1);
    const inflacion = await getSerie('SP68279', 1);

    const hoy = parseFloat(dolar[1].dato);
    const ayer = parseFloat(dolar[0].dato);
    const variacion = (((hoy - ayer) / ayer) * 100).toFixed(2);

    // 3. JSON consolidado
    const json = {
      fecha_actualizacion: new Date().toISOString().split('T')[0],
      items: [
        {
          icono: "💵",
          label: "Dólar FIX",
          valor: `$${hoy.toFixed(2)}`,
          variacion: `${variacion}%`
        },
        {
          icono: "🏛️",
          label: "Tasa Objetivo",
          valor: `${tasa[0].dato}%`
        },
        {
          icono: "📉",
          label: "INPC Anual",
          valor: `${inflacion[0].dato}%`,
          ultimo_dato: inflacion[0].fecha
        }
      ]
    };

    // 4. Guardar cache
    fs.writeFileSync(CACHE_FILE, JSON.stringify(json, null, 2));

    res.json(json);

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Error consultando Banxico" });
  }
});

/* ==========================
   Servidor
========================== */
app.listen(PORT, () => {
  console.log(`SADE backend corriendo en http://localhost:${PORT}`);
});
