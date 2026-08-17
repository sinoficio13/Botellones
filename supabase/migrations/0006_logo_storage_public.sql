-- 0006: Logo storage — create the 'logos' bucket as public
-- The /object/public/ endpoint is governed by storage.buckets.public,
-- NOT by RLS policies. Set public = true so anonymous visitors (and the
-- public botellon page) can load the logo from its public URL.

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;
