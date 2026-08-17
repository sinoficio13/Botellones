import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getSessionRole } from '@/lib/auth/session';

const cookiesMock = vi.mocked(cookies);
const createClientMock = vi.mocked(createClient);

function cookieStoreWith(value: string | undefined) {
  return {
    get: (name: string) => (name === 'botellon_dev_session' ? (value ? { value } : undefined) : undefined),
  };
}

describe('getSessionRole — dev mode', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    cookiesMock.mockReset();
    createClientMock.mockReset();
    vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', 'dev');
  });

  it('returns admin from a valid cookie', async () => {
    cookiesMock.mockResolvedValue(
      cookieStoreWith(JSON.stringify({ email: 'admin@botellon.com', role: 'admin', name: 'Administrador' })) as never
    );
    await expect(getSessionRole()).resolves.toBe('admin');
  });

  it('returns repartidor from a valid cookie', async () => {
    cookiesMock.mockResolvedValue(
      cookieStoreWith(JSON.stringify({ email: 'repartidor@botellon.com', role: 'repartidor', name: 'Repartidor' })) as never
    );
    await expect(getSessionRole()).resolves.toBe('repartidor');
  });

  it('returns null when the cookie is absent', async () => {
    cookiesMock.mockResolvedValue(cookieStoreWith(undefined) as never);
    await expect(getSessionRole()).resolves.toBeNull();
  });

  it('returns null when the cookie is corrupt JSON', async () => {
    cookiesMock.mockResolvedValue(cookieStoreWith('not-json{{') as never);
    await expect(getSessionRole()).resolves.toBeNull();
  });

  it('returns null when the cookie role is unknown', async () => {
    cookiesMock.mockResolvedValue(
      cookieStoreWith(JSON.stringify({ email: 'x@x.com', role: 'superuser' })) as never
    );
    await expect(getSessionRole()).resolves.toBeNull();
  });
});

describe('getSessionRole — production mode', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    cookiesMock.mockReset();
    createClientMock.mockReset();
    vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', 'production');
  });

  function clientWithUser(role: string | undefined, hasUser = true) {
    return {
      auth: {
        getUser: async () => ({
          data: { user: hasUser ? { app_metadata: { role } } : null },
          error: null,
        }),
      },
    };
  }

  it('returns repartidor from app_metadata.role', async () => {
    createClientMock.mockResolvedValue(clientWithUser('repartidor') as never);
    await expect(getSessionRole()).resolves.toBe('repartidor');
  });

  it('returns admin from app_metadata.role', async () => {
    createClientMock.mockResolvedValue(clientWithUser('admin') as never);
    await expect(getSessionRole()).resolves.toBe('admin');
  });

  it('returns null when the user has no role', async () => {
    createClientMock.mockResolvedValue(clientWithUser(undefined) as never);
    await expect(getSessionRole()).resolves.toBeNull();
  });

  it('returns null when there is no user', async () => {
    createClientMock.mockResolvedValue(clientWithUser('admin', false) as never);
    await expect(getSessionRole()).resolves.toBeNull();
  });

  it('returns null when getUser throws', async () => {
    createClientMock.mockRejectedValue(new Error('network') as never);
    await expect(getSessionRole()).resolves.toBeNull();
  });
});
