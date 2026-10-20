import { randomUUID } from 'node:crypto';

function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Simulated airline ticketing provider. A production adapter would send the
 * confirmed order to the airline/GDS and persist the returned ticket and PNR.
 */
export function issueTicket(order, now = new Date()) {
  const seed = hashString(`${order.id}|${order.details ? order.details.flightNo : ''}`);
  const pnr = seed.toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
  const ticketNumber = `781-${String(seed).padStart(10, '0').slice(0, 10)}`;
  return {
    provider: 'Mock Aviation',
    ticketNumber,
    pnr,
    issuedAt: now.toISOString(),
    checkinCode: `BP-${randomUUID()}`
  };
}
