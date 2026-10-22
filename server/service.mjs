import { randomUUID } from 'node:crypto';
import { TRAVEL_DATA } from '../public/data.js';
import { badRequest, conflict, forbidden, notFound, unprocessable } from './errors.mjs';
import { buildFlightSearch, chinaDateKey, decorateRecommendations, parseDateKey } from './pricing.mjs';
import { ORDER_STATUS, STATUS_LABELS, availableActions, transition } from './order-machine.mjs';
import { boardingPassFor, buildSeatMap, prepareCheckIn } from './checkin.mjs';
import { buildItinerary } from './itinerary.mjs';
import { issueTicket } from './airline.mjs';
import {
  applyBargainToOrder,
  closeBargainSession,
  createBargainSession,
  cutBargainSession,
  expireBargainSession,
  serializeBargainSession
} from './bargain.mjs';

const QUOTE_TTL_MS = 10 * 60 * 1000;
const PENDING_TTL_MS = 15 * 60 * 1000;
const DAY_MS = 86400000;
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const ORDER_TYPE_META = {
  flight: { typeLabel: '机票', kindLabel: '机票订单' },
  hotel: { typeLabel: '酒店', kindLabel: '酒店订单' },
  ticket: { typeLabel: '门票', kindLabel: '门票订单' },
  train: { typeLabel: '火车票', kindLabel: '火车票订单' }
};
const SIMULATED_FRIEND_NAMES = ['小橙', '阿拼', '旅行家', '砍价王', '锦鲤本鲤', '省钱达人', '周末飞', '酒店控'];

function dayOffset(fromKey, toKey) {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / DAY_MS);
}

function formatCnDate(key) {
  const { year, month, day } = parseDateKey(key);
  return `${year}年${month}月${day}日`;
}

function weekdayOf(key) {
  return WEEKDAYS[parseDateKey(key).weekday];
}

function validateFutureDate(key, label, now, maxDays = 365) {
  const parsed = parseDateKey(key);
  const offset = dayOffset(chinaDateKey(now), parsed.key);
  if (offset < 0) throw badRequest(`${label}不能早于今天`);
  if (offset > maxDays) throw badRequest(`${label}超出可预订范围`);
  return parsed;
}

function normalizeContact(input) {
  const contact = input || {};
  const name = String(contact.name || '').trim();
  const phone = String(contact.phone || '').trim();
  if (name.length < 2) throw unprocessable('联系人姓名至少需要 2 个字符');
  if (name.length > 40) throw unprocessable('联系人姓名过长');
  if (!/^1[3-9]\d{9}$/.test(phone)) throw unprocessable('请输入有效的 11 位手机号');
  return {
    name,
    phone,
    idNumber: String(contact.idNumber || '').trim().slice(0, 32),
    arrival: String(contact.arrival || '').trim().slice(0, 40),
    note: String(contact.note || '').trim().slice(0, 200)
  };
}

function orderPassengerCount(order) {
  if (Array.isArray(order.passengers)) return order.passengers.length;
  return Number(order.details && order.details.passengers) || 1;
}

function normalizeFlightPassengers(input, expected) {
  if (!Array.isArray(input) || input.length !== expected) {
    throw unprocessable(`请填写 ${expected} 位乘机人信息`);
  }
  return input.map((passenger, index) => {
    const name = String(passenger && passenger.name || '').trim();
    const document = String(passenger && passenger.document || '').trim();
    if (name.length < 2 || name.length > 40) {
      throw unprocessable(`旅客 ${index + 1} 的姓名应为 2–40 个字符`);
    }
    if (!/^[A-Za-z0-9]{6,20}$/.test(document)) {
      throw unprocessable(`旅客 ${index + 1} 的演示证件号应为 6–20 位字母或数字`);
    }
    return { name, document };
  });
}

function makeOrderId(now) {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const date = `${shifted.getUTCFullYear()}${String(shifted.getUTCMonth() + 1).padStart(2, '0')}${String(shifted.getUTCDate()).padStart(2, '0')}`;
  return `OC${date}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

function orderBase({ user, now, type, typeLabel, kindLabel, contact }) {
  const timestamp = now.toISOString();
  return {
    id: makeOrderId(now),
    userId: user.id,
    userRole: user.role,
    type,
    typeLabel,
    kindLabel,
    status: ORDER_STATUS.PENDING_PAYMENT,
    statusLabel: STATUS_LABELS[ORDER_STATUS.PENDING_PAYMENT],
    currency: 'CNY',
    createdAt: timestamp,
    updatedAt: timestamp,
    contact,
    payment: null,
    checkin: null,
    history: [
      {
        status: ORDER_STATUS.PENDING_PAYMENT,
        statusLabel: STATUS_LABELS[ORDER_STATUS.PENDING_PAYMENT],
        at: timestamp,
        reason: '订单已创建，等待支付'
      }
    ]
  };
}

function serializeOrder(order) {
  return {
    ...order,
    statusLabel: STATUS_LABELS[order.status] || order.status,
    availableActions: availableActions(order)
  };
}

function requireOrderAccess(user, order) {
  if (!order) throw notFound('订单不存在');
  if (order.userId !== user.id && user.role !== 'agency') {
    throw forbidden('只能访问自己的订单');
  }
  return order;
}

export function createServices({ store, gateway, clock = () => new Date() }) {
  const quotes = new Map();
  const paymentLocks = new Set();

  function pruneQuotes(now) {
    for (const [id, quote] of quotes) {
      if (new Date(quote.expiresAt).getTime() <= now.getTime()) quotes.delete(id);
    }
    if (quotes.size > 2000) {
      const excess = quotes.size - 2000;
      let removed = 0;
      for (const id of quotes.keys()) {
        if (removed >= excess) break;
        quotes.delete(id);
        removed += 1;
      }
    }
  }

  function searchFlights(params) {
    const now = clock();
    const result = buildFlightSearch({
      from: params.from,
      to: params.to,
      date: params.date,
      passengers: params.passengers,
      cabin: params.cabin,
      now,
      filters: {
        airline: params.airline,
        departWindow: params.departWindow,
        maxPrice: params.maxPrice
      }
    });
    const expiresAt = new Date(now.getTime() + QUOTE_TTL_MS).toISOString();
    const searchDate = result.query.date;
    const available = result.results
      .map((flight) => ({
        ...flight,
        date: searchDate,
        seatsLeft: store.getAvailableFlightSeats(flight.id, flight.seats)
      }))
      .filter((flight) => flight.seatsLeft >= flight.passengers);
    result.results = available.map((flight) => {
      const quoteId = `Q-${randomUUID()}`;
      quotes.set(quoteId, {
        id: quoteId,
        flightId: flight.id,
        flight,
        unitPrice: flight.price,
        passengers: flight.passengers,
        cabin: flight.cabin,
        createdAt: now.toISOString(),
        expiresAt,
        usedAt: null
      });
      return {
        ...flight,
        quoteId,
        quoteExpiresAt: expiresAt
      };
    });
    result.recommendation = decorateRecommendations(result.results);
    result.inventory = {
      note: '每个航班初始化 12–36 个模拟座位；下单时原子校验并扣减余票。',
      availableFlights: result.results.length
    };
    pruneQuotes(now);
    return result;
  }

  function searchHotels(params) {
    const now = clock();
    const city = TRAVEL_DATA.normalizeCity(params.city);
    if (!city) throw badRequest('请填写目的地城市');
    const checkin = validateFutureDate(params.checkin, '入住日期', now);
    const checkout = validateFutureDate(params.checkout, '退房日期', now);
    const nights = dayOffset(checkin.key, checkout.key);
    if (nights < 1) throw badRequest('退房日期必须晚于入住日期');
    if (nights > 30) throw badRequest('单次最多可预订 30 晚');
    const keyword = String(params.keyword || '').trim().toLowerCase();
    const level = params.level && params.level !== '不限' ? Number(params.level) : null;
    let results = TRAVEL_DATA.getHotels(city).slice();
    if (keyword) {
      results = results.filter((hotel) => {
        const haystack = [hotel.name, hotel.area, hotel.address].concat(hotel.tags).join(' ').toLowerCase();
        return haystack.includes(keyword);
      });
    }
    if (level) results = results.filter((hotel) => hotel.star === level);
    return {
      query: {
        city,
        checkin: checkin.key,
        checkout: checkout.key,
        nights,
        keyword,
        level: params.level || '不限'
      },
      generatedAt: now.toISOString(),
      results: results.map((hotel) => ({
        ...hotel,
        nights,
        totalFrom: hotel.price * nights,
        rooms: hotel.rooms.map((room, roomIndex) => {
          const left = store.getAvailableHotelRooms(hotel.id, roomIndex, room.left);
          return { ...room, left, soldOut: left <= 0 };
        })
      }))
    };
  }

  function searchAttractions(params) {
    const now = clock();
    const city = TRAVEL_DATA.normalizeCity(params.city);
    if (!city) throw badRequest('请填写目的地城市');
    const date = validateFutureDate(params.date, '游玩日期', now);
    const keyword = String(params.keyword || '').trim().toLowerCase();
    let results = TRAVEL_DATA.getAttractions(city);
    if (keyword) {
      results = results.filter((ticket) => {
        return [ticket.name, ticket.subtitle].concat(ticket.tags).join(' ').toLowerCase().includes(keyword);
      });
    }
    return {
      query: { city, date: date.key, keyword },
      generatedAt: now.toISOString(),
      results
    };
  }

  function searchTrains(params) {
    const now = clock();
    const from = TRAVEL_DATA.normalizeCity(params.from);
    const to = TRAVEL_DATA.normalizeCity(params.to);
    if (!from || !to) throw badRequest('请填写出发与到达城市');
    if (from === to) throw badRequest('出发和到达城市不能相同');
    const date = validateFutureDate(params.date, '出发日期', now, 180);
    const passengers = Number(params.passengers || 1);
    if (!Number.isInteger(passengers) || passengers < 1 || passengers > 6) throw badRequest('乘客数量应为 1-6');
    let results = TRAVEL_DATA.getTrains(from, to, date.key);
    if (params.type && params.type !== 'all') {
      results = results.filter((train) => train.typeCode === params.type);
    }
    return {
      query: { from, to, date: date.key, passengers, type: params.type || 'all' },
      generatedAt: now.toISOString(),
      results
    };
  }

  async function createOrder(user, input) {
    const now = clock();
    const contact = normalizeContact(input && input.contact);
    const type = input && input.type;
    const base = orderBase({
      user,
      now,
      type,
      typeLabel: (ORDER_TYPE_META[type] || ORDER_TYPE_META.ticket).typeLabel,
      kindLabel: (ORDER_TYPE_META[type] || ORDER_TYPE_META.ticket).kindLabel,
      contact
    });

    let order;
    let reservation = null;
    let hotelReservation = null;
    if (type === 'flight') {
      const quote = quotes.get(String(input.quoteId || ''));
      if (!quote) throw conflict('QUOTE_EXPIRED', '报价已失效，请重新搜索航班');
      if (new Date(quote.expiresAt).getTime() <= now.getTime()) {
        quotes.delete(quote.id);
        throw conflict('QUOTE_EXPIRED', '报价已过期，请重新搜索航班');
      }
      if (quote.usedAt) throw conflict('QUOTE_USED', '该报价已用于创建订单，请重新搜索');
      const flight = quote.flight;
      const passengers = normalizeFlightPassengers(input.passengers, quote.passengers);
      const total = quote.unitPrice * quote.passengers;
      reservation = {
        flightId: flight.id,
        totalSeats: Number(flight.seats) || 30,
        count: quote.passengers
      };
      quote.usedAt = now.toISOString();
      order = {
        ...base,
        title: `${flight.from} → ${flight.to} · ${flight.flightNo}`,
        subtitle: `${flight.airline} · ${flight.aircraft} · ${flight.fromAirport} - ${flight.toAirport}`,
        dateLabel: `${formatCnDate(flight.date)} ${flight.dep}`,
        guestLabel: `${quote.passengers}位成人`,
        meta: [flight.flightNo, quote.cabin, '直飞'],
        total,
        passengers,
        items: [
          {
            type: 'flight',
            flightNo: flight.flightNo,
            airline: flight.airline,
            from: flight.from,
            to: flight.to,
            dep: flight.dep,
            arr: flight.arr,
            cabin: quote.cabin,
            unitPrice: quote.unitPrice,
            passengers: quote.passengers
          }
        ],
        details: {
          quoteId: quote.id,
          flightId: flight.id,
          flightNo: flight.flightNo,
          airline: flight.airline,
          from: flight.from,
          to: flight.to,
          fromAirport: flight.fromAirport,
          toAirport: flight.toAirport,
          date: flight.date,
          dep: flight.dep,
          arr: flight.arr,
          extraDay: flight.extraDay,
          cabin: quote.cabin,
          passengers: quote.passengers,
          passengerNames: passengers.map((passenger) => passenger.name),
          unitPrice: quote.unitPrice,
          pricing: flight.pricing
        }
      };
    } else if (type === 'hotel') {
      const hotel = TRAVEL_DATA.getHotelById(String(input.hotelId || ''));
      if (!hotel) throw notFound('酒店不存在或已下架');
      const roomIndex = Number(input.roomIndex);
      const room = hotel.rooms[roomIndex];
      if (!room) throw badRequest('请选择有效的房型');
      const checkin = validateFutureDate(input.checkin, '入住日期', now, 180);
      const checkout = validateFutureDate(input.checkout, '退房日期', now, 190);
      const nights = dayOffset(checkin.key, checkout.key);
      if (nights < 1) throw badRequest('退房日期必须晚于入住日期');
      if (nights > 30) throw badRequest('单次最多可预订 30 晚');
      const rooms = Number(input.rooms || 1);
      const guests = Number(input.guests || 1);
      if (!Number.isInteger(rooms) || rooms < 1 || rooms > 5) throw badRequest('房间数量应为 1-5');
      if (!Number.isInteger(guests) || guests < 1 || guests > 10) throw badRequest('住客数量应为 1-10');
      const total = room.price * nights * rooms;
      hotelReservation = { hotelId: hotel.id, roomIndex, totalRooms: room.left, count: rooms };
      order = {
        ...base,
        title: `${hotel.name} · ${room.name}`,
        subtitle: `${hotel.area} · ${room.bed} · ${room.size}`,
        dateLabel: `${formatCnDate(checkin.key)} - ${formatCnDate(checkout.key)}（${nights}晚）`,
        guestLabel: `${rooms}间 · ${guests}位`,
        meta: [room.name, `${nights}晚`, `${rooms}间`],
        total,
        items: [
          {
            type: 'hotel',
            hotelId: hotel.id,
            hotelName: hotel.name,
            room: room.name,
            unitPrice: room.price,
            nights,
            rooms
          }
        ],
        details: {
          hotelId: hotel.id,
          hotelName: hotel.name,
          room: room.name,
          roomIndex,
          checkin: checkin.key,
          checkout: checkout.key,
          nights,
          rooms,
          guests
        }
      };
    } else if (type === 'ticket') {
      const city = TRAVEL_DATA.normalizeCity(input.city);
      const tickets = TRAVEL_DATA.getAttractions(city);
      const ticket = tickets.find((item) => item.id === input.ticketId);
      if (!ticket) throw notFound('门票或活动不存在');
      const date = validateFutureDate(input.date, '游玩日期', now, 365);
      const quantity = Number(input.quantity || 1);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 6) throw badRequest('门票数量应为 1-6');
      const total = ticket.price * quantity;
      order = {
        ...base,
        title: ticket.name,
        subtitle: `${ticket.city} · ${ticket.duration} · ${ticket.tags.join(' / ')}`,
        dateLabel: `${formatCnDate(date.key)} ${weekdayOf(date.key)}`,
        guestLabel: `${quantity}张成人票`,
        meta: [ticket.subtitle, ticket.duration],
        total,
        items: [
          {
            type: 'ticket',
            ticketId: ticket.id,
            ticketName: ticket.name,
            city: ticket.city,
            unitPrice: ticket.price,
            quantity
          }
        ],
        details: {
          ticketId: ticket.id,
          ticketName: ticket.name,
          city: ticket.city,
          date: date.key,
          quantity
        }
      };
    } else if (type === 'train') {
      const fromCity = TRAVEL_DATA.normalizeCity(input.fromCity || input.from);
      const toCity = TRAVEL_DATA.normalizeCity(input.toCity || input.to);
      if (!fromCity || !toCity) throw badRequest('请填写出发与到达城市');
      if (fromCity === toCity) throw badRequest('出发和到达城市不能相同');
      const date = validateFutureDate(input.date, '出发日期', now, 180);
      const trains = TRAVEL_DATA.getTrains(fromCity, toCity, date.key);
      const train = trains.find((item) => item.id === input.trainId);
      if (!train) throw notFound('车次不存在，请重新搜索');
      const passengers = Number(input.passengers || 1);
      if (!Number.isInteger(passengers) || passengers < 1 || passengers > 6) throw badRequest('乘客数量应为 1-6');
      const total = train.price * passengers;
      order = {
        ...base,
        title: `${train.from} → ${train.to} · ${train.no}`,
        subtitle: `${train.type} · ${train.duration} · 直达`,
        dateLabel: `${formatCnDate(date.key)} ${train.dep}`,
        guestLabel: `${passengers}位成人`,
        meta: [train.no, train.type],
        total,
        items: [
          {
            type: 'train',
            trainNo: train.no,
            from: train.from,
            to: train.to,
            dep: train.dep,
            arr: train.arr,
            unitPrice: train.price,
            passengers
          }
        ],
        details: {
          trainId: train.id,
          trainNo: train.no,
          fromCity,
          toCity,
          from: train.from,
          to: train.to,
          date: date.key,
          dep: train.dep,
          arr: train.arr,
          extraDay: train.extraDay,
          passengers,
          unitPrice: train.price
        }
      };
    } else {
      throw badRequest('不支持的订单类型');
    }

    if (reservation) {
      const reserved = store.reserveFlightSeats(reservation.flightId, reservation.totalSeats, reservation.count);
      if (!reserved) throw conflict('SOLD_OUT', '余票不足，请重新搜索航班');
    }
    if (hotelReservation) {
      const reserved = store.reserveHotelRooms(hotelReservation.hotelId, hotelReservation.roomIndex, hotelReservation.totalRooms, hotelReservation.count);
      if (!reserved) throw conflict('SOLD_OUT', '该房型余量不足，请重新选择房间');
    }
    try {
      await store.insertOrder(order);
    } catch (error) {
      if (reservation) store.releaseFlightSeats(reservation.flightId, reservation.count);
      if (hotelReservation) store.releaseHotelRooms(hotelReservation.hotelId, hotelReservation.roomIndex, hotelReservation.count);
      throw error;
    }
    return serializeOrder(order);
  }

  async function expireStaleOrders(now) {
    const cutoff = now.getTime() - PENDING_TTL_MS;
    let changed = false;
    for (const order of store.listOrders()) {
      if (order.status !== ORDER_STATUS.PENDING_PAYMENT) continue;
      const createdAt = new Date(order.createdAt).getTime();
      if (Number.isFinite(createdAt) && createdAt < cutoff) {
        transition(order, ORDER_STATUS.EXPIRED, {
          at: now,
          reason: '待付款订单超过 15 分钟，已自动失效'
        });
        if (order.type === 'flight' && order.details && order.details.flightId) {
          store.releaseFlightSeats(order.details.flightId, orderPassengerCount(order));
        }
        if (order.type === 'hotel' && order.details && order.details.hotelId && order.details.roomIndex != null) {
          store.releaseHotelRooms(order.details.hotelId, order.details.roomIndex, Number(order.details.rooms) || 1);
        }
        closeBargainForOrder(order.id, 'EXPIRED', now, '待付款订单超时，砍价活动已失效');
        changed = true;
      }
    }
    if (changed) await store.save();
  }

  async function listOrders(user, scope = 'mine') {
    const now = clock();
    await expireStaleOrders(now);
    if (scope === 'all' && user.role !== 'agency') {
      throw forbidden('只有旅行社角色可以查看全部订单');
    }
    const orders = scope === 'all' ? store.listOrders() : store.getOrdersForUser(user.id);
    orders.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    return {
      scope: scope === 'all' ? 'all' : 'mine',
      role: user.role,
      orders: orders.map(serializeOrder)
    };
  }

  async function getOrder(user, orderId) {
    await expireStaleOrders(clock());
    const order = requireOrderAccess(user, store.findOrderById(orderId));
    return serializeOrder(order);
  }

  async function payOrder(user, orderId, method) {
    const now = clock();
    await expireStaleOrders(now);
    const order = requireOrderAccess(user, store.findOrderById(orderId));
    if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
      throw conflict('INVALID_ORDER_STATE', `订单当前状态为「${order.statusLabel || order.status}」，不能支付`);
    }
    if (paymentLocks.has(orderId)) throw conflict('PAYMENT_IN_PROGRESS', '支付正在处理中，请稍候');
    paymentLocks.add(orderId);
    try {
      const payment = await gateway.charge({ orderId, amount: order.total, method });
      const fresh = store.findOrderById(orderId);
      if (!fresh || fresh.status !== ORDER_STATUS.PENDING_PAYMENT) {
        throw conflict('INVALID_ORDER_STATE', '订单状态已变化，支付未完成');
      }
      const ticketing = fresh.type === 'flight' ? issueTicket(fresh, now) : null;
      transition(fresh, ORDER_STATUS.PAID, {
        at: now,
        reason: `通过 ${payment.methodLabel} 完成本地模拟支付`,
        patch: { payment, ticketing }
      });
      if (ticketing) {
        fresh.history.push({
          status: ORDER_STATUS.PAID,
          statusLabel: '已出票',
          at: now.toISOString(),
          reason: `模拟航信出票完成，票号 ${ticketing.ticketNumber}，PNR ${ticketing.pnr}`
        });
      }
      const bargainSession = store.findBargainByOrderId(orderId);
      if (bargainSession) {
        closeBargainSession(
          bargainSession,
          bargainSession.status === 'SUCCEEDED' ? 'CLAIMED' : 'EXPIRED',
          now,
          bargainSession.status === 'SUCCEEDED' ? '订单已支付，砍价优惠券已使用' : '订单已支付，未完成的砍价活动结束'
        );
        await store.replaceBargain(bargainSession);
      }
      await store.replaceOrder(fresh);
      return serializeOrder(fresh);
    } finally {
      paymentLocks.delete(orderId);
    }
  }

  async function cancelOrder(user, orderId) {
    const now = clock();
    await expireStaleOrders(now);
    const order = requireOrderAccess(user, store.findOrderById(orderId));
    if (order.status !== ORDER_STATUS.PENDING_PAYMENT && order.status !== ORDER_STATUS.PAID) {
      throw conflict('INVALID_ORDER_STATE', '当前订单状态不允许取消');
    }
    const wasPaid = order.status === ORDER_STATUS.PAID;
    const patch = {
      cancellation: {
        at: now.toISOString(),
        reason: '用户取消',
        refund: wasPaid
          ? { status: 'REFUNDED_MOCK', amount: order.total, method: order.payment ? order.payment.method : null }
          : null
      }
    };
    if (order.type === 'flight' && order.details && order.details.flightId) {
      store.releaseFlightSeats(order.details.flightId, orderPassengerCount(order));
    }
    if (order.type === 'hotel' && order.details && order.details.hotelId && order.details.roomIndex != null) {
      store.releaseHotelRooms(order.details.hotelId, order.details.roomIndex, Number(order.details.rooms) || 1);
    }
    const bargainSession = store.findBargainByOrderId(orderId);
    if (bargainSession) {
      closeBargainSession(bargainSession, 'CANCELLED', now, '订单已取消，砍价活动结束');
      await store.replaceBargain(bargainSession);
    }
    transition(order, ORDER_STATUS.CANCELLED, {
      at: now,
      reason: wasPaid ? '订单已取消，本地模拟退款已完成' : '订单已取消',
      patch
    });
    await store.replaceOrder(order);
    return serializeOrder(order);
  }

  function closeBargainForOrder(orderId, status, now, reason) {
    const session = store.findBargainByOrderId(orderId);
    if (!session) return null;
    return closeBargainSession(session, status, now, reason);
  }

  function requireBargainOrder(session) {
    const order = store.findOrderById(session.orderId);
    if (!order) throw notFound('关联订单不存在');
    return order;
  }

  async function createBargain(user, orderId) {
    const now = clock();
    await expireStaleOrders(now);
    const order = requireOrderAccess(user, store.findOrderById(orderId));
    if (order.userId !== user.id) throw forbidden('只能为自己的订单发起砍价');
    const existing = store.findBargainByOrderId(orderId);
    if (existing) {
      if (expireBargainSession(existing, now)) await store.replaceBargain(existing);
      if (existing.status === 'ACTIVE' || existing.status === 'SUCCEEDED' || existing.status === 'CLAIMED') {
        return { order: serializeOrder(order), bargain: serializeBargainSession(existing, user.id) };
      }
      throw conflict('BARGAIN_CLOSED', '该订单的砍价活动已结束');
    }
    if (order.bargain) throw conflict('BARGAIN_CLOSED', '该订单已使用过好友助力优惠，不能重复发起');
    const session = createBargainSession({ order, owner: user, now });
    await store.insertBargain(session);
    return { order: serializeOrder(order), bargain: serializeBargainSession(session, user.id) };
  }

  async function getBargainForOrder(user, orderId) {
    const now = clock();
    await expireStaleOrders(now);
    const order = requireOrderAccess(user, store.findOrderById(orderId));
    const session = store.findBargainByOrderId(orderId);
    if (!session) throw notFound('该订单尚未发起砍价');
    if (expireBargainSession(session, now)) await store.replaceBargain(session);
    return { order: serializeOrder(order), bargain: serializeBargainSession(session, user.id) };
  }

  async function getBargain(user, token) {
    const session = store.findBargainByToken(token);
    if (!session) throw notFound('砍价活动不存在或分享链接已失效');
    const now = clock();
    if (expireBargainSession(session, now)) await store.replaceBargain(session);
    const order = requireBargainOrder(session);
    if (order.status !== ORDER_STATUS.PENDING_PAYMENT && session.status === 'ACTIVE') {
      closeBargainSession(session, 'EXPIRED', now, '订单已结束，砍价活动失效');
      await store.replaceBargain(session);
    }
    return { order: serializeOrder(order), bargain: serializeBargainSession(session, user.id) };
  }

  async function helpBargain(user, token) {
    const session = store.findBargainByToken(token);
    if (!session) throw notFound('砍价活动不存在或分享链接已失效');
    const now = clock();
    const order = requireBargainOrder(session);
    if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
      closeBargainSession(session, 'EXPIRED', now, '订单已结束，砍价活动失效');
      await store.replaceBargain(session);
      throw conflict('BARGAIN_CLOSED', '订单已结束，砍价活动已失效');
    }
    let result;
    try {
      result = cutBargainSession(session, { user, now });
    } catch (error) {
      if (session.status === 'EXPIRED') await store.replaceBargain(session);
      throw error;
    }
    if (result.success) {
      applyBargainToOrder(order, session, now);
      await store.replaceOrder(order);
    }
    await store.replaceBargain(session);
    return { order: serializeOrder(order), bargain: serializeBargainSession(session, user.id), cut: result.cut };
  }

  async function simulateBargainCuts(user, token, count) {
    const session = store.findBargainByToken(token);
    if (!session) throw notFound('砍价活动不存在或分享链接已失效');
    if (session.ownerId !== user.id) throw forbidden('只有发起人可以模拟好友助力');
    const order = requireBargainOrder(session);
    if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
      closeBargainSession(session, 'EXPIRED', clock(), '订单已结束，砍价活动失效');
      await store.replaceBargain(session);
      throw conflict('BARGAIN_CLOSED', '订单已结束，砍价活动已失效');
    }
    const total = Math.min(10, Math.max(1, Number(count) || 1));
    const cuts = [];
    let success = false;
    for (let index = 0; index < total; index += 1) {
      if (session.status !== 'ACTIVE') break;
      const fakeId = `SIM-${session.id}-${session.helperCount + 1}`;
      const name = `${SIMULATED_FRIEND_NAMES[session.helperCount % SIMULATED_FRIEND_NAMES.length]}好友`;
      const result = cutBargainSession(session, {
        user: { id: fakeId, name },
        now: clock(),
        simulatedName: name
      });
      cuts.push(result.cut);
      if (result.success) {
        success = true;
        applyBargainToOrder(order, session, clock());
        await store.replaceOrder(order);
        break;
      }
    }
    await store.replaceBargain(session);
    return {
      order: serializeOrder(order),
      bargain: serializeBargainSession(session, user.id),
      cuts,
      success
    };
  }

  function seatMap(user, orderId) {
    const order = requireOrderAccess(user, store.findOrderById(orderId));
    if (order.type !== 'flight') throw unprocessable('只有机票订单支持值机');
    if (![ORDER_STATUS.PAID, ORDER_STATUS.CHECKED_IN].includes(order.status)) {
      throw conflict('INVALID_ORDER_STATE', '只有已支付的机票订单可以查看座位');
    }
    return {
      orderId: order.id,
      status: order.status,
      order: serializeOrder(order),
      seatMap: buildSeatMap(store, order)
    };
  }

  async function checkIn(user, orderId, seat, now = clock()) {
    const order = requireOrderAccess(user, store.findOrderById(orderId));
    const checkin = prepareCheckIn(store, order, seat, now);
    transition(order, ORDER_STATUS.CHECKED_IN, {
      at: now,
      reason: `在线值机成功，座位 ${checkin.seat}`,
      patch: { checkin }
    });
    await store.replaceOrder(order);
    return {
      order: serializeOrder(order),
      boardingPass: boardingPassFor(order)
    };
  }

  function boardingPass(user, orderId) {
    const order = requireOrderAccess(user, store.findOrderById(orderId));
    return boardingPassFor(order);
  }

  function itinerary(input) {
    return buildItinerary({
      city: input.city,
      days: input.days,
      preferences: input.preferences,
      now: clock()
    });
  }

  function health() {
    const now = clock();
    return {
      ok: true,
      service: 'octrip-air-platform',
      version: '1.0.0',
      time: now.toISOString(),
      features: [
        'dynamic-flight-pricing',
        'smart-flight-recommendation',
        'flight-hotel-ticket-orders',
        'mock-payment-gateway',
        'online-check-in',
        'itinerary-planning',
        'friend-bargain-wheel'
      ],
      counts: {
        users: store.data.users.length,
        orders: store.data.orders.length,
        bargains: store.data.bargains.length,
        quotes: quotes.size
      }
    };
  }

  return {
    searchFlights,
    searchHotels,
    searchTrains,
    searchAttractions,
    createOrder,
    listOrders,
    getOrder,
    payOrder,
    cancelOrder,
    createBargain,
    getBargainForOrder,
    getBargain,
    helpBargain,
    simulateBargainCuts,
    seatMap,
    checkIn,
    boardingPass,
    itinerary,
    health,
    expireStaleOrders
  };
}
