import { TRAVEL_DATA as DATA } from './data.js';
import { api } from './api.js';

(function () {
  'use strict';

  const $ = function (selector, root) { return (root || document).querySelector(selector); };
  const $$ = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };

  const STORAGE = {
    user: 'octrip.user.v1',
    orders: 'octrip.orders.v1',
    favorites: 'octrip.favorites.v1'
  };

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* Storage can be unavailable for file:// or private browsing; the demo still works in-memory. */
    }
  }

  function pad(value) { return value < 10 ? '0' + value : String(value); }

  function startOfDay(date) {
    const copy = new Date(date.getTime());
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  const TODAY = startOfDay(new Date());

  function addDays(date, count) {
    const copy = startOfDay(date);
    copy.setDate(copy.getDate() + count);
    return copy;
  }

  function firstOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }

  function addMonths(date, count) { return new Date(date.getFullYear(), date.getMonth() + count, 1); }

  function diffDays(from, to) {
    const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((b - a) / 86400000);
  }

  function dateKey(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function parseDateKey(key) {
    const parts = key.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatMD(date) { return (date.getMonth() + 1) + '月' + date.getDate() + '日'; }

  function formatFull(date) {
    return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
  }

  function weekdayName(date) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  }

  function relativeDay(date) {
    const offset = diffDays(TODAY, date);
    if (offset === 0) return '今天';
    if (offset === 1) return '明天';
    if (offset === 2) return '后天';
    return weekdayName(date);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function money(value) { return Number(value || 0).toLocaleString('zh-CN'); }

  function svgIcon(name, className) {
    return '<svg' + (className ? ' class="' + className + '"' : '') + ' aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  const storedFavorites = readStore(STORAGE.favorites, []);
  const storedOrders = readStore(STORAGE.orders, []);
  const storedUser = readStore(STORAGE.user, null);

  const state = {
    mode: 'flight',
    homeVisible: true,
    apiOnline: false,
    apiHealth: null,
    searchSeq: 0,
    recommendation: null,
    priceContext: null,
    orderFilter: 'all',
    ordersScope: 'mine',
    ordersLoading: false,
    pendingAuthAction: null,
    authRole: 'traveler',
    selectedSeat: null,
    currentOrder: null,
    search: {
      city: '上海',
      checkin: TODAY,
      checkout: addDays(TODAY, 1),
      rooms: 1,
      adults: 1,
      children: 0,
      level: '不限',
      keyword: ''
    },
    flight: {
      from: '上海',
      to: '北京',
      date: addDays(TODAY, 1),
      cabin: '经济舱',
      passengers: 1,
      trip: 'oneway'
    },
    train: {
      from: '上海',
      to: '北京',
      date: addDays(TODAY, 1),
      type: 'all',
      passengers: 1
    },
    ticket: {
      city: '上海',
      date: addDays(TODAY, 1),
      keyword: ''
    },
    filters: {
      price: 'all',
      star: 'all',
      tags: new Set(),
      sort: 'recommended'
    },
    resultType: 'flight',
    resultParams: null,
    resultData: [],
    recommendCity: '上海',
    recommendPage: 0,
    destinationIndex: 0,
    destinationPaused: false,
    modalOpen: false,
    bookingDraft: null,
    ticketContext: null,
    plannerResult: null,
    authTimer: null,
    favorites: new Set(Array.isArray(storedFavorites) ? storedFavorites : []),
    orders: Array.isArray(storedOrders) ? storedOrders : [],
    user: storedUser && typeof storedUser === 'object' && storedUser.phone ? storedUser : null,
    calendar: null,
    lastFocused: null
  };

  const MODE_CONFIG = {
    hotel: {
      title: '预订酒店',
      eyebrow: '安心订 · 放心住',
      subtitle: '目的地、日期选定后即可搜索本地模拟房源'
    },
    flight: {
      title: '预订机票',
      eyebrow: '智能推荐 · 动态票价',
      subtitle: '选择出发与到达城市，获取动态报价与智能航班推荐'
    },
    train: {
      title: '预订火车票',
      eyebrow: '高铁出行 · 说走就走',
      subtitle: '选择出发与到达城市，查询本地模拟车次'
    },
    ticket: {
      title: '预订门票·活动',
      eyebrow: '玩乐体验 · 即刻出发',
      subtitle: '按城市与关键词查找本地模拟玩乐项目'
    }
  };

  const SORT_OPTIONS = {
    hotel: [
      { value: 'recommended', label: '推荐排序' },
      { value: 'priceAsc', label: '价格从低到高' },
      { value: 'priceDesc', label: '价格从高到低' },
      { value: 'rating', label: '评分优先' }
    ],
    flight: [
      { value: 'recommended', label: '智能推荐' },
      { value: 'priceAsc', label: '价格优先' },
      { value: 'departure', label: '起飞时间' },
      { value: 'duration', label: '耗时最短' }
    ],
    train: [
      { value: 'departure', label: '出发时间' },
      { value: 'priceAsc', label: '价格优先' },
      { value: 'duration', label: '耗时最短' }
    ],
    ticket: [
      { value: 'popular', label: '人气优先' },
      { value: 'priceAsc', label: '价格从低到高' },
      { value: 'rating', label: '评分优先' }
    ]
  };

  function defaultFilters(type) {
    const sort = {
      hotel: 'recommended',
      flight: 'recommended',
      train: 'departure',
      ticket: 'popular'
    }[type] || 'recommended';
    return { price: 'all', star: 'all', tags: new Set(), sort: sort };
  }

  function ratingWord(rating) {
    if (rating >= 4.7) return '超棒';
    if (rating >= 4.4) return '很好';
    return '不错';
  }

  function starsHtml(star) {
    let out = '';
    for (let i = 0; i < star; i += 1) out += svgIcon('star');
    return '<span class="hotel-stars" aria-label="' + star + '星">' + out + '</span>';
  }

  function maskPhone(phone) {
    return String(phone).replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
  }

  /* ------------------------------------------------------------------ */
  /* Initial rendering                                                   */
  /* ------------------------------------------------------------------ */

  function syncInitialInputs() {
    $('#hotelCityInput').value = state.search.city;
    $('#hotelKeyword').value = state.search.keyword;
    $('#flightFromInput').value = state.flight.from;
    $('#flightToInput').value = state.flight.to;
    $('#flightCabin').value = state.flight.cabin;
    $('#flightPassengers').value = String(state.flight.passengers);
    $('#trainFromInput').value = state.train.from;
    $('#trainToInput').value = state.train.to;
    $('#trainType').value = state.train.type;
    $('#trainPassengers').value = String(state.train.passengers);
    $('#ticketCityInput').value = state.ticket.city;
    $('#ticketKeyword').value = state.ticket.keyword;
    const activeTrip = $('#tripTabs .trip-tab[data-trip="' + state.flight.trip + '"]');
    if (activeTrip) {
      $$('#tripTabs .trip-tab').forEach(function (tab) { tab.classList.remove('is-active'); });
      activeTrip.classList.add('is-active');
    }
  }

  function updateAllDateUi() {
    if (diffDays(state.search.checkin, state.search.checkout) < 1) {
      state.search.checkout = addDays(state.search.checkin, 1);
    }
    const nights = diffDays(state.search.checkin, state.search.checkout);
    $('#checkinLabel').textContent = formatMD(state.search.checkin);
    $('#checkinSub').textContent = relativeDay(state.search.checkin);
    $('#checkoutLabel').textContent = formatMD(state.search.checkout);
    $('#checkoutSub').textContent = relativeDay(state.search.checkout);
    $('#nightBadge').textContent = nights + '晚';
    $('#hotelDateField').setAttribute('aria-label', '入住 ' + formatFull(state.search.checkin) + '，退房 ' + formatFull(state.search.checkout));

    $('#flightDateLabel').textContent = formatMD(state.flight.date);
    $('#flightDateSub').textContent = relativeDay(state.flight.date);
    $('#trainDateLabel').textContent = formatMD(state.train.date);
    $('#trainDateSub').textContent = relativeDay(state.train.date);
    $('#ticketDateLabel').textContent = formatMD(state.ticket.date);
    $('#ticketDateSub').textContent = relativeDay(state.ticket.date);
  }

  function syncGuestUi() {
    const guests = state.search.adults + state.search.children;
    $('#guestSummary').textContent = state.search.rooms + '间, ' + guests + '位';
    $('#roomsCount').textContent = state.search.rooms;
    $('#adultsCount').textContent = state.search.adults;
    $('#childrenCount').textContent = state.search.children;
    const limits = { rooms: [1, 5], adults: [1, 10], children: [0, 6] };
    $$('#guestPopover [data-counter]').forEach(function (button) {
      const key = button.getAttribute('data-counter');
      const delta = Number(button.getAttribute('data-delta'));
      const range = limits[key];
      button.disabled = delta < 0 ? state.search[key] <= range[0] : state.search[key] >= range[1];
    });
  }

  function syncLevelUi() {
    $('#levelSummary').textContent = state.search.level;
    $$('#levelPopover [data-level]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-level') === state.search.level);
    });
  }

  function renderCityTabs() {
    const primary = DATA.recommendCities.slice(0, 4);
    if (primary.indexOf(state.recommendCity) === -1) primary.push(state.recommendCity);
    $('#cityTabs').innerHTML = primary.map(function (city) {
      return '<button type="button" class="city-tab' + (city === state.recommendCity ? ' is-active' : '') + '" data-city-name="' + esc(city) + '">' + esc(city) + '</button>';
    }).join('');
    $('#moreCitiesPanel').innerHTML = DATA.recommendCities.map(function (city) {
      return '<button type="button" data-city-name="' + esc(city) + '">' + esc(city) + '</button>';
    }).join('');
  }

  function hotelCardHtml(hotel, index) {
    const favorite = state.favorites.has(hotel.id);
    const badge = index === 0 ? '<span class="ad-pill">广告</span>' : (hotel.promo ? '<span class="ad-pill">' + esc(hotel.promo) + '</span>' : '');
    return '' +
      '<article class="hotel-card" data-hotel-id="' + esc(hotel.id) + '" tabindex="0" role="button" aria-label="查看 ' + esc(hotel.name) + ' 详情">' +
        '<div class="hotel-card-media">' +
          '<img src="' + esc(hotel.image) + '" alt="' + esc(hotel.name) + '" loading="lazy">' +
          '<button class="favorite-btn' + (favorite ? ' is-fav' : '') + '" type="button" data-fav="' + esc(hotel.id) + '" aria-label="收藏 ' + esc(hotel.name) + '" aria-pressed="' + favorite + '">' + svgIcon('heart') + '</button>' +
          badge +
        '</div>' +
        '<div class="hotel-card-body">' +
          '<div class="hotel-card-title">' + esc(hotel.name) + '</div>' +
          '<div class="hotel-card-location">' + esc(hotel.area) + ' · ' + esc(hotel.distance) + '</div>' +
          '<div class="hotel-card-scoreline"><span class="score-badge">' + hotel.rating.toFixed(1) + '</span><span class="score-word">' + ratingWord(hotel.rating) + '</span><span>' + money(hotel.reviewCount) + '条点评</span></div>' +
          '<div class="hotel-card-tags">' + hotel.tags.slice(0, 3).map(function (tag) { return '<span class="mini-tag">' + esc(tag) + '</span>'; }).join('') + '</div>' +
          '<div class="hotel-card-footer">' +
            '<div class="hotel-card-price"><strong><em>¥</em>' + money(hotel.price) + '</strong><span>¥' + money(hotel.originalPrice) + '</span></div>' +
            '<div class="hotel-card-sold">' + money(hotel.sold) + '人已订</div>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function renderRecommendCards() {
    const hotels = DATA.getHotels(state.recommendCity);
    if (state.recommendPage >= hotels.length) state.recommendPage = 0;
    const visible = hotels.slice(state.recommendPage, state.recommendPage + 3);
    $('#recommendCards').innerHTML = visible.map(hotelCardHtml).join('');
  }

  function renderDestination(animate) {
    const slides = DATA.destinations;
    const slide = slides[state.destinationIndex % slides.length];
    const card = $('#destinationCard');
    if (animate !== false) {
      card.classList.add('is-switching');
      window.setTimeout(function () { card.classList.remove('is-switching'); }, 260);
    }
    $('#destinationImage').src = slide.image;
    $('#destinationImage').alt = slide.city + '目的地风光';
    $('#destinationKicker').textContent = slide.kicker;
    $('#destinationTitle').textContent = slide.title;
    $('#destinationSubtitle').textContent = slide.subtitle;
    $('#destinationDots').innerHTML = slides.map(function (item, index) {
      return '<button type="button" class="' + (index === state.destinationIndex ? 'is-active' : '') + '" data-dest-index="' + index + '" aria-label="切换到' + esc(item.city) + '"></button>';
    }).join('');
    $('#miniHotelList').innerHTML = slide.hotels.map(function (hotel) {
      return '<button type="button" class="mini-hotel" data-hotel-id="' + esc(hotel.id) + '">' +
        '<img src="' + esc(hotel.image) + '" alt="' + esc(hotel.name) + '" loading="lazy">' +
        '<span class="mini-hotel-copy"><strong>' + esc(hotel.name) + '</strong><span>¥' + money(hotel.price) + '起</span></span>' +
      '</button>';
    }).join('');
  }

  function startDestinationRotation() {
    const card = $('#destinationCard');
    card.addEventListener('mouseenter', function () { state.destinationPaused = true; });
    card.addEventListener('mouseleave', function () { state.destinationPaused = false; });
    window.setInterval(function () {
      if (!state.homeVisible || state.modalOpen || state.destinationPaused) return;
      state.destinationIndex = (state.destinationIndex + 1) % DATA.destinations.length;
      renderDestination(true);
    }, 7000);
  }

  function renderOrdersPreview() {
    if (!state.orders.length) {
      const message = state.apiOnline && !state.user
        ? '登录后查看后端订单；本地模拟模式也可直接预订。'
        : (state.ordersLoading ? '正在读取订单…' : '还没有订单，搜索并预订后会显示在这里。');
      $('#ordersPreview').innerHTML = '<div class="order-preview-empty">' + message + '</div>';
      return;
    }
    $('#ordersPreview').innerHTML = state.orders.slice(0, 3).map(function (order) {
      return '<div class="order-preview-row">' +
        '<strong>' + esc(order.title) + '</strong>' +
        '<span>' + esc(order.dateLabel || '') + ' · ' + esc(order.statusLabel || order.status) + '</span>' +
      '</div>';
    }).join('');
  }

  function updateAuthUi() {
    if (state.user) {
      const roleLabel = state.user.role === 'agency' ? '旅行社' : '';
      $('#loginTrigger').textContent = roleLabel ? roleLabel + ' · ' + maskPhone(state.user.phone) : maskPhone(state.user.phone);
      $('#loginTrigger').title = roleLabel ? '旅行社账户' : '旅客账户';
      $('#registerTrigger').hidden = true;
    } else {
      $('#loginTrigger').textContent = '登录';
      $('#loginTrigger').title = '登录本地演示账户';
      $('#registerTrigger').hidden = false;
    }
  }

  function setApiStatus(kind, text, title) {
    const status = $('#apiStatus');
    if (!status) return;
    status.className = 'api-status is-' + kind;
    status.innerHTML = '<i></i><span>' + esc(text) + '</span>';
    status.title = title || text;
  }

  async function bootstrapApi() {
    try {
      const health = await api.health();
      state.apiOnline = true;
      state.apiHealth = health;
      setApiStatus('online', 'API 已连接', `本地 API 已连接 · ${health.counts ? health.counts.orders : 0} 个订单`);
      if (api.hasToken()) {
        try {
          const me = await api.me();
          state.user = me.user;
          updateAuthUi();
          await refreshOrders({ silent: true });
        } catch (error) {
          api.setToken('');
          state.user = null;
          state.orders = [];
          updateAuthUi();
          renderOrdersPreview();
          if (error.status !== 401) toast('登录态恢复失败：' + error.message);
        }
      } else {
        // The API is authoritative in platform mode; ignore the legacy local demo account.
        state.user = null;
        state.orders = [];
        updateAuthUi();
        renderOrdersPreview();
      }
    } catch (error) {
      state.apiOnline = false;
      setApiStatus('offline', '本地模式', '后端未启动，已切换到本地模拟数据');
      renderOrdersPreview();
    }
  }

  async function refreshOrders(options) {
    const opts = options || {};
    if (!state.apiOnline || !api.hasToken()) {
      if (!opts.silent) renderOrdersPreview();
      return false;
    }
    state.ordersLoading = true;
    if (!opts.silent) renderOrdersPreview();
    try {
      const scope = state.user && state.user.role === 'agency' ? 'all' : 'mine';
      const result = await api.listOrders(scope);
      state.orders = result.orders || [];
      state.ordersScope = result.scope || scope;
      state.ordersLoading = false;
      renderOrdersPreview();
      if (!$('#ordersView').hidden) renderOrdersPage();
      return true;
    } catch (error) {
      state.ordersLoading = false;
      if (error.status === 401) {
        api.setToken('');
        state.user = null;
        state.orders = [];
        updateAuthUi();
        renderOrdersPreview();
      }
      if (!opts.silent) toast(error.message);
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Mode switching and navigation                                       */
  /* ------------------------------------------------------------------ */

  function setMode(mode, options) {
    if (!MODE_CONFIG[mode]) return;
    const opts = options || {};
    state.mode = mode;
    if (!state.homeVisible && !opts.keepResults) {
      showHome(false);
    }
    ['hotel', 'flight', 'train', 'ticket'].forEach(function (name) {
      const form = document.getElementById(name + 'Form');
      if (!form) return;
      form.hidden = name !== mode;
      form.classList.toggle('is-visible', name === mode);
    });
    const config = MODE_CONFIG[mode];
    $('#searchTitle').textContent = config.title;
    $('#searchEyebrow').textContent = config.eyebrow;
    $('#searchSubtitle').textContent = config.subtitle;
    $$('.side-item[data-service]').forEach(function (item) {
      item.classList.toggle('is-active', item.getAttribute('data-service') === mode);
    });
    if (opts.scroll) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      $('#searchCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function showHome(scroll) {
    $('#resultsView').hidden = true;
    $('#ordersView').hidden = true;
    $('#homeView').hidden = false;
    state.homeVisible = true;
    if (scroll !== false) window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function showResultsView() {
    $('#homeView').hidden = true;
    $('#ordersView').hidden = true;
    $('#resultsView').hidden = false;
    state.homeVisible = false;
    const results = $('#resultsView');
    results.classList.remove('view-enter');
    void results.offsetWidth;
    results.classList.add('view-enter');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function showOrdersView() {
    $('#homeView').hidden = true;
    $('#resultsView').hidden = true;
    $('#ordersView').hidden = false;
    state.homeVisible = false;
    const view = $('#ordersView');
    view.classList.remove('view-enter');
    void view.offsetWidth;
    view.classList.add('view-enter');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  async function openOrdersPage() {
    if (state.apiOnline && !state.user) {
      state.pendingAuthAction = function () { openOrdersPage(); };
      openAuth('login', { reason: '登录后查看您的订单' });
      return;
    }
    showOrdersView();
    renderOrdersPage();
    if (state.apiOnline && state.user) await refreshOrders({ silent: true });
    else renderOrdersPage();
  }

  function orderStatusClass(status) {
    return {
      PENDING_PAYMENT: 'pending',
      PAID: 'paid',
      CHECKED_IN: 'checked',
      CANCELLED: 'cancelled',
      EXPIRED: 'cancelled',
      COMPLETED: 'checked'
    }[status] || 'local';
  }

  function findOrderById(id) {
    return state.orders.find(function (order) { return order.id === id; }) || null;
  }

  function orderTypeIcon(order) {
    if (order.type === 'flight') return svgIcon('plane');
    if (order.type === 'hotel') return svgIcon('bed');
    return svgIcon('ticket');
  }

  function orderActionButtons(order) {
    const actions = [];
    const status = order.status;
    actions.push('<button class="secondary-button small" type="button" data-order-detail="' + esc(order.id) + '">查看详情</button>');
    if (status === 'PENDING_PAYMENT') {
      actions.push('<button class="primary-button small" type="button" data-order-pay="' + esc(order.id) + '">去支付</button>');
      actions.push('<button class="danger-button" type="button" data-order-cancel="' + esc(order.id) + '">取消订单</button>');
    } else if (status === 'PAID') {
      if (order.type === 'flight') {
        actions.push('<button class="primary-button small" type="button" data-order-checkin="' + esc(order.id) + '">在线值机</button>');
      }
      actions.push('<button class="danger-button" type="button" data-order-cancel="' + esc(order.id) + '">取消订单</button>');
    } else if (status === 'CHECKED_IN') {
      actions.push('<button class="primary-button small" type="button" data-order-boarding="' + esc(order.id) + '">查看登机牌</button>');
    }
    return actions.join('');
  }

  function orderCardHtml(order) {
    const statusLabel = order.statusLabel || order.status;
    const contact = order.contact ? order.contact.name + ' ' + maskPhone(order.contact.phone) : '';
    return '<article class="order-page-card" data-order-id="' + esc(order.id) + '">' +
      '<div class="order-page-head">' +
        '<span class="order-type-icon is-' + esc(order.type) + '">' + orderTypeIcon(order) + '</span>' +
        '<div class="order-page-title"><strong>' + esc(order.title) + '</strong><span>' + esc(order.kindLabel || order.typeLabel || '订单') + ' · ' + esc(order.dateLabel || '') + '</span></div>' +
        '<span class="order-status-pill is-' + orderStatusClass(order.status) + '">' + esc(statusLabel) + '</span>' +
      '</div>' +
      '<div class="order-page-body">' +
        '<div class="order-page-facts">' +
          '<span><b>订单号</b>' + esc(order.id) + '</span>' +
          '<span><b>人数/房间</b>' + esc(order.guestLabel || '') + '</span>' +
          (contact ? '<span><b>联系人</b>' + esc(contact) + '</span>' : '') +
          (order.payment ? '<span><b>支付方式</b>' + esc(order.payment.methodLabel || order.payment.method) + '</span>' : '') +
          (order.checkin ? '<span><b>座位</b>' + esc(order.checkin.seat) + ' · ' + esc(order.checkin.gate) + ' 登机口</span>' : '') +
        '</div>' +
        '<div class="order-page-total"><span>订单合计</span><strong><em>¥</em>' + money(order.total) + '</strong></div>' +
      '</div>' +
      '<div class="order-page-foot"><span>创建于 ' + esc(formatDateTime(order.createdAt)) + '</span><div class="order-page-actions">' + orderActionButtons(order) + '</div></div>' +
    '</article>';
  }

  function renderOrdersPage() {
    if (!state.apiOnline && !state.user && !state.orders.length) {
      $('#ordersMeta').textContent = '本地模拟模式：登录或直接预订后即可查看订单';
    } else {
      $('#ordersMeta').textContent = state.apiOnline
        ? (state.user && state.user.role === 'agency' ? '旅行社视角：可查看全部旅客订单' : '订单保存在本地后端，状态变化可追踪')
        : '后端未启动，当前显示浏览器本地的演示订单';
    }
    $('#agencyScopeBadge').hidden = !(state.apiOnline && state.user && state.user.role === 'agency');
    $$('#orderStatusTabs [data-order-tab]').forEach(function (tab) {
      tab.classList.toggle('is-active', tab.getAttribute('data-order-tab') === state.orderFilter);
    });
    if (state.apiOnline && !state.user) {
      $('#ordersPageList').innerHTML = '<div class="orders-login-prompt">' + svgIcon('user') +
        '<h3>登录后管理订单</h3><p>本平台使用手机号 + 验证码登录。演示验证码固定为 888888，可注册旅客或旅行社角色。</p>' +
        '<button class="primary-button" type="button" data-orders-login>立即登录</button>' +
        '<p class="demo-note">所有账户与订单只保存在本机后端数据文件中。</p></div>';
      return;
    }
    if (state.ordersLoading && !state.orders.length) {
      $('#ordersPageList').innerHTML = '<div class="orders-loading"><span class="spinner"></span>正在读取订单…</div>';
      return;
    }
    const filtered = state.orders.filter(function (order) {
      return state.orderFilter === 'all' || order.status === state.orderFilter;
    });
    if (!filtered.length) {
      $('#ordersPageList').innerHTML = '<div class="empty-state">' + svgIcon('briefcase') + '<h3>暂无匹配订单</h3><p>完成一次机票、酒店或门票预订后，订单会出现在这里。</p><button class="secondary-button" type="button" data-orders-home>去首页预订</button></div>';
      return;
    }
    $('#ordersPageList').innerHTML = filtered.map(orderCardHtml).join('');
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('zh-CN', { hour12: false });
  }

  function openOrderDetail(order) {
    if (!order) return;
    state.currentOrder = order;
    const history = Array.isArray(order.history) ? order.history : [];
    const statusLabel = order.statusLabel || order.status;
    const payment = order.payment;
    const checkin = order.checkin;
    const html = '<div id="orderDetailRoot">' +
      '<div class="modal-head"><h2 id="modalTitle">订单详情</h2><p>' + esc(order.id) + ' · ' + esc(order.kindLabel || '订单') + '</p></div>' +
      '<div class="modal-body">' +
        '<div class="order-detail-banner"><div><strong>' + esc(order.title) + '</strong><span>' + esc(order.subtitle || '') + '</span></div><span class="order-status-pill is-' + orderStatusClass(order.status) + '">' + esc(statusLabel) + '</span></div>' +
        '<div class="order-detail-grid">' +
          '<div><span>出行日期</span><strong>' + esc(order.dateLabel || '—') + '</strong></div>' +
          '<div><span>人数/房间</span><strong>' + esc(order.guestLabel || '—') + '</strong></div>' +
          '<div><span>联系人</span><strong>' + esc(order.contact ? order.contact.name : '—') + '</strong></div>' +
          '<div><span>手机号</span><strong>' + esc(order.contact ? maskPhone(order.contact.phone) : '—') + '</strong></div>' +
          '<div><span>订单金额</span><strong class="blue">¥' + money(order.total) + '</strong></div>' +
          '<div><span>创建时间</span><strong>' + esc(formatDateTime(order.createdAt)) + '</strong></div>' +
          (payment ? '<div><span>支付方式</span><strong>' + esc(payment.methodLabel || payment.method) + '</strong></div>' : '') +
          (payment ? '<div><span>支付流水</span><strong class="mono">' + esc(payment.transactionId) + '</strong></div>' : '') +
          (checkin ? '<div><span>值机座位</span><strong>' + esc(checkin.seat) + ' · ' + esc(checkin.gate) + '</strong></div>' : '') +
          (checkin ? '<div><span>登机牌编号</span><strong class="mono">' + esc(checkin.boardingPassCode) + '</strong></div>' : '') +
        '</div>' +
        '<div class="modal-section"><h3>状态历史</h3><div class="order-history">' +
          history.map(function (entry) {
            return '<div class="order-history-row"><span class="state-dot ' + orderStatusClass(entry.status) + '"></span><strong>' + esc(entry.statusLabel || entry.status) + '</strong><span>' + esc(formatDateTime(entry.at)) + '</span><p>' + esc(entry.reason || '') + '</p></div>';
          }).join('') +
        '</div></div>' +
        (order.contact && order.contact.note ? '<p class="demo-note">备注：' + esc(order.contact.note) + '</p>' : '') +
        '<div class="modal-footer" style="padding-left:0;padding-right:0;padding-bottom:0"><div class="order-page-actions">' + orderActionButtons(order) + '</div></div>' +
      '</div>' +
    '</div>';
    openModal(html);
  }

  function upsertOrder(order) {
    const index = state.orders.findIndex(function (item) { return item.id === order.id; });
    if (index === -1) state.orders.unshift(order);
    else state.orders[index] = order;
    if (!$('#ordersView').hidden) renderOrdersPage();
    renderOrdersPreview();
  }

  function closeMobileNav() {
    $('#sideNav').classList.remove('is-open');
    $('#navScrim').hidden = true;
    document.body.classList.remove('nav-open');
  }

  function openMobileNav() {
    $('#sideNav').classList.add('is-open');
    $('#navScrim').hidden = false;
    document.body.classList.add('nav-open');
  }

  function handleSideScroll(target) {
    if (!state.homeVisible) showHome(false);
    closeMobileNav();
    window.setTimeout(function () {
      const element = target === 'footer' ? $('#siteFooter') : $('#recommendSection');
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  }

  function handleSideAction(action) {
    closeMobileNav();
    if (action === 'ai') { openPlannerModal(); return; }
    if (action === 'map') { openMapModal(state.search.city); return; }
    if (action === 'business') { openBusinessModal(); return; }
    toast('该服务为本地演示占位，请体验酒店、机票、火车票与门票流程。');
  }

  function switchService(service) {
    if (service === 'car' || service === 'taxi') {
      toast('汽车·船票与用车服务为占位演示，暂未接入模拟数据。');
      return;
    }
    if (!MODE_CONFIG[service]) return;
    setMode(service, { scroll: true });
    closeMobileNav();
  }

  /* ------------------------------------------------------------------ */
  /* Search                                                              */
  /* ------------------------------------------------------------------ */

  function resolveDestination(raw) {
    const value = String(raw || '').trim();
    const normalized = DATA.normalizeCity(value);
    if (!value) return { city: '上海', extra: '' };
    const exact = DATA.cities.find(function (city) {
      return city.name === value || city.name === normalized;
    });
    if (exact) return { city: exact.name, extra: '' };
    const hotelMatches = DATA.searchHotels(value);
    if (hotelMatches.length) return { city: hotelMatches[0].city, extra: value };
    const contained = DATA.cities.find(function (city) {
      return value.indexOf(city.name) !== -1 || city.name.indexOf(value) !== -1;
    });
    if (contained) return { city: contained.name, extra: value.split(contained.name).join(' ').trim() };
    return { city: normalized || '上海', extra: '' };
  }

  function showResultsLoading(title, meta, message) {
    showResultsView();
    $('#resultsTitle').textContent = title;
    $('#resultsMeta').textContent = meta || '';
    $('#summaryCard').innerHTML = '';
    $('#resultsCount').textContent = '';
    $('#resultList').innerHTML = '<div class="orders-loading"><span class="spinner"></span>' + esc(message || '正在加载…') + '</div>';
  }

  async function performHotelSearch() {
    const raw = $('#hotelCityInput').value.trim();
    if (!raw) {
      toast('请先填写目的地或酒店名称');
      $('#hotelCityInput').focus();
      return;
    }
    const resolved = resolveDestination(raw);
    const extraKeyword = [resolved.extra, $('#hotelKeyword').value.trim()].filter(Boolean).join(' ').trim();
    state.search.city = resolved.city;
    state.search.keyword = extraKeyword;
    $('#hotelCityInput').value = resolved.city;
    $('#hotelKeyword').value = extraKeyword;
    if (diffDays(state.search.checkin, state.search.checkout) < 1) {
      state.search.checkout = addDays(state.search.checkin, 1);
      updateAllDateUi();
    }
    state.resultType = 'hotel';
    state.resultParams = {
      city: state.search.city,
      checkin: state.search.checkin,
      checkout: state.search.checkout,
      rooms: state.search.rooms,
      adults: state.search.adults,
      children: state.search.children,
      level: state.search.level,
      keyword: state.search.keyword
    };
    state.filters = defaultFilters('hotel');
    state.resultData = [];
    const seq = ++state.searchSeq;
    setMode('hotel', { keepResults: true });
    showResultsLoading(state.search.city + '酒店', '正在读取本地库存…', '正在搜索酒店…');
    closeMobileNav();
    try {
      if (state.apiOnline) {
        const result = await api.searchHotels({
          city: state.search.city,
          checkin: dateKey(state.search.checkin),
          checkout: dateKey(state.search.checkout),
          keyword: state.search.keyword,
          level: state.search.level
        });
        if (seq !== state.searchSeq) return;
        state.resultData = result.results || [];
      } else {
        state.resultData = DATA.getHotels(state.search.city);
      }
    } catch (error) {
      if (seq !== state.searchSeq) return;
      if (error.code === 'NETWORK_ERROR') {
        state.apiOnline = false;
        setApiStatus('offline', '本地模式', '后端搜索失败，已切换到本地模拟数据');
      }
      state.resultData = DATA.getHotels(state.search.city);
      toast('酒店接口失败，已回退本地模拟数据：' + error.message);
    }
    renderCurrentResults();
  }

  async function performFlightSearch() {
    const from = DATA.normalizeCity($('#flightFromInput').value);
    const to = DATA.normalizeCity($('#flightToInput').value);
    if (!from || !to) { toast('请填写出发与到达城市'); return; }
    if (from === to) { toast('出发和到达城市不能相同'); return; }
    state.flight.from = from;
    state.flight.to = to;
    state.flight.cabin = $('#flightCabin').value;
    state.flight.passengers = Number($('#flightPassengers').value);
    $('#flightFromInput').value = from;
    $('#flightToInput').value = to;
    state.resultType = 'flight';
    state.resultParams = {
      from: from,
      to: to,
      date: state.flight.date,
      cabin: state.flight.cabin,
      passengers: state.flight.passengers,
      trip: state.flight.trip
    };
    state.filters = defaultFilters('flight');
    state.recommendation = null;
    state.priceContext = null;
    state.resultData = [];
    const seq = ++state.searchSeq;
    showResultsLoading(from + ' → ' + to + ' 机票', formatFull(state.flight.date) + ' · ' + state.flight.passengers + '位成人 · ' + state.flight.cabin, '正在计算动态票价与智能推荐…');
    closeMobileNav();
    try {
      if (state.apiOnline) {
        const result = await api.searchFlights({
          from: from,
          to: to,
          date: dateKey(state.flight.date),
          passengers: state.flight.passengers,
          cabin: state.flight.cabin
        });
        if (seq !== state.searchSeq) return;
        state.resultData = result.results || [];
        state.recommendation = result.recommendation || null;
        state.priceContext = result.priceContext || null;
        if (result.query && result.query.date) state.resultParams.date = parseDateKey(result.query.date);
      } else {
        state.resultData = DATA.getFlights(from, to, dateKey(state.flight.date));
        state.recommendation = null;
      }
    } catch (error) {
      if (seq !== state.searchSeq) return;
      if (error.code === 'NETWORK_ERROR') {
        state.apiOnline = false;
        setApiStatus('offline', '本地模式', '后端搜索失败，已切换到本地模拟数据');
      }
      state.resultData = DATA.getFlights(from, to, dateKey(state.flight.date));
      state.recommendation = null;
      toast('动态票价服务不可用，已回退本地航班：' + error.message);
    }
    renderCurrentResults();
  }

  function performTrainSearch() {
    const from = DATA.normalizeCity($('#trainFromInput').value);
    const to = DATA.normalizeCity($('#trainToInput').value);
    if (!from || !to) { toast('请填写出发与到达城市'); return; }
    if (from === to) { toast('出发和到达城市不能相同'); return; }
    state.train.from = from;
    state.train.to = to;
    state.train.type = $('#trainType').value;
    state.train.passengers = Number($('#trainPassengers').value);
    $('#trainFromInput').value = from;
    $('#trainToInput').value = to;
    state.resultType = 'train';
    state.resultParams = {
      from: from,
      to: to,
      date: state.train.date,
      type: state.train.type,
      passengers: state.train.passengers
    };
    let trains = DATA.getTrains(from, to, dateKey(state.train.date));
    if (state.train.type !== 'all') {
      trains = trains.filter(function (train) { return train.type === state.train.type; });
    }
    state.resultData = trains;
    state.filters = defaultFilters('train');
    showResultsView();
    renderCurrentResults();
    closeMobileNav();
  }

  async function performTicketSearch() {
    const resolved = resolveDestination($('#ticketCityInput').value);
    const city = resolved.city || state.ticket.city;
    state.ticket.city = city;
    state.ticket.keyword = $('#ticketKeyword').value.trim();
    $('#ticketCityInput').value = city;
    state.resultType = 'ticket';
    state.resultParams = {
      city: city,
      date: state.ticket.date,
      keyword: state.ticket.keyword
    };
    state.filters = defaultFilters('ticket');
    state.resultData = [];
    const seq = ++state.searchSeq;
    showResultsLoading(city + '门票·活动', '正在读取本地玩乐项目…', '正在搜索门票与活动…');
    closeMobileNav();
    try {
      if (state.apiOnline) {
        const result = await api.searchAttractions({
          city: city,
          date: dateKey(state.ticket.date),
          keyword: state.ticket.keyword
        });
        if (seq !== state.searchSeq) return;
        state.resultData = result.results || [];
      } else {
        state.resultData = DATA.getAttractions(city);
      }
    } catch (error) {
      if (seq !== state.searchSeq) return;
      if (error.code === 'NETWORK_ERROR') {
        state.apiOnline = false;
        setApiStatus('offline', '本地模式', '后端搜索失败，已切换到本地模拟数据');
      }
      state.resultData = DATA.getAttractions(city);
      toast('门票接口失败，已回退本地模拟数据：' + error.message);
    }
    renderCurrentResults();
  }

  function startHotelSearch(city, keyword) {
    setMode('hotel', { keepResults: true });
    $('#hotelCityInput').value = city || '上海';
    $('#hotelKeyword').value = keyword || '';
    performHotelSearch();
  }

  function performGlobalSearch() {
    const query = $('#globalSearchInput').value.trim();
    $('#globalSuggestions').hidden = true;
    if (!query) {
      toast('请输入城市、酒店或目的地');
      $('#globalSearchInput').focus();
      return;
    }
    const exact = DATA.cities.find(function (city) {
      return city.name === query || city.name === DATA.normalizeCity(query) || query.indexOf(city.name) !== -1;
    });
    if (exact) {
      const extra = query.split(exact.name).join(' ').trim();
      startHotelSearch(exact.name, extra);
      return;
    }
    const matches = DATA.searchHotels(query);
    if (matches.length) {
      startHotelSearch(matches[0].city, query);
      return;
    }
    toast('未找到匹配城市或酒店，已按关键词搜索当前城市');
    startHotelSearch(state.search.city, query);
  }

  /* ------------------------------------------------------------------ */
  /* Results                                                             */
  /* ------------------------------------------------------------------ */

  function prepareResultsLayout(type) {
    const noFilters = type !== 'hotel';
    $('#resultsLayout').classList.toggle('no-filters', noFilters);
    $('#filterPanel').hidden = noFilters;
    $('#mapTeaser').hidden = noFilters;
  }

  function setupSort(type) {
    const options = SORT_OPTIONS[type];
    if (!options.some(function (option) { return option.value === state.filters.sort; })) {
      state.filters.sort = options[0].value;
    }
    $('#sortSelect').innerHTML = options.map(function (option) {
      return '<option value="' + option.value + '">' + option.label + '</option>';
    }).join('');
    $('#sortSelect').value = state.filters.sort;
  }

  function syncFilterChips() {
    $$('#priceFilters .filter-chip').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-price') === state.filters.price);
    });
    $$('#starFilters .filter-chip').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-star') === state.filters.star);
    });
    $$('#tagFilters .filter-chip').forEach(function (button) {
      button.classList.toggle('is-active', state.filters.tags.has(button.getAttribute('data-tag')));
    });
  }

  function sortHotels(list) {
    const sorted = list.slice();
    const sort = state.filters.sort;
    sorted.sort(function (a, b) {
      if (sort === 'priceAsc') return a.price - b.price;
      if (sort === 'priceDesc') return b.price - a.price;
      if (sort === 'rating') return b.rating - a.rating || b.reviewCount - a.reviewCount;
      return b.rating - a.rating || b.reviewCount - a.reviewCount;
    });
    return sorted;
  }

  function sortFlights(list) {
    const sorted = list.slice();
    const sort = state.filters.sort;
    sorted.sort(function (a, b) {
      if (sort === 'recommended') {
        const scoreA = a.recommendation ? a.recommendation.score : 0;
        const scoreB = b.recommendation ? b.recommendation.score : 0;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.price - b.price;
      }
      if (sort === 'departure') return a.dep.localeCompare(b.dep);
      if (sort === 'duration') return a.durationMin - b.durationMin;
      return a.price - b.price;
    });
    return sorted;
  }

  function sortTrains(list) {
    const sorted = list.slice();
    const sort = state.filters.sort;
    sorted.sort(function (a, b) {
      if (sort === 'departure') return a.dep.localeCompare(b.dep);
      if (sort === 'duration') return a.durationMin - b.durationMin;
      return a.price - b.price;
    });
    return sorted;
  }

  function sortTickets(list) {
    const sorted = list.slice();
    const sort = state.filters.sort;
    sorted.sort(function (a, b) {
      if (sort === 'priceAsc') return a.price - b.price;
      if (sort === 'rating') return b.rating - a.rating;
      return b.sold - a.sold;
    });
    return sorted;
  }

  function hotelResultHtml(hotel) {
    const favorite = state.favorites.has(hotel.id);
    return '<article class="hotel-result" data-hotel-id="' + esc(hotel.id) + '" tabindex="0" role="button" aria-label="查看 ' + esc(hotel.name) + ' 详情">' +
      '<div class="hotel-result-media">' +
        '<img src="' + esc(hotel.image) + '" alt="' + esc(hotel.name) + '" loading="lazy">' +
        '<button class="favorite-btn' + (favorite ? ' is-fav' : '') + '" type="button" data-fav="' + esc(hotel.id) + '" aria-label="收藏 ' + esc(hotel.name) + '" aria-pressed="' + favorite + '">' + svgIcon('heart') + '</button>' +
      '</div>' +
      '<div class="hotel-result-body">' +
        '<div class="hotel-result-head"><div><div class="hotel-result-title">' + esc(hotel.name) + '</div>' + starsHtml(hotel.star) + '</div></div>' +
        '<div class="hotel-result-sub"><span class="area">' + esc(hotel.area) + '</span><span>' + esc(hotel.distance) + '</span><span class="score-pill">' + hotel.rating.toFixed(1) + ' <small>/5</small></span><span class="score-desc">' + ratingWord(hotel.rating) + '</span><span>' + money(hotel.reviewCount) + '条点评</span></div>' +
        '<div class="hotel-result-tags">' + hotel.tags.slice(0, 4).map(function (tag) { return '<span class="mini-tag">' + esc(tag) + '</span>'; }).join('') + '</div>' +
        '<div class="hotel-result-promo">' + (hotel.promo ? '<span class="promo-pill">' + esc(hotel.promo) + '</span>' : '') + '<span class="promo-pill">到店无房保障</span></div>' +
      '</div>' +
      '<div class="hotel-result-price-col">' +
        '<div><div class="price-now"><em>¥</em>' + money(hotel.price) + '</div><div class="price-old">¥' + money(hotel.originalPrice) + '</div><div class="price-note">每晚起 · 含税</div></div>' +
        '<button class="primary-button" type="button" data-open-hotel="' + esc(hotel.id) + '">查看详情</button>' +
      '</div>' +
    '</article>';
  }

  function renderHotelResults() {
    const params = state.resultParams;
    const nights = Math.max(1, diffDays(params.checkin, params.checkout));
    const terms = params.keyword.toLowerCase().split(/\s+/).filter(Boolean);
    let hotels = (state.resultData || []).slice();
    if (terms.length) {
      hotels = hotels.filter(function (hotel) {
        const haystack = [hotel.name, hotel.city, hotel.area, hotel.address].concat(hotel.tags).join(' ').toLowerCase();
        return terms.every(function (term) { return haystack.indexOf(term) !== -1; });
      });
    }
    if (params.level !== '不限') {
      hotels = hotels.filter(function (hotel) { return hotel.star === Number(params.level); });
    }
    if (state.filters.price !== 'all') {
      hotels = hotels.filter(function (hotel) {
        if (state.filters.price === '0-500') return hotel.price <= 500;
        if (state.filters.price === '500-1000') return hotel.price >= 500 && hotel.price <= 1000;
        return hotel.price > 1000;
      });
    }
    if (state.filters.star !== 'all') {
      hotels = hotels.filter(function (hotel) { return hotel.star === Number(state.filters.star); });
    }
    if (state.filters.tags.size) {
      hotels = hotels.filter(function (hotel) {
        return Array.from(state.filters.tags).every(function (tag) { return hotel.tags.indexOf(tag) !== -1; });
      });
    }
    hotels = sortHotels(hotels);

    prepareResultsLayout('hotel');
    setupSort('hotel');
    syncFilterChips();
    $('#resultsTitle').textContent = params.city + '酒店';
    $('#resultsMeta').textContent = formatFull(params.checkin) + ' - ' + formatMD(params.checkout) + ' · ' + nights + '晚 · ' + params.rooms + '间' + (params.adults + params.children) + '位' + (params.keyword ? ' · 关键词“' + params.keyword + '”' : '');
    const guestCount = params.adults + params.children;
    $('#summaryCard').innerHTML =
      '<h3>住宿摘要</h3>' +
      '<div class="summary-row"><span>目的地</span><strong>' + esc(params.city) + '</strong></div>' +
      '<div class="summary-row"><span>入住</span><strong>' + formatFull(params.checkin) + ' · ' + weekdayName(params.checkin) + '</strong></div>' +
      '<div class="summary-row"><span>退房</span><strong>' + formatFull(params.checkout) + ' · ' + weekdayName(params.checkout) + '</strong></div>' +
      '<div class="summary-row"><span>住客</span><strong>' + params.rooms + '间 · ' + guestCount + '位</strong></div>' +
      '<div class="summary-row"><span>级别</span><strong>' + esc(params.level) + '</strong></div>' +
      (params.keyword ? '<div class="summary-row"><span>关键词</span><strong>' + esc(params.keyword) + '</strong></div>' : '') +
      '<button class="summary-edit" type="button" data-edit-search>修改搜索</button>' +
      '<p class="demo-note">共 ' + nights + ' 晚，价格为每间每晚的模拟含税价。</p>';
    $('#mapTeaser').hidden = false;
    $('#resultsCount').innerHTML = '找到 <strong>' + hotels.length + '</strong> 家符合条件的酒店' + (state.filters.price !== 'all' || state.filters.star !== 'all' || state.filters.tags.size ? '（已筛选）' : '');
    if (!hotels.length) {
      $('#resultList').innerHTML = '<div class="empty-state">' + svgIcon('search') + '<h3>没有符合条件的酒店</h3><p>尝试放宽价格、星级或特色筛选，或返回修改搜索条件。</p><button class="secondary-button" type="button" data-reset-filters>清除筛选</button></div>';
      return;
    }
    $('#resultList').innerHTML = hotels.map(hotelResultHtml).join('');
  }

  function flightResultHtml(flight) {
    const labels = flight.recommendation && Array.isArray(flight.recommendation.labels) ? flight.recommendation.labels : [];
    const isBest = labels.indexOf('综合推荐') !== -1;
    const priceNote = flight.originalPrice && flight.originalPrice > flight.price
      ? '<span class="price-old-inline">¥' + money(flight.originalPrice) + '</span>'
      : '';
    const seats = flight.seatsLeft ? '<span class="seats-left">余 ' + flight.seatsLeft + ' 座</span>' : '<span class="seats-left">动态库存</span>';
    const dynamic = flight.pricing ? '<span class="dynamic-tag">动态票价</span>' : '';
    const recommendationNote = flight.recommendation && flight.recommendation.reason
      ? '<div class="flight-reason">' + svgIcon('sparkle') + esc(flight.recommendation.reason) + '</div>'
      : '';
    return '<article class="transport-card' + (isBest ? ' is-recommended' : '') + '">' +
      '<div class="airline-block">' +
        '<span class="airline-logo" style="background:' + esc(flight.color) + '">' + esc(flight.code) + '</span>' +
        '<span class="airline-copy"><strong>' + esc(flight.airline) + '</strong><span>' + esc(flight.flightNo) + ' · ' + esc(flight.aircraft) + '</span></span>' +
      '</div>' +
      '<div>' +
        '<div class="flight-route">' +
          '<div class="flight-end"><strong>' + flight.dep + '</strong><span>' + esc(flight.fromAirport) + '</span></div>' +
          '<div class="flight-mid"><span>' + esc(flight.duration) + '</span><div class="flight-line"><i></i>' + svgIcon('plane') + '<i></i></div><strong>' + esc(flight.stops) + '</strong></div>' +
          '<div class="flight-end"><strong>' + flight.arr + (flight.extraDay ? '<sup>+1</sup>' : '') + '</strong><span>' + esc(flight.toAirport) + '</span></div>' +
        '</div>' +
        '<div class="flight-tags"><span class="on-time">准点率 ' + flight.onTime + '%</span><span class="mini-tag">' + esc(flight.cabin) + '</span>' + dynamic + labels.map(function (label) { return '<span class="rec-tag">' + esc(label) + '</span>'; }).join('') + '</div>' +
        recommendationNote +
      '</div>' +
      '<div class="transport-price"><strong><em>¥</em>' + money(flight.price) + '</strong>' + priceNote + '<span>含税费 · 每人</span>' + seats + '</div>' +
      '<button class="primary-button" type="button" data-book-flight="' + esc(flight.id) + '">选此航班</button>' +
    '</article>';
  }

  function trainResultHtml(train) {
    return '<article class="transport-card">' +
      '<div class="airline-block">' +
        '<span class="airline-logo" style="background:' + (train.type === 'G' ? '#0f9b7a' : '#2f6fed') + '">' + train.type + '</span>' +
        '<span class="airline-copy"><strong class="train-no">' + esc(train.no) + '<span class="train-type">' + esc(train.type) + '</span></strong><span>' + esc(train.from) + ' → ' + esc(train.to) + '</span></span>' +
      '</div>' +
      '<div>' +
        '<div class="flight-route">' +
          '<div class="flight-end"><strong>' + train.dep + '</strong><span>' + esc(train.from) + '</span></div>' +
          '<div class="flight-mid"><span>' + esc(train.duration) + '</span><div class="flight-line"><i></i>' + svgIcon('train') + '<i></i></div><strong>直达</strong></div>' +
          '<div class="flight-end"><strong>' + train.arr + (train.extraDay ? '<sup>+1</sup>' : '') + '</strong><span>' + esc(train.to) + '</span></div>' +
        '</div>' +
        '<div class="flight-tags"><span class="on-time">' + esc(train.seats) + '</span>' + train.tags.map(function (tag) { return '<span class="mini-tag">' + esc(tag) + '</span>'; }).join('') + '</div>' +
      '</div>' +
      '<div class="transport-price"><strong><em>¥</em>' + money(train.price) + '</strong><span>二等座 · 每人</span></div>' +
      '<button class="primary-button" type="button" data-book-train="' + esc(train.id) + '">选此车次</button>' +
    '</article>';
  }

  function ticketResultHtml(ticket) {
    return '<article class="ticket-result" data-ticket-id="' + esc(ticket.id) + '" tabindex="0" role="button" aria-label="查看 ' + esc(ticket.name) + '">' +
      '<div class="ticket-art" style="background:' + esc(ticket.gradient) + '">' +
        (ticket.image ? '<img src="' + esc(ticket.image) + '" alt="' + esc(ticket.name) + '" loading="lazy">' : '') +
        svgIcon(ticket.icon) +
        '<span class="ticket-badge">' + esc(ticket.subtitle) + '</span>' +
      '</div>' +
      '<div class="ticket-body">' +
        '<div class="ticket-title">' + esc(ticket.name) + '</div>' +
        '<div class="ticket-sub">' + esc(ticket.city) + ' · ' + esc(ticket.duration) + ' · ' + esc(ticket.tags.join(' / ')) + '</div>' +
        '<div class="ticket-facts"><span class="score-pill">' + ticket.rating.toFixed(1) + '</span><span class="score-word">' + ratingWord(ticket.rating) + '</span><span>' + money(ticket.sold) + '人已订</span></div>' +
        '<div class="ticket-footer"><div class="ticket-price"><em>¥</em>' + money(ticket.price) + '<span>起</span></div><button class="primary-button" type="button" data-ticket-open="' + esc(ticket.id) + '">查看详情</button></div>' +
      '</div>' +
    '</article>';
  }

  function smartRecommendationHtml() {
    const recommendation = state.recommendation;
    if (!recommendation) return '';
    const best = state.resultData.find(function (flight) { return flight.id === recommendation.bestId; });
    if (!best) return '';
    const reason = recommendation.summary || best.recommendation.reason || recommendation.policy || '综合价格、耗时与准点率推荐';
    return '<button class="smart-pick" type="button" data-book-flight="' + esc(best.id) + '">' +
      '<span class="smart-pick-mark">' + svgIcon('sparkle') + '</span>' +
      '<span class="smart-pick-copy"><span>智能航班推荐</span><strong>' + esc(best.airline) + ' ' + esc(best.flightNo) + ' · ' + esc(best.dep) + ' - ' + esc(best.arr) + ' · ¥' + money(best.price) + '</strong><small>' + esc(reason) + '</small></span>' +
      '<span class="smart-pick-action">查看推荐 <svg><use href="#i-arrow-right"></use></svg></span>' +
    '</button>';
  }

  function renderFlightResults() {
    const params = state.resultParams;
    const flights = sortFlights(state.resultData);
    prepareResultsLayout('flight');
    setupSort('flight');
    const validUntil = state.priceContext && state.priceContext.validUntil
      ? new Date(state.priceContext.validUntil).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '';
    $('#resultsTitle').textContent = params.from + ' → ' + params.to + ' 机票';
    $('#resultsMeta').textContent = formatFull(params.date) + ' · ' + params.passengers + '位成人 · ' + params.cabin + ' · ' + (params.trip === 'roundtrip' ? '往返演示（按单程展示）' : '单程') + ' · 动态含税价';
    $('#summaryCard').innerHTML =
      '<h3>航班摘要</h3>' +
      '<div class="summary-row"><span>航线</span><strong>' + esc(params.from) + ' → ' + esc(params.to) + '</strong></div>' +
      '<div class="summary-row"><span>日期</span><strong>' + formatFull(params.date) + ' · ' + weekdayName(params.date) + '</strong></div>' +
      '<div class="summary-row"><span>舱位</span><strong>' + esc(params.cabin) + '</strong></div>' +
      '<div class="summary-row"><span>乘客</span><strong>' + params.passengers + '位成人</strong></div>' +
      (state.recommendation ? '<div class="summary-row"><span>智能推荐</span><strong>' + esc(state.recommendation.bestFlightNo || '') + ' · ¥' + money(state.recommendation.bestPrice || '') + '</strong></div>' : '') +
      '<button class="summary-edit" type="button" data-edit-search>修改搜索</button>' +
      '<p class="demo-note">票价由本地后端按需求、出发时间和舱位动态模拟' + (validUntil ? '，当前报价有效至 ' + validUntil : '') + '。不对应真实航班。</p>';
    $('#resultsCount').innerHTML = '共 <strong>' + flights.length + '</strong> 个航班 · 动态含税价' + (state.priceContext ? ' · 每 30 分钟更新' : '');
    const body = flights.length
      ? smartRecommendationHtml() + flights.map(flightResultHtml).join('')
      : '<div class="empty-state">' + svgIcon('plane') + '<h3>没有可用航班</h3><p>请更换出发/到达城市再试。</p></div>';
    $('#resultList').innerHTML = body;
  }

  function renderTrainResults() {
    const params = state.resultParams;
    const trains = sortTrains(state.resultData);
    prepareResultsLayout('train');
    setupSort('train');
    $('#resultsTitle').textContent = params.from + ' → ' + params.to + ' 火车票';
    $('#resultsMeta').textContent = formatFull(params.date) + ' · ' + params.passengers + '位成人 · ' + (params.type === 'all' ? '全部车次' : '只看' + (params.type === 'G' ? '高铁' : '动车')) + ' · 本地模拟';
    $('#summaryCard').innerHTML =
      '<h3>车次摘要</h3>' +
      '<div class="summary-row"><span>路线</span><strong>' + esc(params.from) + ' → ' + esc(params.to) + '</strong></div>' +
      '<div class="summary-row"><span>日期</span><strong>' + formatFull(params.date) + ' · ' + weekdayName(params.date) + '</strong></div>' +
      '<div class="summary-row"><span>乘客</span><strong>' + params.passengers + '位成人</strong></div>' +
      '<div class="summary-row"><span>类型</span><strong>' + (params.type === 'all' ? '全部车次' : params.type) + '</strong></div>' +
      '<button class="summary-edit" type="button" data-edit-search>修改搜索</button>' +
      '<p class="demo-note">车次、余票与价格为本地模拟，不可用于真实出行。</p>';
    $('#resultsCount').innerHTML = '共 <strong>' + trains.length + '</strong> 个模拟车次';
    $('#resultList').innerHTML = trains.length ? trains.map(trainResultHtml).join('') : '<div class="empty-state">' + svgIcon('train') + '<h3>没有符合条件的车次</h3><p>请调整车次类型或更换路线。</p></div>';
  }

  function renderTicketResults() {
    const params = state.resultParams;
    let tickets = state.resultData.slice();
    if (params.keyword) {
      const keyword = params.keyword.toLowerCase();
      tickets = tickets.filter(function (ticket) {
        return (ticket.name + ' ' + ticket.subtitle + ' ' + ticket.tags.join(' ')).toLowerCase().indexOf(keyword) !== -1;
      });
    }
    tickets = sortTickets(tickets);
    prepareResultsLayout('ticket');
    setupSort('ticket');
    $('#resultsTitle').textContent = params.city + '门票·活动';
    $('#resultsMeta').textContent = formatFull(params.date) + ' · ' + (params.keyword ? '关键词“' + params.keyword + '” · ' : '') + '本地模拟玩乐项目';
    $('#summaryCard').innerHTML =
      '<h3>玩乐摘要</h3>' +
      '<div class="summary-row"><span>城市</span><strong>' + esc(params.city) + '</strong></div>' +
      '<div class="summary-row"><span>游玩日期</span><strong>' + formatFull(params.date) + ' · ' + weekdayName(params.date) + '</strong></div>' +
      (params.keyword ? '<div class="summary-row"><span>关键词</span><strong>' + esc(params.keyword) + '</strong></div>' : '') +
      '<button class="summary-edit" type="button" data-edit-search>修改搜索</button>' +
      '<p class="demo-note">景点、价格与销量均为本地模拟；预订不会真实出票。</p>';
    $('#resultsCount').innerHTML = '共 <strong>' + tickets.length + '</strong> 个模拟玩乐项目';
    $('#resultList').innerHTML = tickets.length ? '<div class="ticket-grid">' + tickets.map(ticketResultHtml).join('') + '</div>' : '<div class="empty-state">' + svgIcon('ticket') + '<h3>没有匹配的门票或活动</h3><p>换一个关键词，例如“游船”“博物馆”“亲子”。</p></div>';
  }

  function renderCurrentResults() {
    if (state.resultType === 'hotel') renderHotelResults();
    else if (state.resultType === 'flight') renderFlightResults();
    else if (state.resultType === 'train') renderTrainResults();
    else renderTicketResults();
  }

  /* ------------------------------------------------------------------ */
  /* Hotel detail and booking                                            */
  /* ------------------------------------------------------------------ */

  function openHotelDetail(hotel) {
    if (!hotel) return;
    state.ticketContext = null;
    const images = hotel.images.slice(0, 3);
    const html = '<div class="modal-body">' +
      '<div class="detail-gallery"><img src="' + esc(images[0]) + '" alt="' + esc(hotel.name) + '"><img src="' + esc(images[1] || images[0]) + '" alt="' + esc(hotel.name) + ' 客房"><img src="' + esc(images[2] || images[0]) + '" alt="' + esc(hotel.name) + ' 设施"></div>' +
      '<div class="detail-head">' +
        '<div><h2 id="modalTitle">' + esc(hotel.name) + '</h2>' + starsHtml(hotel.star) + '<p class="detail-address">' + esc(hotel.city) + ' · ' + esc(hotel.area) + ' · ' + esc(hotel.address) + '</p></div>' +
        '<div class="detail-score-block"><span class="score-badge">' + hotel.rating.toFixed(1) + '</span><div class="detail-score-copy"><strong>' + ratingWord(hotel.rating) + '</strong><span>' + money(hotel.reviewCount) + '条真实感模拟点评</span></div></div>' +
      '</div>' +
      '<div class="detail-tag-line">' + hotel.tags.map(function (tag, index) { return '<span class="detail-tag' + (index === 0 ? ' is-accent' : '') + '">' + esc(tag) + '</span>'; }).join('') + '</div>' +
      '<div class="detail-section"><h3>酒店设施</h3><div class="amenity-grid">' + hotel.amenities.map(function (item) { return '<div class="amenity-item">' + svgIcon(item[0]) + '<span>' + esc(item[1]) + '</span></div>'; }).join('') + '</div></div>' +
      '<div class="detail-section"><h3>房型与价格</h3><div class="room-list">' + hotel.rooms.map(function (room, index) {
        return '<div class="room-card"><div class="room-info"><strong>' + esc(room.name) + '</strong><p>' + esc(room.bed) + ' · ' + esc(room.size) + ' · ' + esc(room.breakfast) + ' · <span class="room-cancel">' + esc(room.cancel) + '</span></p></div>' +
          '<div class="room-price-block"><div class="room-price"><strong><em>¥</em>' + money(room.price) + '</strong><span class="' + (room.left <= 2 ? 'is-warning' : '') + '">仅剩 ' + room.left + ' 间</span></div><button class="primary-button" type="button" data-book-room="' + esc(hotel.id) + '" data-room-index="' + index + '">预订</button></div></div>';
      }).join('') + '</div></div>' +
      '<div class="detail-note">本地演示：酒店名称、图片、评分、房态和价格均为模拟数据；预订后可在“我的订单”中查看或取消。</div>' +
    '</div>';
    openModal(html, { className: 'modal-wide' });
  }

  function openTicketDetail(ticket) {
    if (!ticket) return;
    state.ticketContext = ticket;
    const html = '<div class="modal-body">' +
      '<div class="ticket-art" style="height:190px;border-radius:12px;background:' + esc(ticket.gradient) + '">' + (ticket.image ? '<img src="' + esc(ticket.image) + '" alt="' + esc(ticket.name) + '">' : '') + svgIcon(ticket.icon) + '<span class="ticket-badge">' + esc(ticket.subtitle) + '</span></div>' +
      '<div style="margin-top:18px"><h2 id="modalTitle" style="font-size:24px">' + esc(ticket.name) + '</h2><p style="margin-top:6px;font-size:12px;color:#77839a">' + esc(ticket.city) + ' · ' + esc(ticket.duration) + ' · ' + esc(ticket.tags.join(' / ')) + '</p></div>' +
      '<div class="detail-tag-line"><span class="detail-tag is-accent">评分 ' + ticket.rating.toFixed(1) + '</span><span class="detail-tag">' + money(ticket.sold) + '人已订</span><span class="detail-tag">可订 ' + formatMD(state.ticket.date) + '</span></div>' +
      '<div class="detail-section"><h3>项目说明</h3><p style="font-size:13px;line-height:1.9;color:#55657c">这是一条本地生成的模拟玩乐项目。展示价格、时长、评分与可订日期，仅用于演示从搜索到详情、再到模拟下单的完整交互。真实出行前请通过正规渠道核实景点开放时间与票务政策。</p></div>' +
      '<div class="booking-total"><span>门票参考价<br><small style="font-size:10px;color:#9aa6b6">' + formatMD(state.ticket.date) + ' · 1张</small></span><strong><em>¥</em>' + money(ticket.price) + '</strong></div>' +
      '<div class="booking-submit-row"><button class="secondary-button" type="button" data-close-modal>关闭</button><button class="primary-button" type="button" data-book-ticket>预订门票</button></div>' +
      '<p class="booking-hint">本地模拟订单，不会产生真实出票或费用。</p>' +
    '</div>';
    openModal(html);
  }

  function openHotelBooking(hotel, room) {
    if (!hotel || !room) return;
    const nights = Math.max(1, diffDays(state.search.checkin, state.search.checkout));
    const rooms = state.search.rooms;
    const guests = state.search.adults + state.search.children;
    const total = room.price * nights * rooms;
    openBooking({
      kind: 'hotel',
      kindLabel: '酒店订单',
      title: hotel.name + ' · ' + room.name,
      subtitle: hotel.area + ' · ' + room.bed + ' · ' + room.size,
      lines: [
        { label: '入住日期', value: formatFull(state.search.checkin) },
        { label: '退房日期', value: formatFull(state.search.checkout) + ' · ' + nights + '晚' },
        { label: '房间数量', value: rooms + '间 · ' + guests + '位住客' },
        { label: '早餐', value: room.breakfast },
        { label: '取消政策', value: room.cancel }
      ],
      total: total,
      totalNote: '¥' + money(room.price) + ' × ' + nights + '晚 × ' + rooms + '间',
      dateLabel: formatMD(state.search.checkin) + ' - ' + formatMD(state.search.checkout) + '（' + nights + '晚）',
      guestLabel: rooms + '间 · ' + guests + '位',
      meta: [room.name, nights + '晚', rooms + '间'],
      apiPayload: {
        type: 'hotel',
        hotelId: hotel.id,
        roomIndex: hotel.rooms.indexOf(room),
        checkin: dateKey(state.search.checkin),
        checkout: dateKey(state.search.checkout),
        rooms: rooms,
        guests: guests
      },
      details: {
        hotelId: hotel.id,
        hotelName: hotel.name,
        room: room.name,
        checkin: dateKey(state.search.checkin),
        checkout: dateKey(state.search.checkout),
        nights: nights,
        rooms: rooms,
        guests: guests
      }
    });
  }

  function openFlightBooking(flight) {
    if (!flight) return;
    if (state.apiOnline && !flight.quoteId) {
      toast('该航班报价已失效，请重新搜索后再预订');
      return;
    }
    const passengers = state.resultParams ? state.resultParams.passengers : state.flight.passengers;
    const date = state.resultParams ? state.resultParams.date : state.flight.date;
    const cabin = state.resultParams ? state.resultParams.cabin : state.flight.cabin;
    const total = flight.price * passengers;
    openBooking({
      kind: 'flight',
      kindLabel: '机票订单',
      title: flight.from + ' → ' + flight.to + ' · ' + flight.flightNo,
      subtitle: flight.airline + ' · ' + flight.aircraft + ' · ' + flight.fromAirport + ' - ' + flight.toAirport,
      lines: [
        { label: '出发日期', value: formatFull(date) },
        { label: '起飞/到达', value: flight.dep + ' - ' + flight.arr + (flight.extraDay ? ' +1天' : '') },
        { label: '舱位', value: cabin },
        { label: '乘客', value: passengers + '位成人' },
        { label: '航程', value: flight.duration + ' · 直飞' }
      ],
      total: total,
      totalNote: '¥' + money(flight.price) + ' × ' + passengers + '位乘客',
      dateLabel: formatFull(date) + ' ' + flight.dep,
      guestLabel: passengers + '位成人',
      meta: [flight.flightNo, cabin, '直飞'],
      apiPayload: { type: 'flight', quoteId: flight.quoteId || '' },
      details: {
        flightNo: flight.flightNo,
        airline: flight.airline,
        from: flight.from,
        to: flight.to,
        date: dateKey(date),
        dep: flight.dep,
        arr: flight.arr,
        cabin: cabin,
        passengers: passengers
      }
    });
  }

  function openTrainBooking(train) {
    if (!train) return;
    const passengers = state.resultParams ? state.resultParams.passengers : state.train.passengers;
    const date = state.resultParams ? state.resultParams.date : state.train.date;
    const total = train.price * passengers;
    openBooking({
      kind: 'train',
      kindLabel: '火车票订单',
      title: train.from + ' → ' + train.to + ' · ' + train.no,
      subtitle: train.type + ' · ' + train.duration + ' · 直达',
      lines: [
        { label: '出发日期', value: formatFull(date) },
        { label: '发车/到达', value: train.dep + ' - ' + train.arr + (train.extraDay ? ' +1天' : '') },
        { label: '乘客', value: passengers + '位成人' },
        { label: '席别', value: '二等座 · ' + train.seats }
      ],
      total: total,
      totalNote: '¥' + money(train.price) + ' × ' + passengers + '位乘客',
      dateLabel: formatFull(date) + ' ' + train.dep,
      guestLabel: passengers + '位成人',
      meta: [train.no, '直达'],
      details: {
        trainNo: train.no,
        from: train.from,
        to: train.to,
        date: dateKey(date),
        dep: train.dep,
        passengers: passengers
      }
    });
  }

  function openTicketBooking(ticket) {
    if (!ticket) return;
    openBooking({
      kind: 'ticket',
      kindLabel: '门票订单',
      title: ticket.name,
      subtitle: ticket.city + ' · ' + ticket.duration + ' · ' + ticket.tags.join(' / '),
      lines: [
        { label: '游玩日期', value: formatFull(state.ticket.date) },
        { label: '数量', value: '1张成人票' },
        { label: '使用方式', value: '凭本地演示订单号入场（模拟）' }
      ],
      total: ticket.price,
      totalNote: '¥' + money(ticket.price) + ' × 1张',
      dateLabel: formatFull(state.ticket.date),
      guestLabel: '1张成人票',
      meta: [ticket.subtitle, ticket.duration],
      apiPayload: {
        type: 'ticket',
        ticketId: ticket.id,
        city: ticket.city,
        date: dateKey(state.ticket.date),
        quantity: 1
      },
      details: {
        ticketId: ticket.id,
        ticketName: ticket.name,
        city: ticket.city,
        date: dateKey(state.ticket.date)
      }
    });
  }

  function openBooking(draft) {
    if (state.apiOnline && (!state.user || !api.hasToken())) {
      state.pendingAuthAction = function () { openBooking(draft); };
      openAuth('login', { reason: '预订前请先登录本地账户' });
      return;
    }
    state.bookingDraft = draft;
    const name = state.user && state.user.name ? state.user.name : '';
    const phone = state.user ? state.user.phone : '';
    const html = '<div class="modal-head"><h2 id="modalTitle">确认订单</h2><p>' + esc(draft.kindLabel) + ' · 本地模拟预订，不会产生真实费用</p></div>' +
      '<div class="modal-body">' +
        '<div class="booking-summary"><strong>' + esc(draft.title) + '</strong><p>' + esc(draft.subtitle) + '</p><div class="booking-lines">' +
          draft.lines.map(function (line) { return '<div class="booking-line"><span>' + esc(line.label) + '</span><strong>' + esc(line.value) + '</strong></div>'; }).join('') +
        '</div></div>' +
        '<form id="bookingForm" novalidate>' +
          '<div class="booking-form">' +
            '<div class="form-field"><label for="bookingName">联系人</label><input class="form-input" id="bookingName" name="name" type="text" placeholder="请输入联系人姓名" value="' + esc(name) + '" autocomplete="name"></div>' +
            '<div class="form-field"><label for="bookingPhone">手机号</label><input class="form-input" id="bookingPhone" name="phone" type="tel" inputmode="numeric" placeholder="用于接收模拟订单通知" value="' + esc(phone) + '" autocomplete="tel"></div>' +
            '<div class="form-field"><label for="bookingId">证件号（选填）</label><input class="form-input" id="bookingId" name="idNumber" type="text" placeholder="演示环境无需填写真实证件"></div>' +
            '<div class="form-field"><label for="bookingArrival">预计到达 / 出行时间</label><input class="form-input" id="bookingArrival" name="arrival" type="text" placeholder="例如：14:00 后"></div>' +
            '<div class="form-field full"><label for="bookingNote">备注</label><textarea class="form-input" id="bookingNote" name="note" rows="3" placeholder="可选：房型偏好、出行需求等"></textarea></div>' +
          '</div>' +
          '<div class="booking-total"><span>' + esc(draft.totalNote) + '<br><small style="font-size:10px;color:#9aa6b6">全部为本地模拟价格</small></span><strong><em>¥</em>' + money(draft.total) + '</strong></div>' +
          '<div class="booking-submit-row"><button class="secondary-button" type="button" data-close-modal>取消</button><button class="primary-button" type="submit">提交订单</button></div>' +
          '<p class="booking-hint">' + (state.apiOnline && draft.apiPayload
            ? '提交后会在本地后端创建订单（待付款），下一步可完成模拟支付；机票支付后可在线值机。'
            : '后端接口不可用或该业务未接入后端时，会在浏览器本地生成演示订单。') + '</p>' +
        '</form>' +
      '</div>';
    openModal(html);
  }

  async function handleBookingSubmit(event) {
    event.preventDefault();
    const draft = state.bookingDraft;
    if (!draft) return;
    const name = $('#bookingName').value.trim();
    const phone = $('#bookingPhone').value.trim();
    if (name.length < 2) {
      toast('请填写至少 2 个字符的联系人姓名');
      $('#bookingName').focus();
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      toast('请输入有效的 11 位手机号');
      $('#bookingPhone').focus();
      return;
    }
    const contact = {
      name: name,
      phone: phone,
      idNumber: $('#bookingId').value.trim(),
      arrival: $('#bookingArrival').value.trim(),
      note: $('#bookingNote').value.trim()
    };
    if (state.apiOnline && draft.apiPayload) {
      const submit = event.target.querySelector('button[type="submit"]');
      if (submit) { submit.disabled = true; submit.textContent = '提交中…'; }
      try {
        const result = await api.createOrder({ ...draft.apiPayload, contact });
        state.bookingDraft = null;
        upsertOrder(result.order);
        toast('订单已创建，请完成模拟支付');
        openPaymentModal(result.order);
        return;
      } catch (error) {
        if (submit) { submit.disabled = false; submit.textContent = '提交订单'; }
        if (error.status === 401) {
          openAuth('login', { reason: '登录状态已过期，请重新登录后再提交' });
          return;
        }
        if (error.code === 'NETWORK_ERROR') {
          state.apiOnline = false;
          setApiStatus('offline', '本地模式', '后端不可用，已切换到本地模拟订单');
        }
        toast(error.message);
        return;
      }
    }
    const order = {
      id: 'OC' + Date.now().toString().slice(-10) + Math.floor(Math.random() * 90 + 10),
      kind: draft.kind,
      kindLabel: draft.kindLabel,
      title: draft.title,
      status: '已确认',
      statusLabel: '已确认（本地）',
      createdAt: new Date().toISOString(),
      dateLabel: draft.dateLabel,
      guestLabel: draft.guestLabel,
      meta: draft.meta,
      total: draft.total,
      contact: contact,
      details: draft.details
    };
    state.orders.unshift(order);
    writeStore(STORAGE.orders, state.orders);
    renderOrdersPreview();
    state.bookingDraft = null;
    openModal('<div class="modal-body"><div class="success-modal">' +
      '<div class="success-icon">' + svgIcon('check') + '</div>' +
      '<h2 id="modalTitle">预订成功</h2>' +
      '<p>' + esc(order.title) + '<br>' + esc(order.dateLabel) + ' · ' + esc(order.guestLabel) + '</p>' +
      '<div class="order-number-box">本地订单号<strong>' + esc(order.id) + '</strong></div>' +
      '<p>后端未参与此订单，数据保存在浏览器本地存储中。</p>' +
      '<div class="success-actions"><button class="secondary-button" type="button" data-success-orders>查看订单</button><button class="primary-button" type="button" data-success-close>继续浏览</button></div>' +
    '</div></div>');
    toast('本地订单已创建');
  }

  function openPaymentModal(order) {
    if (!order) return;
    if (!state.apiOnline) {
      toast('模拟支付需要本地后端，请先运行 npm start');
      return;
    }
    if (order.status !== 'PENDING_PAYMENT') {
      toast('该订单当前状态为「' + (order.statusLabel || order.status) + '」，无需支付');
      return;
    }
    let method = 'alipay';
    const methods = [
      { key: 'alipay', label: '支付宝', note: '模拟网关', className: 'alipay' },
      { key: 'wechat', label: '微信支付', note: '模拟网关', className: 'wechat' },
      { key: 'card', label: '银行卡', note: '模拟收单', className: 'card' }
    ];
    const html = '<div id="paymentRoot">' +
      '<div class="modal-head"><h2 id="modalTitle">订单支付</h2><p>演示支付由本地 MockPay 沙箱处理，不会跳转真实支付平台。</p></div>' +
      '<div class="modal-body">' +
        '<div class="payment-amount"><span>应付金额</span><strong><em>¥</em>' + money(order.total) + '</strong><small>' + esc(order.title) + '</small></div>' +
        '<div class="form-field" style="margin-top:16px"><label>支付方式</label><div class="payment-methods">' +
          methods.map(function (item) {
            return '<button type="button" class="payment-method' + (item.key === method ? ' is-active' : '') + ' is-' + item.className + '" data-pay-method="' + item.key + '"><span class="payment-method-icon">' + (item.key === 'alipay' ? '支' : item.key === 'wechat' ? '微' : '卡') + '</span><span><strong>' + item.label + '</strong><small>' + item.note + '</small></span></button>';
          }).join('') +
        '</div></div>' +
        '<div class="payment-note">' + svgIcon('shield') + '<span>支付成功后订单进入「已支付」状态；机票订单可继续在线值机。待付款订单保留 15 分钟。</span></div>' +
        '<div class="booking-total"><span>本地模拟支付<br><small style="font-size:10px;color:#9aa6b6">MockPay Sandbox · CNY</small></span><strong><em>¥</em>' + money(order.total) + '</strong></div>' +
        '<div class="booking-submit-row"><button class="secondary-button" type="button" data-close-modal>稍后支付</button><button class="primary-button" type="button" id="payNow">立即支付</button></div>' +
        '<p class="booking-hint">本演示不会采集真实支付凭据。点击支付只会调用本地 /api/orders/:id/pay。</p>' +
      '</div>' +
    '</div>';
    const modal = openModal(html);
    const root = $('#paymentRoot', modal);
    root.addEventListener('click', async function (event) {
      const methodButton = event.target.closest('[data-pay-method]');
      if (methodButton) {
        method = methodButton.getAttribute('data-pay-method');
        $$('[data-pay-method]', root).forEach(function (button) {
          button.classList.toggle('is-active', button === methodButton);
        });
        return;
      }
      const payButton = event.target.closest('#payNow');
      if (!payButton) return;
      payButton.disabled = true;
      payButton.textContent = '支付处理中…';
      try {
        const result = await api.payOrder(order.id, method);
        upsertOrder(result.order);
        openPaymentSuccess(result.order);
      } catch (error) {
        payButton.disabled = false;
        payButton.textContent = '立即支付';
        if (error.status === 401) {
          openAuth('login', { reason: '登录状态已过期，请重新登录后支付' });
          return;
        }
        if (error.code === 'INVALID_ORDER_STATE') await refreshOrders({ silent: true });
        toast(error.message);
      }
    });
  }

  function openPaymentSuccess(order) {
    const canCheckin = order.type === 'flight';
    openModal('<div class="modal-body"><div class="success-modal">' +
      '<div class="success-icon">' + svgIcon('check') + '</div>' +
      '<h2 id="modalTitle">支付成功</h2>' +
      '<p>' + esc(order.title) + '<br>' + esc(order.dateLabel || '') + ' · ' + esc(order.guestLabel || '') + '</p>' +
      '<div class="order-number-box">本地订单号<strong>' + esc(order.id) + '</strong></div>' +
      '<p>订单状态已更新为「' + esc(order.statusLabel || '已支付') + '」。' + (canCheckin ? '现在可以在线选座并生成登机牌。' : '可在订单页查看状态历史。') + '</p>' +
      '<div class="success-actions">' +
        '<button class="secondary-button" type="button" data-success-orders>查看订单</button>' +
        (canCheckin ? '<button class="primary-button" type="button" data-pay-checkin="' + esc(order.id) + '">去值机</button>' : '<button class="primary-button" type="button" data-success-close>继续浏览</button>') +
      '</div>' +
    '</div></div>');
    toast('支付成功，订单状态已更新');
  }

  async function cancelOrder(id) {
    const order = findOrderById(id);
    if (!order) return;
    const isServerOrder = Boolean(order.userId);
    if (state.apiOnline && isServerOrder) {
      try {
        const result = await api.cancelOrder(id);
        upsertOrder(result.order);
        if (!$('#ordersView').hidden) renderOrdersPage();
        if (state.modalOpen) closeModal();
        toast('订单已取消' + (result.order.cancellation && result.order.cancellation.refund ? '，模拟退款已完成' : ''));
      } catch (error) {
        toast(error.message);
      }
      return;
    }
    if (order.status === '已取消') return;
    order.status = '已取消';
    order.statusLabel = '已取消（本地）';
    writeStore(STORAGE.orders, state.orders);
    renderOrdersPreview();
    if (!$('#ordersView').hidden) renderOrdersPage();
    if (state.modalOpen) closeModal();
    toast('订单已取消（本地模拟）');
  }

  async function openCheckin(order) {
    if (!order) return;
    if (!state.apiOnline) {
      toast('在线值机需要本地后端，请先运行 npm start');
      return;
    }
    if (order.status === 'CHECKED_IN') {
      openBoardingPass(order);
      return;
    }
    if (order.status !== 'PAID') {
      toast('只有已支付的机票订单可以值机');
      return;
    }
    openModal('<div class="modal-body"><div class="orders-loading"><span class="spinner"></span>正在读取座位图…</div></div>');
    try {
      const result = await api.getSeats(order.id);
      renderCheckinModal(result.order || order, result.seatMap);
    } catch (error) {
      closeModal();
      toast(error.message);
    }
  }

  function renderCheckinModal(order, seatMap) {
    const rows = seatMap.rows || [1, 2, 3, 4, 5, 6, 7, 8];
    const columns = seatMap.columns || ['A', 'B', 'C', 'D', 'E', 'F'];
    const seatIndex = {};
    seatMap.seats.forEach(function (seat) { seatIndex[seat.id] = seat; });
    const rowsHtml = rows.map(function (row) {
      const cells = columns.map(function (column, index) {
        const seat = seatIndex[row + column] || { id: row + column, status: 'blocked' };
        const disabled = seat.status !== 'available';
        const cls = 'seat is-' + seat.status;
        const label = seat.status === 'available' ? '可选' : seat.status === 'occupied' ? '已占' : seat.status === 'selected' ? '已选' : '不可用';
        const between = index === 3 ? '<span class="seat-aisle"></span>' : '';
        return between + '<button type="button" class="' + cls + '" data-seat="' + esc(seat.id) + '"' + (disabled ? ' disabled' : '') + ' aria-label="' + esc(seat.id) + ' ' + label + '" title="' + esc(seat.id) + ' · ' + label + '">' + column + '</button>';
      }).join('');
      return '<div class="seat-row"><span class="seat-row-label">' + row + '</span>' + cells + '</div>';
    }).join('');
    const html = '<div id="checkinRoot">' +
      '<div class="modal-head"><h2 id="modalTitle">在线值机</h2><p>选择座位后确认，系统会生成模拟登机牌。值机后订单进入「已值机」状态。</p></div>' +
      '<div class="modal-body">' +
        '<div class="checkin-flight-card">' +
          '<div><span class="checkin-airline">' + esc(order.details ? order.details.airline : '') + ' · ' + esc(order.details ? order.details.flightNo : '') + '</span><strong>' + esc(seatMap.flightNo) + ' · ' + esc(order.title) + '</strong><small>' + esc(order.dateLabel || '') + ' · 登机口 ' + esc(seatMap.gate) + '</small></div>' +
          '<span class="order-status-pill is-paid">' + esc(order.statusLabel || '已支付') + '</span>' +
        '</div>' +
        '<div class="seat-map-legend"><span><i class="seat-swatch available"></i>可选</span><span><i class="seat-swatch occupied"></i>已占用</span><span><i class="seat-swatch blocked"></i>不可选</span><span class="seat-map-note">共 ' + (columns.length * rows.length) + ' 个座位 · 本地座位图</span></div>' +
        '<div class="seat-map"><div class="seat-map-front">机头方向 ↑</div>' + rowsHtml + '</div>' +
        '<div class="checkin-bar"><div>已选座位：<strong id="selectedSeatLabel">请选择</strong></div><button class="primary-button" id="confirmCheckin" type="button" disabled>确认值机</button></div>' +
        '<p class="booking-hint">出于演示考虑，值机仅校验订单状态、航班时间和座位占用，不连接真实航信系统。</p>' +
      '</div>' +
    '</div>';
    const modal = openModal(html, { className: 'modal-checkin' });
    const root = $('#checkinRoot', modal);
    let selected = '';
    const firstAvailable = $('.seat.is-available', root);
    if (firstAvailable) {
      selected = firstAvailable.getAttribute('data-seat');
      firstAvailable.classList.add('is-picked');
      $('#selectedSeatLabel', root).textContent = selected + '（推荐）';
      $('#confirmCheckin', root).disabled = false;
    }
    root.addEventListener('click', async function (event) {
      const seatButton = event.target.closest('[data-seat]');
      if (seatButton && !seatButton.disabled) {
        selected = seatButton.getAttribute('data-seat');
        $$('.seat.is-picked', root).forEach(function (button) { button.classList.remove('is-picked'); });
        seatButton.classList.add('is-picked');
        $('#selectedSeatLabel', root).textContent = selected;
        $('#confirmCheckin', root).disabled = false;
        return;
      }
      const confirm = event.target.closest('#confirmCheckin');
      if (!confirm || !selected) return;
      confirm.disabled = true;
      confirm.textContent = '值机中…';
      try {
        const result = await api.checkIn(order.id, selected);
        upsertOrder(result.order);
        openBoardingPass(result.order, result.boardingPass);
      } catch (error) {
        confirm.disabled = false;
        confirm.textContent = '确认值机';
        toast(error.message);
      }
    });
  }

  async function openBoardingPass(order, presetPass) {
    if (!order) return;
    if (!state.apiOnline) {
      toast('登机牌需要本地后端生成');
      return;
    }
    let boardingPass = presetPass;
    if (!boardingPass) {
      try {
        const result = await api.boardingPass(order.id);
        boardingPass = result.boardingPass;
      } catch (error) {
        toast(error.message);
        return;
      }
    }
    const pass = boardingPass;
    const html = '<div class="modal-body"><div class="boarding-pass-wrap">' +
      '<div class="boarding-pass-sheet">' +
        '<div class="bp-top"><div class="bp-brand">' + svgIcon('plane') + '<strong>橙程航空</strong><span>BOARDING PASS</span></div><span class="bp-sequence">' + esc(pass.boardingPassCode.slice(-8)) + '</span></div>' +
        '<div class="bp-route"><div><span>FROM</span><strong>' + esc(pass.from) + '</strong><small>' + esc(pass.terminal) + '</small></div><div class="bp-plane">' + svgIcon('plane') + '<span>' + esc(pass.flightNo) + '</span></div><div><span>TO</span><strong>' + esc(pass.to) + '</strong><small>' + esc(pass.date) + '</small></div></div>' +
        '<div class="bp-grid">' +
          '<div><span>乘客 PASSENGER</span><strong>' + esc(pass.passenger) + '</strong></div>' +
          '<div><span>航班 FLIGHT</span><strong>' + esc(pass.flightNo) + '</strong></div>' +
          '<div><span>日期 DATE</span><strong>' + esc(pass.date) + '</strong></div>' +
          '<div><span>登机口 GATE</span><strong>' + esc(pass.gate) + '</strong></div>' +
          '<div><span>登机时间 BOARDING</span><strong>' + esc(pass.boardingTime) + '</strong></div>' +
          '<div><span>座位 SEAT</span><strong class="bp-seat">' + esc(pass.seat) + '</strong></div>' +
        '</div>' +
        '<div class="bp-bottom"><div class="bp-barcode">' + pass.boardingPassCode.split('').slice(0, 24).map(function (char) { return '<i style="height:' + (12 + (char.charCodeAt(0) % 22)) + 'px"></i>'; }).join('') + '</div><div class="bp-note">本地模拟登机牌 · 非真实登机凭证</div></div>' +
      '</div>' +
      '<div class="bp-actions"><button class="primary-button" type="button" data-bp-print>打印 / 保存登机牌</button><button class="secondary-button" type="button" data-success-orders>返回订单</button></div>' +
      '<p class="booking-hint">登机口与登机时间均由本地规则生成，不可用于真实机场。</p>' +
    '</div></div>';
    openModal(html, { className: 'modal-boarding-pass' });
  }

  /* ------------------------------------------------------------------ */
  /* Orders / favorites / account                                        */
  /* ------------------------------------------------------------------ */

  function toggleFavorite(id) {
    const hotel = DATA.getHotelById(id);
    if (!hotel) return;
    const added = !state.favorites.has(id);
    if (added) state.favorites.add(id);
    else state.favorites.delete(id);
    writeStore(STORAGE.favorites, Array.from(state.favorites));
    $$('[data-fav="' + id + '"]').forEach(function (button) {
      button.classList.toggle('is-fav', added);
      button.setAttribute('aria-pressed', String(added));
    });
    toast(added ? '已收藏「' + hotel.name + '」' : '已取消收藏「' + hotel.name + '」');
    if ($('#favoritesRoot')) openFavoritesModal();
  }

  function openFavoritesModal() {
    const hotels = Array.from(state.favorites).map(function (id) { return DATA.getHotelById(id); }).filter(Boolean);
    let content;
    if (!hotels.length) {
      content = '<div class="favorite-empty">' + svgIcon('heart') + '<div style="margin-top:10px">还没有收藏酒店。在酒店卡片右上角点击爱心即可收藏。</div></div>';
    } else {
      content = hotels.map(function (hotel) {
        return '<div class="favorite-row">' +
          '<img src="' + esc(hotel.image) + '" alt="' + esc(hotel.name) + '" loading="lazy">' +
          '<button class="rank-copy" type="button" data-modal-hotel="' + esc(hotel.id) + '" style="border:0;background:transparent;text-align:left;padding:0"><strong>' + esc(hotel.name) + '</strong><span>' + esc(hotel.city) + ' · ' + esc(hotel.area) + ' · 评分 ' + hotel.rating.toFixed(1) + '</span></button>' +
          '<span class="rank-price">¥' + money(hotel.price) + '</span>' +
          '<button class="icon-btn" type="button" data-fav="' + esc(hotel.id) + '" aria-label="取消收藏">' + svgIcon('trash') + '</button>' +
        '</div>';
      }).join('');
    }
    openModal('<div id="favoritesRoot"><div class="modal-head"><h2 id="modalTitle">我的收藏</h2><p>收藏只保存在本地浏览器中。</p></div><div class="modal-body" style="display:flex;flex-direction:column;gap:8px">' + content + '</div></div>');
  }

  function openAccountModal() {
    if (!state.user) { openAuth('login'); return; }
    const roleLabel = state.user.role === 'agency' ? '旅行社账户' : '旅客账户';
    const html = '<div id="accountRoot"><div class="modal-head"><h2 id="modalTitle">账户中心</h2><p>' + (state.apiOnline ? '登录态由本地后端会话维护，不连接真实账号系统。' : '后端离线时使用浏览器本地演示账户。') + '</p></div><div class="modal-body">' +
      '<div class="user-card"><span class="user-avatar">' + svgIcon('user') + '</span><div><strong>' + esc(state.user.name || '橙程用户') + '</strong><span>' + esc(maskPhone(state.user.phone)) + ' · ' + esc(roleLabel) + ' · 本地演示</span></div></div>' +
      '<div class="account-stats"><div><strong>' + state.orders.length + '</strong><span>订单</span></div><div><strong>' + state.favorites.size + '</strong><span>收藏酒店</span></div><div><strong>0</strong><span>积分（演示）</span></div></div>' +
      '<div class="account-actions"><button class="primary-button" type="button" data-account-orders>查看订单</button><button class="secondary-button" type="button" data-account-favorites>我的收藏</button><button class="secondary-button" type="button" data-account-logout>退出登录</button></div>' +
      '<p class="demo-note">' + (state.apiOnline ? '账户与订单保存在本机 data/store.json 中；收藏仅保存在浏览器。' : '登录状态、订单与收藏均保存在浏览器本地。') + '</p>' +
    '</div></div>';
    openModal(html, { onMount: function (modal) {
      $('[data-account-orders]', modal).addEventListener('click', openOrdersPage);
      $('[data-account-favorites]', modal).addEventListener('click', openFavoritesModal);
      $('[data-account-logout]', modal).addEventListener('click', async function () {
        if (state.apiOnline && api.hasToken()) {
          try { await api.logout(); } catch (error) { toast('退出接口失败：' + error.message); }
        }
        state.user = null;
        state.orders = [];
        writeStore(STORAGE.user, null);
        api.setToken('');
        updateAuthUi();
        renderOrdersPreview();
        closeModal();
        toast('已退出本地账户');
      });
    } });
  }

  function openAuth(mode, options) {
    if (state.authTimer) {
      window.clearInterval(state.authTimer);
      state.authTimer = null;
    }
    const opts = options || {};
    const isRegister = mode === 'register';
    const role = state.authRole || 'traveler';
    const html = '<div id="authRoot">' +
      '<div class="modal-head"><h2 id="modalTitle">' + (isRegister ? '创建本地账户' : '登录橙程旅行') + '</h2><p>' + (opts.reason ? esc(opts.reason) + '。' : '') + '本平台使用本地会话，不发送真实短信。</p></div>' +
      '<div class="modal-body">' +
        '<div class="auth-tabs"><button type="button" class="auth-tab' + (!isRegister ? ' is-active' : '') + '" data-auth-tab="login">登录</button><button type="button" class="auth-tab' + (isRegister ? ' is-active' : '') + '" data-auth-tab="register">注册</button></div>' +
        '<form class="auth-form" id="authForm" novalidate>' +
          '<div class="form-field"><label for="authPhone">手机号</label><input class="form-input" id="authPhone" type="tel" inputmode="numeric" maxlength="11" placeholder="请输入 11 位手机号" autocomplete="tel"></div>' +
          '<div class="form-field"><label for="authCode">验证码</label><div class="code-row"><input class="form-input" id="authCode" type="text" inputmode="numeric" maxlength="6" placeholder="请输入 6 位验证码"><button class="code-button" id="sendCode" type="button">获取验证码</button></div></div>' +
          '<div class="form-field"><label for="authRole">演示角色</label><select class="form-input" id="authRole"><option value="traveler"' + (role === 'traveler' ? ' selected' : '') + '>旅客 · 搜索、预订与值机</option><option value="agency"' + (role === 'agency' ? ' selected' : '') + '>旅行社 · 可查看全部旅客订单</option></select></div>' +
          '<label class="auth-agreement"><input type="checkbox" id="authAgree"> 我已阅读并同意本地演示的服务说明，知悉本页面不提供真实预订服务。</label>' +
          '<button class="primary-button auth-submit" type="submit">' + (isRegister ? '创建账户' : '登录') + '</button>' +
        '</form>' +
        '<p class="auth-hint">演示验证码固定为 <strong>888888</strong>，任意 11 位中国大陆手机号均可登录。' + (state.apiOnline ? '登录状态由本地后端会话维护。' : '后端离线时将使用浏览器本地账户。') + '</p>' +
      '</div>' +
    '</div>';
    openModal(html, { onMount: function (modal) {
      const root = $('#authRoot', modal);
      root.addEventListener('click', function (event) {
        const tab = event.target.closest('[data-auth-tab]');
        if (tab) {
          state.authRole = $('#authRole').value;
          openAuth(tab.getAttribute('data-auth-tab'), opts);
          return;
        }
        if (event.target.closest('#sendCode')) {
          const phone = $('#authPhone').value.trim();
          if (!/^1[3-9]\d{9}$/.test(phone)) {
            toast('请先输入有效的 11 位手机号');
            $('#authPhone').focus();
            return;
          }
          const button = $('#sendCode');
          let seconds = 60;
          button.disabled = true;
          button.textContent = seconds + 's 后重发';
          toast('演示验证码已发送：888888');
          if (state.authTimer) window.clearInterval(state.authTimer);
          state.authTimer = window.setInterval(function () {
            seconds -= 1;
            if (!document.body.contains(button)) {
              window.clearInterval(state.authTimer);
              state.authTimer = null;
              return;
            }
            if (seconds <= 0) {
              window.clearInterval(state.authTimer);
              state.authTimer = null;
              button.disabled = false;
              button.textContent = '重新获取';
              return;
            }
            button.textContent = seconds + 's 后重发';
          }, 1000);
        }
      });
      $('#authForm', modal).addEventListener('submit', async function (event) {
        event.preventDefault();
        const phone = $('#authPhone').value.trim();
        const code = $('#authCode').value.trim();
        const selectedRole = $('#authRole').value;
        state.authRole = selectedRole;
        if (!/^1[3-9]\d{9}$/.test(phone)) { toast('请输入有效的 11 位手机号'); return; }
        if (code !== '888888') { toast('演示验证码为 888888'); return; }
        if (!$('#authAgree').checked) { toast('请先勾选演示服务说明'); return; }
        const pending = state.pendingAuthAction;
        const submit = $('#authForm', modal).querySelector('button[type="submit"]');
        if (submit) { submit.disabled = true; submit.textContent = '登录中…'; }
        if (state.apiOnline) {
          try {
            const result = await api.login({ phone: phone, code: code, role: selectedRole });
            state.user = result.user;
            updateAuthUi();
            closeModal();
            await refreshOrders({ silent: true });
            toast('登录成功，欢迎回来');
            if (pending) window.setTimeout(pending, 30);
            return;
          } catch (error) {
            if (submit) { submit.disabled = false; submit.textContent = isRegister ? '创建账户' : '登录'; }
            toast(error.message);
            return;
          }
        }
        state.user = { phone: phone, name: selectedRole === 'agency' ? '旅行社演示账号' : '橙程用户', role: selectedRole, loginAt: new Date().toISOString() };
        writeStore(STORAGE.user, state.user);
        updateAuthUi();
        closeModal();
        toast('登录成功，欢迎回来');
        if (pending) window.setTimeout(pending, 30);
      });
      $('#authPhone', modal).focus();
    } });
  }

  /* ------------------------------------------------------------------ */
  /* City picker / calendar / suggestions                                */
  /* ------------------------------------------------------------------ */

  function openCityPicker(target) {
    if (target === 'hotel') {
      $('#hotelCitySuggest').hidden = true;
    }
    let region = (DATA.findCity(getTargetCity(target)) || {}).region === 'international' ? 'international' : 'domestic';
    let query = '';
    const html = '<div id="cityPickerRoot">' +
      '<div class="modal-head"><h2 id="modalTitle">选择城市</h2><p>选择目的地后，将自动带回到搜索表单。</p></div>' +
      '<div class="modal-body">' +
        '<div class="city-search-line">' + svgIcon('search') + '<input id="cityPickerSearch" type="text" placeholder="搜索城市名称或拼音" autocomplete="off"></div>' +
        '<div class="city-modal-tabs"><button type="button" class="city-modal-tab' + (region === 'domestic' ? ' is-active' : '') + '" data-region="domestic">国内（含港澳台）</button><button type="button" class="city-modal-tab' + (region === 'international' ? ' is-active' : '') + '" data-region="international">海外</button></div>' +
        '<div id="cityPickerBody"></div>' +
        '<p class="city-hint">酒店、机票、火车票与门票共用这份本地城市列表。</p>' +
      '</div>' +
    '</div>';
    const modal = openModal(html, { className: 'modal-city' });
    const root = $('#cityPickerRoot', modal);
    const searchInput = $('#cityPickerSearch', modal);
    const body = $('#cityPickerBody', modal);

    function render() {
      const current = getTargetCity(target);
      const normalizedQuery = query.trim().toLowerCase();
      const list = DATA.cities.filter(function (city) {
        if (city.region !== region) return false;
        if (!normalizedQuery) return true;
        return city.name.toLowerCase().indexOf(normalizedQuery) !== -1 || city.en.toLowerCase().indexOf(normalizedQuery) !== -1;
      });
      let inner = '';
      if (!list.length) {
        inner = '<div class="city-hint" style="padding:26px 0;text-align:center">没有找到匹配城市，换个关键词试试。</div>';
      } else if (normalizedQuery) {
        inner = '<div class="city-section"><h4>搜索结果</h4><div class="city-grid">' + list.map(function (city) {
          return '<button type="button" class="city-option' + (city.name === current ? ' is-active' : '') + '" data-city-name="' + esc(city.name) + '">' + esc(city.name) + '</button>';
        }).join('') + '</div></div>';
      } else {
        const hot = list.filter(function (city) { return city.hot; });
        if (hot.length) {
          inner += '<div class="city-section"><h4>热门城市</h4><div class="city-grid">' + hot.map(function (city) {
            return '<button type="button" class="city-option' + (city.name === current ? ' is-active' : '') + '" data-city-name="' + esc(city.name) + '">' + esc(city.name) + '</button>';
          }).join('') + '</div></div>';
        }
        const groups = {};
        list.forEach(function (city) {
          const letter = city.en.charAt(0).toUpperCase();
          if (!groups[letter]) groups[letter] = [];
          groups[letter].push(city);
        });
        Object.keys(groups).sort().forEach(function (letter) {
          inner += '<div class="city-letter-group"><div class="city-letter">' + letter + '</div><div class="city-letter-list">' + groups[letter].map(function (city) {
            return '<button type="button" class="city-option' + (city.name === current ? ' is-active' : '') + '" data-city-name="' + esc(city.name) + '">' + esc(city.name) + '</button>';
          }).join('') + '</div></div>';
        });
      }
      body.innerHTML = inner;
    }

    searchInput.addEventListener('input', function () {
      query = searchInput.value;
      render();
    });
    root.addEventListener('click', function (event) {
      const tab = event.target.closest('[data-region]');
      if (tab) {
        region = tab.getAttribute('data-region');
        $$('.city-modal-tab', root).forEach(function (button) {
          button.classList.toggle('is-active', button.getAttribute('data-region') === region);
        });
        render();
        return;
      }
      const option = event.target.closest('[data-city-name]');
      if (option) {
        applyCity(target, option.getAttribute('data-city-name'));
        closeModal();
      }
    });
    render();
    searchInput.focus();
  }

  function getTargetCity(target) {
    if (target === 'hotel') return state.search.city;
    if (target === 'flightFrom') return state.flight.from;
    if (target === 'flightTo') return state.flight.to;
    if (target === 'trainFrom') return state.train.from;
    if (target === 'trainTo') return state.train.to;
    if (target === 'ticket') return state.ticket.city;
    return state.search.city;
  }

  function applyCity(target, city) {
    if (target === 'hotel') { state.search.city = city; $('#hotelCityInput').value = city; }
    else if (target === 'flightFrom') { state.flight.from = city; $('#flightFromInput').value = city; }
    else if (target === 'flightTo') { state.flight.to = city; $('#flightToInput').value = city; }
    else if (target === 'trainFrom') { state.train.from = city; $('#trainFromInput').value = city; }
    else if (target === 'trainTo') { state.train.to = city; $('#trainToInput').value = city; }
    else if (target === 'ticket') { state.ticket.city = city; $('#ticketCityInput').value = city; }
    toast('已选择 ' + city);
  }

  function positionFloating(panel, anchor, preferredWidth, offset) {
    panel.hidden = false;
    panel.classList.add('is-floating');
    const rect = anchor.getBoundingClientRect();
    const width = Math.max(220, Math.min(preferredWidth || rect.width || 320, window.innerWidth - 24));
    panel.style.width = width + 'px';
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    panel.style.left = left + 'px';
    const height = Math.min(panel.scrollHeight || panel.offsetHeight || 240, 360);
    let top = rect.bottom + (offset == null ? 8 : offset);
    if (top + height > window.innerHeight - 12 && rect.top - height - (offset == null ? 8 : offset) > 12) {
      top = rect.top - height - (offset == null ? 8 : offset);
    }
    panel.style.top = Math.max(12, top) + 'px';
  }

  function hideFloatingPanels() {
    $$('.is-floating').forEach(function (panel) {
      panel.hidden = true;
      panel.classList.remove('is-floating');
    });
    $('#globalSuggestions').hidden = true;
  }

  function bindCitySuggest(input, panel, onPick) {
    function render() {
      const query = input.value.trim().toLowerCase();
      let list = DATA.cities.filter(function (city) {
        return !query || city.name.toLowerCase().indexOf(query) !== -1 || city.en.toLowerCase().indexOf(query) !== -1;
      });
      if (!query) {
        list = DATA.cities.filter(function (city) { return city.hot; }).slice(0, 10);
      } else {
        list = list.slice(0, 12);
      }
      hideFloatingPanels();
      if (!list.length) {
        panel.innerHTML = '<div class="suggest-label">没有匹配城市</div><div class="suggest-item"><span class="suggest-item-copy"><strong>可直接使用当前输入</strong><span>搜索时会按输入城市处理</span></span></div>';
      } else {
        panel.innerHTML = '<div class="suggest-label">' + (query ? '匹配城市' : '热门城市') + '</div>' + list.map(function (city) {
          return '<button type="button" class="suggest-item" data-city-pick="' + esc(city.name) + '">' +
            '<span class="suggest-item-icon">' + svgIcon('location') + '</span>' +
            '<span class="suggest-item-copy"><strong>' + esc(city.name) + '</strong><span>' + esc(city.en) + ' · ' + (city.region === 'international' ? '海外' : '国内') + '</span></span>' +
          '</button>';
        }).join('');
      }
      positionFloating(panel, input.closest('.field') || input, 320);
    }
    input.addEventListener('focus', render);
    input.addEventListener('input', render);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        panel.hidden = true;
        panel.classList.remove('is-floating');
      }
    });
    panel.addEventListener('click', function (event) {
      const button = event.target.closest('[data-city-pick]');
      if (!button) return;
      const city = button.getAttribute('data-city-pick');
      onPick(city);
      panel.hidden = true;
      panel.classList.remove('is-floating');
    });
  }

  function updateGlobalSuggestions() {
    const input = $('#globalSearchInput');
    const panel = $('#globalSuggestions');
    const query = input.value.trim();
    const cityMatches = DATA.cities.filter(function (city) {
      if (!query) return city.hot;
      return city.name.toLowerCase().indexOf(query.toLowerCase()) !== -1 || city.en.toLowerCase().indexOf(query.toLowerCase()) !== -1;
    }).slice(0, query ? 4 : 6);
    const hotelMatches = query ? DATA.searchHotels(query).slice(0, 4) : [];
    let html = '';
    if (cityMatches.length) {
      html += '<div class="suggest-label">城市</div>' + cityMatches.map(function (city) {
        return '<button type="button" class="suggest-item" data-global-city="' + esc(city.name) + '"><span class="suggest-item-icon">' + svgIcon('location') + '</span><span class="suggest-item-copy"><strong>' + esc(city.name) + '</strong><span>' + esc(city.en) + ' · ' + (city.region === 'international' ? '海外' : '国内') + '</span></span></button>';
      }).join('');
    }
    if (hotelMatches.length) {
      html += '<div class="suggest-label">酒店</div>' + hotelMatches.map(function (hotel) {
        return '<button type="button" class="suggest-item" data-global-hotel="' + esc(hotel.id) + '"><span class="suggest-item-icon">' + svgIcon('bed') + '</span><span class="suggest-item-copy"><strong>' + esc(hotel.name) + '</strong><span>' + esc(hotel.city) + ' · ' + esc(hotel.area) + ' · ¥' + money(hotel.price) + '起</span></span></button>';
      }).join('');
    }
    if (!html) {
      html = '<div class="suggest-label">没有直接匹配</div><button type="button" class="suggest-item" data-global-search-query="' + esc(query) + '"><span class="suggest-item-icon">' + svgIcon('search') + '</span><span class="suggest-item-copy"><strong>按“' + esc(query) + '”搜索酒店</strong><span>从当前位置继续搜索</span></span></button>';
    }
    panel.innerHTML = html;
    panel.hidden = false;
  }

  function openCalendar(target) {
    const isHotel = target === 'hotel';
    let baseDate;
    if (target === 'hotel') baseDate = state.search.checkin;
    else if (target === 'flight') baseDate = state.flight.date;
    else if (target === 'train') baseDate = state.train.date;
    else baseDate = state.ticket.date;
    const cache = {
      target: target,
      isHotel: isHotel,
      start: baseDate,
      end: isHotel ? state.search.checkout : null,
      view: firstOfMonth(baseDate)
    };
    state.calendar = cache;
    const html = '<div id="calendarRoot">' +
      '<div class="modal-head"><h2 id="modalTitle">' + (isHotel ? '选择入住和退房日期' : '选择出发日期') + '</h2><p>' + (isHotel ? '先选入住日期，再选退房日期。今天之后的日期均可选择。' : '选择今天或之后的日期。') + '</p></div>' +
      '<div class="modal-body">' +
        '<div class="calendar-summary" id="calendarSummary"></div>' +
        '<div class="calendar-months" id="calendarMonths"></div>' +
        '<div class="calendar-footer"><div class="calendar-footer-copy" id="calendarFooterCopy"></div><div class="calendar-actions"><button class="secondary-button" type="button" data-close-modal>取消</button><button class="primary-button" type="button" id="calendarConfirm" disabled>确定</button></div></div>' +
      '</div>' +
    '</div>';
    const modal = openModal(html, { className: 'modal-calendar' });
    const root = $('#calendarRoot', modal);

    function render() {
      const startKey = cache.start ? dateKey(cache.start) : '';
      const endKey = cache.end ? dateKey(cache.end) : '';
      $('#calendarSummary', root).innerHTML = cache.start
        ? (cache.isHotel
          ? '入住 <strong>' + formatFull(cache.start) + '</strong>' + (cache.end ? ' · 退房 <strong>' + formatFull(cache.end) + '</strong>' : ' · 请选择退房日期')
          : '已选择 <strong>' + formatFull(cache.start) + ' ' + weekdayName(cache.start) + '</strong>')
        : '请选择日期';
      let monthsHtml = calendarMonthHtml(cache.view, cache, true);
      if (cache.isHotel) monthsHtml += calendarMonthHtml(addMonths(cache.view, 1), cache, false);
      $('#calendarMonths', root).innerHTML = monthsHtml;
      const nights = cache.start && cache.end ? diffDays(cache.start, cache.end) : 0;
      $('#calendarFooterCopy', root).innerHTML = cache.isHotel
        ? (cache.start && cache.end ? formatMD(cache.start) + ' - ' + formatMD(cache.end) + ' · 共 <strong>' + nights + '</strong> 晚' : '请选择完整的入住与退房日期')
        : (cache.start ? formatFull(cache.start) + ' · ' + weekdayName(cache.start) : '请选择日期');
      $('#calendarConfirm', root).disabled = cache.isHotel ? !(cache.start && cache.end && nights > 0) : !cache.start;
    }

    function handleClick(event) {
      const nav = event.target.closest('[data-cal-nav]');
      if (nav) {
        const delta = Number(nav.getAttribute('data-cal-nav'));
        const next = addMonths(cache.view, delta);
        if (next < firstOfMonth(TODAY)) return;
        cache.view = next;
        render();
        return;
      }
      const dayButton = event.target.closest('[data-cal-date]');
      if (dayButton) {
        const selected = parseDateKey(dayButton.getAttribute('data-cal-date'));
        if (selected < TODAY) return;
        if (!cache.isHotel) {
          cache.start = selected;
          cache.end = null;
        } else if (!cache.start || (cache.start && cache.end)) {
          cache.start = selected;
          cache.end = null;
        } else if (selected <= cache.start) {
          cache.start = selected;
          cache.end = null;
        } else {
          cache.end = selected;
        }
        render();
        return;
      }
      if (event.target.closest('#calendarConfirm')) {
        if (!cache.start) return;
        if (cache.isHotel && (!cache.end || diffDays(cache.start, cache.end) < 1)) return;
        if (cache.target === 'hotel') {
          state.search.checkin = cache.start;
          state.search.checkout = cache.end;
        } else if (cache.target === 'flight') {
          state.flight.date = cache.start;
        } else if (cache.target === 'train') {
          state.train.date = cache.start;
        } else {
          state.ticket.date = cache.start;
        }
        updateAllDateUi();
        closeModal();
        toast(cache.isHotel ? '已更新入住日期' : '已更新出发日期');
      }
    }

    root.addEventListener('click', handleClick);
    render();
  }

  function calendarMonthHtml(month, cache, withNav) {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const startKey = cache.start ? dateKey(cache.start) : '';
    const endKey = cache.end ? dateKey(cache.end) : '';
    const canGoPrev = month > firstOfMonth(TODAY);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    let cells = '';
    for (let i = 0; i < firstWeekday; i += 1) cells += '<span></span>';
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, monthIndex, day);
      const key = dateKey(date);
      const disabled = date < TODAY;
      const isStart = key === startKey;
      const isEnd = key === endKey;
      const inRange = cache.isHotel && startKey && endKey && key > startKey && key < endKey;
      const classes = ['cal-day'];
      if (disabled) classes.push('is-other');
      if (key === dateKey(TODAY)) classes.push('is-today');
      if (isStart) classes.push('is-start');
      if (isEnd) classes.push('is-end');
      if (inRange) classes.push('is-in-range');
      cells += '<button type="button" class="' + classes.join(' ') + '" data-cal-date="' + key + '"' + (disabled ? ' disabled' : '') + '>' + day + '</button>';
    }
    return '<div class="calendar-month"><div class="calendar-month-head"><strong>' + year + '年' + (monthIndex + 1) + '月</strong>' +
      (withNav ? '<div class="calendar-nav"><button type="button" data-cal-nav="-1"' + (canGoPrev ? '' : ' disabled') + ' aria-label="上个月">' + svgIcon('chevron-left') + '</button><button type="button" data-cal-nav="1" aria-label="下个月">' + svgIcon('chevron-right') + '</button></div>' : '') +
      '</div><div class="cal-weekdays">' + weekdays.map(function (day) { return '<span>' + day + '</span>'; }).join('') + '</div><div class="cal-grid">' + cells + '</div></div>';
  }

  /* ------------------------------------------------------------------ */
  /* Planner / map / support                                             */
  /* ------------------------------------------------------------------ */

  function openPlannerModal() {
    const cityOptions = DATA.recommendCities.map(function (city) {
      return '<option value="' + esc(city) + '">' + esc(city) + '</option>';
    }).join('');
    const html = '<div id="plannerRoot">' +
      '<div class="modal-head"><h2 id="modalTitle">AI 行程助手</h2><p>按目的地、天数和偏好，在本地生成一份可执行的旅行草案。</p></div>' +
      '<div class="modal-body">' +
        '<div id="plannerFormArea">' +
          '<div class="planner-steps">' +
            '<div class="planner-choice"><label for="plannerCity">目的地</label><select class="form-input" id="plannerCity">' + cityOptions + '</select></div>' +
            '<div class="planner-choice"><label for="plannerDays">行程天数</label><select class="form-input" id="plannerDays"><option value="2">2天1晚</option><option value="3" selected>3天2晚</option><option value="4">4天3晚</option></select></div>' +
            '<div class="planner-choice"><label>旅行偏好</label><div class="planner-chip-row"><button class="planner-chip is-active" type="button" data-planner-style="休闲">休闲</button><button class="planner-chip" type="button" data-planner-style="美食">美食</button><button class="planner-chip" type="button" data-planner-style="亲子">亲子</button><button class="planner-chip" type="button" data-planner-style="文化">文化</button></div></div>' +
          '</div>' +
          '<div class="planner-actions"><button class="primary-button" id="plannerGenerate" type="button">生成行程</button><button class="secondary-button" type="button" data-close-modal>关闭</button></div>' +
          '<p class="demo-note">行程内容由本地规则与模拟景点生成，适合体验交互，不代表真实旅行建议。</p>' +
        '</div>' +
        '<div id="plannerResult" class="planner-result" hidden></div>' +
      '</div>' +
    '</div>';
    const modal = openModal(html, { className: 'modal-wide' });
    const root = $('#plannerRoot', modal);
    root.addEventListener('click', function (event) {
      const styleButton = event.target.closest('[data-planner-style]');
      if (styleButton) {
        $$('[data-planner-style]', root).forEach(function (button) { button.classList.toggle('is-active', button === styleButton); });
        return;
      }
      if (event.target.closest('#plannerGenerate')) {
        const city = $('#plannerCity', root).value;
        const days = Number($('#plannerDays', root).value);
        const style = $('.planner-chip.is-active', root) ? $('.planner-chip.is-active', root).getAttribute('data-planner-style') : '休闲';
        generatePlanner(root, city, days, style);
        return;
      }
      if (event.target.closest('[data-planner-search]')) {
        const city = event.target.closest('[data-planner-search]').getAttribute('data-planner-search');
        closeModal();
        startHotelSearch(city, '');
        return;
      }
      if (event.target.closest('[data-planner-reset]')) {
        openPlannerModal();
      }
    });
  }

  async function generatePlanner(root, city, days, style) {
    const generate = $('#plannerGenerate', root);
    if (state.apiOnline) {
      if (generate) { generate.disabled = true; generate.textContent = '生成中…'; }
      const styleMap = { '休闲': 'relax', '美食': 'food', '亲子': 'family', '文化': 'culture' };
      try {
        const result = await api.itinerary({ city: city, days: days, preferences: [styleMap[style] || 'relax'] });
        renderApiPlannerResult(root, result);
        return;
      } catch (error) {
        toast('行程 API 失败，已使用本地规则：' + error.message);
      } finally {
        if (generate) { generate.disabled = false; generate.textContent = '生成行程'; }
      }
    }
    renderPlannerResult(root, city, days, style);
  }

  function renderApiPlannerResult(root, data) {
    state.plannerResult = data;
    const daysHtml = data.plan.map(function (day) {
      const items = day.items.map(function (item) {
        return '<div class="planner-item"><b>' + esc(item.time) + '</b><span>' + esc(item.title) + ' · ' + esc(item.detail) + '</span></div>';
      }).join('');
      return '<div class="planner-day">' +
        '<div class="planner-day-no"><strong>DAY</strong><span>' + day.day + '</span></div>' +
        '<div class="planner-schedule">' + items +
          '<div class="planner-item"><b>入住</b><span>建议入住「' + esc(day.hotel.name) + '」，' + esc(day.hotel.area) + '，参考价 ¥' + money(day.hotel.price) + ' 起。</span></div>' +
        '</div>' +
      '</div>';
    }).join('');
    $('#plannerFormArea', root).hidden = true;
    const result = $('#plannerResult', root);
    result.hidden = false;
    result.innerHTML = '<div class="planner-banner"><div><strong>' + esc(data.city) + ' · ' + data.days + '天' + (data.days - 1) + '晚 · ' + esc(data.preferences.join(' / ') || '均衡') + '行程</strong><span>' + esc(data.summary) + ' · 预计 ¥' + money(data.estimatedCost) + '</span></div>' + svgIcon('sparkle') + '</div>' +
      daysHtml +
      '<div class="planner-actions"><button class="primary-button" type="button" data-planner-search="' + esc(data.city) + '">按此行程找酒店</button><button class="secondary-button" type="button" data-planner-reset>重新规划</button></div>' +
      '<p class="demo-note">行程由本地后端 API 按模拟景点与酒店生成，不构成真实旅行建议。</p>';
  }

  function renderPlannerResult(root, city, days, style) {
    const attractions = DATA.getAttractions(city);
    const hotels = DATA.getHotels(city);
    state.plannerResult = { city: city, days: days, style: style };
    let daysHtml = '';
    for (let day = 1; day <= days; day += 1) {
      const first = attractions[(day - 1) * 2 % attractions.length];
      const second = attractions[(day * 2) % attractions.length];
      const hotel = hotels[(day - 1) % hotels.length];
      daysHtml += '<div class="planner-day">' +
        '<div class="planner-day-no"><strong>DAY</strong><span>' + day + '</span></div>' +
        '<div class="planner-schedule">' +
          '<div class="planner-item"><b>09:30</b><span>前往「' + esc(first.name) + '」，' + esc(first.duration) + '，建议提前预约。</span></div>' +
          '<div class="planner-item"><b>13:30</b><span>体验「' + esc(second.name) + '」，安排 ' + esc(second.duration) + ' 的轻松行程。</span></div>' +
          '<div class="planner-item"><b>18:30</b><span>在 ' + esc(city) + ' 本地街区享用晚餐，留出自由漫步时间。</span></div>' +
          '<div class="planner-item"><b>入住</b><span>建议入住「' + esc(hotel.name) + '」，' + esc(hotel.area) + '，参考价 ¥' + money(hotel.price) + ' 起。</span></div>' +
        '</div>' +
      '</div>';
    }
    $('#plannerFormArea', root).hidden = true;
    const result = $('#plannerResult', root);
    result.hidden = false;
    result.innerHTML = '<div class="planner-banner"><div><strong>' + esc(city) + ' · ' + days + '天' + (days - 1) + '晚 · ' + esc(style) + '行程</strong><span>本地生成的旅行草案，可继续搜索同城酒店落实住宿。</span></div>' + svgIcon('sparkle') + '</div>' +
      daysHtml +
      '<div class="planner-actions"><button class="primary-button" type="button" data-planner-search="' + esc(city) + '">按此行程找酒店</button><button class="secondary-button" type="button" data-planner-reset>重新规划</button></div>';
  }

  function openMapModal(city) {
    const currentCity = DATA.normalizeCity(city) || state.search.city;
    const hotels = DATA.getHotels(currentCity);
    const positions = [
      { left: '24%', top: '34%' },
      { left: '56%', top: '26%' },
      { left: '72%', top: '54%' },
      { left: '42%', top: '64%' },
      { left: '18%', top: '72%' },
      { left: '82%', top: '30%' }
    ];
    const options = DATA.recommendCities.map(function (name) {
      return '<option value="' + esc(name) + '"' + (name === currentCity ? ' selected' : '') + '>' + esc(name) + '</option>';
    }).join('');
    const pins = hotels.map(function (hotel, index) {
      const position = positions[index % positions.length];
      return '<button type="button" class="map-pin" style="left:' + position.left + ';top:' + position.top + '" data-map-hotel="' + esc(hotel.id) + '"><span>¥' + money(hotel.price) + '</span>' + svgIcon('pin') + '</button>';
    }).join('');
    const rows = hotels.map(function (hotel) {
      return '<button type="button" class="map-hotel-row" data-map-hotel="' + esc(hotel.id) + '"><img src="' + esc(hotel.image) + '" alt="' + esc(hotel.name) + '"><span><strong>' + esc(hotel.name) + '</strong><span>' + esc(hotel.area) + ' · ¥' + money(hotel.price) + '起</span></span></button>';
    }).join('');
    const html = '<div id="mapRoot">' +
      '<div class="modal-head"><h2 id="modalTitle">地图找酒店</h2><p>点击地图标记或右侧列表查看酒店详情。地图为本地绘制的示意地图，不是真实地理数据。</p><div class="map-city-select"><label for="mapCitySelect">城市</label><select id="mapCitySelect" class="form-input">' + options + '</select></div></div>' +
      '<div class="modal-body"><div class="map-modal-layout">' +
        '<div><div class="map-board"><div class="map-board-art">' +
          '<svg viewBox="0 0 700 390" preserveAspectRatio="xMidYMid slice"><rect width="700" height="390" fill="#eef6ff"></rect>' +
            '<path d="M-20 300 C 100 230 180 270 280 220 S 500 130 720 170 L720 390 L-20 390Z" fill="#d1e9df"></path>' +
            '<path d="M-30 335 C 120 265 210 305 320 245 S 540 165 740 215" fill="none" stroke="#a9d1f8" stroke-width="28"></path>' +
            '<g stroke="#ffffff" stroke-width="10" opacity=".9"><path d="M60 0v390M220 0v390M420 0v390M610 0v390M0 80h700M0 200h700M0 320h700"></path></g>' +
            '<g fill="#dcebe0"><rect x="90" y="100" width="84" height="55" rx="10"></rect><rect x="460" y="230" width="100" height="48" rx="10"></rect><rect x="250" y="248" width="74" height="46" rx="10"></rect></g>' +
            '<g fill="#fff" opacity=".65"><rect x="260" y="100" width="80" height="48" rx="8"></rect><rect x="480" y="82" width="80" height="48" rx="8"></rect></g>' +
            '<circle cx="330" cy="150" r="38" fill="#b7ddff" opacity=".75"></circle>' +
          '</svg>' +
        '</div>' + pins + '</div><div class="map-legend"><span>● 酒店位置为模拟分布</span><span>地图不包含真实道路与坐标</span></div></div>' +
        '<div class="map-side-list">' + rows + '</div>' +
      '</div></div>' +
    '</div>';
    const modal = openModal(html, { className: 'modal-map' });
    const root = $('#mapRoot', modal);
    $('#mapCitySelect', root).addEventListener('change', function (event) { openMapModal(event.target.value); });
    root.addEventListener('click', function (event) {
      const hotelButton = event.target.closest('[data-map-hotel]');
      if (hotelButton) openHotelDetail(DATA.getHotelById(hotelButton.getAttribute('data-map-hotel')));
    });
  }

  function openRankModal() {
    const hotels = [];
    DATA.recommendCities.forEach(function (city) {
      DATA.getHotels(city).forEach(function (hotel) { hotels.push(hotel); });
    });
    hotels.sort(function (a, b) { return b.rating - a.rating || b.reviewCount - a.reviewCount; });
    const top = hotels.slice(0, 8);
    const rows = top.map(function (hotel, index) {
      return '<button class="rank-row" type="button" data-modal-hotel="' + esc(hotel.id) + '"><span class="rank-num">' + (index + 1) + '</span><img src="' + esc(hotel.image) + '" alt="' + esc(hotel.name) + '"><span class="rank-copy"><strong>' + esc(hotel.name) + '</strong><span>' + esc(hotel.city) + ' · ' + esc(hotel.area) + ' · ' + hotel.rating.toFixed(1) + '分 · ' + money(hotel.reviewCount) + '条点评</span></span><span class="rank-price">¥' + money(hotel.price) + '</span></button>';
    }).join('');
    openModal('<div class="modal-head"><h2 id="modalTitle">橙程榜单</h2><p>按模拟评分与点评数综合排序，帮助快速挑选住宿。点击任意酒店查看详情。</p></div><div class="modal-body">' + rows + '<p class="demo-note">榜单仅基于本地生成的模拟数据，不代表真实酒店排名。</p></div>');
  }

  function openSupportModal() {
    const html = '<div id="supportRoot">' +
      '<div class="modal-head"><h2 id="modalTitle">联系客服</h2><p>本地演示客服，不会连接真人坐席。你可以体验 FAQ 与自动回复。</p></div>' +
      '<div class="modal-body"><div class="support-layout">' +
        '<div class="support-faq"><button type="button" data-faq="如何查看我的订单？">如何查看订单？</button><button type="button" data-faq="如何取消本地订单？">如何取消订单？</button><button type="button" data-faq="订单会真实扣费吗？">会真实扣费吗？</button><button type="button" data-faq="如何收藏酒店？">如何收藏酒店？</button></div>' +
        '<div><div class="chat-log" id="chatLog"><div class="chat-msg bot">你好，我是橙程本地演示助手。可以问我订单、取消、收藏或搜索相关的问题。</div></div><form class="chat-form" id="supportForm"><input id="supportInput" type="text" placeholder="输入你的问题..." autocomplete="off"><button class="primary-button" type="submit">发送</button></form></div>' +
      '</div></div>' +
    '</div>';
    const modal = openModal(html);
    const root = $('#supportRoot', modal);
    const log = $('#chatLog', root);
    function append(role, text) {
      const message = document.createElement('div');
      message.className = 'chat-msg ' + role;
      message.textContent = text;
      log.appendChild(message);
      log.scrollTop = log.scrollHeight;
    }
    function reply(question) {
      window.setTimeout(function () {
        if (!document.body.contains(log)) return;
        let answer = '这是本地演示客服。你可以体验搜索、详情、预订、订单与收藏等完整流程，所有数据都保存在浏览器中。';
        if (/订单|查/.test(question)) answer = '点击右上角“我的订单”即可查看本地订单。完成预订后会立即出现在列表中，也可以随时取消。';
        else if (/取消|退款/.test(question)) answer = '在“我的订单”中点击“取消订单”即可把本地订单标记为已取消。演示订单不涉及真实退款。';
        else if (/扣费|支付|真实/.test(question)) answer = '不会。本页面完全在本地运行，不连接支付机构，也不会产生真实费用或出票。';
        else if (/收藏/.test(question)) answer = '在酒店卡片右上角点击心形按钮即可收藏，顶部心形入口可以查看全部收藏。';
        else if (/酒店|搜索/.test(question)) answer = '在首页选择“酒店”，填写目的地、日期和人数后点击搜索，即可查看筛选、详情和预订流程。';
        append('bot', answer);
      }, 450);
    }
    root.addEventListener('click', function (event) {
      const faq = event.target.closest('[data-faq]');
      if (!faq) return;
      const question = faq.getAttribute('data-faq');
      append('user', question);
      reply(question);
    });
    $('#supportForm', root).addEventListener('submit', function (event) {
      event.preventDefault();
      const input = $('#supportInput', root);
      const question = input.value.trim();
      if (!question) return;
      input.value = '';
      append('user', question);
      reply(question);
    });
    $('#supportInput', root).focus();
  }

  function openBusinessModal() {
    openModal('<div class="modal-head"><h2 id="modalTitle">橙程商旅 · 本地演示</h2><p>企业差旅管理模块的界面演示，不提供真实企业服务。</p></div><div class="modal-body">' +
      '<div class="detail-tag-line"><span class="detail-tag is-accent">统一预订</span><span class="detail-tag">费用管控</span><span class="detail-tag">月度对账</span><span class="detail-tag">差旅政策</span></div>' +
      '<p style="margin-top:16px;font-size:13px;line-height:1.9;color:#55657c">真实的企业商旅系统通常包含员工权限、成本中心、审批流、协议价与发票管理。本演示只复刻首页入口和说明，不包含登录态企业数据和真实协议价。</p>' +
      '<div class="booking-submit-row"><button class="primary-button" type="button" data-close-modal>返回首页</button></div>' +
      '<p class="demo-note">该入口与真实携程商旅无关。</p></div>');
  }

  function openAppModal() {
    openModal('<div class="modal-head"><h2 id="modalTitle">手机版演示</h2><p>当前站点已经适配移动端浏览器。</p></div><div class="modal-body"><div class="user-card"><span class="user-avatar">' + svgIcon('phone') + '</span><div><strong>直接使用移动浏览器访问</strong><span>将页面地址在手机浏览器中打开即可体验响应式布局。</span></div></div><p class="demo-note">本演示不包含真实的 App 下载二维码或原生客户端。</p><div class="booking-submit-row"><button class="primary-button" type="button" data-close-modal>知道了</button></div></div>');
  }

  function openInfoModal(title) {
    openModal('<div class="modal-head"><h2 id="modalTitle">' + esc(title) + '</h2><p>这是一个本地旅行预订交互演示。</p></div><div class="modal-body"><p style="font-size:13px;line-height:1.9;color:#55657c">本页面不提供真实预订、支付、出票或客服服务，与携程旅行网及任何真实旅行服务商无关联。页面中的酒店、航班、车次、门票、价格、评分和订单均为本地模拟数据，仅用于展示搜索、筛选、详情、下单、订单管理和收藏等交互流程。</p><p class="demo-note">你可以关闭此窗口继续体验站点功能。</p><div class="booking-submit-row"><button class="primary-button" type="button" data-close-modal>继续体验</button></div></div>');
  }

  /* ------------------------------------------------------------------ */
  /* Modal and toast                                                     */
  /* ------------------------------------------------------------------ */

  function openModal(html, options) {
    const opts = options || {};
    hideFloatingPanels();
    const overlay = $('#overlay');
    const modal = $('#modal');
    state.lastFocused = document.activeElement;
    overlay.hidden = false;
    modal.className = 'modal' + (opts.className ? ' ' + opts.className : '');
    $('#modalContent').innerHTML = html;
    document.body.classList.add('modal-open');
    state.modalOpen = true;
    if (opts.onMount) opts.onMount(modal);
    return modal;
  }

  function closeModal() {
    const overlay = $('#overlay');
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    $('#modalContent').innerHTML = '';
    $('#modal').className = 'modal';
    document.body.classList.remove('modal-open');
    state.modalOpen = false;
    state.pendingAuthAction = null;
    if (state.authTimer) {
      window.clearInterval(state.authTimer);
      state.authTimer = null;
    }
    if (state.lastFocused && typeof state.lastFocused.focus === 'function' && document.body.contains(state.lastFocused)) {
      try { state.lastFocused.focus({ preventScroll: true }); } catch (error) { /* ignore */ }
    }
  }

  function toast(message) {
    const stack = $('#toastStack');
    const item = document.createElement('div');
    item.className = 'toast';
    item.textContent = message;
    stack.appendChild(item);
    window.requestAnimationFrame(function () { item.classList.add('is-visible'); });
    window.setTimeout(function () {
      item.classList.remove('is-visible');
      window.setTimeout(function () { item.remove(); }, 240);
    }, 2600);
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    $('#hotelForm').addEventListener('submit', function (event) { event.preventDefault(); performHotelSearch(); });
    $('#flightForm').addEventListener('submit', function (event) { event.preventDefault(); performFlightSearch(); });
    $('#trainForm').addEventListener('submit', function (event) { event.preventDefault(); performTrainSearch(); });
    $('#ticketForm').addEventListener('submit', function (event) { event.preventDefault(); performTicketSearch(); });

    bindCitySuggest($('#hotelCityInput'), $('#hotelCitySuggest'), function (city) {
      state.search.city = city;
      $('#hotelCityInput').value = city;
    });
    bindCitySuggest($('#flightFromInput'), $('#flightFromSuggest'), function (city) {
      state.flight.from = city;
      $('#flightFromInput').value = city;
    });
    bindCitySuggest($('#flightToInput'), $('#flightToSuggest'), function (city) {
      state.flight.to = city;
      $('#flightToInput').value = city;
    });
    bindCitySuggest($('#trainFromInput'), $('#trainFromSuggest'), function (city) {
      state.train.from = city;
      $('#trainFromInput').value = city;
    });
    bindCitySuggest($('#trainToInput'), $('#trainToSuggest'), function (city) {
      state.train.to = city;
      $('#trainToInput').value = city;
    });
    bindCitySuggest($('#ticketCityInput'), $('#ticketCitySuggest'), function (city) {
      state.ticket.city = city;
      $('#ticketCityInput').value = city;
    });

    $('#swapCities').addEventListener('click', function () {
      const from = $('#flightFromInput').value;
      $('#flightFromInput').value = $('#flightToInput').value;
      $('#flightToInput').value = from;
      state.flight.from = $('#flightFromInput').value;
      state.flight.to = $('#flightToInput').value;
      toast('已交换出发与到达城市');
    });
    $('#swapTrainCities').addEventListener('click', function () {
      const from = $('#trainFromInput').value;
      $('#trainFromInput').value = $('#trainToInput').value;
      $('#trainToInput').value = from;
      state.train.from = $('#trainFromInput').value;
      state.train.to = $('#trainToInput').value;
      toast('已交换出发与到达城市');
    });
    $('#tripTabs').addEventListener('click', function (event) {
      const tab = event.target.closest('[data-trip]');
      if (!tab) return;
      state.flight.trip = tab.getAttribute('data-trip');
      $$('#tripTabs .trip-tab').forEach(function (button) { button.classList.toggle('is-active', button === tab); });
    });

    bindDateTrigger('#hotelDateField', 'hotel');
    bindDateTrigger('#flightDateField', 'flight');
    bindDateTrigger('#trainDateField', 'train');
    bindDateTrigger('#ticketDateField', 'ticket');

    $('#guestTrigger').addEventListener('click', function (event) {
      event.stopPropagation();
      $('#levelPopover').hidden = true;
      const popover = $('#guestPopover');
      if (!popover.hidden) {
        popover.hidden = true;
        popover.classList.remove('is-floating');
        return;
      }
      hideFloatingPanels();
      positionFloating(popover, $('#guestField'), 300);
      syncGuestUi();
    });
    $('#levelTrigger').addEventListener('click', function (event) {
      event.stopPropagation();
      $('#guestPopover').hidden = true;
      const popover = $('#levelPopover');
      if (!popover.hidden) {
        popover.hidden = true;
        popover.classList.remove('is-floating');
        return;
      }
      hideFloatingPanels();
      positionFloating(popover, $('#levelField'), 230);
    });
    $$('#guestPopover [data-counter]').forEach(function (button) {
      button.addEventListener('click', function () {
        const key = button.getAttribute('data-counter');
        const delta = Number(button.getAttribute('data-delta'));
        const limits = { rooms: [1, 5], adults: [1, 10], children: [0, 6] };
        const range = limits[key];
        state.search[key] = Math.min(range[1], Math.max(range[0], state.search[key] + delta));
        syncGuestUi();
      });
    });
    $('#guestDone').addEventListener('click', function () {
      $('#guestPopover').hidden = true;
      $('#guestPopover').classList.remove('is-floating');
    });
    $('#levelPopover').addEventListener('click', function (event) {
      const button = event.target.closest('[data-level]');
      if (!button) return;
      state.search.level = button.getAttribute('data-level');
      syncLevelUi();
      $('#levelPopover').hidden = true;
      $('#levelPopover').classList.remove('is-floating');
    });

    $$('.side-item').forEach(function (item) {
      item.addEventListener('click', function () {
        const service = item.getAttribute('data-service');
        if (service) { switchService(service); return; }
        const scroll = item.getAttribute('data-scroll');
        if (scroll) { handleSideScroll(scroll); return; }
        const action = item.getAttribute('data-action');
        if (action) handleSideAction(action);
      });
    });

    $('#mobileMenu').addEventListener('click', openMobileNav);
    $('#navScrim').addEventListener('click', closeMobileNav);
    $('#navCollapse').addEventListener('click', function () {
      document.body.classList.toggle('nav-collapsed');
      const collapsed = document.body.classList.contains('nav-collapsed');
      $('#navCollapse').setAttribute('aria-label', collapsed ? '展开导航' : '收起导航');
    });
    $('#brandHome').addEventListener('click', function (event) {
      event.preventDefault();
      showHome(true);
      setMode('hotel', { scroll: false });
    });

    $('#loginTrigger').addEventListener('click', function () {
      if (state.user) openAccountModal();
      else openAuth('login');
    });
    $('#registerTrigger').addEventListener('click', function () { openAuth('register'); });
    $('#userTrigger').addEventListener('click', function () {
      if (state.user) openAccountModal();
      else openAuth('login');
    });
    $('#favTrigger').addEventListener('click', openFavoritesModal);
    $('#appTrigger').addEventListener('click', openAppModal);
    $('#supportTrigger').addEventListener('click', openSupportModal);
    $('#footerSupport').addEventListener('click', openSupportModal);

    $('#ordersTrigger').addEventListener('click', function (event) {
      event.stopPropagation();
      const panel = $('#ordersPanel');
      panel.hidden = !panel.hidden;
      if (!panel.hidden) renderOrdersPreview();
    });
    $('#ordersAll').addEventListener('click', function (event) {
      event.stopPropagation();
      $('#ordersPanel').hidden = true;
      openOrdersPage();
    });
    $('#ordersPreview').addEventListener('click', function () { openOrdersPage(); });
    $('#ordersBack').addEventListener('click', function () { showHome(true); });
    $('#ordersRefresh').addEventListener('click', async function () {
      if (!state.apiOnline) {
        renderOrdersPage();
        toast('当前为本地模式，没有可刷新的后端订单');
        return;
      }
      await refreshOrders();
      renderOrdersPage();
      toast('订单列表已刷新');
    });
    $('#orderStatusTabs').addEventListener('click', function (event) {
      const tab = event.target.closest('[data-order-tab]');
      if (!tab) return;
      state.orderFilter = tab.getAttribute('data-order-tab');
      renderOrdersPage();
    });
    $('#ordersPageList').addEventListener('click', handleOrdersPageClick);

    $('#globalSearchInput').addEventListener('focus', updateGlobalSuggestions);
    $('#globalSearchInput').addEventListener('input', updateGlobalSuggestions);
    $('#globalSearchInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        performGlobalSearch();
      }
    });
    $('#globalSearchGo').addEventListener('click', performGlobalSearch);
    $('#globalSuggestions').addEventListener('click', function (event) {
      const cityButton = event.target.closest('[data-global-city]');
      const hotelButton = event.target.closest('[data-global-hotel]');
      const queryButton = event.target.closest('[data-global-search-query]');
      if (cityButton) {
        $('#globalSuggestions').hidden = true;
        startHotelSearch(cityButton.getAttribute('data-global-city'), '');
      } else if (hotelButton) {
        $('#globalSuggestions').hidden = true;
        openHotelDetail(DATA.getHotelById(hotelButton.getAttribute('data-global-hotel')));
      } else if (queryButton) {
        $('#globalSearchInput').value = queryButton.getAttribute('data-global-search-query');
        performGlobalSearch();
      }
    });

    $('#cityTabs').addEventListener('click', function (event) {
      const button = event.target.closest('[data-city-name]');
      if (!button) return;
      state.recommendCity = button.getAttribute('data-city-name');
      state.recommendPage = 0;
      renderCityTabs();
      renderRecommendCards();
    });
    $('#moreCitiesTrigger').addEventListener('click', function (event) {
      event.stopPropagation();
      $('#moreCitiesPanel').hidden = !$('#moreCitiesPanel').hidden;
    });
    $('#moreCitiesPanel').addEventListener('click', function (event) {
      const button = event.target.closest('[data-city-name]');
      if (!button) return;
      state.recommendCity = button.getAttribute('data-city-name');
      state.recommendPage = 0;
      $('#moreCitiesPanel').hidden = true;
      renderCityTabs();
      renderRecommendCards();
    });
    $('#hotelPrev').addEventListener('click', function () {
      const hotels = DATA.getHotels(state.recommendCity);
      state.recommendPage = state.recommendPage === 0 ? Math.max(0, Math.floor((hotels.length - 1) / 3) * 3) : Math.max(0, state.recommendPage - 3);
      renderRecommendCards();
    });
    $('#hotelNext').addEventListener('click', function () {
      const hotels = DATA.getHotels(state.recommendCity);
      state.recommendPage = state.recommendPage + 3 >= hotels.length ? 0 : state.recommendPage + 3;
      renderRecommendCards();
    });
    $('#recommendCards').addEventListener('click', function (event) {
      const favorite = event.target.closest('[data-fav]');
      if (favorite) { event.preventDefault(); toggleFavorite(favorite.getAttribute('data-fav')); return; }
      const card = event.target.closest('[data-hotel-id]');
      if (card) openHotelDetail(DATA.getHotelById(card.getAttribute('data-hotel-id')));
    });
    $('#recommendCards').addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('[data-hotel-id]');
      if (card) { event.preventDefault(); openHotelDetail(DATA.getHotelById(card.getAttribute('data-hotel-id'))); }
    });
    $('#miniHotelList').addEventListener('click', function (event) {
      const button = event.target.closest('[data-hotel-id]');
      if (button) openHotelDetail(DATA.getHotelById(button.getAttribute('data-hotel-id')));
    });
    $('#destinationDots').addEventListener('click', function (event) {
      const button = event.target.closest('[data-dest-index]');
      if (!button) return;
      state.destinationIndex = Number(button.getAttribute('data-dest-index'));
      renderDestination(true);
    });
    $('#rankingTrigger').addEventListener('click', openRankModal);
    $('#bizBanner').addEventListener('click', openBusinessModal);
    $('#businessSideCard').addEventListener('click', openBusinessModal);
    $('#aiPlannerTrigger').addEventListener('click', openPlannerModal);
    $('#travelMapTrigger').addEventListener('click', function () { openMapModal(state.search.city); });

    $('#backHome').addEventListener('click', function () { showHome(true); });
    $('#editSearch').addEventListener('click', function () {
      showHome(true);
      window.setTimeout(function () { $('#searchCard').scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 40);
    });
    $('#resultsView').addEventListener('click', function (event) {
      if (event.target.closest('[data-edit-search]')) {
        showHome(true);
        window.setTimeout(function () { $('#searchCard').scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 40);
      }
    });
    $('#priceFilters').addEventListener('click', function (event) {
      const button = event.target.closest('[data-price]');
      if (!button) return;
      state.filters.price = button.getAttribute('data-price');
      renderHotelResults();
    });
    $('#starFilters').addEventListener('click', function (event) {
      const button = event.target.closest('[data-star]');
      if (!button) return;
      state.filters.star = button.getAttribute('data-star');
      renderHotelResults();
    });
    $('#tagFilters').addEventListener('click', function (event) {
      const button = event.target.closest('[data-tag]');
      if (!button) return;
      const tag = button.getAttribute('data-tag');
      if (state.filters.tags.has(tag)) state.filters.tags.delete(tag);
      else state.filters.tags.add(tag);
      renderHotelResults();
    });
    $('#resetFilters').addEventListener('click', function () {
      state.filters.price = 'all';
      state.filters.star = 'all';
      state.filters.tags.clear();
      renderHotelResults();
    });
    $('#sortSelect').addEventListener('change', function (event) {
      state.filters.sort = event.target.value;
      renderCurrentResults();
    });
    $('#openMapBtn').addEventListener('click', function () {
      openMapModal(state.resultParams ? state.resultParams.city : state.search.city);
    });
    $('#resultList').addEventListener('click', function (event) {
      const favorite = event.target.closest('[data-fav]');
      if (favorite) { event.preventDefault(); toggleFavorite(favorite.getAttribute('data-fav')); return; }
      if (event.target.closest('[data-reset-filters]')) {
        state.filters.price = 'all';
        state.filters.star = 'all';
        state.filters.tags.clear();
        renderHotelResults();
        return;
      }
      const flightButton = event.target.closest('[data-book-flight]');
      if (flightButton) {
        const flight = state.resultData.find(function (item) { return item.id === flightButton.getAttribute('data-book-flight'); });
        if (flight) openFlightBooking(flight);
        return;
      }
      const trainButton = event.target.closest('[data-book-train]');
      if (trainButton) {
        const train = state.resultData.find(function (item) { return item.id === trainButton.getAttribute('data-book-train'); });
        if (train) openTrainBooking(train);
        return;
      }
      const ticketCard = event.target.closest('[data-ticket-id]');
      if (ticketCard) {
        const ticket = state.resultData.find(function (item) { return item.id === ticketCard.getAttribute('data-ticket-id'); });
        if (ticket) openTicketDetail(ticket);
        return;
      }
      const hotelCard = event.target.closest('[data-hotel-id]');
      if (hotelCard) openHotelDetail(DATA.getHotelById(hotelCard.getAttribute('data-hotel-id')));
    });
    $('#resultList').addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('[data-hotel-id]');
      if (card) { event.preventDefault(); openHotelDetail(DATA.getHotelById(card.getAttribute('data-hotel-id'))); }
    });

    $$('[data-footer-link]').forEach(function (button) {
      button.addEventListener('click', function () { openInfoModal(button.textContent.trim()); });
    });

    $('#modalClose').addEventListener('click', closeModal);
    $('#overlay').addEventListener('click', function (event) {
      if (event.target === $('#overlay')) closeModal();
    });
    $('#modalContent').addEventListener('click', handleModalClick);
    $('#modalContent').addEventListener('submit', function (event) {
      if (event.target && event.target.id === 'bookingForm') handleBookingSubmit(event);
    });

    document.addEventListener('click', function (event) {
      if (!event.target.closest('#ordersDropdown')) $('#ordersPanel').hidden = true;
      if (!event.target.closest('#moreCitiesWrap')) $('#moreCitiesPanel').hidden = true;
      if (!event.target.closest('#globalSearchWrap')) $('#globalSuggestions').hidden = true;
      if (!event.target.closest('.field-city')) {
        $$('.field-suggest').forEach(function (panel) {
          panel.hidden = true;
          panel.classList.remove('is-floating');
        });
      }
      if (!event.target.closest('#guestField')) {
        $('#guestPopover').hidden = true;
        $('#guestPopover').classList.remove('is-floating');
      }
      if (!event.target.closest('#levelField')) {
        $('#levelPopover').hidden = true;
        $('#levelPopover').classList.remove('is-floating');
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (state.modalOpen) {
        closeModal();
      } else {
        hideFloatingPanels();
        $('#ordersPanel').hidden = true;
        $('#moreCitiesPanel').hidden = true;
        closeMobileNav();
      }
    });
    window.addEventListener('scroll', hideFloatingPanels, { passive: true });
    window.addEventListener('resize', hideFloatingPanels);
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) closeMobileNav();
    });
  }

  function bindDateTrigger(selector, target) {
    const element = $(selector);
    if (!element) return;
    element.addEventListener('click', function () { openCalendar(target); });
    element.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openCalendar(target);
      }
    });
  }

  function performOrderAction(event) {
    const detailButton = event.target.closest('[data-order-detail]');
    if (detailButton) { openOrderDetail(findOrderById(detailButton.getAttribute('data-order-detail'))); return true; }
    const payButton = event.target.closest('[data-order-pay]');
    if (payButton) { openPaymentModal(findOrderById(payButton.getAttribute('data-order-pay'))); return true; }
    const cancelButton = event.target.closest('[data-order-cancel]');
    if (cancelButton) { cancelOrder(cancelButton.getAttribute('data-order-cancel')); return true; }
    const checkinButton = event.target.closest('[data-order-checkin]');
    if (checkinButton) { openCheckin(findOrderById(checkinButton.getAttribute('data-order-checkin'))); return true; }
    const boardingButton = event.target.closest('[data-order-boarding]');
    if (boardingButton) { openBoardingPass(findOrderById(boardingButton.getAttribute('data-order-boarding'))); return true; }
    return false;
  }

  function handleOrdersPageClick(event) {
    if (event.target.closest('[data-orders-login]')) {
      openAuth('login', { reason: '登录后查看您的订单' });
      return;
    }
    if (event.target.closest('[data-orders-home]')) {
      showHome(true);
      return;
    }
    performOrderAction(event);
  }

  function handleModalClick(event) {
    if (performOrderAction(event)) return;
    if (event.target.closest('[data-close-modal]')) { closeModal(); return; }
    const favorite = event.target.closest('[data-fav]');
    if (favorite) { event.preventDefault(); toggleFavorite(favorite.getAttribute('data-fav')); return; }
    const roomButton = event.target.closest('[data-book-room]');
    if (roomButton) {
      const hotel = DATA.getHotelById(roomButton.getAttribute('data-book-room'));
      const room = hotel ? hotel.rooms[Number(roomButton.getAttribute('data-room-index'))] : null;
      if (hotel && room) openHotelBooking(hotel, room);
      return;
    }
    if (event.target.closest('[data-success-orders]')) {
      closeModal();
      openOrdersPage();
      return;
    }
    if (event.target.closest('[data-pay-checkin]')) {
      openCheckin(findOrderById(event.target.closest('[data-pay-checkin]').getAttribute('data-pay-checkin')));
      return;
    }
    if (event.target.closest('[data-bp-print]')) {
      window.print();
      return;
    }
    if (event.target.closest('[data-success-close]')) { closeModal(); return; }
    const modalHotel = event.target.closest('[data-modal-hotel]');
    if (modalHotel) { openHotelDetail(DATA.getHotelById(modalHotel.getAttribute('data-modal-hotel'))); return; }
    if (event.target.closest('[data-book-ticket]')) {
      if (state.ticketContext) openTicketBooking(state.ticketContext);
      return;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */

  function boot() {
    syncInitialInputs();
    updateAllDateUi();
    syncGuestUi();
    syncLevelUi();
    renderCityTabs();
    renderRecommendCards();
    renderDestination(false);
    renderOrdersPreview();
    updateAuthUi();
    bindEvents();
    setMode('flight', { scroll: false });
    startDestinationRotation();
    bootstrapApi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
