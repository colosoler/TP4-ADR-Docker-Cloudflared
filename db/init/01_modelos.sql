-- Módulo 1 — Modelos. DDL copiado tal cual de docs/plan/00-plan-general.md §5.6
create table modelos (
  id           bigint generated always as identity primary key,
  nombre       text not null unique check (length(nombre) between 1 and 40),
  segmento     text not null check (segmento in ('sedan', 'hatchback', 'suv')),
  precio_base  numeric(12,2) not null check (precio_base > 0),
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Datos de ejemplo (precios ficticios)
insert into modelos (nombre, segmento, precio_base, activo) values
  ('City',  'sedan',     32000000, true),
  ('Civic', 'sedan',     52000000, true),
  ('HR-V',  'suv',       42000000, true),
  ('ZR-V',  'suv',       50000000, true),
  ('CR-V',  'suv',       68000000, true),
  ('Fit',   'hatchback', 25000000, false);
