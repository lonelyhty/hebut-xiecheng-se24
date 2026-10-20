import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { buildFlightSearch } from '../server/pricing.mjs';
import { createApplication } from '../server/app.mjs';

const NOW = new Date('2026-10-20T06:00:00.000Z');
const ROUTES = [
  ['上海', '北京'],
  ['北京', '上海'],
  ['上海', '广州'],
  ['广州', '成都'],
  ['深圳', '杭州'],
  ['成都', '三亚'],
  ['杭州', '厦门'],
  ['南京', '重庆']
];

function percentile(sorted, ratio) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index];
}

function report(label, samples) {
  const sorted = samples.slice().sort((left, right) => left - right);
  const summary = {
    label,
    runs: sorted.length,
    p50_ms: Number(percentile(sorted, 0.5).toFixed(3)),
    p95_ms: Number(percentile(sorted, 0.95).toFixed(3)),
    p99_ms: Number(percentile(sorted, 0.99).toFixed(3)),
    max_ms: Number(sorted[sorted.length - 1].toFixed(3))
  };
  console.log(`[performance] ${JSON.stringify(summary)}`);
  return summary;
}

test('in-process flight search p95 stays well below 50ms over 400 runs', () => {
  const samples = [];
  let count = 0;
  for (let index = 0; index < 400; index += 1) {
    const [from, to] = ROUTES[index % ROUTES.length];
    const day = 1 + (index % 28);
    const date = `2026-11-${String(day).padStart(2, '0')}`;
    const started = performance.now();
    const result = buildFlightSearch({
      from,
      to,
      date,
      passengers: 1 + (index % 3),
      cabin: ['经济舱', '超级经济舱', '商务舱'][index % 3],
      now: NOW
    });
    samples.push(performance.now() - started);
    count += result.results.length;
  }
  const summary = report('domain-flight-search', samples);
  assert.equal(count, 2400);
  assert.ok(summary.p95_ms < 50, `p95 ${summary.p95_ms}ms should be under 50ms`);
  assert.ok(summary.p99_ms < 100, `p99 ${summary.p99_ms}ms should be under 100ms`);
});

let app;
let baseUrl;
let tempDir;

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'octrip-perf-'));
  app = await createApplication({
    rootDir: path.resolve('.'),
    storePath: path.join(tempDir, 'store.json'),
    publicDir: path.resolve('public'),
    clock: () => NOW,
    paymentDelayMs: 0
  });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${app.server.address().port}`;
});

after(async () => {
  if (app) await app.close();
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
});

test('HTTP flight search p95 stays below 250ms over 40 sequential requests', async () => {
  const samples = [];
  for (let index = 0; index < 5; index += 1) {
    await fetch(`${baseUrl}/api/flights/search?from=${encodeURIComponent('上海')}&to=${encodeURIComponent('北京')}&date=2026-11-01`);
  }
  for (let index = 0; index < 40; index += 1) {
    const [from, to] = ROUTES[index % ROUTES.length];
    const day = 1 + (index % 28);
    const date = `2026-11-${String(day).padStart(2, '0')}`;
    const started = performance.now();
    const response = await fetch(`${baseUrl}/api/flights/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}&passengers=1&cabin=${encodeURIComponent('经济舱')}`);
    const body = await response.json();
    samples.push(performance.now() - started);
    assert.equal(response.status, 200);
    assert.equal(body.results.length > 0, true);
  }
  const summary = report('http-flight-search', samples);
  assert.ok(summary.p95_ms < 250, `HTTP p95 ${summary.p95_ms}ms should be under 250ms`);
});
