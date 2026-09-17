-- ============================================================
-- Venta por peso (kg): productos como embutidos se pueden manejar
-- en kilogramos con decimales en vez de piezas enteras.
--
-- tipo_venta indica cómo se interpreta el stock y el precio de un
-- producto: 'unidad' (piezas, como hasta ahora) o 'peso' (kg). El
-- default 'unidad' deja a todos los productos existentes tal cual.
-- ============================================================

alter table public.store_productos
  add column if not exists tipo_venta text not null default 'unidad';

alter table public.store_productos
  drop constraint if exists store_productos_tipo_venta_check;
alter table public.store_productos
  add constraint store_productos_tipo_venta_check
  check (tipo_venta in ('unidad', 'peso'));

-- El stock y las cantidades pasan a admitir hasta 3 decimales (ej.
-- 0.250 kg). Para los productos por unidad no cambia nada en la
-- práctica: "10" pasa a guardarse como "10.000".
alter table public.store_productos
  alter column stock type numeric(10,3) using stock::numeric;

alter table public.store_movimientos_inventario
  alter column cantidad type numeric(10,3) using cantidad::numeric,
  alter column stock_anterior type numeric(10,3) using stock_anterior::numeric,
  alter column stock_nuevo type numeric(10,3) using stock_nuevo::numeric;

alter table public.store_venta_items
  alter column cantidad type numeric(10,3) using cantidad::numeric;

alter table public.store_compra_items
  alter column cantidad type numeric(10,3) using cantidad::numeric;

-- ---------- registrar_venta: cantidad pasa de integer a numeric ----------
create or replace function public.registrar_venta(
  p_metodo_pago text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_usuario uuid := auth.uid();
  v_tienda uuid;
  v_venta_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_producto record;
  v_cantidad numeric;
  v_subtotal numeric;
  v_stock_nuevo numeric;
begin
  if v_usuario is null then
    raise exception 'No autenticado';
  end if;

  v_tienda := public.mi_tienda();
  if v_tienda is null then
    raise exception 'Tu cuenta no está asignada a ninguna tienda';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  insert into store_ventas (usuario_id, total, metodo_pago, tienda_id)
  values (v_usuario, 0, p_metodo_pago, v_tienda)
  returning id into v_venta_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_cantidad := (v_item->>'cantidad')::numeric;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad inválida';
    end if;

    select id, nombre, precio, stock into v_producto
    from store_productos
    where id = (v_item->>'producto_id')::uuid
      and tienda_id = v_tienda
    for update;

    if not found then
      raise exception 'Producto no encontrado';
    end if;

    if v_producto.stock < v_cantidad then
      raise exception 'Stock insuficiente para %', v_producto.nombre;
    end if;

    v_stock_nuevo := v_producto.stock - v_cantidad;
    v_subtotal := v_producto.precio * v_cantidad;
    v_total := v_total + v_subtotal;

    insert into store_venta_items
      (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal, tienda_id)
    values
      (v_venta_id, v_producto.id, v_producto.nombre, v_cantidad, v_producto.precio, v_subtotal, v_tienda);

    insert into store_movimientos_inventario
      (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id, venta_id, tienda_id)
    values
      (v_producto.id, 'salida', v_cantidad, v_producto.stock, v_stock_nuevo, 'Venta', v_usuario, v_venta_id, v_tienda);
  end loop;

  update store_ventas set total = v_total where id = v_venta_id;

  return v_venta_id;
end;
$function$;

-- ---------- anular_venta: stock pasa de integer a numeric ----------
create or replace function public.anular_venta(p_venta_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tienda uuid := public.mi_tienda();
  v_venta record;
  v_item record;
  v_stock_actual numeric;
  v_stock_nuevo numeric;
begin
  if not public.es_administrador() then
    raise exception 'Solo un administrador puede anular una venta';
  end if;

  select * into v_venta from store_ventas where id = p_venta_id and tienda_id = v_tienda for update;
  if not found then
    raise exception 'Venta no encontrada';
  end if;
  if v_venta.estado = 'anulada' then
    raise exception 'Esa venta ya estaba anulada';
  end if;

  for v_item in
    select * from store_venta_items where venta_id = p_venta_id
  loop
    if v_item.producto_id is not null then
      select stock into v_stock_actual
      from store_productos
      where id = v_item.producto_id and tienda_id = v_tienda
      for update;

      if found then
        v_stock_nuevo := v_stock_actual + v_item.cantidad;
        insert into store_movimientos_inventario
          (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id, venta_id, tienda_id)
        values
          (v_item.producto_id, 'entrada', v_item.cantidad, v_stock_actual, v_stock_nuevo, 'Anulación de venta', auth.uid(), p_venta_id, v_tienda);
      end if;
    end if;
  end loop;

  update store_ventas set estado = 'anulada' where id = p_venta_id;
end;
$function$;

-- ---------- registrar_compra: cantidad pasa de integer a numeric ----------
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
  v_tienda uuid;
  v_compra_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_producto record;
  v_cantidad numeric;
  v_costo numeric;
  v_subtotal numeric;
  v_stock_nuevo numeric;
begin
  if v_usuario is null then
    raise exception 'No autenticado';
  end if;

  v_tienda := public.mi_tienda();
  if v_tienda is null then
    raise exception 'Tu cuenta no está asignada a ninguna tienda';
  end if;

  if p_proveedor_id is null then
    raise exception 'Selecciona un proveedor';
  end if;

  if not exists (
    select 1 from store_proveedores where id = p_proveedor_id and tienda_id = v_tienda
  ) then
    raise exception 'Proveedor no encontrado';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La compra no tiene productos';
  end if;

  insert into store_compras (proveedor_id, usuario_id, total, tienda_id)
  values (p_proveedor_id, v_usuario, 0, v_tienda)
  returning id into v_compra_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_cantidad := (v_item->>'cantidad')::numeric;
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
      and tienda_id = v_tienda
    for update;

    if not found then
      raise exception 'Producto no encontrado';
    end if;

    v_stock_nuevo := v_producto.stock + v_cantidad;
    v_subtotal := v_costo * v_cantidad;
    v_total := v_total + v_subtotal;

    insert into store_compra_items
      (compra_id, producto_id, nombre_producto, cantidad, costo_unitario, subtotal, tienda_id)
    values
      (v_compra_id, v_producto.id, v_producto.nombre, v_cantidad, v_costo, v_subtotal, v_tienda);

    insert into store_movimientos_inventario
      (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id, compra_id, tienda_id)
    values
      (v_producto.id, 'entrada', v_cantidad, v_producto.stock, v_stock_nuevo, 'Compra a proveedor', v_usuario, v_compra_id, v_tienda);
  end loop;

  update store_compras set total = v_total where id = v_compra_id;

  return v_compra_id;
end;
$function$;
