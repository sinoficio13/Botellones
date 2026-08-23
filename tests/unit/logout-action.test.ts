import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  cookiesMock,
  redirectMock,
  revalidatePathMock,
  createClientMock,
  signOutMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  createClientMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { logout } from '@/app/(auth)/logout/actions';

function cookieStore() {
  return { set: vi.fn(), get: vi.fn(), getAll: vi.fn() };
}

describe('logout — dev mode', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    cookiesMock.mockReset();
    redirectMock.mockReset();
    revalidatePathMock.mockReset();
    createClientMock.mockReset();
    vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', 'dev');
  });

  it('deletes the dev session cookie and redirects to /login', async () => {
    const store = cookieStore();
    cookiesMock.mockResolvedValue(store as never);

    await logout();

    expect(store.set).toHaveBeenCalledWith(
      'botellon_dev_session',
      '',
      expect.objectContaining({ maxAge: 0, path: '/' })
    );
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('does not touch Supabase in dev mode', async () => {
    cookiesMock.mockResolvedValue(cookieStore() as never);

    await logout();

    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('still redirects to /login when reading cookies fails', async () => {
    cookiesMock.mockRejectedValue(new Error('no request scope') as never);

    await logout();

    expect(redirect).toHaveBeenCalledWith('/login');
  });
});

describe('logout — production mode', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    cookiesMock.mockReset();
    redirectMock.mockReset();
    revalidatePathMock.mockReset();
    createClientMock.mockReset();
    signOutMock.mockReset();
    vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', 'production');
  });

  it('signs out of Supabase and redirects to /login', async () => {
    createClientMock.mockResolvedValue({
      auth: { signOut: signOutMock },
    } as never);
    signOutMock.mockResolvedValue({ error: null });

    await logout();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('still redirects to /login when signOut rejects', async () => {
    createClientMock.mockResolvedValue({
      auth: { signOut: signOutMock },
    } as never);
    signOutMock.mockRejectedValue(new Error('network') as never);

    await logout();

    expect(redirect).toHaveBeenCalledWith('/login');
  });
});