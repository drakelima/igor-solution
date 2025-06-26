const request = require('supertest');
const express = require('express');
const fs = require('fs');
const fsp = require('fs').promises;

// Mock the file system methods before loading routers
jest.mock('fs', () => ({
  watch: jest.fn(),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

// Define mock data
const mockItems = [
  { id: 1, name: 'Apple', price: 10 },
  { id: 2, name: 'Banana', price: 20 },
  { id: 3, name: 'Cherry', price: 30 },
];

// Helper to create an Express app with the routers mounted
function createApp() {
  const app = express();
  app.use(express.json());
  // Require after mocks
  const itemsRouter = require('../items');
  const statsRouter = require('../stats');
  app.use('/api/items', itemsRouter);
  app.use('/api/stats', statsRouter);
  // Error handler to format errors in tests
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return app;
}

beforeEach(() => {
  fsp.readFile.mockReset();
  fsp.writeFile.mockReset();
  fsp.readFile.mockResolvedValue(JSON.stringify(mockItems));
});

describe('Items API', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  test('GET /api/items returns all items', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockItems);
  });

  test('GET /api/items?limit=2 returns limited items', async () => {
    const res = await request(app).get('/api/items?limit=2');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockItems.slice(0, 2));
  });

  test('GET /api/items?q=an filters items by name', async () => {
    const res = await request(app).get('/api/items?q=an');
    expect(res.status).toBe(200);
    // 'Banana' and 'Cherry' contain 'an' (case-insensitive)
    expect(res.body).toEqual([
      mockItems[1],
    ]);
  });

  test('GET /api/items/:id returns an item', async () => {
    const res = await request(app).get('/api/items/2');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockItems[1]);
  });

  test('GET /api/items/:id returns 404 when not found', async () => {
    const res = await request(app).get('/api/items/999');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('message', 'Item not found');
  });

  test('POST /api/items creates a new item', async () => {
    const newItem = { name: 'Durian', price: 40 };
    const mockTime = 1620000000000;
    jest.spyOn(Date, 'now').mockReturnValue(mockTime);

    const res = await request(app)
      .post('/api/items')
      .send(newItem)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: mockTime, ...newItem });
    expect(fsp.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify([...mockItems, { id: mockTime, ...newItem }], null, 2),
      'utf8'
    );

    Date.now.mockRestore();
  });
});

describe('Stats API', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  test('GET /api/stats returns correct total and averagePrice', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    const total = mockItems.length;
    const avg = mockItems.reduce((acc, i) => acc + i.price, 0) / total;
    expect(res.body).toEqual({ total, averagePrice: avg });
  });

  test('Stats recompute on data change', async () => {
    // Simulate file-change invalidation by updating mock data
    const newMock = [...mockItems, { id: 4, name: 'Elderberry', price: 50 }];
    fsp.readFile.mockResolvedValueOnce(JSON.stringify(newMock));
    // Trigger manual cache reload via watch callback
    const statsRouter = require('../stats');
    fs.watch.mock.calls[0][1]('change');

    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    const total2 = newMock.length;
    const avg2 = newMock.reduce((acc, i) => acc + i.price, 0) / total2;
    expect(res.body).toEqual({ total: total2, averagePrice: avg2 });
  });
});
