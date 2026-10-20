import { TRAVEL_DATA } from '../public/data.js';
import { badRequest } from './errors.mjs';

const STYLE_LABELS = {
  relax: '休闲',
  food: '美食',
  family: '亲子',
  culture: '文化'
};

export function buildItinerary({ city, days = 3, preferences = [], now = new Date() }) {
  const normalizedCity = TRAVEL_DATA.normalizeCity(city);
  if (!normalizedCity) throw badRequest('请填写目的地城市');
  const dayCount = Number(days);
  if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 7) {
    throw badRequest('行程天数应为 1-7 的整数');
  }
  const styles = (Array.isArray(preferences) ? preferences : []).filter((style) => STYLE_LABELS[style]);
  const attractionPool = TRAVEL_DATA.getAttractions(normalizedCity);
  const hotels = TRAVEL_DATA.getHotels(normalizedCity);
  if (!attractionPool.length || !hotels.length) throw badRequest('该城市暂无模拟行程数据');

  let attractionIndex = 0;
  const plan = [];
  for (let day = 1; day <= dayCount; day += 1) {
    const first = attractionPool[attractionIndex % attractionPool.length];
    attractionIndex += 1;
    const second = attractionPool[attractionIndex % attractionPool.length];
    attractionIndex += 1;
    const hotel = hotels[(day - 1) % hotels.length];
    const items = [
      {
        time: '09:30',
        title: first.name,
        detail: `${first.duration} · ${first.subtitle} · 参考价 ¥${first.price}`
      },
      {
        time: '12:00',
        title: '本地风味午餐',
        detail: styles.includes('food') ? '优先选择当地口碑餐厅，预留 90 分钟。' : '在景点周边用餐，预留 60 分钟。'
      },
      {
        time: '14:00',
        title: second.name,
        detail: `${second.duration} · ${second.tags.join(' / ')} · 参考价 ¥${second.price}`
      },
      {
        time: '18:30',
        title: styles.includes('family') ? '亲子友好晚餐与自由活动' : '晚餐与街区漫步',
        detail: '根据体力情况自由调整，保留弹性时间。'
      }
    ];
    plan.push({
      day,
      title: day === 1 ? '抵达与城市初体验' : day === dayCount ? '从容收尾' : '深度探索',
      items,
      hotel: {
        id: hotel.id,
        name: hotel.name,
        area: hotel.area,
        price: hotel.price,
        note: '本地模拟酒店，可在首页直接搜索同城酒店落实预订。'
      },
      estimatedCost: first.price + second.price + hotel.price
    });
  }

  const estimatedCost = plan.reduce((sum, day) => sum + day.estimatedCost, 0);
  return {
    city: normalizedCity,
    days: dayCount,
    preferences: styles.map((style) => STYLE_LABELS[style]),
    summary: `${normalizedCity} ${dayCount} 天行程，已按${styles.length ? styles.map((style) => STYLE_LABELS[style]).join('、') : '均衡'}偏好生成，景点与价格为本地模拟数据。`,
    plan,
    estimatedCost,
    generatedAt: now.toISOString()
  };
}
