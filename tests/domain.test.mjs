import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../server/errors.mjs';
import { buildFlightSearch } from '../server/pricing.mjs';
import { ORDER_STATUS, canTransition, transition, availableActions } from '../server/order-machine.mjs';
import { buildSeatMap, prepareCheckIn, boardingPassFor } from '../server/checkin.mjs';
import { buildItinerary } from '../server/itinerary.mjs';

const NOW = new Date('2026-10-20T06:00:00.000Z');
const TOMORROW = '2026-10-21';

function search(overrides = {}) {
  return buildFlightSearch({
    from: '上海',
    to: '北京',
    date: TOMORROW,
    passengers: 1,
    cabin: '经济舱',
    now: NOW,
    ...overrides
  });
}

test('flight search returns priced flights with recommendation metadata', () => {
  const result = search();
  assert.equal(result.query.from, '上海');
  assert.equal(result.query.to, '北京');
  assert.equal(result.query.date, TOMORROW);
  assert.equal(result.results.length, 5);
  assert.equal(result.calendar.length >= 1, true);
  for (const flight of result.results) {
    assert.ok(flight.price > 0);
    assert.ok(flight.originalPrice >= flight.price);
    assert.equal(flight.pricing.tax, 80);
    assert.ok(flight.pricing.demandFactor >= 0.97 && flight.pricing.demandFactor <= 1.03);
    assert.equal(flight.price, flight.pricing.ticketFare + flight.pricing.tax);
    assert.ok(flight.recommendation.score >= 0 && flight.recommendation.score <= 100);
    assert.equal(flight.date, TOMORROW);
  }
  assert.ok(result.recommendation.bestId);
  assert.ok(result.results.some((flight) => flight.id === result.recommendation.bestId));
  assert.ok(result.results.some((flight) => flight.id === result.recommendation.cheapestId));
  assert.ok(result.results.some((flight) => flight.id === result.recommendation.fastestId));
  const cheapest = result.results.find((flight) => flight.id === result.recommendation.cheapestId);
  assert.equal(cheapest.price, Math.min(...result.results.map((flight) => flight.price)));
  const best = result.results.find((flight) => flight.id === result.recommendation.bestId);
  assert.ok(best.recommendation.labels.includes('综合推荐'));
});

test('dynamic pricing is deterministic inside a 5 minute bucket and reacts to time', () => {
  const first = search();
  const second = search();
  assert.deepEqual(first.results.map((flight) => flight.price), second.results.map((flight) => flight.price));

  const later = search({ now: new Date(NOW.getTime() + 6 * 60 * 1000) });
  const changed = first.results.some((flight, index) => flight.price !== later.results[index].price);
  assert.equal(changed, true);
});

test('cabin class and passenger count affect quote', () => {
  const economy = search({ passengers: 2 });
  const business = search({ cabin: '商务舱', passengers: 2 });
  assert.equal(economy.query.passengers, 2);
  assert.ok(business.results[0].price > economy.results[0].price);
});

test('invalid routes, past dates and unknown cabins are rejected', () => {
  assert.throws(() => search({ date: '2026-10-19' }), (error) => error instanceof AppError && error.code === 'BAD_REQUEST');
  assert.throws(() => search({ to: '上海' }), /不能相同/);
  assert.throws(() => search({ cabin: '太空舱' }), /舱位/);
  assert.throws(() => search({ passengers: 0 }), /乘客数量/);
});

test('order state machine rejects illegal transitions and exposes actions', () => {
  const order = {
    status: ORDER_STATUS.PENDING_PAYMENT,
    history: [],
    type: 'flight',
    updatedAt: null
  };
  assert.equal(canTransition(ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PAID), true);
  assert.equal(canTransition(ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.CHECKED_IN), false);
  assert.deepEqual(availableActions(order), ['pay', 'cancel']);
  transition(order, ORDER_STATUS.PAID, { at: NOW, reason: 'paid' });
  assert.equal(order.status, ORDER_STATUS.PAID);
  assert.deepEqual(availableActions(order), ['cancel', 'checkin']);
  assert.throws(() => transition(order, ORDER_STATUS.PAID, { at: NOW }), (error) => error.code === 'INVALID_ORDER_STATE');
});

test('check-in selects available seats and rejects taken seats', () => {
  const store = { listOrders: () => [] };
  const order = {
    id: 'OC-1',
    type: 'flight',
    status: ORDER_STATUS.PAID,
    contact: { name: '橙程旅客' },
    passengers: [{ name: '橙程旅客', document: 'DEMO000001' }],
    details: {
      flightNo: 'YH1001',
      airline: '远航航空',
      from: '上海',
      to: '北京',
      date: TOMORROW,
      dep: '18:00',
      arr: '19:40'
    }
  };
  const seatMap = buildSeatMap(store, order);
  assert.equal(seatMap.seats.length, 180);
  const available = seatMap.seats.find((seat) => seat.status === 'available');
  assert.ok(available);
  const checkin = prepareCheckIn(store, order, available.id, NOW);
  assert.equal(checkin.seat, available.id);
  assert.ok(checkin.gate);
  assert.ok(checkin.boardingPassCode.startsWith('BP-'));

  const otherOrder = {
    ...order,
    id: 'OC-2',
    checkin: { seat: available.id },
    status: ORDER_STATUS.CHECKED_IN
  };
  const occupiedStore = { listOrders: () => [otherOrder] };
  assert.throws(
    () => prepareCheckIn(occupiedStore, order, available.id, NOW),
    (error) => error.code === 'SEAT_UNAVAILABLE'
  );

  order.checkin = checkin;
  const pass = boardingPassFor(order);
  assert.equal(pass.seat, available.id);
  assert.equal(pass.flightNo, 'YH1001');
});

test('check-in requires a paid order and a future departure', () => {
  const store = { listOrders: () => [] };
  const order = {
    id: 'OC-3',
    type: 'flight',
    status: ORDER_STATUS.PENDING_PAYMENT,
    passengers: [{ name: '橙程旅客', document: 'DEMO000001' }],
    details: { flightNo: 'YH1', date: TOMORROW, dep: '18:00' }
  };
  assert.throws(() => prepareCheckIn(store, order, '1A', NOW), (error) => error.code === 'INVALID_ORDER_STATE');
  order.status = ORDER_STATUS.PAID;
  order.details.dep = '00:10';
  const nextDayMorning = new Date('2026-10-21T01:00:00.000Z');
  assert.throws(() => prepareCheckIn(store, order, '1A', nextDayMorning), (error) => error.code === 'CHECKIN_WINDOW');

  const farOrder = {
    ...order,
    status: ORDER_STATUS.PAID,
    details: { ...order.details, date: '2026-10-25', dep: '18:00' }
  };
  assert.throws(() => prepareCheckIn(store, farOrder, '1A', NOW), (error) => error.code === 'CHECKIN_WINDOW');

  const groupOrder = {
    ...order,
    status: ORDER_STATUS.PAID,
    details: { ...order.details, date: TOMORROW, dep: '18:00' },
    passengers: [
      { name: '旅客甲', document: 'DEMO000001' },
      { name: '旅客乙', document: 'DEMO000002' }
    ]
  };
  assert.throws(() => prepareCheckIn(store, groupOrder, '1A', NOW), (error) => error.code === 'SINGLE_CHECKIN_ONLY');
});

test('itinerary planner returns day-by-day plans and costs', () => {
  const plan = buildItinerary({
    city: '上海',
    days: 3,
    preferences: ['food', 'culture'],
    now: NOW
  });
  assert.equal(plan.city, '上海');
  assert.equal(plan.days, 3);
  assert.equal(plan.plan.length, 3);
  assert.ok(plan.estimatedCost > 0);
  for (const day of plan.plan) {
    assert.ok(day.items.length >= 4);
    assert.ok(day.hotel.name);
    assert.ok(day.estimatedCost > 0);
  }
  assert.deepEqual(plan.preferences, ['美食', '文化']);
  assert.throws(() => buildItinerary({ city: '', days: 2, now: NOW }), /目的地城市/);
  assert.throws(() => buildItinerary({ city: '上海', days: 9, now: NOW }), /1-7/);
});
