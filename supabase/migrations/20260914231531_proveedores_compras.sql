-- ============================================================
-- Proveedores y compras: registrar productos recién comprados,
-- que además reponen el stock automáticamente.
-- ============================================================

create table if not exists public.store_proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto text,
  created_at timestamptz not null default now()
);

create table if not exists public.store_compras (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references public.store_proveedores(id),
  usuario_id uuid references public.store_usuarios(id),
  total numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.store_compra_items (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.store_compras(id) on delete cascade,
  producto_id uuid references public.store_productos(id) on delete set null,
  -- snapshot del nombre, igual que en store_venta_items
  nombre_producto text not null,
  cantidad integer not null check (cantidad > 0),
  costo_unitario numeric not null,
  subtotal numeric not null
);

-- Para poder rastrear qué movimiento de inventario vino de una compra.
alter table public.store_movimientos_inventario
  add column if not exists compra_id uuid references public.store_compras(id) on delete set null;

-- ---------- Políticas ----------
alter table public.store_proveedores enable row level security;
alter table public.store_compras enable row level security;
alter table public.store_compra_items enable row level security;

drop policy if exists "Usuarios ven proveedores" on public.store_proveedores;
create policy "Usuarios ven proveedores"
on public.store_proveedores for select
to authenticated
using (true);

drop policy if exists "Administradores gestionan proveedores" on public.store_proveedores;
create policy "Administradores gestionan proveedores"
on public.store_proveedores for all
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

drop policy if exists "Usuarios ven compras" on public.store_compras;
create policy "Usuarios ven compras"
on public.store_compras for select
to authenticated
using (true);

drop policy if exists "Usuarios registran compras propias" on public.store_compras;
create policy "Usuarios registran compras propias"
on public.store_compras for insert
to authenticated
with check (usuario_id = auth.uid());

drop policy if exists "Usuarios ven items de compra" on public.store_compra_items;
create policy "Usuarios ven items de compra"
on public.store_compra_items for select
to authenticated
using (true);

drop policy if exists "Usuarios registran items de su compra" on public.store_compra_items;
create policy "Usuarios registran items de su compra"
on public.store_compra_items for insert
to authenticated
with check (
  exists (
    select 1 from public.store_compras c
    where c.id = compra_id and c.usuario_id = auth.uid()
  )
);

-- ---------- registrar_compra: compra completa en una transacción ----------
-- Espejo de registrar_venta, pero sumando stock en vez de restarlo.
-- p_items: [{ "producto_id": "uuid", "cantidad": 2, "costo_unitario": 3.20 }, ...]
create or replace function public.registrar_compra(
  p_proveedor_id uuid,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_usuario uuid := auth.uid();
  v_compra_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_producto record;
  v_cantidad integer;
  v_costo numeric;
  v_subtotal numeric;
  v_stock_nuevo integer;
begin
  if v_usuario is null then
    raise exception 'No autenticado';
  end if;

  if p_proveedor_id is null then
    raise exception 'Selecciona un proveedor';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La compra no tiene productos';
  end if;

  insert into store_compras (proveedor_id, usuario_id, total)
  values (p_proveedor_id, v_usuario, 0)
  returning id into v_compra_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_cantidad := (v_item->>'cantidad')::integer;
    v_costo := (v_item->>'costo_unitario')::numeric;

    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad inválida';
    end if;
    if v_costo is null or v_costo < 0 then
      raise exception 'Costo inválido';
    end if;

    select id, nombre, stock into v_producto
    from store_productos
    where id = (v_item->>'producto_id')::uuid
    for update;

    if not found then
      raise exception 'Producto no encontrado';
    end if;

    v_stock_nuevo := v_producto.stock + v_cantidad;
    v_subtotal := v_costo * v_cantidad;
    v_total := v_total + v_subtotal;

    insert into store_compra_items
      (compra_id, producto_id, nombre_producto, cantidad, costo_unitario, subtotal)
    values
      (v_compra_id, v_producto.id, v_producto.nombre, v_cantidad, v_costo, v_subtotal);

    insert into store_movimientos_inventario
      (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id, compra_id)
    values
      (v_producto.id, 'entrada', v_cantidad, v_producto.stock, v_stock_nuevo, 'Compra a proveedor', v_usuario, v_compra_id);
  end loop;

  update store_compras set total = v_total where id = v_compra_id;

  return v_compra_id;
end;
$function$;

grant execute on function public.registrar_compra(uuid, jsonb) to authenticated;
