import { randomUUID } from 'node:crypto';
import { AppError, badRequest } from './errors.mjs';

export const PAYMENT_METHODS = Object.freeze({
  alipay: '支付宝（模拟）',
  wechat: '微信支付（模拟）',
  card: '银行卡（模拟）'
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Adapter for an external payment gateway. This implementation is intentionally
 * local and deterministic; it demonstrates where a real signed HTTP integration
 * would sit without sending any payment data outside the machine.
 */
export function createMockPaymentGateway({ delayMs = 450, clock = () => new Date() } = {}) {
  return {
    name: 'MockPay Sandbox',
    async charge({ orderId, amount, method }) {
      if (!PAYMENT_METHODS[method]) throw badRequest('请选择支持的支付方式');
      if (!Number.isFinite(amount) || amount <= 0) throw new AppError('INVALID_AMOUNT', '订单金额无效', 422);
      if (delayMs > 0) await sleep(delayMs);
      const paidAt = clock().toISOString();
      return {
        provider: 'MockPay Sandbox',
        transactionId: `MP-${randomUUID()}`,
        orderId,
        amount,
        currency: 'CNY',
        method,
        methodLabel: PAYMENT_METHODS[method],
        status: 'SUCCESS',
        paidAt
      };
    }
  };
}
