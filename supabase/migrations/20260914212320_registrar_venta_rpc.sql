-- ============================================================
-- registrar_venta: registra una venta completa (cabecera + items
-- + descuento de stock) en una sola transacción. Si algo falla
-- a mitad de camino (p. ej. no hay stock del tercer producto),
-- no queda nada a medias: se revierte todo.
--
-- p_items: [{ "producto_id": "uuid", "cantidad": 2 }, ...]
-- ============================================================
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
  v_venta_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_producto record;
  v_cantidad integer;
  v_subtotal numeric;
  v_stock_nuevo integer;
begin
  if v_usuario is null then
    raise exception 'No autenticado';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  insert into store_ventas (usuario_id, total, metodo_pago)
  values (v_usuario, 0, p_metodo_pago)
  returning id into v_venta_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_cantidad := (v_item->>'cantidad')::integer;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad inválida';
    end if;

    -- "for update" bloquea la fila del producto hasta que termine la
    -- transacción: si dos personas venden el último producto a la vez,
    -- la segunda espera y ve el stock ya descontado por la primera.
    select id, nombre, precio, stock into v_producto
    from store_productos
    where id = (v_item->>'producto_id')::uuid
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
      (venta_id, producto_id, nombre_producto, cantidad, precio_unitario, subtotal)
    values
      (v_venta_id, v_producto.id, v_producto.nombre, v_cantidad, v_producto.precio, v_subtotal);

    -- Registra el movimiento; el trigger actualizar_stock_producto ya
    -- existente se encarga de dejar store_productos.stock al día.
    insert into store_movimientos_inventario
      (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id, venta_id)
    values
      (v_producto.id, 'salida', v_cantidad, v_producto.stock, v_stock_nuevo, 'Venta', v_usuario, v_venta_id);
  end loop;

  update store_ventas set total = v_total where id = v_venta_id;

  return v_venta_id;
end;
$function$;

grant execute on function public.registrar_venta(text, jsonb) to authenticated;
