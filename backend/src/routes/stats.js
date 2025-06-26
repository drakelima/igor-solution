const express = require('express');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const router = express.Router();
const DATA_PATH = path.join(__dirname, '../../../data/items.json');

let cachedStats = null;

// Função que lê o arquivo e calcula os stats
async function loadStats() {
  const raw = await fsp.readFile(DATA_PATH, 'utf8');
  const items = JSON.parse(raw);
  const total = items.length;
  const averagePrice = total > 0
    ? items.reduce((sum, item) => sum + item.price, 0) / total
    : 0;

  cachedStats = { total, averagePrice };
}

// Fica de olho em mudanças no arquivo para invalidar o cache
fs.watch(DATA_PATH, (eventType) => {
  if (eventType === 'change') {
    loadStats();
  }
});

// GET /api/stats
router.get('/', async (req, res, next) => {
  try {
    if (!cachedStats) {
      // no primeiro acesso, carrega os stats
      await loadStats();
    }
    return res.json(cachedStats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
