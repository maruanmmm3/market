-- ============================================================
-- Roles y permisos: Administrador / Trabajador
-- ============================================================

-- 1. Columna de rol en store_usuarios ------------------------
alter table public.store_usuarios
  add column if not exists rol text not null default 'trabajador';

alter table public.store_usuarios
  drop constraint if exists store_usuarios_rol_check;

alter table public.store_usuarios
  add constraint store_usuarios_rol_check
  check (rol in ('administrador', 'trabajador'));

-- El único usuario existente (la cuenta con la que se creó el
-- proyecto) queda como administrador; el resto de altas nuevas
-- entra como trabajador por defecto (ver trigger más abajo).
update public.store_usuarios
set rol = 'administrador'
where nombre_usuario = 'maruanmmm3';

-- 2. Alta de usuarios: incluir rol ----------------------------
-- Antes solo insertaba nombre/nombre_usuario/email. Ahora toma
-- el rol de los metadatos del signUp si viene, y si no, asume
-- 'trabajador' (alta por defecto para el registro público).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.store_usuarios (id, nombre, nombre_usuario, email, rol)
  values (
    new.id,
    new.raw_user_meta_data->>'nombre',
    new.raw_user_meta_data->>'nombre_usuario',
    new.email,
    coalesce(new.raw_user_meta_data->>'rol', 'trabajador')
  );
  return new;
end;
$function$;

-- 3. Función auxiliar para usar dentro de políticas RLS --------
-- SECURITY DEFINER para no caer en recursión al consultar
-- store_usuarios desde una política que protege store_usuarios.
create or replace function public.es_administrador()
returns boolean
language sql
security definer
set search_path to 'public'
stable
as $$
  select exists (
    select 1 from public.store_usuarios
    where id = auth.uid() and rol = 'administrador'
  );
$$;

-- 4. Importante: el trigger que actualiza el stock debe poder
-- escribir en store_productos aunque quien registra el
-- movimiento sea un "trabajador" sin permiso directo de UPDATE
-- sobre esa tabla (ver políticas más abajo). Por eso pasa a
-- SECURITY DEFINER.
create or replace function public.actualizar_stock_producto()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update store_productos
  set stock = new.stock_nuevo
  where id = new.producto_id;
  return new;
end;
$function$;

-- 5. Políticas sobre store_usuarios ----------------------------
-- La lectura pública ya existía (la necesita el login, que busca
-- el email a partir del nombre_usuario antes de autenticar).
-- Se agregan reglas de escritura: solo un administrador puede
-- editar o eliminar cuentas de usuario.
drop policy if exists "Administradores actualizan usuarios" on public.store_usuarios;
create policy "Administradores actualizan usuarios"
on public.store_usuarios for update
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

drop policy if exists "Administradores eliminan usuarios" on public.store_usuarios;
create policy "Administradores eliminan usuarios"
on public.store_usuarios for delete
to authenticated
using (public.es_administrador());

-- 6. Políticas sobre store_productos ----------------------------
-- Cualquier usuario con sesión puede ver el catálogo; solo un
-- administrador puede crear, editar o eliminar productos.
alter table public.store_productos enable row level security;

drop policy if exists "Usuarios ven productos" on public.store_productos;
create policy "Usuarios ven productos"
on public.store_productos for select
to authenticated
using (true);

drop policy if exists "Administradores gestionan productos" on public.store_productos;
create policy "Administradores gestionan productos"
on public.store_productos for all
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

-- 7. Políticas sobre store_categorias ----------------------------
alter table public.store_categorias enable row level security;

drop policy if exists "Usuarios ven categorias" on public.store_categorias;
create policy "Usuarios ven categorias"
on public.store_categorias for select
to authenticated
using (true);

drop policy if exists "Administradores gestionan categorias" on public.store_categorias;
create policy "Administradores gestionan categorias"
on public.store_categorias for all
to authenticated
using (public.es_administrador())
with check (public.es_administrador());

-- 8. Políticas sobre store_movimientos_inventario -----------------
-- Administradores y trabajadores registran movimientos por igual
-- (es la operación diaria de mostrador). El registro queda
-- inmutable: nadie puede editar ni borrar un movimiento ya hecho,
-- y cada quien solo puede registrar movimientos a su propio nombre.
alter table public.store_movimientos_inventario enable row level security;

drop policy if exists "Usuarios ven movimientos" on public.store_movimientos_inventario;
create policy "Usuarios ven movimientos"
on public.store_movimientos_inventario for select
to authenticated
using (true);

drop policy if exists "Usuarios registran movimientos propios" on public.store_movimientos_inventario;
create policy "Usuarios registran movimientos propios"
on public.store_movimientos_inventario for insert
to authenticated
with check (usuario_id = auth.uid());
