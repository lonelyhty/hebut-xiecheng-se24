  const IMG = {
    hero: 'assets/hero-qingdao.jpg',
    shBund: 'assets/hotel-shanghai-bund.jpg',
    shLobby: 'assets/hotel-shanghai-lobby.jpg',
    shRoom: 'assets/hotel-shanghai-room.jpg',
    bjCourt: 'assets/hotel-beijing-courtyard.jpg',
    bjTower: 'assets/hotel-beijing-tower.jpg',
    gzPool: 'assets/hotel-guangzhou-pool.jpg',
    sanya: 'assets/hotel-sanya-resort.jpg',
    hz: 'assets/hotel-hangzhou-lake.jpg',
    cd: 'assets/hotel-chengdu-modern.jpg',
    park: 'assets/attraction-sunset-park.jpg'
  };

  const CITY_DEFS = [
    ['上海', 'Shanghai', 'domestic', true],
    ['北京', 'Beijing', 'domestic', true],
    ['广州', 'Guangzhou', 'domestic', true],
    ['三亚', 'Sanya', 'domestic', true],
    ['杭州', 'Hangzhou', 'domestic', true],
    ['成都', 'Chengdu', 'domestic', true],
    ['南京', 'Nanjing', 'domestic', true],
    ['重庆', 'Chongqing', 'domestic', true],
    ['深圳', 'Shenzhen', 'domestic', true],
    ['厦门', 'Xiamen', 'domestic', true],
    ['西安', "Xi'an", 'domestic', true],
    ['武汉', 'Wuhan', 'domestic', true],
    ['昆明', 'Kunming', 'domestic', true],
    ['长沙', 'Changsha', 'domestic', true],
    ['苏州', 'Suzhou', 'domestic', true],
    ['哈尔滨', 'Harbin', 'domestic', true],
    ['青岛', 'Qingdao', 'domestic', true],
    ['天津', 'Tianjin', 'domestic', true],
    ['济南', 'Jinan', 'domestic', false],
    ['郑州', 'Zhengzhou', 'domestic', false],
    ['珠海', 'Zhuhai', 'domestic', false],
    ['合肥', 'Hefei', 'domestic', false],
    ['福州', 'Fuzhou', 'domestic', false],
    ['沈阳', 'Shenyang', 'domestic', false],
    ['大连', 'Dalian', 'domestic', false],
    ['宁波', 'Ningbo', 'domestic', false],
    ['无锡', 'Wuxi', 'domestic', false],
    ['桂林', 'Guilin', 'domestic', false],
    ['丽江', 'Lijiang', 'domestic', false],
    ['大理', 'Dali', 'domestic', false],
    ['海口', 'Haikou', 'domestic', false],
    ['香港', 'Hong Kong', 'domestic', false],
    ['澳门', 'Macau', 'domestic', false],
    ['台北', 'Taipei', 'domestic', false],
    ['新加坡', 'Singapore', 'international', true],
    ['普吉岛', 'Phuket', 'international', true],
    ['东京', 'Tokyo', 'international', true],
    ['曼谷', 'Bangkok', 'international', true],
    ['大阪', 'Osaka', 'international', true],
    ['巴厘岛', 'Bali', 'international', true],
    ['清迈', 'Chiang Mai', 'international', false],
    ['京都', 'Kyoto', 'international', false],
    ['巴黎', 'Paris', 'international', false],
    ['伦敦', 'London', 'international', false],
    ['纽约', 'New York', 'international', false],
    ['首尔', 'Seoul', 'international', false],
    ['悉尼', 'Sydney', 'international', false],
    ['吉隆坡', 'Kuala Lumpur', 'international', false],
    ['马尔代夫', 'Maldives', 'international', false],
    ['迪拜', 'Dubai', 'international', false]
  ];

  const cities = CITY_DEFS.map(function (d) {
    return { name: d[0], en: d[1], region: d[2], hot: d[3] };
  });

  const PROFILES = {
    '上海': {
      areas: ['外滩商圈', '静安寺', '陆家嘴', '徐家汇', '人民广场', '新天地'],
      names: ['外滩云际酒店', '静安栖悦酒店', '陆家嘴星河酒店', '徐家汇拾光酒店', '人民广场澜庭酒店', '新天地璞岸公寓'],
      images: [IMG.shBund, IMG.shLobby, IMG.shRoom],
      priceFactor: 1.28,
      airport: '虹桥T2',
      station: '上海虹桥'
    },
    '北京': {
      areas: ['王府井', '三里屯', '国贸CBD', '什刹海', '中关村', '通州运河'],
      names: ['王府井澜庭酒店', '三里屯星澜酒店', '国贸云际酒店', '什刹海隐庐酒店', '中关村拾光酒店', '通州运河悦庭酒店'],
      images: [IMG.bjCourt, IMG.bjTower, IMG.shRoom],
      priceFactor: 1.22,
      airport: '首都T3',
      station: '北京南'
    },
    '广州': {
      areas: ['珠江新城', '天河商圈', '广州塔', '越秀公园', '白云新城', '琶洲会展'],
      names: ['珠江新城云际酒店', '天河澜庭酒店', '广州塔星澜酒店', '越秀拾光酒店', '白云新城栖悦酒店', '琶洲璞岸酒店'],
      images: [IMG.gzPool, IMG.shRoom, IMG.shLobby],
      priceFactor: 1.16,
      airport: '白云T2',
      station: '广州南'
    },
    '三亚': {
      areas: ['亚龙湾', '海棠湾', '三亚湾', '大东海', '崖州湾', '蜈支洲岛'],
      names: ['亚龙湾海岸度假酒店', '海棠湾拾光度假酒店', '三亚湾椰风酒店', '大东海澜庭度假酒店', '崖州湾云际酒店', '蜈支洲岛悦庭酒店'],
      images: [IMG.sanya, IMG.gzPool, IMG.hero],
      priceFactor: 1.45,
      airport: '凤凰T1',
      station: '三亚站'
    },
    '杭州': {
      areas: ['西湖景区', '龙井山', '钱江新城', '灵隐寺', '京杭运河', '千岛湖'],
      names: ['西湖畔隐庐酒店', '龙井山居度假酒店', '钱江新城云际酒店', '灵隐禅意酒店', '运河畔拾光酒店', '千岛湖澜庭度假酒店'],
      images: [IMG.hz, IMG.cd, IMG.shRoom],
      priceFactor: 1.18,
      airport: '萧山T3',
      station: '杭州东'
    },
    '成都': {
      areas: ['太古里', '宽窄巷子', '天府新区', '锦江畔', '熊猫基地', '青城山'],
      names: ['太古里星澜酒店', '宽窄巷子隐庐酒店', '天府新区云际酒店', '锦江畔拾光酒店', '熊猫基地悦庭酒店', '青城山栖悦度假酒店'],
      images: [IMG.cd, IMG.hz, IMG.shLobby],
      priceFactor: 1.05,
      airport: '天府T2',
      station: '成都东'
    },
    '青岛': {
      areas: ['小鱼山', '八大关', '五四广场', '崂山', '栈桥', '西海岸'],
      names: ['小鱼山海岸酒店', '八大关澜庭酒店', '五四广场云际酒店', '崂山海边隐庐酒店', '栈桥拾光酒店', '西海岸悦庭酒店'],
      images: [IMG.hero, IMG.sanya, IMG.hz],
      priceFactor: 1.1,
      airport: '胶东T1',
      station: '青岛北'
    },
    '厦门': {
      areas: ['鼓浪屿', '环岛路', '中山路', '曾厝垵', '五缘湾', '集美学村'],
      names: ['鼓浪屿海庭酒店', '环岛路澜庭度假酒店', '中山路拾光酒店', '曾厝垵栖悦酒店', '五缘湾云际酒店', '集美学村悦庭酒店'],
      images: [IMG.sanya, IMG.hz, IMG.gzPool],
      priceFactor: 1.08,
      airport: '高崎T3',
      station: '厦门北'
    },
    '深圳': {
      areas: ['福田CBD', '南山', '华侨城', '大梅沙', '宝安中心', '前海'],
      names: ['福田星河酒店', '南山云际酒店', '华侨城拾光酒店', '大梅沙海岸度假酒店', '宝安澜庭酒店', '前海悦庭公寓'],
      images: [IMG.gzPool, IMG.shRoom, IMG.bjTower],
      priceFactor: 1.2,
      airport: '宝安T3',
      station: '深圳北'
    },
    '南京': {
      areas: ['新街口', '夫子庙', '玄武湖', '河西', '钟山', '老门东'],
      names: ['新街口云际酒店', '夫子庙澜庭酒店', '玄武湖拾光酒店', '河西星澜酒店', '钟山栖悦酒店', '老门东隐庐酒店'],
      images: [IMG.bjCourt, IMG.hz, IMG.shLobby],
      priceFactor: 1.04,
      airport: '禄口T2',
      station: '南京南'
    },
    '重庆': {
      areas: ['解放碑', '洪崖洞', '江北嘴', '南山', '磁器口', '两江新区'],
      names: ['解放碑云际酒店', '洪崖洞澜庭酒店', '江北嘴星澜酒店', '南山拾光酒店', '磁器口栖悦酒店', '两江新区悦庭酒店'],
      images: [IMG.cd, IMG.gzPool, IMG.shRoom],
      priceFactor: 1.02,
      airport: '江北T3',
      station: '重庆北'
    },
    '西安': {
      areas: ['钟楼', '大唐不夜城', '曲江池', '城墙内', '高新区', '华清宫'],
      names: ['钟楼澜庭酒店', '大唐不夜城云际酒店', '曲江池畔拾光酒店', '城墙内隐庐酒店', '高新星澜酒店', '华清宫悦庭度假酒店'],
      images: [IMG.bjCourt, IMG.cd, IMG.bjTower],
      priceFactor: 1.0,
      airport: '咸阳T3',
      station: '西安北'
    },
    '武汉': {
      areas: ['江汉路', '东湖', '黄鹤楼', '光谷', '汉口江滩', '楚河汉街'],
      names: ['江汉路云际酒店', '东湖澜庭酒店', '黄鹤楼拾光酒店', '光谷星澜酒店', '汉口江滩栖悦酒店', '楚河汉街悦庭酒店'],
      images: [IMG.bjTower, IMG.shRoom, IMG.shLobby],
      priceFactor: 0.98,
      airport: '天河T3',
      station: '武汉站'
    },
    '昆明': {
      areas: ['翠湖', '滇池', '南屏街', '西山', '呈贡', '石林'],
      names: ['翠湖云际酒店', '滇池澜庭度假酒店', '南屏街拾光酒店', '西山栖悦酒店', '呈贡星澜酒店', '石林悦庭酒店'],
      images: [IMG.hz, IMG.sanya, IMG.cd],
      priceFactor: 0.96,
      airport: '长水T1',
      station: '昆明南'
    }
  };

  const GENERIC_NAMES = ['云际酒店', '澜庭酒店', '星澜酒店', '栖悦酒店', '拾光酒店', '悦庭酒店'];
  const GENERIC_AREAS = ['市中心', '老城区', '滨江商圈', '高铁站', '会展中心', '风景区'];
  const GENERIC_IMAGES = [IMG.shLobby, IMG.bjCourt, IMG.cd, IMG.hz, IMG.shRoom];
  const TAG_POOL = ['免费取消', '含双早', '近地铁', '高空景观', '亲子友好', '室内泳池', '行政酒廊', '智能客控', '免费停车', '健身房'];
  const AMENITIES = [
    ['wifi', '免费Wi-Fi'],
    ['parking', '停车场'],
    ['pool', '室内泳池'],
    ['gym', '健身房'],
    ['coffee', '咖啡厅'],
    ['car', '接送机']
  ];

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function makeRng(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function round10(n) {
    return Math.round(n / 10) * 10;
  }

  function normalizeCity(name) {
    return String(name || '').replace(/市$/, '').trim();
  }

  function genericProfile(city) {
    const key = normalizeCity(city) || '上海';
    return {
      areas: GENERIC_AREAS.map(function (a) { return key + a; }),
      names: GENERIC_NAMES.map(function (n) { return key + n; }),
      images: GENERIC_IMAGES,
      priceFactor: 0.94,
      airport: key + '机场',
      station: key + '站'
    };
  }

  function pickTags(rnd, star) {
    const tags = ['免费取消'];
    const pool = TAG_POOL.slice(1);
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    const count = star >= 5 ? 4 : 3;
    return tags.concat(pool.slice(0, count));
  }

  function buildRooms(basePrice, rnd) {
    const defs = [
      { name: '高级大床房', bed: '1张1.8米大床', size: '32㎡', breakfast: '含双早', cancel: '免费取消' },
      { name: '豪华城景双床房', bed: '2张1.2米单人床', size: '38㎡', breakfast: '含双早', cancel: '免费取消' },
      { name: '行政景观套房', bed: '1张2米大床', size: '56㎡', breakfast: '含双早', cancel: '入住前1天可免费取消' }
    ];
    return defs.map(function (def, index) {
      return {
        name: def.name,
        bed: def.bed,
        size: def.size,
        breakfast: def.breakfast,
        cancel: def.cancel,
        price: round10(basePrice + [0, 180, 560][index]),
        left: 1 + Math.floor(rnd() * 6)
      };
    });
  }

  function buildHotels(city) {
    const key = normalizeCity(city) || '上海';
    const profile = PROFILES[key] || genericProfile(key);
    return profile.names.map(function (name, index) {
      const rnd = makeRng(hashString(key + '|' + name + '|' + index));
      const star = index === 0 ? 5 : 3 + Math.floor(rnd() * 3);
      const rating = Math.min(4.9, 4.2 + rnd() * 0.7);
      const reviews = 280 + Math.floor(rnd() * 9200);
      const base = round10((300 + rnd() * 620 + star * 70) * profile.priceFactor);
      const original = round10(base * (1.16 + rnd() * 0.3));
      const area = profile.areas[index % profile.areas.length];
      const distances = ['距地铁站 180m', '距市中心 1.2km', '步行可达热门商圈', '距景区入口 400m', '距高铁站 3.6km', '临江景观位'];
      const hotels = {
        id: 'H-' + key + '-' + index,
        city: key,
        name: name,
        star: star,
        rating: Number(rating.toFixed(1)),
        reviewCount: reviews,
        price: base,
        originalPrice: original,
        area: area,
        distance: distances[index % distances.length],
        address: key + ' · ' + area + ' · ' + (10 + index * 8) + '号旅行路',
        image: profile.images[index % profile.images.length],
        images: [profile.images[index % profile.images.length], profile.images[(index + 1) % profile.images.length], profile.images[(index + 2) % profile.images.length]],
        tags: pickTags(rnd, star),
        amenities: AMENITIES.slice(0, 4 + (star >= 5 ? 2 : 0)),
        rooms: buildRooms(base, rnd),
        promo: index === 0 ? '限时立减 120 元' : (index === 1 ? '会员价 9.2 折' : ''),
        sold: 120 + Math.floor(rnd() * 2400)
      };
      return hotels;
    });
  }

  const hotelCache = Object.create(null);

  function getHotels(city) {
    const key = normalizeCity(city) || '上海';
    if (!hotelCache[key]) {
      hotelCache[key] = buildHotels(key);
    }
    return hotelCache[key];
  }

  const featuredCities = ['上海', '北京', '广州', '三亚', '杭州', '成都', '青岛', '厦门', '深圳', '南京', '重庆', '西安'];
  featuredCities.forEach(getHotels);

  function getHotelById(id) {
    const keys = Object.keys(hotelCache);
    for (let i = 0; i < keys.length; i += 1) {
      const found = hotelCache[keys[i]].find(function (h) { return h.id === id; });
      if (found) return found;
    }
    return null;
  }

  function findCity(name) {
    const key = normalizeCity(name);
    return cities.find(function (c) { return c.name === key; }) || null;
  }

  const FLIGHT_CITIES = [
    { code: 'SHA', name: '上海', en: 'Shanghai', region: 'domestic', hot: true, airport: '虹桥国际机场', terminal: 'T2', x: 76, y: 55 },
    { code: 'BJS', name: '北京', en: 'Beijing', region: 'domestic', hot: true, airport: '首都国际机场', terminal: 'T3', x: 66, y: 24 },
    { code: 'CAN', name: '广州', en: 'Guangzhou', region: 'domestic', hot: true, airport: '白云国际机场', terminal: 'T2', x: 61, y: 78 },
    { code: 'SZX', name: '深圳', en: 'Shenzhen', region: 'domestic', hot: true, airport: '宝安国际机场', terminal: 'T3', x: 65, y: 81 },
    { code: 'CTU', name: '成都', en: 'Chengdu', region: 'domestic', hot: true, airport: '天府国际机场', terminal: 'T2', x: 36, y: 56 },
    { code: 'HGH', name: '杭州', en: 'Hangzhou', region: 'domestic', hot: true, airport: '萧山国际机场', terminal: 'T4', x: 73, y: 60 },
    { code: 'SYX', name: '三亚', en: 'Sanya', region: 'domestic', hot: true, airport: '凤凰国际机场', terminal: 'T1', x: 52, y: 93 },
    { code: 'XIY', name: '西安', en: "Xi'an", region: 'domestic', hot: true, airport: '咸阳国际机场', terminal: 'T3', x: 48, y: 42 }
  ];
  const FLIGHT_CITY_MAP = Object.fromEntries(FLIGHT_CITIES.map(function (city) { return [city.name, city]; }));
  const FLIGHT_AIRLINES = [
    { name: '东方航空', code: 'MU', color: '#d93c4b' },
    { name: '中国国航', code: 'CA', color: '#a52b36' },
    { name: '南方航空', code: 'CZ', color: '#2386c8' },
    { name: '吉祥航空', code: 'HO', color: '#a26843' },
    { name: '四川航空', code: '3U', color: '#c93147' }
  ];
  const STATIONS = {
    '上海': '上海虹桥', '北京': '北京南', '广州': '广州南', '深圳': '深圳北', '杭州': '杭州东',
    '南京': '南京南', '成都': '成都东', '重庆': '重庆北', '西安': '西安北', '武汉': '武汉站',
    '长沙': '长沙南', '昆明': '昆明南', '厦门': '厦门北', '青岛': '青岛北', '天津': '天津西',
    '苏州': '苏州北', '无锡': '无锡东', '郑州': '郑州东', '济南': '济南西'
  };

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function addMinutes(time, minutes) {
    const parts = time.split(':').map(Number);
    let total = parts[0] * 60 + parts[1] + minutes;
    const extraDay = Math.floor(total / 1440);
    total %= 1440;
    return { time: pad2(Math.floor(total / 60)) + ':' + pad2(total % 60), extraDay: extraDay };
  }

  function getFlights(from, to, date) {
    const sourceName = normalizeCity(from);
    const targetName = normalizeCity(to);
    if (!sourceName || !targetName || sourceName === targetName) return [];
    const source = FLIGHT_CITY_MAP[sourceName];
    const target = FLIGHT_CITY_MAP[targetName];
    if (!source || !target) return [];
    const dateKey = date || '';
    const seed = hashString(sourceName + '>' + targetName + '|' + dateKey);
    const distance = Math.hypot(source.x - target.x, source.y - target.y);
    const durationMin = Math.max(75, Math.round(distance * 3.2 + 60));
    const departureTimes = [[7, 15], [9, 30], [12, 5], [15, 45], [19, 20]];
    return FLIGHT_AIRLINES.map(function (airline, index) {
      const dep = pad2(departureTimes[index][0]) + ':' + pad2(departureTimes[index][1]);
      const arrival = addMinutes(dep, durationMin);
      const flightNo = airline.code + (1100 + (seed % 6000) + index * 13);
      const departureIso = dateKey ? dateKey + 'T' + dep + ':00+08:00' : '';
      const arrivalIso = departureIso
        ? new Date(Date.parse(departureIso) + durationMin * 60000).toISOString()
        : '';
      const baseFare = 280 + (seed % 220) + index * 81;
      return {
        id: sourceName + '-' + targetName + '-' + dateKey + '-' + index,
        airline: airline.name,
        code: airline.code,
        color: airline.color,
        flightNo: flightNo,
        number: flightNo,
        from: sourceName,
        to: targetName,
        fromAirport: source.airport + ' ' + source.terminal,
        toAirport: target.airport + ' ' + target.terminal,
        fromCity: { code: source.code, name: source.name, airport: source.airport, terminal: source.terminal },
        toCity: { code: target.code, name: target.name, airport: target.airport, terminal: target.terminal },
        date: dateKey,
        dep: dep,
        arr: arrival.time,
        extraDay: arrival.extraDay,
        departure: departureIso,
        arrival: arrivalIso,
        duration: Math.floor(durationMin / 60) + '小时' + pad2(durationMin % 60) + '分',
        durationMin: durationMin,
        aircraft: index % 2 ? '空客 A320' : '波音 737-800',
        cabin: '经济舱',
        onTime: 88 + (hashString(flightNo + dateKey + 'ontime') % 11),
        price: baseFare,
        base: baseFare,
        seats: 12 + index * 6,
        stops: '直飞'
      };
    });
  }

  function getTrains(from, to, date) {
    const source = normalizeCity(from);
    const target = normalizeCity(to);
    if (!source || !target || source === target) return [];
    const rnd = makeRng(hashString('T' + source + '>' + target + '|' + (date || '')));
    const results = [];
    const types = ['G', 'G', 'D', 'G', 'D', 'G'];
    for (let i = 0; i < 6; i += 1) {
      const type = types[i];
      const depHour = 6 + i * 2 + Math.floor(rnd() * 2);
      const depMinute = Math.floor(rnd() * 6) * 10;
      const dep = pad2(Math.min(depHour, 22)) + ':' + pad2(depMinute);
      const durationMin = (type === 'G' ? 210 : 280) + Math.floor(rnd() * 150);
      const arrival = addMinutes(dep, durationMin);
      results.push({
        id: 'T-' + source + '-' + target + '-' + i,
        no: type + (100 + Math.floor(rnd() * 900)),
        type: type === 'G' ? '高铁' : '动车',
        from: STATIONS[source] || source + '站',
        to: STATIONS[target] || target + '站',
        dep: dep,
        arr: arrival.time,
        extraDay: arrival.extraDay,
        duration: Math.floor(durationMin / 60) + '小时' + pad2(durationMin % 60) + '分',
        durationMin: durationMin,
        price: round10(280 + rnd() * 480 + (type === 'G' ? 80 : 0)),
        seats: ['二等座有票', '二等座余 12 张', '一等座有票', '商务座余 3 张'][Math.floor(rnd() * 4)],
        tags: [type === 'G' ? '复兴号' : '和谐号', '可刷证乘车']
      });
    }
    return results;
  }

  const ATTRACTION_NAMES = {
    '上海': ['外滩江景游船', '城市之巅观景台', '老城厢文化漫步', '滨江艺术中心', '亲子探索乐园', '夜色浦江摄影之旅'],
    '北京': ['故宫深度讲解', '长城日出小团', '胡同美食漫步', '皇家园林半日游', '京剧体验课', '亲子科学探索馆'],
    '广州': ['珠江夜游', '广州塔观景', '岭南园林漫步', '早茶文化体验', '亲子动物乐园', '老城骑楼摄影'],
    '三亚': ['蜈支洲岛一日游', '热带雨林徒步', '帆船出海体验', '海岛日落巡游', '亲子沙滩营', '海鲜市场美食课'],
    '杭州': ['西湖游船', '灵隐寺半日游', '龙井茶山徒步', '古镇水乡一日游', '运河夜游', '手作团扇体验'],
    '成都': ['熊猫基地半日游', '都江堰水利之旅', '川剧变脸体验', '宽窄巷子美食课', '青城山徒步', '蜀锦手作工坊'],
    '青岛': ['崂山观海徒步', '栈桥日落漫步', '老城建筑摄影', '帆船出海体验', '啤酒博物馆之旅', '海岛一日游'],
    '厦门': ['鼓浪屿漫步', '环岛路骑行', '帆船出海体验', '闽南美食课', '植物园探索', '老别墅摄影之旅']
  };
  const GENERIC_ATTRACTIONS = ['城市观光巴士', '特色美食之旅', '文化博物馆', '夜景游船', '近郊自然徒步', '亲子探索乐园'];
  const ATTRACTION_GRADIENTS = [
    'linear-gradient(135deg, #1d8cf8 0%, #1046a5 100%)',
    'linear-gradient(135deg, #f6a13b 0%, #e2552b 100%)',
    'linear-gradient(135deg, #17b890 0%, #0b6e5a 100%)',
    'linear-gradient(135deg, #7a63f1 0%, #3d2b9e 100%)',
    'linear-gradient(135deg, #ef5b8c 0%, #a41d4d 100%)',
    'linear-gradient(135deg, #0f9bb3 0%, #075a74 100%)'
  ];
  const ATTRACTION_ICONS = ['boat', 'peak', 'camera', 'temple', 'food', 'park'];

  function getAttractions(city) {
    const key = normalizeCity(city) || '上海';
    const names = ATTRACTION_NAMES[key] || GENERIC_ATTRACTIONS.map(function (n) { return key + n; });
    const rnd = makeRng(hashString('A' + key));
    return names.map(function (name, index) {
      return {
        id: 'A-' + key + '-' + index,
        city: key,
        name: name,
        subtitle: ['当地必玩', '亲子友好', '深度体验', '日落限定', '人气精选', '小众玩法'][index % 6],
        rating: Number((4.5 + rnd() * 0.4).toFixed(1)),
        sold: 300 + Math.floor(rnd() * 8600),
        price: round10(58 + rnd() * 320),
        duration: ['约2小时', '约3小时', '半日', '约1.5小时', '一日', '约4小时'][index % 6],
        tags: [['可订今日', '免排队'], ['含讲解', '小团'], ['亲子', '含装备'], ['日落', '摄影'], ['美食', '文化'], ['自然', '徒步']][index % 6],
        gradient: ATTRACTION_GRADIENTS[index % ATTRACTION_GRADIENTS.length],
        icon: ATTRACTION_ICONS[index % ATTRACTION_ICONS.length],
        image: index === 4 ? IMG.park : ''
      };
    });
  }

  const recommendCities = ['上海', '北京', '广州', '三亚', '杭州', '成都', '青岛', '厦门', '重庆', '西安', '南京', '深圳'];

  const destinations = [
    {
      city: '青岛',
      kicker: '目的地灵感',
      title: '青岛必住酒店攻略',
      subtitle: '红瓦绿树 · 碧海蓝天',
      image: IMG.hero,
      hotels: getHotels('青岛').slice(0, 3).map(function (h) {
        return { id: h.id, name: h.name, price: h.price, image: h.image };
      })
    },
    {
      city: '三亚',
      kicker: '海岛度假',
      title: '三亚湾畔度假指南',
      subtitle: '椰林海风 · 慢享假日',
      image: IMG.sanya,
      hotels: getHotels('三亚').slice(0, 3).map(function (h) {
        return { id: h.id, name: h.name, price: h.price, image: h.image };
      })
    },
    {
      city: '杭州',
      kicker: '湖畔美宿',
      title: '杭州西湖边住哪里',
      subtitle: '一半山水 · 一半烟火',
      image: IMG.hz,
      hotels: getHotels('杭州').slice(0, 3).map(function (h) {
        return { id: h.id, name: h.name, price: h.price, image: h.image };
      })
    }
  ];

  function searchHotels(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    const all = [];
    Object.keys(hotelCache).forEach(function (key) {
      hotelCache[key].forEach(function (hotel) { all.push(hotel); });
    });
    return all.filter(function (hotel) {
      return hotel.name.toLowerCase().includes(q) || hotel.city.toLowerCase().includes(q) || hotel.area.toLowerCase().includes(q);
    }).slice(0, 8);
  }

  export const TRAVEL_DATA = {
    IMG: IMG,
    cities: cities,
    flightCities: FLIGHT_CITIES,
    flightAirlines: FLIGHT_AIRLINES,
    getHotels: getHotels,
    getHotelById: getHotelById,
    findCity: findCity,
    findFlightCity: function (city) { return FLIGHT_CITY_MAP[normalizeCity(city)] || null; },
    normalizeCity: normalizeCity,
    getFlights: getFlights,
    getTrains: getTrains,
    getAttractions: getAttractions,
    searchHotels: searchHotels,
    recommendCities: recommendCities,
    destinations: destinations,
    airportFor: function (city) {
      const flightCity = FLIGHT_CITY_MAP[normalizeCity(city)];
      return flightCity ? flightCity.airport + ' ' + flightCity.terminal : normalizeCity(city) + '机场';
    },
    stationFor: function (city) { return STATIONS[normalizeCity(city)] || normalizeCity(city) + '站'; }
  };
