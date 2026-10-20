import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApplication } from '../server/app.mjs';

const NOW = new Date('2026-10-20T06:00:00.000Z');
const CHECKIN = '2026-10-21';
const CHECKOUT = '2026-10-22';

let app;
let baseUrl;
let tempDir;
let currentNow = new Date(NOW.getTime());

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
  return { status: response.status, payload, headers: response.headers };
}

function query(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => search.set(key, String(value)));
  return search.toString();
}

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'octrip-api-'));
  app = await createApplication({
    rootDir: path.resolve('.'),
    storePath: path.join(tempDir, 'store.json'),
    publicDir: path.resolve('public'),
    clock: () => currentNow,
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

test('full flight lifecycle: search, quote, order, pay, seat, check-in, boarding pass', async () => {
  const health = await call('GET', '/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.payload.ok, true);

  const search = await call('GET', `/api/flights/search?${query({
    from: '上海', to: '北京', date: CHECKIN, passengers: 1, cabin: '经济舱'
  })}`);
  assert.equal(search.status, 200);
  assert.equal(search.status, 200);
  assert.equal(search.payload.results.length, 5);
  const flight = search.payload.results[0];
  const quoteId = flight.quoteId;
  assert.ok(quoteId);
  assert.ok(search.payload.recommendation.bestId);

  const unauthorized = await call('POST', '/api/orders', {
    body: { type: 'flight', quoteId, contact: { name: '测试旅客', phone: '13800138000' }, passengers: [{ name: '测试旅客', document: 'DEMO000001' }] }
  });
  assert.equal(unauthorized.status, 401);

  const login = await call('POST', '/api/auth/login', {
    body: { phone: '13800138000', code: '888888', role: 'traveler' }
  });
  assert.equal(login.status, 200);
  assert.equal(login.payload.user.role, 'traveler');
  const token = login.payload.token;

  const created = await call('POST', '/api/orders', {
    token,
    body: { type: 'flight', quoteId, contact: { name: '测试旅客', phone: '13800138000' }, passengers: [{ name: '测试旅客', document: 'DEMO000001' }] }
  });
  assert.equal(created.status, 201);
  const order = created.payload.order;
  assert.equal(order.status, 'PENDING_PAYMENT');
  assert.equal(order.total, flight.price);
  assert.equal(order.details.flightNo, flight.flightNo);
  assert.ok(order.dateLabel.includes(flight.dep));

  const reuseQuote = await call('POST', '/api/orders', {
    token,
    body: { type: 'flight', quoteId, contact: { name: '测试旅客', phone: '13800138000' }, passengers: [{ name: '测试旅客', document: 'DEMO000001' }] }
  });
  assert.equal(reuseQuote.status, 409);
  assert.equal(reuseQuote.payload.error.code, 'QUOTE_USED');

  const pay = await call('POST', `/api/orders/${order.id}/pay`, { token, body: { method: 'alipay' } });
  assert.equal(pay.status, 200);
  assert.equal(pay.payload.order.status, 'PAID');
  assert.equal(pay.payload.order.payment.provider, 'MockPay Sandbox');
  assert.ok(pay.payload.order.ticketing.ticketNumber.startsWith('781-'));
  assert.ok(pay.payload.order.ticketing.pnr);

  const payAgain = await call('POST', `/api/orders/${order.id}/pay`, { token, body: { method: 'alipay' } });
  assert.equal(payAgain.status, 409);
  assert.equal(payAgain.payload.error.code, 'INVALID_ORDER_STATE');

  const seats = await call('GET', `/api/orders/${order.id}/seats`, { token });
  assert.equal(seats.status, 200);
  assert.equal(seats.payload.seatMap.seats.length, 180);
  const available = seats.payload.seatMap.seats.find((seat) => seat.status === 'available');
  assert.ok(available);

  const checkin = await call('POST', `/api/orders/${order.id}/checkin`, {
    token,
    body: { seat: available.id }
  });
  assert.equal(checkin.status, 200);
  assert.equal(checkin.payload.order.status, 'CHECKED_IN');
  assert.equal(checkin.payload.boardingPass.seat, available.id);
  assert.ok(checkin.payload.boardingPass.gate);
  assert.ok(checkin.payload.boardingPass.boardingPassCode.startsWith('BP-'));

  const boarding = await call('GET', `/api/orders/${order.id}/boarding-pass`, { token });
  assert.equal(boarding.status, 200);
  assert.equal(boarding.payload.boardingPass.seat, available.id);

  const cancelCheckedIn = await call('POST', `/api/orders/${order.id}/cancel`, { token });
  assert.equal(cancelCheckedIn.status, 409);

  const list = await call('GET', '/api/orders', { token });
  assert.equal(list.status, 200);
  assert.equal(list.payload.orders.length, 1);
  assert.equal(list.payload.orders[0].status, 'CHECKED_IN');
  assert.deepEqual(list.payload.orders[0].availableActions, ['boardingPass']);
});

test('cancellation, hotel and ticket orders, roles and access control', async () => {
  const login = await call('POST', '/api/auth/login', {
    body: { phone: '13800138000', code: '888888', role: 'traveler' }
  });
  const travelerToken = login.payload.token;

  const search = await call('GET', `/api/flights/search?${query({
    from: '上海', to: '广州', date: CHECKIN, passengers: 2, cabin: '经济舱'
  })}`);
  assert.equal(search.status, 200);
  const flight = search.payload.results[0];
  const created = await call('POST', '/api/orders', {
    token: travelerToken,
    body: {
      type: 'flight',
      quoteId: flight.quoteId,
      contact: { name: '测试旅客', phone: '13800138000' },
      passengers: [{ name: '测试旅客甲', document: 'DEMO000001' }, { name: '测试旅客乙', document: 'DEMO000002' }]
    }
  });
  const flightOrder = created.payload.order;
  assert.equal(flightOrder.total, flight.price * 2);
  await call('POST', `/api/orders/${flightOrder.id}/pay`, { token: travelerToken, body: { method: 'wechat' } });
  const cancelled = await call('POST', `/api/orders/${flightOrder.id}/cancel`, { token: travelerToken });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.payload.order.status, 'CANCELLED');
  assert.equal(cancelled.payload.order.cancellation.refund.status, 'REFUNDED_MOCK');
  const cancelAgain = await call('POST', `/api/orders/${flightOrder.id}/cancel`, { token: travelerToken });
  assert.equal(cancelAgain.status, 409);

  const hotelSearch = await call('GET', `/api/hotels/search?${query({
    city: '上海', checkin: CHECKIN, checkout: CHECKOUT
  })}`);
  assert.equal(hotelSearch.status, 200);
  assert.ok(hotelSearch.payload.results.length > 0);
  const hotel = hotelSearch.payload.results[0];
  let roomIndex = hotel.rooms.findIndex((room) => room.left >= 1 && room.left <= 5);
  if (roomIndex < 0) roomIndex = 0;
  const initialRoomLeft = hotel.rooms[roomIndex].left;
  const hotelOrder = await call('POST', '/api/orders', {
    token: travelerToken,
    body: {
      type: 'hotel',
      hotelId: hotel.id,
      roomIndex,
      checkin: CHECKIN,
      checkout: CHECKOUT,
      rooms: 1,
      guests: 2,
      contact: { name: '测试旅客', phone: '13800138000' }
    }
  });
  assert.equal(hotelOrder.status, 201);
  assert.equal(hotelOrder.payload.order.total, hotel.rooms[roomIndex].price);
  assert.equal(hotelOrder.payload.order.details.nights, 1);
  assert.equal(hotelOrder.payload.order.details.roomIndex, roomIndex);

  const afterBookingSearch = await call('GET', `/api/hotels/search?${query({
    city: '上海', checkin: CHECKIN, checkout: CHECKOUT
  })}`);
  const afterHotel = afterBookingSearch.payload.results.find((item) => item.id === hotel.id);
  assert.equal(afterHotel.rooms[roomIndex].left, initialRoomLeft - 1);

  if (initialRoomLeft <= 5) {
    const oversell = await call('POST', '/api/orders', {
      token: travelerToken,
      body: {
        type: 'hotel',
        hotelId: hotel.id,
        roomIndex,
        checkin: CHECKIN,
        checkout: CHECKOUT,
        rooms: initialRoomLeft,
        guests: 1,
        contact: { name: '测试旅客', phone: '13800138000' }
      }
    });
    assert.equal(oversell.status, 409);
    assert.equal(oversell.payload.error.code, 'SOLD_OUT');
  }

  const cancelHotel = await call('POST', `/api/orders/${hotelOrder.payload.order.id}/cancel`, { token: travelerToken });
  assert.equal(cancelHotel.status, 200);
  const afterCancelSearch = await call('GET', `/api/hotels/search?${query({
    city: '上海', checkin: CHECKIN, checkout: CHECKOUT
  })}`);
  const restoredHotel = afterCancelSearch.payload.results.find((item) => item.id === hotel.id);
  assert.equal(restoredHotel.rooms[roomIndex].left, initialRoomLeft);

  const attractionSearch = await call('GET', `/api/attractions/search?${query({
    city: '上海', date: CHECKIN
  })}`);
  assert.equal(attractionSearch.status, 200);
  const attraction = attractionSearch.payload.results[0];
  const ticketOrder = await call('POST', '/api/orders', {
    token: travelerToken,
    body: {
      type: 'ticket',
      ticketId: attraction.id,
      city: '上海',
      date: CHECKIN,
      quantity: 2,
      contact: { name: '测试旅客', phone: '13800138000' }
    }
  });
  assert.equal(ticketOrder.status, 201);
  assert.equal(ticketOrder.payload.order.total, attraction.price * 2);

  const scopeAllTraveler = await call('GET', '/api/orders?scope=all', { token: travelerToken });
  assert.equal(scopeAllTraveler.status, 403);

  const agencyLogin = await call('POST', '/api/auth/login', {
    body: { phone: '13700001111', code: '888888', role: 'agency' }
  });
  assert.equal(agencyLogin.status, 200);
  assert.equal(agencyLogin.payload.user.role, 'agency');
  const agencyToken = agencyLogin.payload.token;

  const agencyOrders = await call('GET', '/api/orders?scope=all', { token: agencyToken });
  assert.equal(agencyOrders.status, 200);
  assert.equal(agencyOrders.payload.scope, 'all');
  assert.ok(agencyOrders.payload.orders.length >= 3);
  const foreignOrder = await call('GET', `/api/orders/${hotelOrder.payload.order.id}`, { token: agencyToken });
  assert.equal(foreignOrder.status, 200);

  const itinerary = await call('POST', '/api/itineraries', {
    body: { city: '上海', days: 3, preferences: ['food'] }
  });
  assert.equal(itinerary.status, 200);
  assert.equal(itinerary.payload.plan.length, 3);

  const unknown = await call('GET', '/api/not-exists', { token: travelerToken });
  assert.equal(unknown.status, 404);

  const expiringSearch = await call('GET', `/api/flights/search?${query({
    from: '北京', to: '成都', date: CHECKIN, passengers: 1, cabin: '经济舱'
  })}`);
  const expiringFlight = expiringSearch.payload.results[2];
  const expiringOrder = await call('POST', '/api/orders', {
    token: travelerToken,
    body: { type: 'flight', quoteId: expiringFlight.quoteId, contact: { name: '测试旅客', phone: '13800138000' }, passengers: [{ name: '测试旅客', document: 'DEMO000001' }] }
  });
  assert.equal(expiringOrder.status, 201);
  const expiringId = expiringOrder.payload.order.id;
  currentNow = new Date(NOW.getTime() + 20 * 60 * 1000);
  const expiredList = await call('GET', '/api/orders', { token: travelerToken });
  assert.equal(expiredList.status, 200);
  const expiredOrder = expiredList.payload.orders.find((item) => item.id === expiringId);
  assert.equal(expiredOrder.status, 'EXPIRED');
  const payExpired = await call('POST', `/api/orders/${expiringId}/pay`, {
    token: travelerToken,
    body: { method: 'alipay' }
  });
  assert.equal(payExpired.status, 409);
});
