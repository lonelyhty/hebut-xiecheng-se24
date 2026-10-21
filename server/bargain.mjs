import { randomBytes, randomUUID } from 'node:crypto';
import { conflict, unprocessable } from './errors.mjs';

export const BARGAIN_TARGET = 99;
export const BARGAIN_TTL_MS = 15 * 60 * 1000;
export const BARGAIN_STATUS_LABELS = Object.freeze({
  ACTIVE: '砍价中',
  SUCCEEDED: '砍价成功',
  CLAIMED: '已使用',
  EXPIRED: '已失效',
  CANCELLED: '已取消'
});

const OWNER_CUTS = [8.88, 5.2, 3];
const CUT_STAGES = [
  { above: 50, choices: [8.88, 5.2, 3] },
  { above: 20, choices: [5.2, 3, 1] },
  { above: 5, choices: [3, 1, 0.5] },
  { above: 1, choices: [0.5, 0.1, 0.05] },
  { above: 0.1, choices: [0.1, 0.05, 0.01] },
  { above: 0, choices: [0.01] }
];

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function pick(list, random) {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

function randomInt(min, max, random) {
  return min + Math.floor(random() * (max - min + 1));
}

export function createBargainSession({ order, owner, now = new Date(), random = Math.random }) {
  if (!['flight', 'hotel'].includes(order.type)) {
    throw unprocessable('目前只有机票和酒店订单支持砍价');
  }
  if (order.status !== 'PENDING_PAYMENT') {
    throw conflict('INVALID_ORDER_STATE', '只有待付款订单可以发起砍价');
  }
  const maxTarget = roundMoney(Math.min(BARGAIN_TARGET, Math.max(0, order.total - 1)));
  if (maxTarget < 1) throw unprocessable('订单金额过低，暂不支持砍价');
  const ownerAmount = Math.min(pick(OWNER_CUTS, random), roundMoney(maxTarget - 0.01));
  const discount = Math.max(0.01, roundMoney(ownerAmount));
  const createdAt = now.toISOString();
  const expiresAt = new Date(new Date(order.createdAt).getTime() + BARGAIN_TTL_MS).toISOString();
  return {
    id: `BG-${randomUUID()}`,
    token: randomBytes(16).toString('hex'),
    orderId: order.id,
    ownerId: owner.id,
    ownerName: owner.name || '发起人',
    status: 'ACTIVE',
    statusLabel: BARGAIN_STATUS_LABELS.ACTIVE,
    target: maxTarget,
    originalTotal: order.total,
    discount,
    remaining: roundMoney(maxTarget - discount),
    helperCount: 0,
    successAt: randomInt(18, 35, random),
    helpers: [],
    ownerCut: { amount: discount, at: createdAt },
    lastCut: { kind: 'owner', name: owner.name || '发起人', amount: discount, at: createdAt, success: false, simulated: false },
    coupon: null,
    createdAt,
    updatedAt: createdAt,
    expiresAt
  };
}

export function expireBargainSession(session, now = new Date()) {
  if (!session || session.status !== 'ACTIVE') return false;
  if (now.getTime() < new Date(session.expiresAt).getTime()) return false;
  session.status = 'EXPIRED';
  session.statusLabel = BARGAIN_STATUS_LABELS.EXPIRED;
  session.updatedAt = now.toISOString();
  session.closeReason = '待付款订单超时，砍价活动已失效';
  return true;
}

export function closeBargainSession(session, status, now = new Date(), reason = '') {
  if (!session || !BARGAIN_STATUS_LABELS[status]) return null;
  if (['CLAIMED', 'CANCELLED'].includes(session.status)) return session;
  session.status = status;
  session.statusLabel = BARGAIN_STATUS_LABELS[status];
  session.updatedAt = now.toISOString();
  session.closeReason = reason;
  return session;
}

function pickCutAmount(remaining, random) {
  const stage = CUT_STAGES.find((item) => remaining > item.above) || CUT_STAGES[CUT_STAGES.length - 1];
  const allowed = stage.choices.filter((amount) => amount <= roundMoney(remaining - 0.01));
  return allowed.length ? pick(allowed, random) : 0.01;
}

export function cutBargainSession(session, { user, now = new Date(), random = Math.random, simulatedName = '' } = {}) {
  if (!session) throw conflict('BARGAIN_NOT_FOUND', '砍价活动不存在');
  if (expireBargainSession(session, now) || session.status !== 'ACTIVE') {
    throw conflict('BARGAIN_CLOSED', '砍价活动已结束，不能再助力');
  }
  if (!user || !user.id) throw conflict('UNAUTHORIZED', '请先登录后再帮砍');
  const simulated = Boolean(simulatedName);
  if (!simulated && user.id === session.ownerId) {
    throw conflict('OWNER_CANNOT_CUT', '发起人不能给自己助力，快把链接分享给好友吧');
  }
  if (!simulated && session.helpers.some((helper) => helper.userId === user.id)) {
    throw conflict('ALREADY_CUT', '你已经帮砍过这一刀了');
  }
  const helper = {
    id: `H-${randomUUID()}`,
    userId: simulated ? `SIM-${randomUUID()}` : user.id,
    name: simulatedName || user.name || '热心好友',
    amount: 0,
    simulated,
    success: false,
    stalled: false,
    at: now.toISOString()
  };
  session.helperCount += 1;
  const previousDiscount = session.discount;
  const lucky = session.helperCount >= 8 && random() < 0.03;
  const success = session.helperCount >= session.successAt || lucky;
  if (success) {
    helper.amount = roundMoney(session.target - previousDiscount);
    helper.success = true;
    session.discount = session.target;
    session.remaining = 0;
    session.status = 'SUCCEEDED';
    session.statusLabel = BARGAIN_STATUS_LABELS.SUCCEEDED;
    session.coupon = {
      amount: session.target,
      status: 'GRANTED',
      grantedAt: now.toISOString()
    };
  } else if (session.remaining <= 0.01) {
    // 拼多多式最后 0.01：继续拉人只显示砍掉 0.01，进度不再增长。
    helper.amount = 0.01;
    helper.stalled = true;
  } else {
    const amount = pickCutAmount(session.remaining, random);
    helper.amount = amount;
    const cap = roundMoney(session.target - 0.01);
    session.discount = Math.min(cap, roundMoney(previousDiscount + amount));
    session.remaining = Math.max(0.01, roundMoney(session.target - session.discount));
  }
  session.helpers.push(helper);
  session.lastCut = { ...helper, totalDiscount: session.discount, remaining: session.remaining };
  session.updatedAt = now.toISOString();
  return { session, cut: helper, success };
}

export function applyBargainToOrder(order, session, now = new Date()) {
  const originalTotal = Number(order.originalTotal) || order.total;
  order.originalTotal = originalTotal;
  order.total = roundMoney(Math.max(0, originalTotal - session.discount));
  order.bargain = {
    id: session.id,
    target: session.target,
    discount: session.discount,
    helperCount: session.helperCount,
    status: 'SUCCEEDED',
    successAt: now.toISOString()
  };
  order.updatedAt = now.toISOString();
  if (!Array.isArray(order.history)) order.history = [];
  order.history.push({
    status: order.status,
    statusLabel: '砍价成功',
    at: now.toISOString(),
    reason: `好友助力砍成 ¥${session.discount} 优惠，订单应付已更新`
  });
  return order;
}

export function serializeBargainSession(session, viewerId) {
  if (!session) return null;
  const helpers = Array.isArray(session.helpers) ? session.helpers : [];
  const alreadyHelped = helpers.some((helper) => helper.userId === viewerId);
  return {
    id: session.id,
    token: session.token,
    orderId: session.orderId,
    status: session.status,
    statusLabel: session.statusLabel,
    ownerName: session.ownerName,
    target: session.target,
    originalTotal: session.originalTotal,
    discount: session.discount,
    remaining: session.remaining,
    progress: session.target ? Math.min(1, session.discount / session.target) : 0,
    helperCount: session.helperCount,
    ownerCut: session.ownerCut,
    lastCut: session.lastCut,
    coupon: session.coupon,
    expiresAt: session.expiresAt,
    closeReason: session.closeReason || '',
    isOwner: session.ownerId === viewerId,
    alreadyHelped,
    canCut: session.status === 'ACTIVE' && session.ownerId !== viewerId && !alreadyHelped,
    helpers: helpers.slice(-30).map((helper) => ({
      name: helper.name,
      amount: helper.amount,
      simulated: helper.simulated,
      success: helper.success,
      stalled: Boolean(helper.stalled),
      at: helper.at
    }))
  };
}
