import { HTTPException } from 'hono/http-exception'

export { HTTPException }

export function notFound(message = 'Not found'): HTTPException {
  return new HTTPException(404, { message })
}

export function badRequest(message = 'Bad request'): HTTPException {
  return new HTTPException(400, { message })
}

export function unauthorized(message = 'Unauthorized'): HTTPException {
  return new HTTPException(401, { message })
}
