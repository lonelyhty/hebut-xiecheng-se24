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
const BUCKET_MS = 5 * 60 * 1000;
const TAX_FEE = 80;
const SUPPORTED_FLIGHT_CITIES = '上海、北京、广州、深圳、成都、杭州、三亚、西安';

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

function round(value) {
  return Math.round(value);
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
  if (offset > 180) throw badRequest('仅支持搜索未来 180 天内的航班');
  return { parsed, offset };
}

export function normalizeCityOrThrow(value, label) {
  const name = TRAVEL_DATA.normalizeCity(value);
  if (!name) throw badRequest(`请填写${label}`);
  const city = TRAVEL_DATA.findFlightCity(name);
  if (!city) {
    throw badRequest(`${label}「${name}」暂无模拟航班，目前支持：${SUPPORTED_FLIGHT_CITIES}`);
  }
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

export function decorateRecommendations(flights) {
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

export function computeFlightPrice(flight, cabin, now) {
  const bucket = Math.floor(now.getTime() / BUCKET_MS);
  const daysUntilDeparture = flight.date
    ? (Date.parse(`${flight.date}T00:00:00+08:00`) - now.getTime()) / DAY_MS
    : 0;
  const proximityAdjustment = daysUntilDeparture < 3 ? 120 : daysUntilDeparture < 14 ? 40 : 0;
  const demandAdjustment = ((hashString(`${flight.id || flight.flightNo}|${bucket}`) % 13) - 6) * 5;
  const cabinFactor = CABIN_FACTORS[cabin] || 1;
  const baseFare = Number(flight.base != null ? flight.base : flight.price) || 0;
  const price = round((baseFare + proximityAdjustment + demandAdjustment) * cabinFactor) + TAX_FEE;
  const originalPrice = round(price * (1.06 + unit(`${flight.flightNo}|${bucket}|original`) * 0.1));
  return {
    price,
    originalPrice,
    pricing: {
      baseFare,
      tax: TAX_FEE,
      proximityAdjustment,
      demandAdjustment,
      cabinFactor,
      daysUntilDeparture: Number(Math.max(0, daysUntilDeparture).toFixed(2)),
      bucket,
      bucketMinutes: 5
    }
  };
}

export function buildPriceCalendar({ from, to, date, cabin = '经济舱', now = new Date() }) {
  const fromCity = normalizeCityOrThrow(from, '出发城市');
  const toCity = normalizeCityOrThrow(to, '到达城市');
  if (!CABINS.includes(cabin)) throw badRequest('不支持的舱位');
  const center = Date.parse(`${parseDateKey(date).key}T00:00:00+08:00`);
  const today = chinaDateKey(now);
  const items = [];
  for (let offset = -3; offset <= 3; offset += 1) {
    const key = chinaDateKey(new Date(center + offset * DAY_MS));
    if (key < today) continue;
    const dayOffset = Math.round((Date.parse(`${key}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
    if (dayOffset > 180) continue;
    const flights = TRAVEL_DATA.getFlights(fromCity.name, toCity.name, key);
    if (!flights.length) continue;
    const prices = flights.map((flight) => computeFlightPrice({ ...flight, date: key }, cabin, now).price);
    items.push({
      date: key,
      weekday: parseDateKey(key).weekday,
      price: Math.min(...prices)
    });
  }
  return items;
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
  const { parsed } = validateDateWindow(date, now);
  const bucket = Math.floor(now.getTime() / BUCKET_MS);

  let flights = TRAVEL_DATA.getFlights(fromCity.name, toCity.name, parsed.key).map((flight) => {
    const computed = computeFlightPrice(flight, cabin, now);
    const reasons = [];
    if (computed.pricing.daysUntilDeparture < 3) reasons.push('临近出发价格上浮');
    if (computed.pricing.proximityAdjustment === 40) reasons.push('出发日期较近');
    if (computed.pricing.demandAdjustment > 15) reasons.push('该时段需求较高');
    if (!reasons.length) reasons.push('当前价格相对平稳');
    return {
      ...flight,
      date: parsed.key,
      cabin,
      passengers: passengerCount,
      price: computed.price,
      originalPrice: computed.originalPrice,
      currency: 'CNY',
      seatsLeft: flight.seats,
      pricing: { ...computed.pricing, reasons }
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
      note: '模拟动态票价每 5 分钟按需求、出发时间和舱位重新计算一次；报价锁定 10 分钟。'
    },
    supportedCities: TRAVEL_DATA.flightCities.map((city) => city.name),
    calendar: buildPriceCalendar({ from: fromCity.name, to: toCity.name, date: parsed.key, cabin, now }),
    results: flights,
    recommendation
  };
}
