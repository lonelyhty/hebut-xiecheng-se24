export class AppError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function badRequest(message, details) {
  return new AppError('BAD_REQUEST', message, 400, details);
}

export function unauthorized(message = '请先登录后再继续') {
  return new AppError('UNAUTHORIZED', message, 401);
}

export function forbidden(message = '当前角色无权执行此操作') {
  return new AppError('FORBIDDEN', message, 403);
}

export function notFound(message = '请求的资源不存在') {
  return new AppError('NOT_FOUND', message, 404);
}

export function conflict(code, message) {
  return new AppError(code, message, 409);
}

export function unprocessable(message, details) {
  return new AppError('VALIDATION_FAILED', message, 422, details);
}

export function internal(message = '服务内部错误') {
  return new AppError('INTERNAL_ERROR', message, 500);
}
