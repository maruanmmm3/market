-- Contenido editable de la landing page de "pagina_servicios" (Amaru):
-- hero, secciones de "dolor"/estadísticas, formas de trabajo, comparación
-- y bio del fundador. Todo con prefijo SP_ y editable solo por el admin
-- (sp_is_admin(), definida en 20260915180500_sp_admin_restriction.sql).

create table "SP_home_content" (
  id uuid primary key default gen_random_uuid(),
  hero_badge text not null default '',
  hero_title text not null default '',
  hero_highlight text not null default '',
  hero_subtitle text not null default '',
  hero_tags jsonb not null default '[]'::jsonb,
  cta_title text not null default '',
  cta_subtitle text not null default '',
  cta_button_text text not null default ''
);

create table "SP_founder" (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  role text not null default '',
  quote text not null default '',
  bio text not null default '',
  years_automation int not null default 0,
  years_dev int not null default 0,
  photo_url text
);

create table "SP_pain_tabs" (
  id uuid primary key default gen_random_uuid(),
  "order" int not null default 0,
  key text not null,
  label text not null,
  icon text not null default 'clock',
  stat_label text not null default '',
  stat_value_display text not null default '',
  stat_percent int not null default 0 check (stat_percent between 0 and 100),
  cards jsonb not null default '[]'::jsonb,
  bars jsonb not null default '[]'::jsonb
);

create table "SP_approaches" (
  id uuid primary key default gen_random_uuid(),
  "order" int not null default 0,
  badge text not null default '',
  badge_variant text not null default 'default' check (badge_variant in ('default', 'recommended')),
  title text not null default '',
  description text not null default '',
  points jsonb not null default '[]'::jsonb,
  quote text
);

create table "SP_comparison_items" (
  id uuid primary key default gen_random_uuid(),
  side text not null check (side in ('sin', 'con')),
  text text not null,
  "order" int not null default 0
);

-- =========================================================
-- RLS: lectura pública, escritura solo el admin (sp_is_admin())
-- =========================================================

alter table "SP_home_content" enable row level security;
alter table "SP_founder" enable row level security;
alter table "SP_pain_tabs" enable row level security;
alter table "SP_approaches" enable row level security;
alter table "SP_comparison_items" enable row level security;

create policy "sp_home_content_public_select" on "SP_home_content"
  for select to anon, authenticated using (true);
create policy "sp_home_content_admin_write" on "SP_home_content"
  for all to authenticated using (sp_is_admin()) with check (sp_is_admin());

create policy "sp_founder_public_select" on "SP_founder"
  for select to anon, authenticated using (true);
create policy "sp_founder_admin_write" on "SP_founder"
  for all to authenticated using (sp_is_admin()) with check (sp_is_admin());

create policy "sp_pain_tabs_public_select" on "SP_pain_tabs"
  for select to anon, authenticated using (true);
create policy "sp_pain_tabs_admin_write" on "SP_pain_tabs"
  for all to authenticated using (sp_is_admin()) with check (sp_is_admin());

create policy "sp_approaches_public_select" on "SP_approaches"
  for select to anon, authenticated using (true);
create policy "sp_approaches_admin_write" on "SP_approaches"
  for all to authenticated using (sp_is_admin()) with check (sp_is_admin());

create policy "sp_comparison_items_public_select" on "SP_comparison_items"
  for select to anon, authenticated using (true);
create policy "sp_comparison_items_admin_write" on "SP_comparison_items"
  for all to authenticated using (sp_is_admin()) with check (sp_is_admin());

-- =========================================================
-- Seed: contenido inicial de Amaru
-- =========================================================

insert into "SP_home_content" (hero_badge, hero_title, hero_highlight, hero_subtitle, hero_tags, cta_title, cta_subtitle, cta_button_text)
values (
  'MENOS TRABAJO MANUAL, MÁS RESULTADOS',
  'Tu negocio no necesita más horas de trabajo. Necesita',
  'sistemas que trabajen por ti',
  'Combinamos desarrollo de software a medida y automatización de procesos para que atiendas más clientes con menos esfuerzo manual.',
  '["Desarrollo a medida", "Automatización con IA", "Implementación en días"]'::jsonb,
  '¿Te identificas con alguna de estas áreas?',
  'Podemos resolverlas juntos — sin tecnicismos, sin rodeos.',
  'Quiero solucionar esto'
);

insert into "SP_founder" (name, role, quote, bio, years_automation, years_dev, photo_url)
values (
  'Jheanpier Maruan Aguilar',
  'CEO & Fundador · Amaru',
  'La salida a los problemas de todo negocio.',
  'Comencé desarrollando software y, con el tiempo, me especialicé en automatización de procesos. Hoy combino ambos mundos para construir sistemas a medida que resuelven el problema de fondo, no solo el síntoma.',
  4,
  3,
  null
);

insert into "SP_pain_tabs" (key, label, icon, "order", stat_label, stat_value_display, stat_percent, cards, bars) values
(
  'tiempo', 'Tiempo', 'clock', 1,
  'Tiempo dedicado a tareas repetitivas', '40% del día', 40,
  '[
    {"title": "Tareas que consumen el día", "description": "En promedio, los negocios sin automatizar dedican 3 a 4 horas diarias a tareas manuales y repetitivas."},
    {"title": "Repetición que no escala", "description": "Las mismas tareas, cada día, por las mismas personas. Cada hora en lo repetitivo es una hora menos en crecer."},
    {"title": "Tiempo que no regresa", "description": "A diferencia del dinero, el tiempo perdido no vuelve. Mientras tu equipo hace lo manual, tu competencia ya automatizó."}
  ]'::jsonb,
  '[
    {"label": "Atención al cliente", "display_value": "~8h"},
    {"label": "Seguimiento manual", "display_value": "~6h"},
    {"label": "Registro de datos", "display_value": "~4h"},
    {"label": "Reportes internos", "display_value": "~3h"}
  ]'::jsonb
),
(
  'procesos', 'Procesos', 'refresh-cw', 2,
  'Procesos que pueden automatizarse hoy', '80% automatizable', 80,
  '[
    {"title": "Equipo operando al límite", "description": "Tu equipo dedica horas a lo que un sistema puede hacer en segundos. Eso no es productividad, es desgaste."},
    {"title": "Procesos que no escalan", "description": "Más clientes significa más carga manual si no hay automatización detrás."},
    {"title": "Potencial sin aprovechar", "description": "Con las automatizaciones correctas, el mismo equipo atiende más clientes sin estrés ni horas extra."}
  ]'::jsonb,
  '[
    {"label": "Ingreso de datos", "display_value": "95%"},
    {"label": "Generación de reportes", "display_value": "85%"},
    {"label": "Seguimiento de clientes", "display_value": "80%"},
    {"label": "Consolidación de información", "display_value": "70%"}
  ]'::jsonb
),
(
  'tecnologia', 'Tecnología', 'code', 3,
  'Negocios operando con sistemas obsoletos o manuales', '65%', 65,
  '[
    {"title": "Herramientas que no conversan entre sí", "description": "Excel, WhatsApp y cuadernos no reemplazan un sistema real."},
    {"title": "Información dispersa", "description": "Sin un sistema central, los datos se pierden entre archivos y chats."},
    {"title": "Un sistema a tu medida", "description": "Un software hecho para tu negocio se adapta a cómo realmente trabajas, no al revés."}
  ]'::jsonb,
  '[
    {"label": "Negocios sin sistema propio", "display_value": "65%"},
    {"label": "Información en hojas de cálculo", "display_value": "55%"},
    {"label": "Procesos sin registro digital", "display_value": "45%"},
    {"label": "Reportes hechos a mano", "display_value": "40%"}
  ]'::jsonb
),
(
  'crecimiento', 'Crecimiento', 'trending-up', 4,
  'Más valor por cliente con sistema + automatización', '4.8x', 96,
  '[
    {"title": "Procesos que no se pierden", "description": "Un sistema centralizado evita que se te escapen tareas, pagos o seguimientos."},
    {"title": "Decisiones con datos reales", "description": "Reportes automáticos te muestran qué está funcionando, sin adivinar."},
    {"title": "El costo de no invertir", "description": "Negocios con sistema propio generan en promedio 4.8x más valor por cliente. No es un gasto, es la inversión con mayor retorno."}
  ]'::jsonb,
  '[
    {"label": "Sin sistema", "display_value": "1x"},
    {"label": "Solo automatización", "display_value": "2.2x"},
    {"label": "Solo desarrollo a medida", "display_value": "2.6x"},
    {"label": "Automatización + Desarrollo", "display_value": "4.8x"}
  ]'::jsonb
);

insert into "SP_approaches" ("order", badge, badge_variant, title, description, points, quote) values
(
  1, 'IMPLEMENTACIÓN DIRECTA', 'default',
  'Sabes qué necesitas y lo construimos',
  'Si ya tienes claro qué automatización o sistema quieres, lo diseñamos e instalamos directamente.',
  '[
    {"text": "Más rápido de implementar", "type": "good"},
    {"text": "Ideal cuando el problema ya está identificado", "type": "good"},
    {"text": "Sin diagnóstico previo, hay riesgo de resolver el síntoma, no la causa", "type": "warning"},
    {"text": "Como automedicarse: puede funcionar, pero también puede quedarse corto", "type": "warning"}
  ]'::jsonb,
  null
),
(
  2, 'DIAGNÓSTICO + SOLUCIÓN', 'recommended',
  'Analizamos, diseñamos y resolvemos',
  'Antes de escribir una sola línea de código, estudiamos tu operación en profundidad: dónde se pierde tiempo, dónde se pierden clientes y qué solución tiene sentido real para tu negocio.',
  '[
    {"text": "Identificamos la raíz del problema, no solo los síntomas", "type": "good"},
    {"text": "La solución está diseñada exactamente para tu caso", "type": "good"},
    {"text": "Minimiza el riesgo de implementar algo que no se usa", "type": "good"},
    {"text": "Como ir al especialista: diagnóstico primero, tratamiento después", "type": "good"}
  ]'::jsonb,
  'Si no sabemos exactamente qué necesitas, tú tampoco lo sabes todavía — y eso está bien. Para eso existe el diagnóstico.'
);

insert into "SP_comparison_items" (side, text, "order") values
('sin', 'Dependes del trabajo manual para crecer', 1),
('sin', 'Pierdes tiempo en tareas repetitivas cada día', 2),
('sin', 'Tu información vive dispersa en hojas de cálculo y chats', 3),
('sin', 'Seguimiento manual o ninguno en absoluto', 4),
('sin', 'No sabes qué proceso te está frenando', 5),
('sin', 'Crecimiento impredecible y limitado por tu tiempo', 6),
('con', 'Sistema a medida para tu forma real de trabajar', 1),
('con', 'Automatizaciones que hacen el trabajo repetitivo por ti', 2),
('con', 'Información centralizada y siempre disponible', 3),
('con', 'Reportes automáticos y seguimiento sin esfuerzo', 4),
('con', 'Sabes exactamente dónde se pierde tiempo y dinero', 5),
('con', 'Crecimiento sostenible sin depender de más horas tuyas', 6);
