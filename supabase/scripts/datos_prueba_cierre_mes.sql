-- ============================================================
-- Datos de prueba para el "Cierre de mes" (Reportes.jsx).
--
-- Esto NO es una migración: es un script para pegar y correr a
-- mano en el SQL Editor de Supabase cuando quieras generar
-- historial falso de ventas/cierres y ver cómo luce el reporte
-- de cierre de mes con varios meses de datos. No se aplica solo
-- ni con `supabase db reset` / `supabase db push` porque vive
-- fuera de supabase/migrations/.
--
-- Qué hace:
--   1. Toma la primera tienda que encuentre y un administrador
--      de esa tienda (si tienes varias tiendas de prueba, cambia
--      el filtro del `select ... into v_tienda_id` de abajo).
--   2. Genera ventas falsas para julio y agosto de 2026 (entre 3
--      y 12 ventas por día, montos entre S/15 y S/200, métodos de
--      pago variados).
--   3. Cierra cada uno de esos días en store_cierres_caja con el
--      total real de esas ventas (como haría el RPC cerrar_dia()).
--   4. Septiembre de 2026 no se toca, para que el botón
--      "Cerrar el día" siga funcionando en vivo sobre el día real
--      de hoy.
--
-- Se puede correr más de una vez sin duplicar: salta los días que
-- ya tengan un cierre registrado.
-- ============================================================

do $$
declare
  v_tienda_id uuid;
  v_usuario_id uuid;
  v_fecha date;
  v_num_ventas int;
  v_total_dia numeric;
  v_metodos text[] := array['efectivo', 'yape', 'plin', 'tarjeta', 'otro'];
  v_monto numeric;
  i int;
begin
  select id into v_tienda_id from store_tiendas order by created_at limit 1;
  select id into v_usuario_id
    from store_usuarios
    where tienda_id = v_tienda_id and rol = 'administrador'
    limit 1;

  if v_tienda_id is null or v_usuario_id is null then
    raise exception 'No se encontró una tienda con un administrador. Ajusta v_tienda_id/v_usuario_id a mano antes de correr el script.';
  end if;

  for v_fecha in select generate_series('2026-07-01'::date, '2026-08-31'::date, '1 day')::date loop
    continue when exists (
      select 1 from store_cierres_caja
      where tienda_id = v_tienda_id and fecha = v_fecha
    );

    v_num_ventas := 3 + floor(random() * 10)::int; -- 3 a 12 ventas
    v_total_dia := 0;

    for i in 1..v_num_ventas loop
      v_monto := round((15 + random() * 185)::numeric, 2); -- S/15 a S/200
      insert into store_ventas (usuario_id, total, metodo_pago, estado, created_at, tienda_id)
      values (
        v_usuario_id,
        v_monto,
        v_metodos[1 + floor(random() * array_length(v_metodos, 1))::int],
        'completada',
        v_fecha + interval '8 hours' + (random() * interval '14 hours'),
        v_tienda_id
      );
      v_total_dia := v_total_dia + v_monto;
    end loop;

    insert into store_cierres_caja (fecha, total_ventas, cantidad_ventas, usuario_id, tienda_id)
    values (v_fecha, v_total_dia, v_num_ventas, v_usuario_id, v_tienda_id);
  end loop;
end $$;

-- ============================================================
-- Limpieza: descomenta y corre esto cuando ya hayas probado el
-- reporte y quieras borrar los datos falsos.
-- ============================================================
-- delete from store_cierres_caja
--   where fecha >= '2026-07-01' and fecha < '2026-09-01';
-- delete from store_ventas
--   where created_at >= '2026-07-01' and created_at < '2026-09-01';
