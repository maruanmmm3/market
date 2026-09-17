-- ============================================================
-- Cierres de caja: snapshot del total vendido en un día, para
-- poder armar después un cierre de mes.
-- ============================================================
create table if not exists public.store_cierres_caja (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  total_ventas numeric not null default 0,
  cantidad_ventas integer not null default 0,
  usuario_id uuid references public.store_usuarios(id),
  created_at timestamptz not null default now()
);

alter table public.store_cierres_caja enable row level security;

drop policy if exists "Usuarios ven cierres" on public.store_cierres_caja;
create policy "Usuarios ven cierres"
on public.store_cierres_caja for select
to authenticated
using (true);

-- El insert real ocurre dentro de cerrar_dia() (security definer);
-- esta política existe por si algún día se necesita insertar directo.
drop policy if exists "Administradores registran cierres" on public.store_cierres_caja;
create policy "Administradores registran cierres"
on public.store_cierres_caja for insert
to authenticated
with check (public.es_administrador());

-- ---------- cerrar_dia: cierra un día una sola vez ----------
create or replace function public.cerrar_dia(p_fecha date default current_date)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_usuario uuid := auth.uid();
  v_total numeric;
  v_cantidad integer;
  v_cierre_id uuid;
begin
  if not public.es_administrador() then
    raise exception 'Solo un administrador puede cerrar el día';
  end if;

  if exists (select 1 from store_cierres_caja where fecha = p_fecha) then
    raise exception 'Ese día ya fue cerrado';
  end if;

  select coalesce(sum(total), 0), count(*)
  into v_total, v_cantidad
  from store_ventas
  where estado = 'completada'
    and created_at >= p_fecha::timestamptz
    and created_at < (p_fecha + 1)::timestamptz;

  insert into store_cierres_caja (fecha, total_ventas, cantidad_ventas, usuario_id)
  values (p_fecha, v_total, v_cantidad, v_usuario)
  returning id into v_cierre_id;

  return v_cierre_id;
end;
$function$;

grant execute on function public.cerrar_dia(date) to authenticated;
