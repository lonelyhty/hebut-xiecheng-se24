import test from 'node:test';
import assert from 'node:assert/strict';
import { TRAVEL_DATA } from '../public/data.js';
import { buildFlightSearch, computeFlightPrice } from '../server/pricing.mjs';

const NOW = new Date('2026-10-23T06:00:00.000Z');
const DATE = '2026-11-06';

function flights(to, date = DATE, options = {}) {
  return TRAVEL_DATA.getFlights('上海', to, date, { now: NOW, ...options });
}

test('long routes have a higher fare scale than short routes across departure dates', () => {
  let shortTotal = 0;
  let longTotal = 0;
  for (let day = 1; day <= 28; day += 1) {
    const date = `2026-11-${String(day).padStart(2, '0')}`;
    shortTotal += flights('杭州', date).reduce((sum, flight) => sum + flight.base, 0);
    longTotal += flights('乌鲁木齐', date).reduce((sum, flight) => sum + flight.base, 0);
  }
  assert.ok(longTotal > shortTotal * 2, 'route length must affect the underlying fare, not only the duration');
});

test('carrier fares do not follow a fixed arithmetic ladder or a fixed cheapest carrier', () => {
  const cheapestCarriers = new Set();
  for (const to of ['北京', '成都', '三亚', '乌鲁木齐']) {
    for (const date of ['2026-11-06', '2026-11-07', '2026-11-08']) {
      const results = flights(to, date);
      const gaps = results.slice(1).map((flight, index) => flight.base - results[index].base);
      assert.ok(new Set(gaps).size > 1, 'carrier prices must not be index * a fixed increment');
      cheapestCarriers.add(results.reduce((best, flight) => flight.base < best.base ? flight : best).code);
    }
  }
  assert.ok(cheapestCarriers.size > 1, 'the same carrier must not always be cheapest');
});

test('local mode honors cabin selection and adds fees only once', () => {
  const economy = flights('北京');
  const business = flights('北京', DATE, { cabin: '商务舱' });
  for (let index = 0; index < economy.length; index += 1) {
    assert.equal(business[index].cabin, '商务舱');
    assert.ok(business[index].price > economy[index].price * 2);
    assert.equal(economy[index].price, computeFlightPrice(economy[index], '经济舱', NOW).price);
    assert.equal(business[index].price, computeFlightPrice(business[index], '商务舱', NOW).price);
  }
});

test('local results, server results and the price calendar use the same cabin quote', () => {
  for (const cabin of ['经济舱', '超级经济舱', '商务舱', '头等舱']) {
    const local = flights('北京', DATE, { cabin });
    const server = buildFlightSearch({ from: '上海', to: '北京', date: DATE, cabin, now: NOW });
    assert.deepEqual(local.map((flight) => flight.price), server.results.map((flight) => flight.price));
    assert.equal(server.calendar.find((day) => day.date === DATE).price, Math.min(...local.map((flight) => flight.price)));
  }
});

test('lead time is measured from actual takeoff rather than midnight of the departure date', () => {
  const quote = computeFlightPrice({ id: 'evening', flightNo: 'MU1234', base: 1000, date: '2026-11-06', dep: '19:20' }, '经济舱', new Date('2026-11-03T08:00:00Z'));
  assert.ok(quote.pricing.daysUntilDeparture > 3, 'the evening flight is still more than three days away');
});

test('holiday and seasonal demand affect otherwise identical simulated fares', () => {
  const flight = { id: 'season', flightNo: 'MU1234', base: 1000, from: '上海', to: '三亚', dep: '12:05' };
  const holiday = computeFlightPrice({ ...flight, date: '2026-10-03' }, '经济舱', new Date('2026-07-20T06:00:00Z'));
  const ordinary = computeFlightPrice({ ...flight, date: '2026-10-17' }, '经济舱', new Date('2026-08-03T06:00:00Z'));
  assert.ok(holiday.price > ordinary.price * 1.15, 'National Day demand must have a visible effect');
  const winter = computeFlightPrice({ ...flight, date: '2027-01-16' }, '经济舱', new Date('2026-11-02T06:00:00Z'));
  const autumn = computeFlightPrice({ ...flight, date: '2026-11-14' }, '经济舱', new Date('2026-08-31T06:00:00Z'));
  assert.ok(winter.price > autumn.price * 1.1, 'the winter leisure season must affect Sanya routes');
});

test('repeated searches remain stable within a five-minute quote bucket', () => {
  const first = flights('乌鲁木齐', DATE, { cabin: '商务舱' });
  const second = flights('乌鲁木齐', DATE, { cabin: '商务舱', now: new Date(NOW.getTime() + 59_000) });
  assert.deepEqual(first.map((flight) => flight.price), second.map((flight) => flight.price));
});

test('fares remain stable within the same bucket even across a lead-time threshold', () => {
  const flight = { id: 'boundary', flightNo: 'MU1234', base: 1000, date: '2026-11-06', dep: '19:22' };
  const before = computeFlightPrice(flight, '经济舱', new Date('2026-11-03T11:21:00Z'));
  const after = computeFlightPrice(flight, '经济舱', new Date('2026-11-03T11:23:00Z'));
  assert.equal(before.price, after.price);
});

test('model quotes stay positive, integer and cabin-ordered for every supported route', () => {
  for (const from of TRAVEL_DATA.flightCities) {
    for (const to of TRAVEL_DATA.flightCities) {
      if (from.name === to.name) continue;
      const results = TRAVEL_DATA.getFlights(from.name, to.name, DATE, { now: NOW });
      assert.equal(results.length, 5);
      for (const flight of results) {
        let previous = 0;
        for (const cabin of ['经济舱', '超级经济舱', '商务舱', '头等舱']) {
          const quote = computeFlightPrice(flight, cabin, NOW);
          assert.ok(Number.isInteger(quote.price) && quote.price > previous);
          assert.ok(quote.originalPrice >= quote.price);
          assert.equal(quote.price, quote.pricing.ticketFare + quote.pricing.tax);
          previous = quote.price;
        }
      }
    }
  }
});
