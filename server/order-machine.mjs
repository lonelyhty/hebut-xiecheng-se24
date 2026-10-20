import { conflict } from './errors.mjs';

export const ORDER_STATUS = Object.freeze({
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  CHECKED_IN: 'CHECKED_IN',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  COMPLETED: 'COMPLETED'
});

export const STATUS_LABELS = Object.freeze({
  PENDING_PAYMENT: '待付款',
  PAID: '已支付',
  CHECKED_IN: '已值机',
  CANCELLED: '已取消',
  EXPIRED: '已失效',
  COMPLETED: '已完成'
});

const TRANSITIONS = Object.freeze({
  PENDING_PAYMENT: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED, ORDER_STATUS.EXPIRED],
  PAID: [ORDER_STATUS.CHECKED_IN, ORDER_STATUS.CANCELLED, ORDER_STATUS.COMPLETED],
  CHECKED_IN: [ORDER_STATUS.COMPLETED],
  CANCELLED: [],
  EXPIRED: [],
  COMPLETED: []
});

export function canTransition(from, to) {
  return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to));
}

export function assertTransition(order, to) {
  if (!canTransition(order.status, to)) {
    throw conflict(
      'INVALID_ORDER_STATE',
      `订单当前状态为「${STATUS_LABELS[order.status] || order.status}」，不能变更为「${STATUS_LABELS[to] || to}」`
    );
  }
}

export function transition(order, to, { at = new Date(), reason = '', patch = {} } = {}) {
  assertTransition(order, to);
  const timestamp = at.toISOString();
  Object.assign(order, patch);
  order.status = to;
  order.statusLabel = STATUS_LABELS[to];
  order.updatedAt = timestamp;
  if (!Array.isArray(order.history)) order.history = [];
  order.history.push({ status: to, statusLabel: STATUS_LABELS[to], at: timestamp, reason });
  return order;
}

export function availableActions(order) {
  const actions = [];
  if (order.status === ORDER_STATUS.PENDING_PAYMENT) {
    actions.push('pay', 'cancel');
  } else if (order.status === ORDER_STATUS.PAID) {
    actions.push('cancel');
    if (order.type === 'flight') actions.push('checkin');
  } else if (order.status === ORDER_STATUS.CHECKED_IN) {
    actions.push('boardingPass');
  }
  return actions;
}
