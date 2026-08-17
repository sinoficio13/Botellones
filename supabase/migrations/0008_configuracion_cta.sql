-- 0008: configuracion — add cta_qr field, drop unused email
-- Every label field is configurable (nothing hardcoded on the sticker).

alter table public.configuracion
  add column if not exists cta_qr text;

update public.configuracion
  set cta_qr = 'Escaneá para recargar'
  where id = 1 and (cta_qr is null or cta_qr = '');

-- Email is not used in the app — drop it.
alter table public.configuracion
  drop column if exists email;
