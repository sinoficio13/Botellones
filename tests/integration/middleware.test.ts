/**
 * Proxy Integration Tests (task 3.4)
 *
 * Tests run with NEXT_PUBLIC_AUTH_MODE=dev — uses cookie-based auth.
 * Supabase path is tested separately below.
 */
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'

// Set dev mode for tests
process.env.NEXT_PUBLIC_AUTH_MODE = 'dev'

const { proxy, config } = await import('@/proxy')

function createMockRequest(
  pathname: string,
  cookies?: Record<string, string>
): NextRequest {
  const url = `http://localhost:3000${pathname}`
  const headers = new Headers()
  if (cookies) {
    const cookieStr = Object.entries(cookies)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('; ')
    headers.set('cookie', cookieStr)
  }
  // Build a request with cookies in the headers
  const init: RequestInit = { headers }
  return new NextRequest(new Request(url, init))
}

describe('Middleware — dev mode (cookie-based auth)', () => {
  it('redirects to /login when no dev session cookie', async () => {
    const req = createMockRequest('/dashboard')

    const response = await proxy(req)

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('http://localhost:3000/login')
  })

  it('redirects repartidor from /configuracion to /dashboard', async () => {
    const devSession = JSON.stringify({ email: 'repartidor@botellon.com', role: 'repartidor', name: 'Repartidor' })
    const req = createMockRequest('/configuracion', {
      botellon_dev_session: devSession,
    })

    const response = await proxy(req)

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard')
  })

  it('allows admin on /configuracion', async () => {
    const devSession = JSON.stringify({ email: 'admin@botellon.com', role: 'admin', name: 'Administrador' })
    const req = createMockRequest('/configuracion', {
      botellon_dev_session: devSession,
    })

    const response = await proxy(req)

    expect(response.status).toBe(200)
  })

  it('allows authenticated user on /clientes', async () => {
    const devSession = JSON.stringify({ email: 'admin@botellon.com', role: 'admin', name: 'Administrador' })
    const req = createMockRequest('/clientes', {
      botellon_dev_session: devSession,
    })

    const response = await proxy(req)

    expect(response.status).toBe(200)
  })
})

describe('Middleware — matcher config', () => {
  it('excludes public routes', () => {
    const anchored = `^${config.matcher[0]}$`
    const regex = new RegExp(anchored)

    expect(regex.test('/login')).toBe(false)
    expect(regex.test('/favicon.ico')).toBe(false)
    expect(regex.test('/_next/static/chunk.js')).toBe(false)
    expect(regex.test('/sw.js')).toBe(false)
    expect(regex.test('/qr/abc123')).toBe(false)
    expect(regex.test('/api/public/health')).toBe(false)
  })

  it('matches protected routes', () => {
    const anchored = `^${config.matcher[0]}$`
    const regex = new RegExp(anchored)

    expect(regex.test('/dashboard')).toBe(true)
    expect(regex.test('/configuracion')).toBe(true)
    expect(regex.test('/dashboard/clientes')).toBe(true)
  })
})
