import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBargainToOrder,
  createBargainSession,
  cutBargainSession,
  expireBargainSession,
  serializeBargainSession
} from '../server/bargain.mjs';

const now = new Date('2026-10-21T04:00:00.000Z');
const owner = { id: 'U-owner', name: '小橙' };
const friend = { id: 'U-friend', name: '好友' };
const rng = () => 0.5;

function makeOrder(total = 598) {
  return {
    id: 'OC-TEST-1',
    type: 'flight',
    status: 'PENDING_PAYMENT',
    total,
    createdAt: now.toISOString(),
    history: []
  };
}

function createSession() {
  return createBargainSession({ order: makeOrder(), owner, now, random: rng });
}

test('bargain starts with an owner cut and a hidden success threshold', () => {
  const session = createSession();
  assert.equal(session.target, 99);
  assert.equal(session.status, 'ACTIVE');
  assert.equal(session.discount, 5.2);
  assert.equal(session.remaining, 93.8);
  assert.equal(session.helperCount, 0);
  assert.ok(session.successAt >= 18 && session.successAt <= 35);
  const serialized = serializeBargainSession(session, owner.id);
  assert.equal(serialized.isOwner, true);
  assert.equal(serialized.canCut, false);
  assert.equal('successAt' in serialized, false);
});

test('owner cannot cut and each friend can only cut once', () => {
  const session = createSession();
  assert.throws(() => cutBargainSession(session, { user: owner, now, random: rng }), (error) => error.code === 'OWNER_CANNOT_CUT');
  cutBargainSession(session, { user: friend, now, random: rng });
  assert.throws(() => cutBargainSession(session, { user: friend, now, random: rng }), (error) => error.code === 'ALREADY_CUT');
  assert.equal(session.helperCount, 1);
});

test('cuts decay toward 0.01 and the last cent can stall without success', () => {
  const session = createSession();
  session.discount = 98.98;
  session.remaining = 0.02;
  session.helperCount = 5;
  const result = cutBargainSession(session, { user: { id: 'U-a', name: '甲' }, now, random: rng });
  assert.equal(result.success, false);
  assert.equal(session.discount, 98.99);
  assert.equal(session.remaining, 0.01);
  const stalled = cutBargainSession(session, { user: { id: 'U-b', name: '乙' }, now, random: rng });
  assert.equal(stalled.success, false);
  assert.equal(stalled.cut.stalled, true);
  assert.equal(session.discount, 98.99);
  assert.equal(session.remaining, 0.01);
});

test('success is granted at the hidden helper threshold and caps at 99', () => {
  const session = createSession();
  session.helperCount = session.successAt - 1;
  session.discount = 98.99;
  session.remaining = 0.01;
  const result = cutBargainSession(session, { user: { id: 'U-final', name: '最后一刀' }, now, random: rng });
  assert.equal(result.success, true);
  assert.equal(session.discount, 99);
  assert.equal(session.remaining, 0);
  assert.equal(session.status, 'SUCCEEDED');
  assert.equal(session.coupon.amount, 99);
  const discountedOrder = makeOrder();
  applyBargainToOrder(discountedOrder, session, now);
  assert.equal(discountedOrder.originalTotal, 598);
  assert.equal(discountedOrder.total, 499);
  assert.equal(discountedOrder.bargain.discount, 99);
  assert.equal(discountedOrder.history.at(-1).statusLabel, '砍价成功');
});

test('bargain expires with the pending order window', () => {
  const session = createSession();
  const later = new Date(new Date(session.expiresAt).getTime() + 1000);
  assert.equal(expireBargainSession(session, later), true);
  assert.equal(session.status, 'EXPIRED');
  assert.throws(() => cutBargainSession(session, { user: friend, now: later, random: rng }), (error) => error.code === 'BARGAIN_CLOSED');
});

test('only flight and hotel orders can start a bargain', () => {
  assert.throws(
    () => createBargainSession({ order: { ...makeOrder(), type: 'train' }, owner, now, random: rng }),
    /机票和酒店/
  );
  assert.throws(
    () => createBargainSession({ order: { ...makeOrder(), status: 'PAID' }, owner, now, random: rng }),
    /待付款/
  );
});
