function hashSeed(text) {
  let hash = 2166136261;
  const value = String(text || '');
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function seeded(seed) {
  let state = seed >>> 0;
  return function () {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const COACH_ROUTES = [
  { from: '上海', to: '杭州', kind: 'bus', km: 176, duration: '2小时30分', base: 68, fromStation: '上海长途客运总站', toStation: '杭州客运中心站' },
  { from: '上海', to: '苏州', kind: 'bus', km: 104, duration: '1小时40分', base: 45, fromStation: '上海长途客运总站', toStation: '苏州北广场汽车站' },
  { from: '上海', to: '南京', kind: 'bus', km: 300, duration: '3小时50分', base: 118, fromStation: '上海长途客运东站', toStation: '南京汽车客运站' },
  { from: '北京', to: '天津', kind: 'bus', km: 130, duration: '2小时', base: 50, fromStation: '北京八王坟客运站', toStation: '天津通莎客运站' },
  { from: '广州', to: '深圳', kind: 'bus', km: 140, duration: '2小时20分', base: 65, fromStation: '广州天河客运站', toStation: '深圳罗湖汽车站' },
  { from: '成都', to: '重庆', kind: 'bus', km: 300, duration: '3小时40分', base: 108, fromStation: '成都东站汽车客运站', toStation: '重庆龙头寺汽车站' },
  { from: '杭州', to: '上海', kind: 'bus', km: 176, duration: '2小时30分', base: 68, fromStation: '杭州客运中心站', toStation: '上海长途客运总站' },
  { from: '深圳', to: '广州', kind: 'bus', km: 140, duration: '2小时20分', base: 65, fromStation: '深圳罗湖汽车站', toStation: '广州天河客运站' },
  { from: '上海', to: '舟山', kind: 'ship', km: 180, duration: '3小时', base: 128, fromStation: '上海吴淞客运码头', toStation: '舟山普陀山码头' },
  { from: '厦门', to: '鼓浪屿', kind: 'ship', km: 6, duration: '20分', base: 35, fromStation: '厦门邮轮中心码头', toStation: '鼓浪屿三丘田码头' },
  { from: '广州', to: '珠海', kind: 'ship', km: 110, duration: '1小时40分', base: 85, fromStation: '广州南沙客运港', toStation: '珠海九洲港' },
  { from: '海口', to: '海安', kind: 'ship', km: 24, duration: '1小时30分', base: 42, fromStation: '海口新海港', toStation: '海安新港' },
  { from: '舟山', to: '上海', kind: 'ship', km: 180, duration: '3小时', base: 128, fromStation: '舟山普陀山码头', toStation: '上海吴淞客运码头' }
];

const COACH_TIMES = ['06:30', '07:40', '08:50', '10:10', '11:30', '13:00', '14:40', '16:20', '18:00', '19:30'];
const BUS_TYPES = ['大型高一', '大型高二', '中型中级', '豪华商务'];
const SHIP_TYPES = ['高速客轮', '普通客轮', '豪华邮轮'];

export function coachCities(kind) {
  const set = new Set();
  COACH_ROUTES.filter((route) => route.kind === kind).forEach((route) => {
    set.add(route.from);
    set.add(route.to);
  });
  return Array.from(set);
}

export function searchCoaches({ from, to, kind = 'bus', date = '' }) {
  const route = COACH_ROUTES.find((item) => item.kind === kind && item.from === from && item.to === to);
  if (!route) return { route: null, results: [] };
  const random = seeded(hashSeed(`${kind}|${from}|${to}|${date}`));
  const times = kind === 'ship' ? COACH_TIMES.filter((_, index) => index % 2 === 0) : COACH_TIMES;
  const results = times.map((dep, index) => {
    const price = Math.round(route.base + (index % 3) * 6 + random() * 8);
    const seats = 3 + Math.floor(random() * 42);
    const vehicle = kind === 'ship' ? SHIP_TYPES[index % SHIP_TYPES.length] : BUS_TYPES[index % BUS_TYPES.length];
    const [hour, minute] = dep.split(':').map(Number);
    const durationMinutes = parseDuration(route.duration);
    const arriveMinutes = hour * 60 + minute + durationMinutes;
    const arr = `${String(Math.floor(arriveMinutes / 60) % 24).padStart(2, '0')}:${String(arriveMinutes % 60).padStart(2, '0')}`;
    return {
      id: `${kind}-${from}-${to}-${index}`,
      kind,
      from,
      to,
      dep,
      arr,
      extraDay: arriveMinutes >= 1440,
      duration: route.duration,
      fromStation: route.fromStation,
      toStation: route.toStation,
      vehicle,
      price,
      seats,
      date
    };
  });
  return { route, results };
}

function parseDuration(text) {
  const hours = /(\d+)小时/.exec(text);
  const minutes = /(\d+)分/.exec(text);
  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
}

const CAR_CLASSES = [
  { id: 'eco', name: '经济型', cars: '大众朗逸 · 丰田卡罗拉', seats: 4, luggage: 2, base: 38, perKm: 2.2 },
  { id: 'comfort', name: '舒适型', cars: '大众帕萨特 · 丰田凯美瑞', seats: 4, luggage: 3, base: 58, perKm: 2.8 },
  { id: 'business', name: '商务型', cars: '别克GL8 · 传祺M8', seats: 6, luggage: 4, base: 98, perKm: 3.6 },
  { id: 'luxury', name: '豪华型', cars: '奔驰E级 · 宝马5系', seats: 4, luggage: 3, base: 158, perKm: 4.6 }
];

const RENTAL_CARS = [
  { id: 'rent-eco', name: '大众朗逸', tag: '经济省油', seats: 5, luggage: 2, transmission: '自动挡', perDay: 128 },
  { id: 'rent-suv', name: '哈弗H6', tag: '空间宽敞', seats: 5, luggage: 3, transmission: '自动挡', perDay: 188 },
  { id: 'rent-mpv', name: '别克GL8', tag: '商务七座', seats: 7, luggage: 4, transmission: '自动挡', perDay: 328 },
  { id: 'rent-ev', name: '特斯拉 Model 3', tag: '新能源', seats: 5, luggage: 2, transmission: '自动挡', perDay: 268 },
  { id: 'rent-lux', name: '宝马3系', tag: '驾控乐趣', seats: 5, luggage: 2, transmission: '自动挡', perDay: 358 }
];

export function carClasses() {
  return CAR_CLASSES.slice();
}

export function rentalCars() {
  return RENTAL_CARS.slice();
}

export function estimateTransfer({ city, from, to, service = 'airport' }) {
  const random = seeded(hashSeed(`${city}|${from}|${to}|${service}`));
  const km = 12 + Math.floor(random() * 48);
  const minutes = 25 + Math.floor(km * 1.4);
  return CAR_CLASSES.map((item) => ({
    ...item,
    km,
    minutes,
    price: Math.round(item.base + km * item.perKm)
  }));
}

export function estimateTaxi({ city, from, to }) {
  const random = seeded(hashSeed(`taxi|${city}|${from}|${to}`));
  const km = 4 + Math.floor(random() * 26);
  const minutes = 10 + Math.floor(km * 1.6);
  return CAR_CLASSES.slice(0, 3).map((item) => ({
    ...item,
    km,
    minutes,
    price: Math.round(item.base * 0.4 + km * item.perKm)
  }));
}

export const EXTRA = {
  coachCities,
  searchCoaches,
  carClasses,
  rentalCars,
  estimateTransfer,
  estimateTaxi
};
