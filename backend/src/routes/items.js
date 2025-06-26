const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const DATA_PATH = path.join(__dirname, '../../../data/items.json');

// Async utility to read data
async function readData() {
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

// GET /api/items?limit=&offset=&q=
router.get('/', async (req, res, next) => {
  try {
    const data = await readData();
    const { limit, offset, q } = req.query;
    let results = data;

    // Server-side search
    if (q) {
      const query = q.toLowerCase();
      results = results.filter(item =>
        item.name.toLowerCase().includes(query)
      );
    }

    // Apply offset
    if (offset) {
      const off = parseInt(offset, 10);
      if (!isNaN(off) && off > 0) {
        results = results.slice(off);
      }
    }

    // Apply limit
    if (limit) {
      const lim = parseInt(limit, 10);
      if (!isNaN(lim) && lim > 0) {
        results = results.slice(0, lim);
      }
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
});

// GET /api/items/:id
router.get('/:id', async (req, res, next) => {
  try {
    const data = await readData();
    const id = parseInt(req.params.id, 10);
    const item = data.find(i => i.id === id);

    if (!item) {
      const err = new Error('Item not found');
      err.status = 404;
      throw err;
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
});

// POST /api/items
router.post('/', async (req, res, next) => {
  try {
    const incoming = req.body;
    const data = await readData();

    // Construct newItem with id first
    const newItem = { id: Date.now(), ...incoming };
    data.push(newItem);

    await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');

    res.status(201).json(newItem);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
