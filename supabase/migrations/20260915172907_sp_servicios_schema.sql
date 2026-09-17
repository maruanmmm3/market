-- Esquema para el proyecto "pagina_servicios" (catálogo de servicios,
-- horario de atención y reservas de citas). Comparte este mismo proyecto
-- Supabase con la app "market"; todas las tablas usan el prefijo SP_
-- para no chocar con las tablas ya existentes de market.

create extension if not exists pgcrypto;

-- =========================================================
-- Tablas
-- =========================================================

create table "SP_categories" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  "order" int not null default 0,
  created_at timestamptz not null default now()
);

create table "SP_services" (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references "SP_categories"(id) on delete cascade,
  title text not null,
  description text,
  features jsonb not null default '[]'::jsonb,
  "order" int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table "SP_business_hours" (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null unique check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_duration_minutes int not null default 30 check (slot_duration_minutes > 0),
  is_active boolean not null default true,
  check (end_time > start_time)
);

create table "SP_blocked_dates" (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  reason text
);

create table "SP_bookings" (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references "SP_services"(id) on delete set null,
  client_name text not null,
  client_email text not null,
  client_phone text not null,
  booking_date date not null,
  booking_time time not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  unique (booking_date, booking_time)
);

-- =========================================================
-- RLS
-- =========================================================

alter table "SP_categories" enable row level security;
alter table "SP_services" enable row level security;
alter table "SP_business_hours" enable row level security;
alter table "SP_blocked_dates" enable row level security;
alter table "SP_bookings" enable row level security;

-- Categorías: lectura pública, escritura solo admin autenticado.
create policy "sp_categories_public_select" on "SP_categories"
  for select to anon, authenticated using (true);
create policy "sp_categories_admin_write" on "SP_categories"
  for all to authenticated using (true) with check (true);

-- Servicios: público solo ve los activos; admin ve y edita todo.
create policy "sp_services_public_select_active" on "SP_services"
  for select to anon using (active = true);
create policy "sp_services_admin_all" on "SP_services"
  for all to authenticated using (true) with check (true);

-- Horario de atención y fechas bloqueadas: lectura pública, escritura admin.
create policy "sp_business_hours_public_select" on "SP_business_hours"
  for select to anon, authenticated using (true);
create policy "sp_business_hours_admin_write" on "SP_business_hours"
  for all to authenticated using (true) with check (true);

create policy "sp_blocked_dates_public_select" on "SP_blocked_dates"
  for select to anon, authenticated using (true);
create policy "sp_blocked_dates_admin_write" on "SP_blocked_dates"
  for all to authenticated using (true) with check (true);

-- Reservas: público solo puede crear (nunca leer datos de otros clientes);
-- admin autenticado puede leer/actualizar/eliminar.
create policy "sp_bookings_public_insert" on "SP_bookings"
  for insert to anon with check (true);
create policy "sp_bookings_admin_all" on "SP_bookings"
  for all to authenticated using (true) with check (true);

-- =========================================================
-- Función: horarios disponibles para una fecha (sin exponer datos de clientes)
-- =========================================================

create or replace function sp_get_available_slots(p_date date)
returns table (slot_time time)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_of_week smallint;
  v_hours record;
begin
  v_day_of_week := extract(dow from p_date);

  if exists (select 1 from "SP_blocked_dates" where date = p_date) then
    return;
  end if;

  select * into v_hours
  from "SP_business_hours"
  where day_of_week = v_day_of_week and is_active = true
  limit 1;

  if not found then
    return;
  end if;

  return query
  select gs::time as slot_time
  from generate_series(
    p_date + v_hours.start_time,
    p_date + v_hours.end_time - make_interval(mins => v_hours.slot_duration_minutes),
    make_interval(mins => v_hours.slot_duration_minutes)
  ) as gs
  where gs::time not in (
    select booking_time from "SP_bookings"
    where booking_date = p_date and status <> 'cancelled'
  );
end;
$$;

grant execute on function sp_get_available_slots(date) to anon, authenticated;

-- =========================================================
-- Seed: catálogo de ejemplo y horario por defecto
-- =========================================================

do $$
declare
  v_web_id uuid;
  v_auto_id uuid;
begin
  insert into "SP_categories" (name, icon, "order")
    values ('Desarrollo Web', '🌐', 1)
    returning id into v_web_id;

  insert into "SP_categories" (name, icon, "order")
    values ('Automatización', '🤖', 2)
    returning id into v_auto_id;

  insert into "SP_services" (category_id, title, description, features, "order") values
    (v_web_id, 'Landing Pages', 'Páginas para negocios y emprendimientos.',
      '["Diseño responsive", "WhatsApp y formularios", "Catálogo de productos/servicios", "Integración con redes sociales"]'::jsonb, 1),
    (v_web_id, 'Páginas Web Empresariales', null,
      '["Inicio", "Nosotros", "Servicios", "Productos", "Galería", "Contacto", "Blog, si lo necesitan"]'::jsonb, 2),
    (v_web_id, 'Sistemas de Administración', 'Sistemas personalizados para tu negocio.',
      '["Inventario", "Clientes", "Productos", "Usuarios y roles", "Ventas", "Reportes", "Dashboard", "Historial de actividades"]'::jsonb, 3),
    (v_web_id, 'Sistemas de Facturación', null,
      '["Registro de clientes", "Productos", "Generación de comprobantes", "Control de ventas", "Reportes", "Integración con servicios externos de facturación electrónica, si corresponde"]'::jsonb, 4),
    (v_auto_id, 'Automatización de Excel', null,
      '["Generación automática de reportes", "Consolidación de varios Excel", "Limpieza y transformación de datos", "Cruce de información", "Generación de archivos automáticamente", "Envío automático por correo"]'::jsonb, 1),
    (v_auto_id, 'Automatización de procesos empresariales', '¿Realizas todos los días el mismo proceso manual? Podemos automatizarlo.',
      '["Descargar información", "Procesar archivos", "Registrar información en sistemas", "Enviar correos", "Generar reportes", "Mover archivos", "Integrar diferentes sistemas"]'::jsonb, 2);
end $$;

insert into "SP_business_hours" (day_of_week, start_time, end_time, slot_duration_minutes, is_active) values
  (0, '09:00', '13:00', 30, false), -- domingo
  (1, '09:00', '18:00', 30, true),  -- lunes
  (2, '09:00', '18:00', 30, true),  -- martes
  (3, '09:00', '18:00', 30, true),  -- miércoles
  (4, '09:00', '18:00', 30, true),  -- jueves
  (5, '09:00', '18:00', 30, true),  -- viernes
  (6, '09:00', '13:00', 30, false); -- sábado
