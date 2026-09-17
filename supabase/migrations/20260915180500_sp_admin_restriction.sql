-- Restringe el acceso de administrador de las tablas SP_* (pagina_servicios)
-- a un único email, en vez de a cualquier usuario autenticado del proyecto
-- Supabase compartido con market (que puede incluir cuentas "trabajador"
-- del sistema de market, sin relación con este sitio de servicios).

create or replace function sp_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.jwt() ->> 'email' = 'maruan123trabajo@gmail.com';
$$;

alter policy "sp_categories_admin_write" on "SP_categories"
  using (sp_is_admin()) with check (sp_is_admin());

alter policy "sp_services_admin_all" on "SP_services"
  using (sp_is_admin()) with check (sp_is_admin());

alter policy "sp_business_hours_admin_write" on "SP_business_hours"
  using (sp_is_admin()) with check (sp_is_admin());

alter policy "sp_blocked_dates_admin_write" on "SP_blocked_dates"
  using (sp_is_admin()) with check (sp_is_admin());

alter policy "sp_bookings_admin_all" on "SP_bookings"
  using (sp_is_admin()) with check (sp_is_admin());
