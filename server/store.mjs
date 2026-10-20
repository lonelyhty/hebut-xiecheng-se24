import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';

const EMPTY_DATA = {
  version: 1,
  users: [],
  sessions: [],
  orders: []
};

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
        orders: Array.isArray(parsed.orders) ? parsed.orders : []
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
}

export async function openStore(filePath) {
  const store = new Store(filePath);
  await store.init();
  return store;
}
