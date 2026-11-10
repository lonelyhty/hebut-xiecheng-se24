const PACKAGE_IMAGES = {
  三亚: 'assets/hotel-sanya-resort.jpg',
  杭州: 'assets/hotel-hangzhou-lake.jpg',
  青岛: 'assets/hero-qingdao.jpg',
  上海: 'assets/hotel-shanghai-bund.jpg',
  北京: 'assets/hotel-beijing-tower.jpg',
  成都: 'assets/hotel-chengdu-modern.jpg',
  广州: 'assets/hotel-guangzhou-pool.jpg'
};

const TRAVEL_PACKAGES = [
  { id: 'pk-sanya-5', dest: '三亚', days: 5, type: 'group', title: '三亚蜈支洲岛+亚龙湾热带天堂森林公园5日4晚跟团游', themes: ['海岛', '亲子'], price: 2680, originalPrice: 3280, score: 4.8, reviews: 1264, highlights: ['全程入住海景房', '蜈支洲岛VIP通道', '赠送海鲜大餐'] },
  { id: 'pk-sanya-4', dest: '三亚', days: 4, type: 'free', title: '三亚亚特兰蒂斯水世界+免税城4日3晚自由行', themes: ['亲子', '购物'], price: 3180, originalPrice: 3880, score: 4.7, reviews: 862, highlights: ['水世界无限次入园', '免税城穿梭巴士', '接送机服务'] },
  { id: 'pk-hz-3', dest: '杭州', days: 3, type: 'group', title: '杭州西湖+灵隐寺+宋城千古情3日2晚跟团游', themes: ['文化', '美食'], price: 1280, originalPrice: 1580, score: 4.9, reviews: 2031, highlights: ['西湖游船', '宋城演出票', '龙井茶体验'] },
  { id: 'pk-hz-2', dest: '杭州', days: 2, type: 'nearby', title: '杭州千岛湖中心湖区2日1晚周边游', themes: ['自然', '亲子'], price: 698, originalPrice: 860, score: 4.6, reviews: 540, highlights: ['千岛湖船票', '湖景民宿', '骑行绿道'] },
  { id: 'pk-qd-4', dest: '青岛', days: 4, type: 'free', title: '青岛栈桥+八大关+崂山4日3晚自由行', themes: ['海滨', '美食'], price: 1580, originalPrice: 1900, score: 4.7, reviews: 733, highlights: ['崂山门票', '啤酒博物馆', '海景酒店'] },
  { id: 'pk-bj-5', dest: '北京', days: 5, type: 'group', title: '北京故宫+长城+颐和园5日4晚跟团游', themes: ['文化', '亲子'], price: 2380, originalPrice: 2880, score: 4.8, reviews: 1580, highlights: ['故宫深度讲解', '长城缆车', '烤鸭宴'] },
  { id: 'pk-cd-4', dest: '成都', days: 4, type: 'free', title: '成都大熊猫基地+都江堰+青城山4日3晚自由行', themes: ['自然', '美食'], price: 1680, originalPrice: 2000, score: 4.8, reviews: 946, highlights: ['熊猫基地门票', '火锅套餐', '接送站'] },
  { id: 'pk-sh-2', dest: '上海', days: 2, type: 'nearby', title: '上海迪士尼乐园2日1晚周边游', themes: ['亲子', '乐园'], price: 1398, originalPrice: 1680, score: 4.9, reviews: 3120, highlights: ['迪士尼两日票', '乐园酒店', '早享卡'] },
  { id: 'pk-gz-3', dest: '广州', days: 3, type: 'group', title: '广州长隆野生动物世界+广州塔3日2晚跟团游', themes: ['亲子', '乐园'], price: 1880, originalPrice: 2280, score: 4.7, reviews: 688, highlights: ['长隆门票', '广州塔登塔', '早茶体验'] },
  { id: 'pk-qd-3', dest: '青岛', days: 3, type: 'group', title: '青岛崂山+极地海洋世界3日2晚跟团游', themes: ['海滨', '亲子'], price: 1180, originalPrice: 1420, score: 4.6, reviews: 415, highlights: ['极地海洋门票', '崂山仰口', '海鲜餐'] }
];

TRAVEL_PACKAGES.forEach((item) => {
  item.image = PACKAGE_IMAGES[item.dest] || 'assets/hero-qingdao.jpg';
  item.itinerary = Array.from({ length: item.days }, (_, day) => ({
    day: day + 1,
    title: day === 0 ? '抵达 ' + item.dest + ' · 接站入住' : day === item.days - 1 ? '自由活动 · 送站返程' : item.dest + ' 精华游览 · 特色体验',
    desc: day === 0 ? '专人接站，入住酒店后可自由探索周边街区。' : day === item.days - 1 ? '睡到自然醒，根据航班/车次时间送站。' : '上午游览核心景点，下午安排特色体验，晚上品尝当地美食。'
  }));
  item.includes = ['往返大交通', (item.days - 1) + '晚住宿', '行程内门票', '当地用车', '导游服务'];
});

export function searchPackages({ dest = '', days = '', type = '', keyword = '', sort = 'recommended' } = {}) {
  let list = TRAVEL_PACKAGES.slice();
  if (dest) list = list.filter((item) => item.dest === dest);
  if (type) list = list.filter((item) => item.type === type);
  if (days === 'short') list = list.filter((item) => item.days <= 3);
  else if (days === 'mid') list = list.filter((item) => item.days >= 4 && item.days <= 5);
  else if (days === 'long') list = list.filter((item) => item.days >= 6);
  if (keyword) {
    const term = keyword.toLowerCase();
    list = list.filter((item) => (item.title + item.dest + item.themes.join('')).toLowerCase().includes(term));
  }
  if (sort === 'price') list.sort((a, b) => a.price - b.price);
  else if (sort === 'score') list.sort((a, b) => b.score - a.score);
  else list.sort((a, b) => b.reviews - a.reviews);
  return list;
}

export function packageById(id) {
  return TRAVEL_PACKAGES.find((item) => item.id === id) || null;
}

export function packageDests() {
  return Array.from(new Set(TRAVEL_PACKAGES.map((item) => item.dest)));
}

const GUIDES = [
  {
    id: 'gd-qd', dest: '青岛', title: '青岛三日漫步：红瓦绿树与碧海蓝天的正确打开方式', author: '海风旅人', views: 12800, likes: 964, image: 'assets/hero-qingdao.jpg', tags: ['海滨', 'Citywalk'],
    summary: '从栈桥到八大关，再到崂山仰口，一条不走回头路的青岛经典动线。',
    sections: [
      { h: 'Day 1 老城漫步', p: ['上午从栈桥出发，沿中山路看德式老建筑，中午在劈柴院解决午餐。', '下午逛信号山与大学路网红墙，傍晚到小鱼山看日落。'] },
      { h: 'Day 2 海岸线', p: ['上午八大关与第二海水浴场，下午五四广场与奥帆中心。', '晚上台东夜市吃海鲜烧烤。'] },
      { h: 'Day 3 崂山', p: ['仰口线看山海相接，体力好可走觅天洞。', '返程前买一点脂渣与崂山可乐当手信。'] }
    ],
    tips: ['海边风大，备一件薄外套。', '吃海鲜先问价，选择明码标价的店。', '崂山门票提前一天在线买更便宜。']
  },
  {
    id: 'gd-hz', dest: '杭州', title: '杭州西湖不挤人攻略：错峰路线与隐藏机位', author: '江南慢生活', views: 9600, likes: 712, image: 'assets/hotel-hangzhou-lake.jpg', tags: ['湖泊', '摄影'],
    summary: '避开断桥人流，从茅家埠到浴鹄湾，看见更安静的西湖。',
    sections: [
      { h: '错峰动线', p: ['清晨先到茅家埠，水面如镜。', '上午走杨公堤到浴鹄湾，人少景美。'] },
      { h: '隐藏机位', p: ['霁虹桥拍倒影，傍晚光线最佳。', '乌龟潭边适合拍人像。'] }
    ],
    tips: ['周末尽量早出门。', '环湖公交比打车快。', '带一双好走的鞋。']
  },
  {
    id: 'gd-sy', dest: '三亚', title: '三亚亲子五日：选湾、选酒店与免税城省钱清单', author: '带娃看海', views: 15200, likes: 1180, image: 'assets/hotel-sanya-resort.jpg', tags: ['亲子', '海岛'],
    summary: '亚龙湾玩沙、海棠湾看酒店、三亚湾看日落，一次讲清三个湾的差别。',
    sections: [
      { h: '选湾', p: ['亚龙湾沙质最好，适合带娃玩沙。', '海棠湾酒店新但风浪大，不适合下海。'] },
      { h: '免税城', p: ['先买大件再凑单，关注会员积分。', '离岛前提货预留时间。'] }
    ],
    tips: ['防晒一定要补涂。', '玩沙工具当地买更便宜。', '出海项目看天气再订。']
  },
  {
    id: 'gd-cd', dest: '成都', title: '成都美食地图：从火锅到巷子里的苍蝇馆子', author: '辣味研究所', views: 11000, likes: 890, image: 'assets/hotel-chengdu-modern.jpg', tags: ['美食', '城市'],
    summary: '不止火锅，串串、冒菜、甜水面与蛋烘糕的本地人清单。',
    sections: [
      { h: '火锅与串串', p: ['牛油锅选微辣起步，香油碟解辣。', '串串香数签签前先问计价方式。'] },
      { h: '小吃', p: ['甜水面要趁热拌开。', '蛋烘糕加奶油肉松是经典搭配。'] }
    ],
    tips: ['肠胃弱备一点药。', '排队名店可错峰下午去。', '冰粉是解辣神器。']
  },
  {
    id: 'gd-bj', dest: '北京', title: '北京故宫长城一日双打卡：时间线与预约要点', author: '京城行者', views: 8800, likes: 620, image: 'assets/hotel-beijing-tower.jpg', tags: ['文化', '历史'],
    summary: '故宫上午、长城下午的极限动线，以及预约与交通的关键细节。',
    sections: [
      { h: '故宫', p: ['提前七天预约，午门进神武门出。', '中轴线加珍宝馆约三小时。'] },
      { h: '长城', p: ['选慕田峪人少景好。', '缆车上滑道下节省体力。'] }
    ],
    tips: ['周一闭馆注意安排。', '带身份证原件。', '穿舒适的鞋。']
  },
  {
    id: 'gd-sh', dest: '上海', title: '上海迪士尼省力攻略：早享卡与项目优先级', author: '乐园控', views: 18400, likes: 1520, image: 'assets/hotel-shanghai-bund.jpg', tags: ['乐园', '亲子'],
    summary: '用早享卡先刷热门项目，下午看演出休息，晚上占位烟花。',
    sections: [
      { h: '上午', p: ['早享入园先冲疯狂动物城。', '接着刷加勒比海盗与七个小矮人。'] },
      { h: '下午与晚上', p: ['下午看花车与演出，避开高温。', '晚上提前占位看烟花。'] }
    ],
    tips: ['下载官方 App 看排队时间。', '带充电宝与水杯。', '雨天项目可能调整。']
  }
];

export function guides(dest = '') {
  return dest ? GUIDES.filter((item) => item.dest === dest) : GUIDES.slice();
}

export function guideById(id) {
  return GUIDES.find((item) => item.id === id) || null;
}
