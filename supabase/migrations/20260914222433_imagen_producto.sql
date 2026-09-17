-- ============================================================
-- Imagen de producto: URL de una imagen alojada en internet,
-- para mostrarla en el selector visual de Ventas.
-- ============================================================
alter table public.store_productos
  add column if not exists imagen_url text;
