/**
 * Middleware Integration Tests (task 3.4)
 *
 * Test Next.js middleware auth guard and role-based redirects.
 * Mocks @supabase/ssr's getUser() to simulate different auth states.
 *
 * NOTE: Next.js config.matcher strings are automatically anchored
 * (^...$) by Next.js internally. Our raw regex tests replicate this.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}))

const { middleware, config } = await import('@/middleware')

function createMockRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`)
}

/** Next.js anchors matcher regexes with ^...$ — replicate that. */
function anchoredMatcher(path: string): boolean {
  // config.matcher strings use path-to-regexp syntax which is auto-anchored
  const raw = config.matcher[0]
  const anchored = `^${raw}$`
  return new RegExp(anchored).test(path)
}

describe('Middleware — auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects unauthenticated users to /login', async () => {
    const req = createMockRequest('/dashboard')

    const { createServerClient } = await import('@supabase/ssr')
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as any)

    const response = await middleware(req)

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('http://localhost:3000/login')
  })

  it('redirects repartidor from /configuracion to /dashboard', async () => {
    const req = createMockRequest('/configuracion')

    const { createServerClient } = await import('@supabase/ssr')
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { app_metadata: { role: 'repartidor' } } },
          error: null,
        }),
      },
    } as any)

    const response = await middleware(req)

    expect(response.status).toBe(307)
    expect(response.headers.get('Location')).toBe('http://localhost:3000/dashboard')
  })

  it('allows admin on /configuracion without redirect', async () => {
    const req = createMockRequest('/configuracion')

    const { createServerClient } = await import('@supabase/ssr')
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { app_metadata: { role: 'admin' } } },
          error: null,
        }),
      },
    } as any)

    const response = await middleware(req)

    expect(response.status).toBe(200)
  })
})

describe('Middleware — matcher config', () => {
  it('excludes /login (public route managed by matcher, not middleware internals)', () => {
    expect(anchoredMatcher('/login')).toBe(false)
  })

  it('excludes static assets', () => {
    expect(anchoredMatcher('/_next/static/chunk.js')).toBe(false)
    expect(anchoredMatcher('/_next/image')).toBe(false)
    expect(anchoredMatcher('/favicon.ico')).toBe(false)
  })

  it('excludes PWA and QR public files', () => {
    expect(anchoredMatcher('/sw.js')).toBe(false)
    expect(anchoredMatcher('/manifest')).toBe(false)
    expect(anchoredMatcher('/icon-192.png')).toBe(false)
    expect(anchoredMatcher('/icon-512.png')).toBe(false)
  })

  it('excludes /qr routes (public QR scanning page)', () => {
    expect(anchoredMatcher('/qr')).toBe(false)
    expect(anchoredMatcher('/qr/abc123')).toBe(false)
  })

  it('excludes /api/public', () => {
    expect(anchoredMatcher('/api/public/health')).toBe(false)
  })

  it('matches protected routes', () => {
    expect(anchoredMatcher('/dashboard')).toBe(true)
    expect(anchoredMatcher('/configuracion')).toBe(true)
    expect(anchoredMatcher('/dashboard/clientes')).toBe(true)
    expect(anchoredMatcher('/dashboard/botellones/nuevo')).toBe(true)
  })
})
