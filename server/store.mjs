import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';

const EMPTY_DATA = {
  version: 1,
  users: [],
  sessions: [],
  orders: [],
  bargains: [],
  inventory: {},
  hotelInventory: {}
};

const ACTIVE_FLIGHT_STATUSES = new Set(['PENDING_PAYMENT', 'PAID', 'CHECKED_IN']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = clone(EMPTY_DATA);
    this.writeChain = Promise.resolve();
  }

  async init() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      this.data = {
        version: 1,
        users: Array.isArray(parsed.users) ? parsed.users : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
        bargains: Array.isArray(parsed.bargains) ? parsed.bargains : [],
        inventory: parsed.inventory && typeof parsed.inventory === 'object' ? parsed.inventory : {},
        hotelInventory: parsed.hotelInventory && typeof parsed.hotelInventory === 'object' ? parsed.hotelInventory : {}
      };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new Error(`无法读取本地数据文件 ${this.filePath}: ${error.message}`);
      }
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await this.persist();
    }
    return this;
  }

  async persist() {
    const directory = path.dirname(this.filePath);
    await fs.mkdir(directory, { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    const payload = JSON.stringify(this.data, null, 2);
    await fs.writeFile(temporary, payload, 'utf8');
    await fs.rename(temporary, this.filePath);
  }

  async save() {
    this.writeChain = this.writeChain.then(() => this.persist());
    return this.writeChain;
  }

  findUserByPhone(phone) {
    return this.data.users.find((user) => user.phone === phone) || null;
  }

  findUserById(id) {
    return this.data.users.find((user) => user.id === id) || null;
  }

  async createUser({ phone, role, name }) {
    const user = {
      id: `U-${randomUUID()}`,
      phone,
      role,
      name,
      createdAt: new Date().toISOString()
    };
    this.data.users.push(user);
    await this.save();
    return user;
  }

  async createSession(userId, role, ttlMs) {
    const token = randomBytes(24).toString('hex');
    const now = Date.now();
    const session = {
      token,
      userId,
      role,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString()
    };
    this.data.sessions.push(session);
    this.data.sessions = this.data.sessions.filter((item) => new Date(item.expiresAt).getTime() > now);
    await this.save();
    return session;
  }

  getSession(token) {
    if (!token) return null;
    const now = Date.now();
    const session = this.data.sessions.find((item) => item.token === token && new Date(item.expiresAt).getTime() > now);
    if (!session) return null;
    const user = this.data.users.find((item) => item.id === session.userId);
    if (!user) return null;
    return { session, user };
  }

  async deleteSession(token) {
    const before = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((item) => item.token !== token);
    if (this.data.sessions.length !== before) await this.save();
  }

  async insertOrder(order) {
    this.data.orders.push(order);
    await this.save();
    return order;
  }

  ensureFlightInventory(flightId, totalSeats) {
    if (!this.data.inventory) this.data.inventory = {};
    if (!this.data.inventory[flightId]) {
      const reserved = this.data.orders
        .filter((order) => order.type === 'flight' && ACTIVE_FLIGHT_STATUSES.has(order.status))
        .filter((order) => order.details && order.details.flightId === flightId)
        .reduce((sum, order) => {
          const details = order.details || {};
          return sum + Number(details.passengers || (Array.isArray(order.passengers) ? order.passengers.length : 1));
        }, 0);
      this.data.inventory[flightId] = {
        totalSeats,
        reservedSeats: Math.min(totalSeats, Math.max(0, reserved))
      };
    }
    return this.data.inventory[flightId];
  }

  getAvailableFlightSeats(flightId, totalSeats) {
    const inventory = this.ensureFlightInventory(flightId, totalSeats);
    return Math.max(0, inventory.totalSeats - inventory.reservedSeats);
  }

  reserveFlightSeats(flightId, totalSeats, count) {
    const inventory = this.ensureFlightInventory(flightId, totalSeats);
    if (inventory.totalSeats - inventory.reservedSeats < count) return false;
    inventory.reservedSeats += count;
    return true;
  }

  releaseFlightSeats(flightId, count) {
    if (!this.data.inventory || !this.data.inventory[flightId]) return;
    const inventory = this.data.inventory[flightId];
    inventory.reservedSeats = Math.max(0, inventory.reservedSeats - count);
  }

  ensureHotelRoomInventory(hotelId, roomIndex, totalRooms) {
    if (!this.data.hotelInventory) this.data.hotelInventory = {};
    if (!this.data.hotelInventory[hotelId]) this.data.hotelInventory[hotelId] = {};
    const key = String(roomIndex);
    if (!this.data.hotelInventory[hotelId][key]) {
      const reserved = this.data.orders
        .filter((order) => order.type === 'hotel' && ACTIVE_FLIGHT_STATUSES.has(order.status))
        .filter((order) => order.details && order.details.hotelId === hotelId && Number(order.details.roomIndex) === Number(roomIndex))
        .reduce((sum, order) => sum + Number(order.details.rooms || 1), 0);
      this.data.hotelInventory[hotelId][key] = {
        totalRooms: Math.max(0, Number(totalRooms) || 0),
        reservedRooms: Math.min(Math.max(0, Number(totalRooms) || 0), Math.max(0, reserved))
      };
    }
    return this.data.hotelInventory[hotelId][key];
  }

  getAvailableHotelRooms(hotelId, roomIndex, totalRooms) {
    const inventory = this.ensureHotelRoomInventory(hotelId, roomIndex, totalRooms);
    return Math.max(0, inventory.totalRooms - inventory.reservedRooms);
  }

  reserveHotelRooms(hotelId, roomIndex, totalRooms, count) {
    const inventory = this.ensureHotelRoomInventory(hotelId, roomIndex, totalRooms);
    if (inventory.totalRooms - inventory.reservedRooms < count) return false;
    inventory.reservedRooms += count;
    return true;
  }

  releaseHotelRooms(hotelId, roomIndex, count) {
    if (!this.data.hotelInventory || !this.data.hotelInventory[hotelId]) return;
    const inventory = this.data.hotelInventory[hotelId][String(roomIndex)];
    if (!inventory) return;
    inventory.reservedRooms = Math.max(0, inventory.reservedRooms - count);
  }

  findOrderById(id) {
    return this.data.orders.find((order) => order.id === id) || null;
  }

  listOrders() {
    return this.data.orders.slice();
  }

  async replaceOrder(order) {
    const index = this.data.orders.findIndex((item) => item.id === order.id);
    if (index === -1) throw new Error(`订单 ${order.id} 不存在`);
    this.data.orders[index] = order;
    await this.save();
    return order;
  }

  getOrdersForUser(userId) {
    return this.data.orders.filter((order) => order.userId === userId);
  }

  findBargainByToken(token) {
    if (!token) return null;
    return this.data.bargains.find((bargain) => bargain.token === token) || null;
  }

  findBargainByOrderId(orderId) {
    return this.data.bargains.find((bargain) => bargain.orderId === orderId) || null;
  }

  listBargains() {
    return this.data.bargains.slice();
  }

  async insertBargain(bargain) {
    this.data.bargains.push(bargain);
    await this.save();
    return bargain;
  }

  async replaceBargain(bargain) {
    const index = this.data.bargains.findIndex((item) => item.id === bargain.id);
    if (index === -1) throw new Error(`砍价活动 ${bargain.id} 不存在`);
    this.data.bargains[index] = bargain;
    await this.save();
    return bargain;
  }
}

export async function openStore(filePath) {
  const store = new Store(filePath);
  await store.init();
  return store;
}
