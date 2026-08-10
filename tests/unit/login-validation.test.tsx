import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/app/(auth)/login/page'

// Mock the server action
vi.mock('@/app/(auth)/login/actions', () => ({
  login: vi.fn(),
}))

describe('LoginPage — client-side validation', () => {
  function getForm() {
    return screen.getByRole('button', { name: /sign in/i }).closest('form')!
  }

  it('shows "Email is required" when email is empty', async () => {
    render(<LoginPage />)
    const form = getForm()

    // Type valid password, leave email empty
    await userEvent.type(screen.getByLabelText('Password'), 'validPassword123')

    fireEvent.submit(form)

    // Error comes through the wrapper action's state.error
    expect(await screen.findByText('Email is required')).toBeInTheDocument()
  })

  it('shows "Password must be at least 6 characters" when password is too short', async () => {
    render(<LoginPage />)
    const form = getForm()

    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com')
    await userEvent.type(screen.getByLabelText('Password'), '12345')

    fireEvent.submit(form)

    expect(
      await screen.findByText('Password must be at least 6 characters')
    ).toBeInTheDocument()
  })

  it('shows no client errors when both fields are valid', async () => {
    render(<LoginPage />)
    const form = getForm()

    await userEvent.type(screen.getByLabelText('Email'), 'admin@botellon.com')
    await userEvent.type(screen.getByLabelText('Password'), 'Admin123!')

    fireEvent.submit(form)

    // Client validation passes — no "Email is required" or "Password must be..."
    // The form delegates to server action (mocked, won't actually redirect)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('Email is required')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Password must be at least 6 characters')
    ).not.toBeInTheDocument()
  })

  it('shows no server error when state is null (initial render)', () => {
    render(<LoginPage />)
    expect(
      screen.queryByText('Invalid email or password')
    ).not.toBeInTheDocument()
  })
})
