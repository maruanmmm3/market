-- ============================================================
-- anular_venta: revierte una venta (repone el stock vendido con
-- movimientos de "entrada" y marca la venta como anulada). Todo
-- en una sola transacción, y solo para administradores.
-- ============================================================
create or replace function public.anular_venta(p_venta_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_venta record;
  v_item record;
  v_stock_actual integer;
  v_stock_nuevo integer;
begin
  if not public.es_administrador() then
    raise exception 'Solo un administrador puede anular una venta';
  end if;

  select * into v_venta from store_ventas where id = p_venta_id for update;
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
      where id = v_item.producto_id
      for update;

      if found then
        v_stock_nuevo := v_stock_actual + v_item.cantidad;
        insert into store_movimientos_inventario
          (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, usuario_id, venta_id)
        values
          (v_item.producto_id, 'entrada', v_item.cantidad, v_stock_actual, v_stock_nuevo, 'Anulación de venta', auth.uid(), p_venta_id);
      end if;
    end if;
  end loop;

  update store_ventas set estado = 'anulada' where id = p_venta_id;
end;
$function$;

grant execute on function public.anular_venta(uuid) to authenticated;
