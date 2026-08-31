import { describe, it, expect } from 'vitest';
import { normalizeWhatsAppPhone, mensajeWhatsApp, buildWaLink, linkWhatsApp } from '@/lib/utils/whatsapp';

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

describe('linkWhatsApp — wa.me digits from a stored international number', () => {
  it('passes through a stored VE international number unchanged', () => {
    expect(linkWhatsApp('584141234567')).toBe('584141234567');
  });

  it('passes through a stored CO international number unchanged', () => {
    expect(linkWhatsApp('573001234567')).toBe('573001234567');
  });

  it('does not force 58 nor drop leading zeros on a local-format string', () => {
    expect(linkWhatsApp('04141234567')).toBe('584141234567');
    expect(linkWhatsApp('1144445555')).toBe('581144445555');
    expect(linkWhatsApp('2125551234')).toBe('582125551234');
  });

  it('strips formatting characters but keeps the country code', () => {
    expect(linkWhatsApp('+58 412 123-4567')).toBe('584121234567');
  });

  it('returns empty string for empty, null and undefined input', () => {
    expect(linkWhatsApp('')).toBe('');
    expect(linkWhatsApp(null)).toBe('');
    expect(linkWhatsApp(undefined)).toBe('');
  });
});

describe('mensajeWhatsApp — locked §7.3 literal (REQ-COS-28)', () => {
  it('recibido plural: count-aware "botellones" and "estén listos"', () => {
    expect(mensajeWhatsApp('recibido', 'María González', 3)).toBe(
      'Hola María, recibimos 3 botellones. Te aviso apenas estén listos.'
    );
  });

  it('recibido singular: "tu botellón" and "esté listo"', () => {
    expect(mensajeWhatsApp('recibido', 'María González', 1)).toBe(
      'Hola María, recibimos tu botellón. Te aviso apenas esté listo.'
    );
  });

  it('recarga plural uses the count-aware unit', () => {
    expect(mensajeWhatsApp('recarga', 'María González', 2)).toBe(
      'Hola María, ya estamos recargando 2 botellones.'
    );
  });

  it('recarga singular uses "tu botellón"', () => {
    expect(mensajeWhatsApp('recarga', 'María González', 1)).toBe(
      'Hola María, ya estamos recargando tu botellón.'
    );
  });

  it('listo plural with a multi-word name takes the FIRST name (spec scenario)', () => {
    expect(mensajeWhatsApp('listo', 'Gimnasio Ríos', 3)).toBe(
      'Hola Gimnasio, tus 3 botellones están listos. ¿Te lo llevo hoy?'
    );
  });

  it('listo singular: "tu botellón está listo"', () => {
    expect(mensajeWhatsApp('listo', 'María González', 1)).toBe(
      'Hola María, tu botellón está listo. ¿Te lo llevo hoy?'
    );
  });

  it('delivery plural uses the count-aware unit', () => {
    expect(mensajeWhatsApp('delivery', 'María González', 4)).toBe(
      'Hola María, vamos en camino con 4 botellones.'
    );
  });

  it('delivery singular uses "tu botellón"', () => {
    expect(mensajeWhatsApp('delivery', 'María González', 1)).toBe(
      'Hola María, vamos en camino con tu botellón.'
    );
  });

  it('unknown estado falls back to "Hola {p}, "', () => {
    expect(mensajeWhatsApp('entregado', 'María González', 2)).toBe('Hola María, ');
  });
});

describe('buildWaLink — wa.me deep link (REQ-COS-28, D13)', () => {
  it('encodes spaces and accents in the message with encodeURIComponent', () => {
    expect(buildWaLink('584121234567', 'Hola María, ¿cómo estás?')).toBe(
      'https://wa.me/584121234567?text=Hola%20Mar%C3%ADa%2C%20%C2%BFc%C3%B3mo%20est%C3%A1s%3F'
    );
  });

  it('keeps a plain message untouched by the encoder', () => {
    expect(buildWaLink('584121234567', 'Hola!')).toBe('https://wa.me/584121234567?text=Hola!');
  });
});
