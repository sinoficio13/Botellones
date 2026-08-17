-- 0007: configuracion — add eslogan column for bottle label marketing
-- The label sticker shows: business name + slogan + QR + CTA + WhatsApp + code.

alter table public.configuracion
  add column if not exists eslogan text;

-- Seed a default slogan for the existing row so the label shows something.
update public.configuracion
  set eslogan = 'Agua pura, directo a tu puerta'
  where id = 1 and (eslogan is null or eslogan = '');
