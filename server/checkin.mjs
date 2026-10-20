import { randomUUID } from 'node:crypto';
import { conflict, unprocessable } from './errors.mjs';
import { ORDER_STATUS } from './order-machine.mjs';

const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F'];
const ROWS = [1, 2, 3, 4, 5, 6, 7, 8];

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
  const number = 1 + (hashString(`${order.details.flightNo}|${order.details.date}|gate`) % 18);
  return `A${number}`;
}

function takenSeats(store, order) {
  const keys = new Set();
  store.listOrders().forEach((candidate) => {
    if (candidate.id === order.id) return;
    if (candidate.type !== 'flight' || candidate.status !== ORDER_STATUS.CHECKED_IN) return;
    if (!candidate.details || !candidate.checkin) return;
    if (candidate.details.flightNo !== order.details.flightNo) return;
    if (candidate.details.date !== order.details.date) return;
    keys.add(candidate.checkin.seat);
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
      const blocked = hashString(`${order.details.flightNo}|${order.details.date}|${id}`) % 11 < 2;
      let status = 'available';
      if (blocked) status = 'blocked';
      if (taken.has(id)) status = 'occupied';
      if (order.checkin && order.checkin.seat === id) status = 'selected';
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

export function prepareCheckIn(store, order, seatId, now = new Date()) {
  assertFlightOrder(order);
  if (order.status !== ORDER_STATUS.PAID) {
    throw conflict('INVALID_ORDER_STATE', '只有已支付的机票订单可以值机');
  }
  const departureAt = flightDeparture(order);
  if (departureAt === null) throw unprocessable('无法解析航班起飞时间');
  if (departureAt <= now.getTime()) {
    throw conflict('CHECKIN_CLOSED', '航班已起飞，无法值机');
  }
  const map = buildSeatMap(store, order);
  const seat = map.seats.find((item) => item.id === seatId);
  if (!seat) throw unprocessable('请选择有效的座位');
  if (seat.status !== 'available') {
    throw conflict('SEAT_UNAVAILABLE', `座位 ${seatId} 不可用，请重新选择`);
  }
  const checkedInAt = now.toISOString();
  return {
    seat: seat.id,
    gate: map.gate || gateFor(order),
    boardingTime: subtractMinutes(order.details.dep, 40),
    terminal: 'T2',
    boardingPassCode: `BP-${randomUUID()}`,
    checkedInAt
  };
}

export function boardingPassFor(order) {
  assertFlightOrder(order);
  if (!order.checkin) throw conflict('NOT_CHECKED_IN', '订单尚未完成值机');
  return {
    orderId: order.id,
    passenger: order.contact ? order.contact.name : '旅客',
    flightNo: order.details.flightNo,
    airline: order.details.airline,
    from: order.details.from,
    to: order.details.to,
    date: order.details.date,
    dep: order.details.dep,
    arr: order.details.arr,
    gate: order.checkin.gate,
    terminal: order.checkin.terminal,
    boardingTime: order.checkin.boardingTime,
    seat: order.checkin.seat,
    boardingPassCode: order.checkin.boardingPassCode,
    issuedAt: order.checkin.checkedInAt
  };
}
