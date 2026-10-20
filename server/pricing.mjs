import { TRAVEL_DATA } from '../public/data.js';
import { badRequest } from './errors.mjs';

export const CABIN_FACTORS = Object.freeze({
  '经济舱': 1,
  '超级经济舱': 1.35,
  '商务舱': 2.6,
  '头等舱': 3.8
});

export const CABINS = Object.freeze(Object.keys(CABIN_FACTORS));

const DAY_MS = 86400000;
const BUCKET_MS = 30 * 60 * 1000;

function pad(value) {
  return value < 10 ? `0${value}` : String(value);
}

export function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function unit(input) {
  return hashString(input) / 4294967296;
}

function round10(value) {
  return Math.round(value / 10) * 10;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function chinaDateKey(now) {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export function parseDateKey(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!match) throw badRequest('日期格式应为 YYYY-MM-DD');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw badRequest('日期不是有效的日历日期');
  }
  return { year, month, day, key: `${year}-${pad(month)}-${pad(day)}`, weekday: parsed.getUTCDay() };
}

function validateDateWindow(date, now) {
  const parsed = parseDateKey(date);
  const today = chinaDateKey(now);
  const offset = Math.round((Date.parse(`${parsed.key}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  if (offset < 0) throw badRequest('不能搜索过去的日期');
  if (offset > 365) throw badRequest('仅支持搜索未来 365 天内的航班');
  return { parsed, offset };
}

export function normalizeCityOrThrow(value, label) {
  const name = TRAVEL_DATA.normalizeCity(value);
  if (!name) throw badRequest(`请填写${label}`);
  const city = TRAVEL_DATA.findCity(name);
  if (!city) throw badRequest(`${label}「${name}」不在本地城市列表中`);
  return city;
}

function timeScore(dep) {
  const hour = Number(String(dep).slice(0, 2));
  if (hour >= 7 && hour <= 10) return 1;
  if (hour >= 17 && hour <= 20) return 0.95;
  if (hour >= 11 && hour <= 16) return 0.8;
  if (hour === 6 || hour === 21 || hour === 22) return 0.6;
  return 0.4;
}

function decorateRecommendations(flights) {
  if (!flights.length) {
    return {
      bestId: null,
      cheapestId: null,
      fastestId: null,
      policy: '综合价格、耗时、出发时段与准点率评分',
      summary: '没有符合筛选条件的航班'
    };
  }
  const prices = flights.map((flight) => flight.price);
  const durations = flights.map((flight) => flight.durationMin);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  const avgPrice = prices.reduce((sum, value) => sum + value, 0) / prices.length;

  flights.forEach((flight) => {
    const priceScore = maxPrice === minPrice ? 1 : 1 - (flight.price - minPrice) / (maxPrice - minPrice);
    const durationScore = maxDuration === minDuration ? 1 : 1 - (flight.durationMin - minDuration) / (maxDuration - minDuration);
    const punctualityScore = flight.onTime / 100;
    const departureScore = timeScore(flight.dep);
    const score = Math.round((0.48 * priceScore + 0.24 * durationScore + 0.16 * departureScore + 0.12 * punctualityScore) * 100);
    flight.recommendation = { score, labels: [], reason: '' };
  });

  const cheapest = flights.reduce((best, flight) => (flight.price < best.price ? flight : best), flights[0]);
  const fastest = flights.reduce((best, flight) => (flight.durationMin < best.durationMin ? flight : best), flights[0]);
  const best = flights.reduce((current, flight) => (flight.recommendation.score > current.recommendation.score ? flight : current), flights[0]);

  flights.forEach((flight) => {
    const labels = [];
    const reasons = [];
    if (flight.id === cheapest.id) {
      labels.push('最低价');
      reasons.push('本次搜索中价格最低');
    }
    if (flight.id === fastest.id) {
      labels.push('最短耗时');
      reasons.push(`总耗时 ${flight.duration}`);
    }
    if (flight.id === best.id) {
      labels.push('综合推荐');
      reasons.push(`综合评分 ${flight.recommendation.score}`);
    }
    if (flight.price <= avgPrice * 0.9) {
      reasons.push(`价格低于均价 ${Math.round((1 - flight.price / avgPrice) * 100)}%`);
    }
    if (flight.onTime >= 95) reasons.push(`准点率 ${flight.onTime}%`);
    if (timeScore(flight.dep) >= 0.95) reasons.push('出发时段舒适');
    flight.recommendation.labels = Array.from(new Set(labels));
    flight.recommendation.reason = reasons.slice(0, 3).join('，');
  });

  return {
    bestId: best.id,
    cheapestId: cheapest.id,
    fastestId: fastest.id,
    bestFlightNo: best.flightNo,
    bestPrice: best.price,
    cheapestPrice: cheapest.price,
    fastestDuration: fastest.duration,
    policy: '综合价格、耗时、出发时段与准点率评分，权重 48/24/16/12',
    summary: `推荐 ${best.airline} ${best.flightNo}，价格 ¥${best.price}，${best.recommendation.reason}`
  };
}

export function buildFlightSearch({ from, to, date, passengers = 1, cabin = '经济舱', now = new Date(), filters = {} }) {
  const fromCity = normalizeCityOrThrow(from, '出发城市');
  const toCity = normalizeCityOrThrow(to, '到达城市');
  if (fromCity.name === toCity.name) throw badRequest('出发和到达城市不能相同');
  if (!CABINS.includes(cabin)) throw badRequest('不支持的舱位');
  const passengerCount = Number(passengers);
  if (!Number.isInteger(passengerCount) || passengerCount < 1 || passengerCount > 6) {
    throw badRequest('乘客数量应为 1-6 的整数');
  }
  const { parsed, offset } = validateDateWindow(date, now);
  const bucket = Math.floor(now.getTime() / BUCKET_MS);
  const weekend = parsed.weekday === 0 || parsed.weekday === 5 || parsed.weekday === 6;
  const cabinFactor = CABIN_FACTORS[cabin];

  let flights = TRAVEL_DATA.getFlights(fromCity.name, toCity.name, date).map((flight) => {
    const demandSeed = unit(`${fromCity.name}|${toCity.name}|${date}|${bucket}|${flight.flightNo}`);
    const demandFactor = 0.9 + demandSeed * 0.45;
    const timeFactor = 1 + clamp((14 - offset) * 0.02, 0, 0.3);
    const weekendFactor = weekend ? 1.08 : 1;
    const taxes = 50;
    const price = round10(flight.price * demandFactor * timeFactor * weekendFactor * cabinFactor + taxes);
    const originalPrice = round10(price * (1.06 + unit(`${flight.flightNo}|${bucket}|original`) * 0.14));
    const seatsLeft = 2 + (hashString(`${flight.flightNo}|${date}|${bucket}|seats`) % 29);
    const reasons = [];
    if (offset <= 3) reasons.push('临近出发价格上浮');
    if (weekend) reasons.push('周末出行需求较高');
    if (demandFactor >= 1.2) reasons.push('该日期需求旺盛');
    if (!reasons.length) reasons.push('当前价格相对平稳');
    return {
      ...flight,
      date: parsed.key,
      cabin,
      passengers: passengerCount,
      price,
      originalPrice,
      currency: 'CNY',
      seatsLeft,
      pricing: {
        baseFare: flight.price,
        taxes,
        demandFactor: Number(demandFactor.toFixed(3)),
        timeFactor: Number(timeFactor.toFixed(3)),
        weekendFactor,
        cabinFactor,
        daysUntilDeparture: offset,
        bucket,
        reasons
      },
      quoteExpiresAt: null
    };
  });

  if (filters.airline) flights = flights.filter((flight) => flight.airline === filters.airline);
  if (filters.departWindow) {
    flights = flights.filter((flight) => {
      const hour = Number(flight.dep.slice(0, 2));
      if (filters.departWindow === 'morning') return hour < 12;
      if (filters.departWindow === 'afternoon') return hour >= 12 && hour < 18;
      return hour >= 18;
    });
  }
  if (filters.maxPrice) {
    flights = flights.filter((flight) => flight.price <= Number(filters.maxPrice));
  }

  const recommendation = decorateRecommendations(flights);
  const validUntil = new Date((Math.floor(now.getTime() / BUCKET_MS) + 1) * BUCKET_MS).toISOString();

  return {
    query: {
      from: fromCity.name,
      to: toCity.name,
      date: parsed.key,
      passengers: passengerCount,
      cabin
    },
    generatedAt: now.toISOString(),
    priceContext: {
      bucket,
      validUntil,
      note: '模拟动态票价每 30 分钟按需求、出发时间和舱位重新计算一次。'
    },
    results: flights,
    recommendation
  };
}
