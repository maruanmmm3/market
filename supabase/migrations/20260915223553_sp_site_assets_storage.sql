-- Bucket público de Storage para imágenes del sitio de servicios (por ahora,
-- la foto del fundador). Lectura pública, escritura solo el admin de Amaru.

insert into storage.buckets (id, name, public)
values ('sp-site-assets', 'sp-site-assets', true)
on conflict (id) do nothing;

create policy "sp_site_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'sp-site-assets');

create policy "sp_site_assets_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'sp-site-assets' and sp_is_admin());

create policy "sp_site_assets_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'sp-site-assets' and sp_is_admin())
  with check (bucket_id = 'sp-site-assets' and sp_is_admin());

create policy "sp_site_assets_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'sp-site-assets' and sp_is_admin());
