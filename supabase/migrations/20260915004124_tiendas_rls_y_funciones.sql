-- ============================================================
-- Tiendas: separar por tienda_id en cada política RLS, y hacer que
-- las funciones de venta/compra/cierre validen que todo lo que tocan
-- (productos, proveedores, ventas) pertenece a la tienda de quien
-- llama. Estas funciones son SECURITY DEFINER (pasan por encima de
-- RLS), así que esta validación hay que hacerla a mano adentro.
-- ============================================================

-- ---------- store_usuarios ----------
-- La lectura pública se mantiene tal cual: el login busca el email a
-- partir del nombre_usuario antes de autenticar, y todavía no sabe a
-- qué tienda pertenece esa persona.
drop policy if exists "Administradores actualizan usuarios" on public.store_usuarios;
create policy "Administradores actualizan usuarios"
on public.store_usuarios for update
to authenticated
using (public.es_administrador() and tienda_id = public.mi_tienda())
with check (public.es_administrador() and tienda_id = public.mi_tienda());

drop policy if exists "Administradores eliminan usuarios" on public.store_usuarios;
create policy "Administradores eliminan usuarios"
on public.store_usuarios for delete
to authenticated
using (public.es_administrador() and tienda_id = public.mi_tienda());

-- ---------- store_productos ----------
drop policy if exists "Usuarios ven productos" on public.store_productos;
create policy "Usuarios ven productos"
on public.store_productos for select
to authenticated
using (tienda_id = public.mi_tienda());

drop policy if exists "Administradores gestionan productos" on public.store_productos;
create policy "Administradores gestionan productos"
on public.store_productos for all
to authenticated
using (public.es_administrador() and tienda_id = public.mi_tienda())
with check (public.es_administrador() and tienda_id = public.mi_tienda());

-- ---------- store_categorias ----------
drop policy if exists "Usuarios ven categorias" on public.store_categorias;
create policy "Usuarios ven categorias"
on public.store_categorias for select
to authenticated
using (tienda_id = public.mi_tienda());

drop policy if exists "Administradores gestionan categorias" on public.store_categorias;
create policy "Administradores gestionan categorias"
on public.store_categorias for all
to authenticated
using (public.es_administrador() and tienda_id = public.mi_tienda())
with check (public.es_administrador() and tienda_id = public.mi_tienda());

-- ---------- store_movimientos_inventario ----------
drop policy if exists "Usuarios ven movimientos" on public.store_movimientos_inventario;
create policy "Usuarios ven movimientos"
on public.store_movimientos_inventario for select
to authenticated
using (tienda_id = public.mi_tienda());

drop policy if exists "Usuarios registran movimientos propios" on public.store_movimientos_inventario;
create policy "Usuarios registran movimientos propios"
on public.store_movimientos_inventario for insert
to authenticated
with check (usuario_id = auth.uid() and tienda_id = public.mi_tienda());

-- ---------- store_ventas / store_venta_items ----------
drop policy if exists "Usuarios ven ventas" on public.store_ventas;
create policy "Usuarios ven ventas"
on public.store_ventas for select
to authenticated
using (tienda_id = public.mi_tienda());

drop policy if exists "Usuarios registran ventas propias" on public.store_ventas;
create policy "Usuarios registran ventas propias"
on public.store_ventas for insert
to authenticated
with check (usuario_id = auth.uid() and tienda_id = public.mi_tienda());

drop policy if exists "Administradores anulan ventas" on public.store_ventas;
create policy "Administradores anulan ventas"
on public.store_ventas for update
to authenticated
using (public.es_administrador() and tienda_id = public.mi_tienda())
with check (public.es_administrador() and tienda_id = public.mi_tienda());

drop policy if exists "Usuarios ven items de venta" on public.store_venta_items;
create policy "Usuarios ven items de venta"
on public.store_venta_items for select
to authenticated
using (tienda_id = public.mi_tienda());

drop policy if exists "Usuarios registran items de su venta" on public.store_venta_items;
create policy "Usuarios registran items de su venta"
on public.store_venta_items for insert
to authenticated
with check (
  tienda_id = public.mi_tienda()
  and exists (
    select 1 from public.store_ventas v
    where v.id = venta_id and v.usuario_id = auth.uid()
  )
);

-- ---------- store_proveedores ----------
drop policy if exists "Usuarios ven proveedores" on public.store_proveedores;
create policy "Usuarios ven proveedores"
on public.store_proveedores for select
to authenticated
using (tienda_id = public.mi_tienda());

drop policy if exists "Administradores gestionan proveedores" on public.store_proveedores;
create policy "Administradores gestionan proveedores"
on public.store_proveedores for all
to authenticated
using (public.es_administrador() and tienda_id = public.mi_tienda())
with check (public.es_administrador() and tienda_id = public.mi_tienda());

-- ---------- store_compras / store_compra_items ----------
drop policy if exists "Usuarios ven compras" on public.store_compras;
create policy "Usuarios ven compras"
on public.store_compras for select
to authenticated
using (tienda_id = public.mi_tienda());

drop policy if exists "Usuarios registran compras propias" on public.store_compras;
create policy "Usuarios registran compras propias"
on public.store_compras for insert
to authenticated
with check (usuario_id = auth.uid() and tienda_id = public.mi_tienda());

drop policy if exists "Usuarios ven items de compra" on public.store_compra_items;
create policy "Usuarios ven items de compra"
on public.store_compra_items for select
to authenticated
using (tienda_id = public.mi_tienda());

drop policy if exists "Usuarios registran items de su compra" on public.store_compra_items;
create policy "Usuarios registran items de su compra"
on public.store_compra_items for insert
to authenticated
with check (
  tienda_id = public.mi_tienda()
  and exists (
    select 1 from public.store_compras c
    where c.id = compra_id and c.usuario_id = auth.uid()
  )
);

-- ---------- store_cierres_caja ----------
drop policy if exists "Usuarios ven cierres" on public.store_cierres_caja;
create policy "Usuarios ven cierres"
on public.store_cierres_caja for select
to authenticated
using (tienda_id = public.mi_tienda());

drop policy if exists "Administradores registran cierres" on public.store_cierres_caja;
create policy "Administradores registran cierres"
on public.store_cierres_caja for insert
to authenticated
with check (public.es_administrador() and tienda_id = public.mi_tienda());

-- ============================================================
-- Alta de usuario: crear tienda nueva o unirse con un código.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_codigo text := nullif(trim(new.raw_user_meta_data->>'codigo_invitacion'), '');
  v_nombre_tienda text := nullif(trim(new.raw_user_meta_data->>'nombre_tienda'), '');
  v_tienda_id uuid;
  v_rol text;
begin
  if v_codigo is not null then
    select id into v_tienda_id
    from store_tiendas
    where codigo_invitacion = upper(v_codigo);

    if v_tienda_id is null then
      raise exception 'El código de invitación no es válido';
    end if;
    v_rol := 'trabajador';
  else
    if v_nombre_tienda is null then
      raise exception 'Falta el nombre de la tienda';
    end if;

    insert into store_tiendas (nombre, codigo_invitacion)
    values (v_nombre_tienda, public.generar_codigo_invitacion())
    returning id into v_tienda_id;
    v_rol := 'administrador';
  end if;

  insert into public.store_usuarios (id, nombre, nombre_usuario, email, rol, tienda_id)
  values (
    new.id,
    new.raw_user_meta_data->>'nombre',
    new.raw_user_meta_data->>'nombre_usuario',
    new.email,
    v_rol,
    v_tienda_id
  );
  return new;
end;
$function$;

-- ============================================================
-- registrar_venta: ahora valida que el producto pertenezca a la
-- tienda de quien vende (si no, alguien podría pasar el id de un
-- producto de OTRA tienda y afectar su stock).
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
  v_tienda uuid;
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
    v_cantidad := (v_item->>'cantidad')::integer;
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

-- ============================================================
-- anular_venta: la venta y los productos que repone deben ser de la
-- misma tienda que el administrador que anula.
-- ============================================================
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
  v_stock_actual integer;
  v_stock_nuevo integer;
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

-- ============================================================
-- registrar_compra: valida que el proveedor y los productos sean de
-- la tienda de quien compra.
-- ============================================================
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
  v_cantidad integer;
  v_costo numeric;
  v_subtotal numeric;
  v_stock_nuevo integer;
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

-- ============================================================
-- cerrar_dia: el "una vez por día" ahora es por tienda.
-- ============================================================
create or replace function public.cerrar_dia(p_fecha date default current_date)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_usuario uuid := auth.uid();
  v_tienda uuid;
  v_total numeric;
  v_cantidad integer;
  v_cierre_id uuid;
begin
  if not public.es_administrador() then
    raise exception 'Solo un administrador puede cerrar el día';
  end if;

  v_tienda := public.mi_tienda();
  if v_tienda is null then
    raise exception 'Tu cuenta no está asignada a ninguna tienda';
  end if;

  if exists (
    select 1 from store_cierres_caja where fecha = p_fecha and tienda_id = v_tienda
  ) then
    raise exception 'Ese día ya fue cerrado';
  end if;

  select coalesce(sum(total), 0), count(*)
  into v_total, v_cantidad
  from store_ventas
  where estado = 'completada'
    and tienda_id = v_tienda
    and created_at >= p_fecha::timestamptz
    and created_at < (p_fecha + 1)::timestamptz;

  insert into store_cierres_caja (fecha, total_ventas, cantidad_ventas, usuario_id, tienda_id)
  values (p_fecha, v_total, v_cantidad, v_usuario, v_tienda)
  returning id into v_cierre_id;

  return v_cierre_id;
end;
$function$;
