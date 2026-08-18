import { describe, it, expect } from 'vitest';
import { parseQrCode } from '@/lib/scanner/parse-qr';

describe('parseQrCode', () => {
  it('extracts the codigo from a full botellón URL', () => {
    expect(parseQrCode('https://app.example.com/b/BOT-00001')).toEqual({
      codigo: 'BOT-00001',
    });
  });

  it('extracts the codigo from a bare path', () => {
    expect(parseQrCode('/b/BOT-00001')).toEqual({ codigo: 'BOT-00001' });
  });

  it('ignores query strings and hash fragments', () => {
    expect(
      parseQrCode('https://app.example.com/b/BOT-00001?utm=qr#frag')
    ).toEqual({ codigo: 'BOT-00001' });
  });

  it('ignores the origin entirely (any host accepted)', () => {
    expect(parseQrCode('https://otro-dominio.com.ar/b/BOT-00042')).toEqual({
      codigo: 'BOT-00042',
    });
  });

  it('rejects foreign or malformed QR content', () => {
    expect(parseQrCode('https://example.com/other')).toBeNull();
    expect(parseQrCode('https://example.com/b/not-a-code')).toBeNull();
    expect(parseQrCode('hola mundo')).toBeNull();
  });

  it('rejects paths with the wrong prefix', () => {
    expect(parseQrCode('https://app.example.com/x/BOT-00001')).toBeNull();
    expect(parseQrCode('https://app.example.com/botellones/BOT-00001')).toBeNull();
  });

  it('rejects codigos with the wrong number of digits', () => {
    expect(parseQrCode('/b/BOT-0000')).toBeNull();
    expect(parseQrCode('/b/BOT-000001')).toBeNull();
  });

  it('rejects a bare codigo without the /b/ path', () => {
    expect(parseQrCode('BOT-00001')).toBeNull();
  });

  it('rejects lowercase codigos', () => {
    expect(parseQrCode('/b/bot-00001')).toBeNull();
  });
});
