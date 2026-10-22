import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApplication } from '../server/app.mjs';

const NOW = new Date('2026-10-20T06:00:00.000Z');
const DATE = '2026-10-21';

let app;
let baseUrl;
let tempDir;

async function call(method, endpoint, { token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch (error) { payload = text; }
  }
  return { status: response.status, payload };
}

function query(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => search.set(key, String(value)));
  return search.toString();
}

async function login(phone, role = 'traveler') {
  const result = await call('POST', '/api/auth/login', {
    body: { phone, code: '888888', role }
  });
  assert.equal(result.status, 200);
  return result.payload.token;
}

async function createFlightOrder(token) {
  const search = await call('GET', `/api/flights/search?${query({
    from: '上海', to: '北京', date: DATE, passengers: 1, cabin: '经济舱'
  })}`);
  assert.equal(search.status, 200);
  const flight = search.payload.results[0];
  const created = await call('POST', '/api/orders', {
    token,
    body: {
      type: 'flight',
      quoteId: flight.quoteId,
      contact: { name: '砍价旅客', phone: '13800138000' },
      passengers: [{ name: '砍价旅客', document: 'DEMO000001' }]
    }
  });
  assert.equal(created.status, 201);
  return created.payload.order;
}

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'octrip-bargain-'));
  app = await createApplication({
    rootDir: path.resolve('.'),
    storePath: path.join(tempDir, 'store.json'),
    publicDir: path.resolve('public'),
    clock: () => NOW,
    paymentDelayMs: 0
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const address = app.server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (app) await app.close();
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
});

test('friend bargain wheel: owner cut, helper limit, last-cent stall and 99 discount', async () => {
  const ownerToken = await login('13900000001');
  const helperToken = await login('13900000002');
  const strangerToken = await login('13900000003');
  const order = await createFlightOrder(ownerToken);
  const originalTotal = order.total;

  const started = await call('POST', `/api/orders/${order.id}/bargain`, { token: ownerToken });
  assert.equal(started.status, 200);
  assert.equal(started.payload.bargain.target, 99);
  assert.equal(started.payload.bargain.status, 'ACTIVE');
  assert.ok(started.payload.bargain.discount > 0);
  assert.equal(started.payload.bargain.isOwner, true);
  assert.equal(started.payload.bargain.canCut, false);
  assert.equal('successAt' in started.payload.bargain, false);
  const token = started.payload.bargain.token;

  const ownerCut = await call('POST', `/api/bargains/${token}/cut`, { token: ownerToken });
  assert.equal(ownerCut.status, 409);
  assert.equal(ownerCut.payload.error.code, 'OWNER_CANNOT_CUT');

  const strangerView = await call('GET', `/api/bargains/${token}`, { token: strangerToken });
  assert.equal(strangerView.status, 200);
  assert.equal(strangerView.payload.bargain.canCut, true);

  const firstCut = await call('POST', `/api/bargains/${token}/cut`, { token: helperToken });
  assert.equal(firstCut.status, 200);
  assert.equal(firstCut.payload.cut.success, false);
  assert.ok(firstCut.payload.cut.amount > 0);
  assert.equal(firstCut.payload.bargain.canCut, false);

  const duplicateCut = await call('POST', `/api/bargains/${token}/cut`, { token: helperToken });
  assert.equal(duplicateCut.status, 409);
  assert.equal(duplicateCut.payload.error.code, 'ALREADY_CUT');

  const nonOwnerSimulate = await call('POST', `/api/bargains/${token}/simulate`, {
    token: helperToken,
    body: { count: 10 }
  });
  assert.equal(nonOwnerSimulate.status, 403);

  let simulated = null;
  for (let round = 0; round < 4; round += 1) {
    simulated = await call('POST', `/api/bargains/${token}/simulate`, {
      token: ownerToken,
      body: { count: 10 }
    });
    assert.equal(simulated.status, 200);
    if (simulated.payload.bargain.status === 'SUCCEEDED') break;
  }
  assert.equal(simulated.payload.bargain.status, 'SUCCEEDED');
  assert.equal(simulated.payload.bargain.remaining, 0);
  assert.equal(simulated.payload.bargain.discount, 99);

  const updated = await call('GET', `/api/orders/${order.id}`, { token: ownerToken });
  assert.equal(updated.status, 200);
  assert.equal(updated.payload.order.originalTotal, originalTotal);
  assert.equal(updated.payload.order.total, Math.round((originalTotal - 99) * 100) / 100);
  assert.equal(updated.payload.order.bargain.discount, 99);

  const helperOrderView = await call('GET', `/api/orders/${order.id}`, { token: helperToken });
  assert.equal(helperOrderView.status, 403);

  const paid = await call('POST', `/api/orders/${order.id}/pay`, {
    token: ownerToken,
    body: { method: 'alipay' }
  });
  assert.equal(paid.status, 200);
  assert.equal(paid.payload.order.payment.amount, updated.payload.order.total);

  const claimed = await call('GET', `/api/bargains/${token}`, { token: ownerToken });
  assert.equal(claimed.status, 200);
  assert.equal(claimed.payload.bargain.status, 'CLAIMED');
});

test('cancelling the order closes the bargain and blocks further cuts', async () => {
  const ownerToken = await login('13900000004');
  const helperToken = await login('13900000005');
  const order = await createFlightOrder(ownerToken);
  const started = await call('POST', `/api/orders/${order.id}/bargain`, { token: ownerToken });
  assert.equal(started.status, 200);
  const token = started.payload.bargain.token;

  const cancelled = await call('POST', `/api/orders/${order.id}/cancel`, { token: ownerToken });
  assert.equal(cancelled.status, 200);

  const view = await call('GET', `/api/orders/${order.id}/bargain`, { token: ownerToken });
  assert.equal(view.status, 200);
  assert.equal(view.payload.bargain.status, 'CANCELLED');

  const cutAfterCancel = await call('POST', `/api/bargains/${token}/cut`, { token: helperToken });
  assert.equal(cutAfterCancel.status, 409);
  assert.equal(cutAfterCancel.payload.error.code, 'BARGAIN_CLOSED');
});

test('bargain is limited to flight and hotel orders', async () => {
  const token = await login('13900000006');
  const trainSearch = await call('GET', `/api/trains/search?${query({
    from: '上海', to: '北京', date: DATE, passengers: 1, type: 'all'
  })}`);
  const train = trainSearch.payload.results[0];
  const created = await call('POST', '/api/orders', {
    token,
    body: {
      type: 'train',
      trainId: train.id,
      fromCity: '上海',
      toCity: '北京',
      date: DATE,
      passengers: 1,
      contact: { name: '砍价旅客', phone: '13800138000' }
    }
  });
  assert.equal(created.status, 201);
  const bargain = await call('POST', `/api/orders/${created.payload.order.id}/bargain`, { token });
  assert.equal(bargain.status, 422);
  assert.match(bargain.payload.error.message, /机票和酒店/);
});

test('hotel orders can start a bargain too', async () => {
  const token = await login('13900000007');
  const search = await call('GET', `/api/hotels/search?${query({
    city: '上海', checkin: DATE, checkout: '2026-10-22'
  })}`);
  assert.equal(search.status, 200);
  const hotel = search.payload.results[0];
  const created = await call('POST', '/api/orders', {
    token,
    body: {
      type: 'hotel',
      hotelId: hotel.id,
      roomIndex: 0,
      checkin: DATE,
      checkout: '2026-10-22',
      rooms: 1,
      guests: 1,
      contact: { name: '砍价旅客', phone: '13800138000' }
    }
  });
  assert.equal(created.status, 201);
  const bargain = await call('POST', `/api/orders/${created.payload.order.id}/bargain`, { token });
  assert.equal(bargain.status, 200);
  assert.equal(bargain.payload.bargain.target, 99);
  assert.ok(bargain.payload.bargain.discount > 0);
});
