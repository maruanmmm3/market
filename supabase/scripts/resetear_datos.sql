-- ============================================================
-- ADVERTENCIA: este script borra PERMANENTEMENTE todo el catálogo
-- y el historial de tu tienda (productos, categorías, ventas,
-- movimientos de inventario, proveedores, compras y cierres de
-- caja). No se puede deshacer. No toca `store_usuarios` ni
-- `store_tiendas`: tu cuenta y las de cualquier otro usuario de tu
-- tienda quedan intactas, tal como pediste.
--
-- Es un script manual (no una migración): se corre a mano en el
-- SQL Editor de Supabase, una sola vez, cuando de verdad quieras
-- vaciar los datos (por ejemplo, para limpiar todo lo de prueba
-- antes de usar la app en serio).
-- ============================================================

do $$
declare
  v_tienda_id uuid;
begin
  -- Si alguna vez tienes más de una tienda de prueba, cambia esta
  -- línea para apuntar a la tienda correcta en vez de "la primera".
  select id into v_tienda_id from store_tiendas order by created_at limit 1;

  if v_tienda_id is null then
    raise exception 'No se encontró ninguna tienda.';
  end if;

  -- Se borra en este orden para no chocar con las llaves foráneas:
  -- primero lo que depende de ventas/compras, después ventas y
  -- compras, y al final productos/categorías/proveedores.
  delete from store_venta_items where tienda_id = v_tienda_id;
  delete from store_compra_items where tienda_id = v_tienda_id;
  delete from store_movimientos_inventario where tienda_id = v_tienda_id;
  delete from store_ventas where tienda_id = v_tienda_id;
  delete from store_compras where tienda_id = v_tienda_id;
  delete from store_cierres_caja where tienda_id = v_tienda_id;
  delete from store_productos where tienda_id = v_tienda_id;
  delete from store_categorias where tienda_id = v_tienda_id;
  delete from store_proveedores where tienda_id = v_tienda_id;
end $$;
