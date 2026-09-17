-- Índices para las consultas más frecuentes del sitio de servicios.
-- Postgres no indexa automáticamente las claves foráneas, y estas dos
-- columnas se filtran en cada carga de /servicios y cada vez que un
-- visitante elige una fecha en /reservar (sp_get_available_slots).

create index if not exists sp_services_category_id_idx on "SP_services" (category_id);
create index if not exists sp_bookings_booking_date_idx on "SP_bookings" (booking_date);
