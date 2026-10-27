import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { TRAVEL_DATA } from '../public/data.js';
import { openStore } from './store.mjs';
import { createServices } from './service.mjs';
import { createMockPaymentGateway } from './payments.mjs';
import { authenticate, login, publicUser, tokenFromRequest } from './auth.mjs';
import { AppError, badRequest, notFound } from './errors.mjs';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const JSON_LIMIT_BYTES = 1024 * 1024;

function commonHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  commonHeaders(response);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

function sendApiError(response, error) {
  const status = error instanceof AppError ? error.status : 500;
  const payload = {
    error: {
      code: error instanceof AppError ? error.code : 'INTERNAL_ERROR',
      message: error instanceof AppError ? error.message : '服务内部错误',
      details: error instanceof AppError ? error.details : null
    }
  };
  sendJson(response, status, payload);
}

function methodNotAllowed(response, method) {
  const error = new AppError('METHOD_NOT_ALLOWED', `不支持 ${method} 方法`, 405);
  return sendApiError(response, error);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > JSON_LIMIT_BYTES) {
      throw new AppError('PAYLOAD_TOO_LARGE', '请求体过大', 413);
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    throw badRequest('请求体必须是合法 JSON');
  }
}

function queryObject(url) {
  return Object.fromEntries(url.searchParams.entries());
}

function requireInteger(value, fallback) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function serveStatic(request, response, url, publicDir) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    methodNotAllowed(response, request.method);
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch (error) {
    throw badRequest('URL 编码无效');
  }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let filePath = path.resolve(publicDir, relative);
  if (filePath !== publicDir && !filePath.startsWith(publicDir + path.sep)) {
    throw notFound('文件不存在');
  }
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch (error) {
    stat = null;
  }
  if (stat && stat.isDirectory()) {
    filePath = path.join(filePath, 'index.html');
    try {
      stat = await fs.stat(filePath);
    } catch (error) {
      stat = null;
    }
  }
  if (!stat || !stat.isFile()) {
    commonHeaders(response);
    const body = 'Not found';
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
    response.end(request.method === 'HEAD' ? undefined : body);
    return;
  }
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || 'application/octet-stream';
  const cacheControl = extension === '.html' || extension === '.js' || extension === '.css'
    ? 'no-cache'
    : 'public, max-age=86400';
  commonHeaders(response);
  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': cacheControl
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  const body = await fs.readFile(filePath);
  response.end(body);
}

export async function createApplication(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const publicDir = path.resolve(options.publicDir || path.join(rootDir, 'public'));
  const storePath = path.resolve(options.storePath || path.join(rootDir, 'data', 'store.json'));
  const clock = options.clock || (() => new Date());
  const paymentDelayMs = options.paymentDelayMs == null ? 450 : options.paymentDelayMs;
  const logger = options.logger || null;
  const store = options.store || await openStore(storePath);
  const gateway = options.gateway || createMockPaymentGateway({ delayMs: paymentDelayMs, clock });
  const services = createServices({ store, gateway, clock });

  const server = http.createServer(async (request, response) => {
    const startedAt = Date.now();
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    let status = 200;
    try {
      if (!url.pathname.startsWith('/api/')) {
        await serveStatic(request, response, url, publicDir);
        status = response.statusCode;
        return;
      }

      const method = request.method || 'GET';
      const pathname = url.pathname;

      if (pathname === '/api/health' && method === 'GET') {
        sendJson(response, 200, services.health());
        return;
      }

      if (pathname === '/api/cities' && method === 'GET') {
        const region = url.searchParams.get('region');
        const cities = region ? TRAVEL_DATA.cities.filter((city) => city.region === region) : TRAVEL_DATA.cities;
        sendJson(response, 200, { cities });
        return;
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await readJsonBody(request);
        const result = await login(store, body, clock());
        status = 200;
        sendJson(response, 200, result);
        return;
      }

      if (pathname === '/api/auth/me' && method === 'GET') {
        const auth = authenticate(store, request);
        sendJson(response, 200, { user: publicUser(auth.user), role: auth.session.role });
        return;
      }

      if (pathname === '/api/auth/logout' && method === 'POST') {
        const token = tokenFromRequest(request);
        await store.deleteSession(token);
        status = 204;
        commonHeaders(response);
        response.writeHead(204, { 'Cache-Control': 'no-store' });
        response.end();
        return;
      }

      if (pathname === '/api/flights/search' && method === 'GET') {
        const query = queryObject(url);
        const result = services.searchFlights({
          from: query.from,
          to: query.to,
          date: query.date,
          returnDate: query.returnDate,
          trip: query.trip || 'oneway',
          passengers: requireInteger(query.passengers, 1),
          cabin: query.cabin || '经济舱',
          airline: query.airline || '',
          departWindow: query.departWindow || '',
          maxPrice: query.maxPrice ? requireInteger(query.maxPrice, null) : null
        });
        sendJson(response, 200, result);
        return;
      }

      if (pathname === '/api/trains/search' && method === 'GET') {
        const query = queryObject(url);
        const result = services.searchTrains({
          from: query.from,
          to: query.to,
          date: query.date,
          passengers: requireInteger(query.passengers, 1),
          type: query.type || 'all'
        });
        sendJson(response, 200, result);
        return;
      }

      if (pathname === '/api/hotels/search' && method === 'GET') {
        const query = queryObject(url);
        const result = services.searchHotels({
          city: query.city,
          checkin: query.checkin,
          checkout: query.checkout,
          keyword: query.keyword,
          level: query.level
        });
        sendJson(response, 200, result);
        return;
      }

      if (pathname === '/api/attractions/search' && method === 'GET') {
        const query = queryObject(url);
        const result = services.searchAttractions({
          city: query.city,
          date: query.date,
          keyword: query.keyword
        });
        sendJson(response, 200, result);
        return;
      }

      if (pathname === '/api/itineraries' && method === 'POST') {
        const body = await readJsonBody(request);
        const result = services.itinerary(body);
        sendJson(response, 200, result);
        return;
      }

      if (pathname === '/api/itineraries' && method === 'GET') {
        const user = authenticate(store, request).user;
        const result = await services.listItineraries(user);
        sendJson(response, 200, result);
        return;
      }

      if (pathname === '/api/itineraries/save' && method === 'POST') {
        const user = authenticate(store, request).user;
        const body = await readJsonBody(request);
        const result = await services.saveItinerary(user, body);
        status = 201;
        sendJson(response, 201, { itinerary: result });
        return;
      }

      if (pathname === '/api/orders' && method === 'POST') {
        const user = authenticate(store, request).user;
        const body = await readJsonBody(request);
        const order = await services.createOrder(user, body);
        status = 201;
        sendJson(response, 201, { order });
        return;
      }

      if (pathname === '/api/orders' && method === 'GET') {
        const user = authenticate(store, request).user;
        const scope = url.searchParams.get('scope') === 'all' ? 'all' : 'mine';
        const result = await services.listOrders(user, scope);
        sendJson(response, 200, result);
        return;
      }

      if (pathname === '/api/agency/dashboard' && method === 'GET') {
        const user = authenticate(store, request).user;
        const result = await services.agencyDashboard(user);
        sendJson(response, 200, result);
        return;
      }

      const orderDetailMatch = /^\/api\/orders\/([^/]+)$/.exec(pathname);
      if (orderDetailMatch && method === 'GET') {
        const user = authenticate(store, request).user;
        const order = await services.getOrder(user, decodeURIComponent(orderDetailMatch[1]));
        sendJson(response, 200, { order });
        return;
      }

      const payMatch = /^\/api\/orders\/([^/]+)\/pay$/.exec(pathname);
      if (payMatch && method === 'POST') {
        const user = authenticate(store, request).user;
        const body = await readJsonBody(request);
        const order = await services.payOrder(user, decodeURIComponent(payMatch[1]), body.method);
        sendJson(response, 200, { order });
        return;
      }

      const cancelMatch = /^\/api\/orders\/([^/]+)\/cancel$/.exec(pathname);
      if (cancelMatch && method === 'POST') {
        const user = authenticate(store, request).user;
        const order = await services.cancelOrder(user, decodeURIComponent(cancelMatch[1]));
        sendJson(response, 200, { order });
        return;
      }

      const createBargainMatch = /^\/api\/orders\/([^/]+)\/bargain$/.exec(pathname);
      if (createBargainMatch && method === 'POST') {
        const user = authenticate(store, request).user;
        const result = await services.createBargain(user, decodeURIComponent(createBargainMatch[1]));
        sendJson(response, 200, result);
        return;
      }
      if (createBargainMatch && method === 'GET') {
        const user = authenticate(store, request).user;
        const result = await services.getBargainForOrder(user, decodeURIComponent(createBargainMatch[1]));
        sendJson(response, 200, result);
        return;
      }

      const bargainDetailMatch = /^\/api\/bargains\/([^/]+)$/.exec(pathname);
      if (bargainDetailMatch && method === 'GET') {
        const user = authenticate(store, request).user;
        const result = await services.getBargain(user, decodeURIComponent(bargainDetailMatch[1]));
        sendJson(response, 200, result);
        return;
      }

      const bargainCutMatch = /^\/api\/bargains\/([^/]+)\/cut$/.exec(pathname);
      if (bargainCutMatch && method === 'POST') {
        const user = authenticate(store, request).user;
        const result = await services.helpBargain(user, decodeURIComponent(bargainCutMatch[1]));
        sendJson(response, 200, result);
        return;
      }

      const bargainSimulateMatch = /^\/api\/bargains\/([^/]+)\/simulate$/.exec(pathname);
      if (bargainSimulateMatch && method === 'POST') {
        const user = authenticate(store, request).user;
        const body = await readJsonBody(request);
        const result = await services.simulateBargainCuts(user, decodeURIComponent(bargainSimulateMatch[1]), body.count);
        sendJson(response, 200, result);
        return;
      }

      const seatsMatch = /^\/api\/orders\/([^/]+)\/seats$/.exec(pathname);
      if (seatsMatch && method === 'GET') {
        const user = authenticate(store, request).user;
        const result = services.seatMap(user, decodeURIComponent(seatsMatch[1]));
        sendJson(response, 200, result);
        return;
      }

      const checkinMatch = /^\/api\/orders\/([^/]+)\/checkin$/.exec(pathname);
      if (checkinMatch && method === 'POST') {
        const user = authenticate(store, request).user;
        const body = await readJsonBody(request);
        const result = await services.checkIn(user, decodeURIComponent(checkinMatch[1]), body.seat, body.seats, clock());
        sendJson(response, 200, result);
        return;
      }

      const boardingPassMatch = /^\/api\/orders\/([^/]+)\/boarding-pass$/.exec(pathname);
      if (boardingPassMatch && method === 'GET') {
        const user = authenticate(store, request).user;
        const pass = services.boardingPass(user, decodeURIComponent(boardingPassMatch[1]));
        sendJson(response, 200, { boardingPass: pass });
        return;
      }

      throw notFound('API 不存在');
    } catch (error) {
      status = error instanceof AppError ? error.status : 500;
      if (!(error instanceof AppError)) {
        // Keep stack in server logs; do not leak implementation details to the client.
        console.error(error);
      }
      if (!response.headersSent) sendApiError(response, error);
      else response.end();
    } finally {
      if (logger) {
        logger({
          method: request.method,
          path: url.pathname,
          status,
          durationMs: Date.now() - startedAt
        });
      }
    }
  });

  async function close() {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  return { server, store, services, publicDir, close };
}
