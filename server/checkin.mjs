import { randomUUID } from 'node:crypto';
import { conflict, unprocessable } from './errors.mjs';
import { ORDER_STATUS } from './order-machine.mjs';
import { issueTicket } from './airline.mjs';

const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F'];
const ROWS = Array.from({ length: 30 }, (_, index) => index + 1);

function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function flightDeparture(order) {
  const date = order.details && order.details.date;
  const dep = order.details && order.details.dep;
  if (!date || !dep) return null;
  const timestamp = Date.parse(`${date}T${dep}:00+08:00`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function subtractMinutes(time, minutes) {
  const [hour, minute] = String(time).split(':').map(Number);
  let total = hour * 60 + minute - minutes;
  if (total < 0) total += 24 * 60;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h < 10 ? `0${h}` : h}:${m < 10 ? `0${m}` : m}`;
}

function gateFor(order) {
  const number = 1 + (hashString(`${order.details.flightNo}|${order.details.date}|gate`) % 20);
  return `B${number}`;
}

function takenSeats(store, order) {
  const keys = new Set();
  store.listOrders().forEach((candidate) => {
    if (candidate.id === order.id) return;
    if (candidate.type !== 'flight' || candidate.status !== ORDER_STATUS.CHECKED_IN) return;
    if (!candidate.details || (!candidate.checkin && !candidate.checkins)) return;
    if (candidate.details.flightNo !== order.details.flightNo) return;
    if (candidate.details.date !== order.details.date) return;
    const assigned = Array.isArray(candidate.checkins) && candidate.checkins.length
      ? candidate.checkins
      : (candidate.checkin ? [candidate.checkin] : []);
    assigned.forEach((checkin) => {
      if (checkin && checkin.seat) keys.add(checkin.seat);
    });
  });
  return keys;
}

export function assertFlightOrder(order) {
  if (order.type !== 'flight') throw unprocessable('只有机票订单可以在线值机');
  if (!order.details || !order.details.flightNo || !order.details.date || !order.details.dep) {
    throw unprocessable('订单缺少航班信息，无法值机');
  }
}

export function buildSeatMap(store, order) {
  assertFlightOrder(order);
  const taken = takenSeats(store, order);
  const seats = [];
  ROWS.forEach((row) => {
    COLUMNS.forEach((column) => {
      const id = `${row}${column}`;
      let status = 'available';
      if (taken.has(id)) status = 'occupied';
      const assigned = Array.isArray(order.checkins) && order.checkins.length
        ? order.checkins
        : (order.checkin ? [order.checkin] : []);
      if (assigned.some((checkin) => checkin && checkin.seat === id)) status = 'selected';
      seats.push({ id, row, column, status });
    });
  });
  return {
    flightNo: order.details.flightNo,
    date: order.details.date,
    dep: order.details.dep,
    columns: COLUMNS,
    rows: ROWS,
    gate: order.checkin && order.checkin.gate ? order.checkin.gate : gateFor(order),
    seats
  };
}

export function prepareCheckIn(store, order, seatIds, now = new Date()) {
  assertFlightOrder(order);
  if (order.status !== ORDER_STATUS.PAID) {
    throw conflict('INVALID_ORDER_STATE', '只有已支付并出票的机票订单可以值机');
  }
  const passengerCount = Array.isArray(order.passengers) && order.passengers.length ? order.passengers.length : 1;
  const seats = Array.isArray(seatIds) ? seatIds : [seatIds];
  if (seats.length !== passengerCount) {
    throw conflict('CHECKIN_SEAT_COUNT', `请为 ${passengerCount} 位乘机人分别选择座位`);
  }
  if (new Set(seats).size !== seats.length) {
    throw conflict('CHECKIN_SEAT_COUNT', '每位乘机人必须选择不同的座位');
  }
  const departureAt = flightDeparture(order);
  if (departureAt === null) throw unprocessable('无法解析航班起飞时间');
  const remaining = departureAt - now.getTime();
  if (remaining > 48 * 60 * 60 * 1000) {
    throw conflict('CHECKIN_WINDOW', '值机将在起飞前 48 小时开放');
  }
  if (remaining <= 45 * 60 * 1000) {
    throw conflict('CHECKIN_WINDOW', '值机已在起飞前 45 分钟关闭');
  }
  const map = buildSeatMap(store, order);
  const selected = seats.map((seatId) => {
    if (!/^(?:[1-9]|[12]\d|30)[A-F]$/.test(String(seatId || ''))) {
      throw unprocessable('INVALID_SEAT', '请选择 1–30 排 A–F 座位');
    }
    const seat = map.seats.find((item) => item.id === seatId);
    if (!seat) throw unprocessable('INVALID_SEAT', '请选择有效的座位');
    if (seat.status !== 'available') {
      throw conflict('SEAT_UNAVAILABLE', `座位 ${seatId} 不可用，请重新选择`);
    }
    return seat;
  });
  const ticketing = order.ticketing || issueTicket(order, now);
  const checkins = selected.map((seat, index) => ({
    seat: seat.id,
    passenger: order.passengers && order.passengers[index] ? order.passengers[index].name : order.contact?.name || '旅客',
    gate: map.gate || gateFor(order),
    boardingTime: subtractMinutes(order.details.dep, 45),
    terminal: 'T2',
    pnr: ticketing.pnr,
    ticketNumber: ticketing.ticketNumber,
    boardingPassCode: `BP-${randomUUID()}`,
    checkedInAt: now.toISOString()
  }));
  return {
    checkins,
    ...(checkins.length === 1 ? checkins[0] : {})
  };
}

export function boardingPassFor(order, index = 0) {
  assertFlightOrder(order);
  const checkins = Array.isArray(order.checkins) && order.checkins.length
    ? order.checkins
    : (order.checkin ? [order.checkin] : []);
  if (!checkins.length) throw conflict('NOT_CHECKED_IN', '订单尚未完成值机');
  const checkin = checkins[index] || checkins[0];
  const passenger = checkin.passenger || (Array.isArray(order.passengers) && order.passengers[index]
    ? order.passengers[index].name
    : (order.contact ? order.contact.name : '旅客'));
  return {
    orderId: order.id,
    passenger,
    flightNo: order.details.flightNo,
    airline: order.details.airline,
    from: order.details.from,
    to: order.details.to,
    date: order.details.date,
    dep: order.details.dep,
    arr: order.details.arr,
    gate: checkin.gate,
    terminal: checkin.terminal,
    boardingTime: checkin.boardingTime,
    seat: checkin.seat,
    pnr: checkin.pnr || (order.ticketing && order.ticketing.pnr) || '',
    ticketNumber: checkin.ticketNumber || (order.ticketing && order.ticketing.ticketNumber) || '',
    boardingPassCode: checkin.boardingPassCode,
    issuedAt: checkin.checkedInAt
  };
}

export function boardingPassesFor(order) {
  const count = Array.isArray(order.checkins) && order.checkins.length ? order.checkins.length : 1;
  return Array.from({ length: count }, (_, index) => boardingPassFor(order, index));
}
