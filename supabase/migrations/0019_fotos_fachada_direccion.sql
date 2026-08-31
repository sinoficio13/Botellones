-- =============================================================================
-- Fotos de fachada + dirección de entrega en clientes
--
-- 1) Crea el bucket público 'fotos-clientes' (mismo patrón que 'logos' en 0006).
--    Las fotos de fachada se sirven por URL pública (/object/public/), sin URLs
--    firmadas. Las policies de storage.objects para este bucket ya existen en
--    0001 (auth_access_fotos_clientes): acá solo falta la fila del bucket.
--
-- 2) Agrega direccion_entrega como texto simple en clientes (la tabla
--    `direcciones` queda sin uso; la dirección de entrega es texto libre).
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('fotos-clientes', 'fotos-clientes', true)
on conflict (id) do update set public = true;

alter table public.clientes add column if not exists direccion_entrega text;