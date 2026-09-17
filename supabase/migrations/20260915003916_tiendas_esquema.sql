-- ============================================================
-- Tiendas (grupos de trabajo): separa los datos de cada negocio.
-- Este archivo solo prepara el esquema; las políticas RLS y las
-- funciones de venta/compra/cierre se actualizan en la siguiente
-- migración, una vez que todas las tablas ya tienen tienda_id.
-- ============================================================

create table if not exists public.store_tiendas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo_invitacion text not null unique,
  created_at timestamptz not null default now()
);

-- Genera un código corto (sin caracteres que se confunden entre sí:
-- sin O/0, I/1/L) y garantiza que no choque con uno ya existente.
create or replace function public.generar_codigo_invitacion()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  resultado text;
  intentos int := 0;
begin
  loop
    resultado := '';
    for i in 1..6 loop
      resultado := resultado || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from store_tiendas where codigo_invitacion = resultado);
    intentos := intentos + 1;
    if intentos > 20 then
      raise exception 'No se pudo generar un código de invitación único';
    end if;
  end loop;
  return resultado;
end;
$function$;

-- 1. Columna tienda_id (nullable por ahora) en todas las tablas de datos.
alter table public.store_usuarios add column if not exists tienda_id uuid references public.store_tiendas(id);
alter table public.store_productos add column if not exists tienda_id uuid references public.store_tiendas(id);
alter table public.store_categorias add column if not exists tienda_id uuid references public.store_tiendas(id);
alter table public.store_movimientos_inventario add column if not exists tienda_id uuid references public.store_tiendas(id);
alter table public.store_ventas add column if not exists tienda_id uuid references public.store_tiendas(id);
alter table public.store_venta_items add column if not exists tienda_id uuid references public.store_tiendas(id);
alter table public.store_proveedores add column if not exists tienda_id uuid references public.store_tiendas(id);
alter table public.store_compras add column if not exists tienda_id uuid references public.store_tiendas(id);
alter table public.store_compra_items add column if not exists tienda_id uuid references public.store_tiendas(id);
alter table public.store_cierres_caja add column if not exists tienda_id uuid references public.store_tiendas(id);

-- 2. mi_tienda(): la tienda del usuario que llama, para usar en RLS
-- y como valor por defecto al insertar (así el frontend no necesita
-- mandar tienda_id explícitamente en ningún insert).
create or replace function public.mi_tienda()
returns uuid
language sql
security definer
set search_path to 'public'
stable
as $$
  select tienda_id from public.store_usuarios where id = auth.uid();
$$;

alter table public.store_productos alter column tienda_id set default public.mi_tienda();
alter table public.store_categorias alter column tienda_id set default public.mi_tienda();
alter table public.store_movimientos_inventario alter column tienda_id set default public.mi_tienda();
alter table public.store_ventas alter column tienda_id set default public.mi_tienda();
alter table public.store_venta_items alter column tienda_id set default public.mi_tienda();
alter table public.store_proveedores alter column tienda_id set default public.mi_tienda();
alter table public.store_compras alter column tienda_id set default public.mi_tienda();
alter table public.store_compra_items alter column tienda_id set default public.mi_tienda();
alter table public.store_cierres_caja alter column tienda_id set default public.mi_tienda();

-- 3. Migración de datos: todo lo que ya existe hoy pertenece a una
-- sola tienda nueva ("Mi Tienda"), para no perder nada.
do $migracion$
declare
  v_tienda_id uuid;
begin
  insert into public.store_tiendas (nombre, codigo_invitacion)
  values ('Mi Tienda', public.generar_codigo_invitacion())
  returning id into v_tienda_id;

  update public.store_usuarios set tienda_id = v_tienda_id where tienda_id is null;
  update public.store_productos set tienda_id = v_tienda_id where tienda_id is null;
  update public.store_categorias set tienda_id = v_tienda_id where tienda_id is null;
  update public.store_movimientos_inventario set tienda_id = v_tienda_id where tienda_id is null;
  update public.store_ventas set tienda_id = v_tienda_id where tienda_id is null;
  update public.store_venta_items set tienda_id = v_tienda_id where tienda_id is null;
  update public.store_proveedores set tienda_id = v_tienda_id where tienda_id is null;
  update public.store_compras set tienda_id = v_tienda_id where tienda_id is null;
  update public.store_compra_items set tienda_id = v_tienda_id where tienda_id is null;
  update public.store_cierres_caja set tienda_id = v_tienda_id where tienda_id is null;
end;
$migracion$;

-- 4. Ya con todo migrado, tienda_id pasa a ser obligatorio.
alter table public.store_usuarios alter column tienda_id set not null;
alter table public.store_productos alter column tienda_id set not null;
alter table public.store_categorias alter column tienda_id set not null;
alter table public.store_movimientos_inventario alter column tienda_id set not null;
alter table public.store_ventas alter column tienda_id set not null;
alter table public.store_venta_items alter column tienda_id set not null;
alter table public.store_proveedores alter column tienda_id set not null;
alter table public.store_compras alter column tienda_id set not null;
alter table public.store_compra_items alter column tienda_id set not null;
alter table public.store_cierres_caja alter column tienda_id set not null;

-- 5. Un cierre de caja por día ERA único globalmente; ahora es único
-- por tienda (dos tiendas sí pueden cerrar "hoy" cada una la suya).
alter table public.store_cierres_caja drop constraint if exists store_cierres_caja_fecha_key;
alter table public.store_cierres_caja add constraint store_cierres_caja_tienda_fecha_key unique (tienda_id, fecha);

-- 6. RLS + política de lectura para la tienda propia (necesaria para
-- mostrar el código de invitación en Usuarios).
alter table public.store_tiendas enable row level security;

drop policy if exists "Usuarios ven su propia tienda" on public.store_tiendas;
create policy "Usuarios ven su propia tienda"
on public.store_tiendas for select
to authenticated
using (id = public.mi_tienda());
