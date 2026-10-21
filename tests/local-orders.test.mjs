import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalOrder, normalizeLocalOrder, payLocalOrder, cancelLocalOrder, expireLocalOrder, changeLocalOrder } from '../public/local-orders.js';

const now = new Date('2026-10-21T04:00:00Z');
const draft = { kind: 'hotel', kindLabel: '酒店订单', title: '演示酒店', total: 388, details: {} };
const contact = { name: '测试旅客', phone: '13800138000' };
const create = () => createLocalOrder(draft, contact, [], now);

test('payment in a stale tab cannot overwrite a cancellation saved by another tab', () => {
  const stored = [create()];
  const staleTab = JSON.parse(JSON.stringify(stored));
  changeLocalOrder(stored, stored[0].id, 'cancel', null, now);
  assert.equal(staleTab[0].status, 'PENDING_PAYMENT');
  const latest = JSON.parse(JSON.stringify(stored));
  assert.throws(() => changeLocalOrder(latest, staleTab[0].id, 'pay', 'alipay', now));
  assert.equal(latest[0].status, 'CANCELLED');
  assert.deepEqual(latest[0].history.map(item => item.status), ['PENDING_PAYMENT', 'CANCELLED']);
});

test('local booking starts pending and survives storage before later payment', () => {
  const order = JSON.parse(JSON.stringify(create()));
  assert.equal(order.status, 'PENDING_PAYMENT');
  assert.equal(order.statusLabel, '待付款');
  assert.equal(order.type, 'hotel');
  assert.equal(order.payment, null);
  payLocalOrder(order, 'wechat', new Date(now.getTime() + 60000));
  assert.equal(order.status, 'PAID');
  assert.equal(order.payment.method, 'wechat');
  assert.equal(order.payment.amount, 388);
  assert.deepEqual(order.history.map(item => item.status), ['PENDING_PAYMENT', 'PAID']);
  assert.throws(() => payLocalOrder(order, 'alipay', now));
});

test('pending local order can be cancelled without payment and cannot be paid again', () => {
  const order = create();
  cancelLocalOrder(order, now);
  assert.equal(order.status, 'CANCELLED');
  assert.equal(order.statusLabel, '已取消');
  assert.equal(order.payment, null);
  assert.equal(order.cancellation.refund, null);
  assert.deepEqual(order.history.map(item => item.status), ['PENDING_PAYMENT', 'CANCELLED']);
  assert.throws(() => payLocalOrder(order, 'alipay', now));
  assert.throws(() => cancelLocalOrder(order, now));
});

test('paid local cancellation records a simulated refund', () => {
  const order = create();
  payLocalOrder(order, 'card', now);
  cancelLocalOrder(order, now);
  assert.equal(order.status, 'CANCELLED');
  assert.equal(order.cancellation.refund.status, 'REFUNDED_MOCK');
  assert.equal(order.cancellation.refund.amount, 388);
});

test('local payment rejects unknown methods and expired orders', () => {
  const order = create();
  assert.throws(() => payLocalOrder(order, 'unknown', now));
  assert.equal(order.status, 'PENDING_PAYMENT');
  const later = new Date(now.getTime() + 16 * 60000);
  assert.throws(() => payLocalOrder(order, 'alipay', later));
  assert.equal(order.status, 'EXPIRED');
  assert.equal(order.payment, null);
  assert.equal(expireLocalOrder(order, later), false);
});

test('legacy confirmed and cancelled local orders use the common status filters', () => {
  const confirmed = normalizeLocalOrder({ kind: 'flight', status: '已确认', statusLabel: '已确认（本地）' });
  assert.equal(confirmed.type, 'flight');
  assert.equal(confirmed.status, 'PAID');
  assert.equal(normalizeLocalOrder({ status: '已取消' }).status, 'CANCELLED');
  const serverOrder = { userId: 'server-user', status: 'PENDING_PAYMENT', createdAt: now.toISOString() };
  assert.equal(expireLocalOrder(serverOrder, new Date(now.getTime() + 3600000)), false);
  assert.throws(() => payLocalOrder(serverOrder, 'alipay', now));
  assert.throws(() => cancelLocalOrder(serverOrder, now));
  assert.equal(serverOrder.status, 'PENDING_PAYMENT');
});
