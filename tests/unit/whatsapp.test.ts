import { describe, it, expect } from 'vitest';
import { normalizeWhatsAppPhone } from '@/lib/utils/whatsapp';

describe('normalizeWhatsAppPhone', () => {
  it('converts a local 04xx number to international 58 form', () => {
    expect(normalizeWhatsAppPhone('04121234567')).toBe('584121234567');
  });

  it('normalizes a +58 number with spaces', () => {
    expect(normalizeWhatsAppPhone('+58 412 1234567')).toBe('584121234567');
  });

  it('strips formatting characters (spaces, dashes, parentheses, dots)', () => {
    expect(normalizeWhatsAppPhone('(0412) 123-4567')).toBe('584121234567');
    expect(normalizeWhatsAppPhone('04.12.123.45.67')).toBe('584121234567');
  });

  it('returns empty string for empty, null and undefined input', () => {
    expect(normalizeWhatsAppPhone('')).toBe('');
    expect(normalizeWhatsAppPhone(null)).toBe('');
    expect(normalizeWhatsAppPhone(undefined)).toBe('');
  });

  it('passes through an already 58-prefixed number unchanged', () => {
    expect(normalizeWhatsAppPhone('584121234567')).toBe('584121234567');
  });

  it('collapses multiple leading zeros before prepending the country code', () => {
    expect(normalizeWhatsAppPhone('004121234567')).toBe('584121234567');
  });
});
