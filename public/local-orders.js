const LABELS = { PENDING_PAYMENT: '待付款', PAID: '已支付', CANCELLED: '已取消', EXPIRED: '已失效' };
const METHODS = { alipay: '支付宝（模拟）', wechat: '微信支付（模拟）', card: '银行卡（模拟）' };
const TTL_MS = 15 * 60 * 1000;

export function changeLocalOrder(orders, id, action, method, now = new Date()) {
  const order = orders.find(item => item.id === id);
  if (!order) throw new Error('订单不存在，请刷新列表');
  return action === 'pay' ? payLocalOrder(order, method, now) : cancelLocalOrder(order, now);
}

function transition(order, status, now, reason) {
  order.status = status;
  order.statusLabel = LABELS[status];
  order.updatedAt = now.toISOString();
  if (!Array.isArray(order.history)) order.history = [];
  order.history.push({ status, statusLabel: order.statusLabel, at: order.updatedAt, reason });
  return order;
}

function assertLocal(order) {
  if (order.userId) throw new Error('后端订单需要连接本地服务后操作，请先运行 npm start');
}

export function createLocalOrder(draft, contact, passengers = [], now = new Date()) {
  const order = {
    id: 'OCL-' + globalThis.crypto.randomUUID(),
    type: draft.kind, kind: draft.kind, kindLabel: draft.kindLabel,
    title: draft.title, dateLabel: draft.dateLabel, guestLabel: draft.guestLabel,
    meta: draft.meta, total: draft.total, details: draft.details, contact, passengers,
    createdAt: now.toISOString(), payment: null, history: []
  };
  return transition(order, 'PENDING_PAYMENT', now, '本地订单已创建，等待模拟付款');
}

export function normalizeLocalOrder(order) {
  if (order.userId) return order;
  const normalized = { ...order, type: order.type || order.kind };
  // Older local bookings were confirmed immediately, so retain that outcome.
  if (order.status === '已确认') normalized.status = 'PAID';
  if (order.status === '已取消') normalized.status = 'CANCELLED';
  normalized.statusLabel = LABELS[normalized.status] || order.statusLabel;
  return normalized;
}

export function expireLocalOrder(order, now = new Date()) {
  if (order.userId || order.status !== 'PENDING_PAYMENT') return false;
  if (now.getTime() - new Date(order.createdAt).getTime() <= TTL_MS) return false;
  transition(order, 'EXPIRED', now, '待付款订单超过 15 分钟，已自动失效');
  return true;
}

export function payLocalOrder(order, method, now = new Date()) {
  assertLocal(order);
  expireLocalOrder(order, now);
  if (order.status !== 'PENDING_PAYMENT') throw new Error('只有待付款订单可以支付');
  if (!Object.hasOwn(METHODS, method)) throw new Error('请选择支持的支付方式');
  order.payment = {
    provider: 'Browser MockPay', transactionId: 'LOCAL-' + globalThis.crypto.randomUUID(),
    orderId: order.id, amount: order.total, currency: 'CNY', method,
    methodLabel: METHODS[method], status: 'SUCCESS', paidAt: now.toISOString()
  };
  return transition(order, 'PAID', now, '已完成浏览器本地模拟支付');
}

export function cancelLocalOrder(order, now = new Date()) {
  assertLocal(order);
  expireLocalOrder(order, now);
  if (!['PENDING_PAYMENT', 'PAID'].includes(order.status)) throw new Error('当前订单状态不允许取消');
  const wasPaid = order.status === 'PAID';
  order.cancellation = {
    at: now.toISOString(), reason: '用户取消',
    refund: wasPaid ? { status: 'REFUNDED_MOCK', amount: order.total, method: order.payment?.method || null } : null
  };
  return transition(order, 'CANCELLED', now, wasPaid ? '订单已取消，本地模拟退款已完成' : '用户取消待付款订单');
}
