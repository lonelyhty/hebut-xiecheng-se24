const PRODUCTS = [
  { id: 'sp-01', name: '免税精华露 100ml 双支装', brand: 'LA MER 平替精选', category: 'beauty', price: 899, originalPrice: 1280, tag: '免税直采', rating: 4.8, sold: 2310, icon: 'sparkle', gradient: 'linear-gradient(135deg,#ffd9e8,#ff9ec4)' },
  { id: 'sp-02', name: '口红礼盒 三支装 限定色', brand: 'DIOR 风格精选', category: 'beauty', price: 520, originalPrice: 720, tag: '限定', rating: 4.7, sold: 1804, icon: 'gift', gradient: 'linear-gradient(135deg,#ffc9c9,#ff8f8f)' },
  { id: 'sp-03', name: '无线降噪耳机 Pro', brand: 'SoundCore', category: 'digital', price: 799, originalPrice: 1099, tag: '新品', rating: 4.6, sold: 3260, icon: 'wifi', gradient: 'linear-gradient(135deg,#c9e4ff,#7fb8ff)' },
  { id: 'sp-04', name: '便携照片打印机', brand: 'PrintGo', category: 'digital', price: 469, originalPrice: 629, tag: '热卖', rating: 4.5, sold: 1520, icon: 'camera', gradient: 'linear-gradient(135deg,#d6d6ff,#9a9aff)' },
  { id: 'sp-05', name: '智能手表 运动版', brand: 'FitBand', category: 'digital', price: 699, originalPrice: 899, tag: '免税', rating: 4.6, sold: 2044, icon: 'clock', gradient: 'linear-gradient(135deg,#c9f9e4,#7fe0b8)' },
  { id: 'sp-06', name: '环球零食大礼包 24 件', brand: 'SnackWorld', category: 'food', price: 168, originalPrice: 238, tag: '组合装', rating: 4.7, sold: 5120, icon: 'food', gradient: 'linear-gradient(135deg,#ffe4c9,#ffb87f)' },
  { id: 'sp-07', name: '精品咖啡豆 1kg 中度烘焙', brand: 'BeanLab', category: 'food', price: 128, originalPrice: 168, tag: '产地直供', rating: 4.8, sold: 2860, icon: 'coffee', gradient: 'linear-gradient(135deg,#e8d6c9,#c9a88f)' },
  { id: 'sp-08', name: '红酒双支礼盒 750ml×2', brand: 'VinoSelect', category: 'food', price: 328, originalPrice: 458, tag: '礼盒', rating: 4.6, sold: 980, icon: 'gift', gradient: 'linear-gradient(135deg,#ffd6d6,#e08f8f)' },
  { id: 'sp-09', name: '乳胶枕 一对装', brand: 'SleepCloud', category: 'home', price: 269, originalPrice: 399, tag: '泰国直采', rating: 4.7, sold: 3420, icon: 'bed', gradient: 'linear-gradient(135deg,#d6ecff,#8fc4ff)' },
  { id: 'sp-10', name: '香薰蜡烛礼盒 三味', brand: 'AromaHome', category: 'home', price: 158, originalPrice: 218, tag: '礼盒', rating: 4.8, sold: 1660, icon: 'sparkle', gradient: 'linear-gradient(135deg,#ffe9c9,#ffc98f)' },
  { id: 'sp-11', name: '保温杯 500ml 钛色', brand: 'ThermoLite', category: 'home', price: 199, originalPrice: 269, tag: '轻量', rating: 4.6, sold: 2210, icon: 'coffee', gradient: 'linear-gradient(135deg,#d9d9d9,#a8a8a8)' },
  { id: 'sp-12', name: '防晒霜 SPF50 两支装', brand: 'SunGuard', category: 'beauty', price: 218, originalPrice: 308, tag: '免税', rating: 4.7, sold: 4060, icon: 'shield', gradient: 'linear-gradient(135deg,#fff3c9,#ffd98f)' }
];

export const SHOP_CATEGORIES = [
  { id: '', label: '全部' },
  { id: 'beauty', label: '免税美妆' },
  { id: 'digital', label: '数码家电' },
  { id: 'food', label: '环球美食' },
  { id: 'home', label: '家居生活' }
];

export function searchProducts({ category = '', keyword = '', sort = 'recommended' } = {}) {
  let list = PRODUCTS.slice();
  if (category) list = list.filter((item) => item.category === category);
  if (keyword) {
    const term = keyword.toLowerCase();
    list = list.filter((item) => (item.name + item.brand + item.tag).toLowerCase().includes(term));
  }
  if (sort === 'price') list.sort((a, b) => a.price - b.price);
  else if (sort === 'sold') list.sort((a, b) => b.sold - a.sold);
  else list.sort((a, b) => b.rating - a.rating);
  return list;
}

export function productById(id) {
  return PRODUCTS.find((item) => item.id === id) || null;
}

export const GIFT_DENOMS = [100, 200, 500, 1000];

export const GIFT_THEMES = [
  { id: 'classic', name: '经典橙', gradient: 'linear-gradient(135deg,#ff9a3d,#ff6a00)' },
  { id: 'ocean', name: '海洋蓝', gradient: 'linear-gradient(135deg,#4facfe,#00c6fb)' },
  { id: 'sakura', name: '樱花粉', gradient: 'linear-gradient(135deg,#ff9ec4,#ff6a9e)' },
  { id: 'forest', name: '森林绿', gradient: 'linear-gradient(135deg,#43e97b,#38f9d7)' },
  { id: 'night', name: '星空紫', gradient: 'linear-gradient(135deg,#a18cd1,#fbc2eb)' }
];
