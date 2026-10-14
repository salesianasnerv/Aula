-- Distribución del aula · tabla de distribuciones (Supabase / PostgreSQL)
-- Ejecutar UNA vez en Supabase → SQL Editor, en el proyecto común «Acceso Microsoft 365»
-- (el mismo de Control de baños). Usa sus tablas cursos, clases y alumnos, que no se tocan.

create table if not exists aul_planos (
  id                 uuid primary key default gen_random_uuid(),
  propietario        text not null default lower(auth.jwt() ->> 'email'),
  propietario_nombre text,
  curso_id           int references cursos(id) on delete cascade,
  clase_id           int references clases(id) on delete set null,
  nombre             text not null,
  compartido         boolean not null default false,  -- visible (solo lectura) para el resto del claustro
  datos              jsonb not null default '{}'::jsonb, -- aula, mesas y sitio de cada alumno/a
  actualizado        timestamptz not null default now()
);
create index if not exists aul_planos_curso_idx on aul_planos (curso_id, clase_id);

-- ── Seguridad: cada profesor/a ve y edita solo lo suyo; lo compartido lo ve todo el claustro ──
alter table aul_planos enable row level security;

drop policy if exists "aul ver"     on aul_planos;
drop policy if exists "aul crear"   on aul_planos;
drop policy if exists "aul editar"  on aul_planos;
drop policy if exists "aul borrar"  on aul_planos;

create policy "aul ver" on aul_planos for select to authenticated
  using (es_profesorado() and (propietario = lower(auth.jwt() ->> 'email') or compartido));
create policy "aul crear" on aul_planos for insert to authenticated
  with check (es_profesorado() and propietario = lower(auth.jwt() ->> 'email'));
create policy "aul editar" on aul_planos for update to authenticated
  using (propietario = lower(auth.jwt() ->> 'email'))
  with check (propietario = lower(auth.jwt() ->> 'email'));
create policy "aul borrar" on aul_planos for delete to authenticated
  using (propietario = lower(auth.jwt() ->> 'email'));

-- Fecha de la última modificación
create or replace function aul_tocar() returns trigger language plpgsql as $$
begin new.actualizado := now(); return new; end $$;
drop trigger if exists aul_planos_tocar on aul_planos;
create trigger aul_planos_tocar before update on aul_planos
  for each row execute function aul_tocar();
