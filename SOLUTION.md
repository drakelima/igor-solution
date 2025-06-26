# SOLUTION.md

This document summarizes the complete solution for the take-home assessment, covering backend refactoring, testing, and frontend enhancements.

---

## ⚙️ Backend (Node.js)

### 1. Non-blocking I/O & Pagination

**File:** `backend/src/routes/items.js`
```js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const DATA_PATH = path.join(__dirname, '../../../data/items.json');

async function readData() {
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

router.get('/', async (req, res, next) => {
  try {
    const data = await readData();
    const { limit, offset, q } = req.query;
    let results = data;

    // Server-side search
    if (q) {
      const term = q.toLowerCase();
      results = results.filter(item =>
        item.name.toLowerCase().includes(term)
      );
    }

    // Pagination
    const off = parseInt(offset, 10) || 0;
    const lim = parseInt(limit, 10) || results.length;
    results = results.slice(off, off + lim);

    res.json(results);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const data = await readData();
    const id = parseInt(req.params.id, 10);
    const item = data.find(i => i.id === id);
    if (!item) {
      const error = new Error('Item not found');
      error.status = 404;
      throw error;
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const newItem = { id: Date.now(), ...req.body };
    const data = await readData();
    data.push(newItem);
    await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
    res.status(201).json(newItem);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

### 2. Cached Stats with File-Watch

**File:** `backend/src/routes/stats.js`
```js
const express = require('express');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const router = express.Router();
const DATA_PATH = path.join(__dirname, '../../../data/items.json');

let cachedStats = null;

async function loadStats() {
  const raw = await fsp.readFile(DATA_PATH, 'utf8');
  const items = JSON.parse(raw);
  const total = items.length;
  const averagePrice = total
    ? items.reduce((sum, i) => sum + i.price, 0) / total
    : 0;
  cachedStats = { total, averagePrice };
}

// Invalidate and reload cache on file change
fs.watch(DATA_PATH, (eventType) => {
  if (eventType === 'change') {
    loadStats();
  }
});

router.get('/', async (req, res, next) => {
  try {
    if (!cachedStats) {
      await loadStats();
    }
    res.json(cachedStats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

### 3. Route Integration

In `backend/src/index.js`:
```js
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const itemsRouter = require('./routes/items');
const statsRouter = require('./routes/stats');
const { notFound } = require('./middleware/errorHandler');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/items', itemsRouter);
app.use('/api/stats', statsRouter);

app.use('*', notFound);

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
```

### 4. Testing with Jest & Supertest

**File:** `backend/src/routes/__tests__/routes.test.js`
- Mocks `fs.promises` and `fs.watch`.
- Tests GET `/api/items` (all, limit, q, id, 404) and POST.
- Tests GET `/api/stats` initial load and after cache invalidation.

Run:
```bash
cd backend
npm install
npm test
```

---

## 🌐 Frontend (React)

### 1. DataContext & Fetch Hook

**File:** `frontend/src/state/DataContext.js`
```js
import React, { createContext, useCallback, useContext, useState } from 'react';

const API_BASE = 'http://localhost:3001';
const DataContext = createContext();

export function DataProvider({ children }) {
  const [items, setItems] = useState([]);

  const fetchItems = useCallback(
    async ({ page = 1, pageSize = 20, q = '' } = {}, signal) => {
      const params = new URLSearchParams();
      params.set('limit', pageSize);
      params.set('offset', (page - 1) * pageSize);
      if (q) params.set('q', q);

      const url = `${API_BASE}/api/items?${params.toString()}`;
      console.log('[DataContext] fetching', url);

      const res = await fetch(url, { signal });
      if (!res.ok) {
        throw new Error(`Fetch error: ${res.status}`);
      }
      setItems(await res.json());
    },
    []
  );

  return (
    <DataContext.Provider value={{ items, fetchItems }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
```

### 2. Items Component with Pagination & Virtualization

**File:** `frontend/src/pages/Items.js`
```js
import React, { useEffect, useState } from 'react';
import { useData } from '../state/DataContext';
import { FixedSizeList as List } from 'react-window';
import { Link } from 'react-router-dom';

function Items() {
  const { items, fetchItems } = useData();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const pageSize = 20;

  useEffect(() => {
    const controller = new AbortController();
    fetchItems({ page, pageSize, q: searchTerm }, controller.signal)
      .catch(err => {
        if (err.name !== 'AbortError') console.error(err);
      });
    return () => controller.abort();
  }, [fetchItems, page, searchTerm]);

  if (!items.length) return <p>Loading...</p>;

  return (
    <div>
      <input
        type="text"
        placeholder="Search..."
        value={searchTerm}
        onChange={e => {
          setSearchTerm(e.target.value);
          setPage(1);
        }}
        style={{ width: '100%', padding: 4, marginBottom: 8 }}
      />

      <List
        height={400}
        itemCount={items.length}
        itemSize={50}
        width="100%"
      >
        {({ index, style }) => {
          const item = items[index];
          return (
            <div style={{ ...style, paddingLeft: 8 }} key={item.id}>
              <Link to={`/items/${item.id}`}>{item.name}</Link>
            </div>
          );
        }}
      </List>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => setPage(p => Math.max(p - 1, 1))}
          disabled={page === 1}
        >
          Previous
        </button>
        <span style={{ margin: '0 8px' }}>Page {page}</span>
        <button onClick={() => setPage(p => p + 1)}>Next</button>
      </div>
    </div>
  );
}

export default Items;
```

### 3. Install & Run

```bash
cd frontend
npm install react-window
npm start
```