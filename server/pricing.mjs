import { TRAVEL_DATA } from '../public/data.js';
import { badRequest } from './errors.mjs';
import { CABINS, FLIGHT_PRICE_BUCKET_MS } from '../public/flight-pricing.js';
export { CABIN_FACTORS, CABINS, computeFlightPrice, hashString } from '../public/flight-pricing.js';

const DAY_MS = 86400000;
const BUCKET_MS = FLIGHT_PRICE_BUCKET_MS;
const SUPPORTED_FLIGHT_CITIES = TRAVEL_DATA.flightCities.map((city) => city.name).join('、');

function pad(value) {
  return value < 10 ? `0${value}` : String(value);
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
    const flights = TRAVEL_DATA.getFlights(fromCity.name, toCity.name, key, { cabin, now });
    if (!flights.length) continue;
    const prices = flights.map((flight) => flight.price);
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

  let flights = TRAVEL_DATA.getFlights(fromCity.name, toCity.name, parsed.key, { cabin, now }).map((flight) => {
    return {
      ...flight,
      date: parsed.key,
      cabin,
      passengers: passengerCount,
      currency: 'CNY',
      seatsLeft: flight.seats,
      pricing: flight.pricing
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
      note: '本地模拟价格，非航司实时售价；综合航程、航司、日期、旺季、提前购票天数、时段和舱位计算，每 5 分钟更新，报价锁定 10 分钟；税费为演示固定值。'
    },
    supportedCities: TRAVEL_DATA.flightCities.map((city) => city.name),
    calendar: buildPriceCalendar({ from: fromCity.name, to: toCity.name, date: parsed.key, cabin, now }),
    results: flights,
    recommendation
  };
}
