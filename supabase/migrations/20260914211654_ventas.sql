-- ============================================================
-- Módulo de ventas: store_ventas + store_venta_items
-- ============================================================

create table if not exists public.store_ventas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.store_usuarios(id),
  total numeric not null default 0,
  metodo_pago text not null default 'efectivo'
    check (metodo_pago in ('efectivo', 'yape', 'plin', 'tarjeta', 'otro')),
  estado text not null default 'completada'
    check (estado in ('completada', 'anulada')),
  created_at timestamptz not null default now()
);

create table if not exists public.store_venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.store_ventas(id) on delete cascade,
  producto_id uuid references public.store_productos(id) on delete set null,
  -- Se guarda el nombre tal cual estaba al momento de la venta, para
  -- que el historial no cambie si el producto se renombra o se borra.
  nombre_producto text not null,
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric not null,
  subtotal numeric not null
);

-- Para poder rastrear qué movimiento de inventario vino de una venta
-- (y distinguirlo de un ajuste manual de stock).
alter table public.store_movimientos_inventario
  add column if not exists venta_id uuid references public.store_ventas(id) on delete set null;

-- ---------- Políticas ----------
alter table public.store_ventas enable row level security;
alter table public.store_venta_items enable row level security;

drop policy if exists "Usuarios ven ventas" on public.store_ventas;
create policy "Usuarios ven ventas"
on public.store_ventas for select
to authenticated
using (true);

drop policy if exists "Usuarios registran ventas propias" on public.store_ventas;
create policy "Usuarios registran ventas propias"
on public.store_ventas for insert
to authenticated
with check (usuario_id = auth.uid());

-- Anular una venta (no se borra, para no perder el historial) queda
-- reservado a un administrador.
drop policy if exists "Administradores anulan ventas" on public.store_ventas;
create policy "Administradores anulan ventas"
on public.store_ventas for update
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

drop policy if exists "Usuarios ven items de venta" on public.store_venta_items;
create policy "Usuarios ven items de venta"
on public.store_venta_items for select
to authenticated
using (true);

drop policy if exists "Usuarios registran items de su venta" on public.store_venta_items;
create policy "Usuarios registran items de su venta"
on public.store_venta_items for insert
to authenticated
with check (
  exists (
    select 1 from public.store_ventas v
    where v.id = venta_id and v.usuario_id = auth.uid()
  )
);
