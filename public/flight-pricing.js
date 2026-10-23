// Shared simulation rules, not live airline quotes or published fare/tax tables.
export const CABIN_FACTORS = Object.freeze({
  '经济舱': 1,
  '超级经济舱': 1.35,
  '商务舱': 2.6,
  '头等舱': 3.8
});
export const CABINS = Object.freeze(Object.keys(CABIN_FACTORS));
export const FLIGHT_PRICE_BUCKET_MS = 5 * 60 * 1000;
const DAY_MS = 86400000;
const TAX_FEE = 80;

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

function seasonFactor(flight, month) {
  const cities = [flight.from, flight.to];
  if (cities.some((city) => ['三亚', '海口'].includes(city)) && [12, 1, 2].includes(month)) return 1.3;
  if (cities.includes('哈尔滨') && [12, 1, 2].includes(month)) return 1.25;
  if (cities.some((city) => ['乌鲁木齐', '昆明', '贵阳'].includes(city)) && [7, 8].includes(month)) return 1.2;
  return [7, 8].includes(month) ? 1.12 : 1;
}

function calendarFactor(date) {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  // Recurring demonstration peaks; these are not an official holiday calendar.
  if ((month === 10 && day <= 7) || (month === 5 && day <= 5)) return 1.4;
  if (date.getUTCDay() === 5 || date.getUTCDay() === 0) return 1.1;
  if (date.getUTCDay() === 2 || date.getUTCDay() === 3) return 0.94;
  return 1;
}

function departureFactor(dep) {
  const hour = Number(String(dep || '12:00').slice(0, 2));
  if (hour < 8 || hour >= 22) return 0.88;
  if ((hour >= 8 && hour < 11) || (hour >= 17 && hour < 21)) return 1.1;
  return 1;
}

export function computeFlightPrice(flight, cabin = '经济舱', now = new Date()) {
  const bucket = Math.floor(now.getTime() / FLIGHT_PRICE_BUCKET_MS);
  const bucketTime = bucket * FLIGHT_PRICE_BUCKET_MS;
  const departure = flight.date ? Date.parse(`${flight.date}T${flight.dep || '00:00'}:00+08:00`) : bucketTime;
  const daysUntilDeparture = Math.max(0, (departure - bucketTime) / DAY_MS);
  const leadTimeFactor = daysUntilDeparture < 1 ? 1.48
    : daysUntilDeparture < 3 ? 1.3
      : daysUntilDeparture < 7 ? 1.12
        : daysUntilDeparture < 14 ? 1
          : daysUntilDeparture < 30 ? 0.9 : 0.82;
  const date = new Date(`${flight.date || '2000-01-01'}T00:00:00Z`);
  const seasonalFactor = seasonFactor(flight, date.getUTCMonth() + 1);
  const travelDateFactor = calendarFactor(date);
  const timeFactor = departureFactor(flight.dep);
  const baseFare = Number(flight.base != null ? flight.base : flight.price) || 0;
  const marketFare = Math.round(baseFare * seasonalFactor * travelDateFactor * timeFactor);
  const proximityAdjustment = Math.round(marketFare * (leadTimeFactor - 1));
  const demandFactor = 0.97 + unit(`${flight.id || flight.flightNo}|${bucket}|demand`) * 0.06;
  const demandAdjustment = Math.round((marketFare + proximityAdjustment) * (demandFactor - 1));
  const cabinFactor = CABIN_FACTORS[cabin] || 1;
  const ticketFare = Math.round(Math.max(120, marketFare + proximityAdjustment + demandAdjustment) * cabinFactor);
  const price = ticketFare + TAX_FEE;
  const originalPrice = Math.max(price, Math.round(baseFare * 1.65 * cabinFactor) + TAX_FEE);
  const reasons = [];
  if (leadTimeFactor > 1) reasons.push('临近出发价格上浮');
  if (leadTimeFactor < 1) reasons.push('提前购票优惠');
  if (seasonalFactor > 1) reasons.push('目的地旺季需求较高');
  if (travelDateFactor >= 1.4) reasons.push('假期模拟需求较高');
  else if (travelDateFactor > 1) reasons.push('周末出行需求较高');
  if (timeFactor < 1) reasons.push('早晚时段优惠');
  if (!reasons.length) reasons.push('当前价格相对平稳');
  return {
    price,
    originalPrice,
    pricing: {
      baseFare, marketFare, ticketFare, tax: TAX_FEE,
      proximityAdjustment, demandAdjustment, cabinFactor, leadTimeFactor,
      seasonalFactor, travelDateFactor, timeFactor, demandFactor,
      daysUntilDeparture: Number(daysUntilDeparture.toFixed(2)),
      bucket, bucketMinutes: 5, source: 'simulation', reasons
    }
  };
}
