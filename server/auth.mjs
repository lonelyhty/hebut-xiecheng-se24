import { badRequest, unauthorized } from './errors.mjs';

export const DEMO_CODE = '888888';
export const ROLES = Object.freeze({
  TRAVELER: 'traveler',
  AGENCY: 'agency'
});
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function publicUser(user) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    roleLabel: user.role === ROLES.AGENCY ? '旅行社' : '旅客'
  };
}

export function maskedPhone(phone) {
  return String(phone).replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

export async function login(store, { phone, code, role }, now = new Date()) {
  const normalizedPhone = String(phone || '').trim();
  const normalizedCode = String(code || '').trim();
  const requestedRole = role === ROLES.AGENCY ? ROLES.AGENCY : ROLES.TRAVELER;
  if (!/^1[3-9]\d{9}$/.test(normalizedPhone)) {
    throw badRequest('请输入有效的 11 位中国大陆手机号');
  }
  if (normalizedCode !== DEMO_CODE) {
    throw badRequest(`演示验证码为 ${DEMO_CODE}`);
  }
  let user = store.findUserByPhone(normalizedPhone);
  if (!user) {
    user = await store.createUser({
      phone: normalizedPhone,
      role: requestedRole,
      name: requestedRole === ROLES.AGENCY ? '橙程旅行社' : '橙程旅客'
    });
  } else if (user.role !== requestedRole) {
    user.role = requestedRole;
    user.name = requestedRole === ROLES.AGENCY ? '橙程旅行社' : '橙程旅客';
    await store.save();
  }
  const session = await store.createSession(user.id, requestedRole, SESSION_TTL_MS);
  return {
    token: session.token,
    expiresAt: session.expiresAt,
    user: publicUser(user)
  };
}

export function tokenFromRequest(request) {
  const header = request.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : '';
}

export function authenticate(store, request) {
  const token = tokenFromRequest(request);
  const session = store.getSession(token);
  if (!session) throw unauthorized('登录状态已失效，请重新登录');
  return { token, session, user: session.user };
}

export function requireRole(user, roles) {
  if (!roles.includes(user.role)) {
    throw unauthorized('当前账号无权访问此资源');
  }
}
