-- Distribución del aula · cada profesor/a solo ve las listas de su etapa (protección de datos, 25-10-2026)
-- Ejecutar en Supabase → SQL Editor, proyecto «Acceso Microsoft 365». PEDIR VISTO BUENO A MARIÁN ANTES.
--
-- Qué cambia
--   Hasta ahora cualquier cuenta de Nervión (también PAS, cuentas compartidas e Infantil o CCFF) podía leer las
--   listas de alumnado de TODO el colegio y la medida de Orientación «Ubicación cercana al profesor/a».
--   Desde aquí, cada persona ve solo los grupos de su etapa, según los grupos de Microsoft 365 que la
--   sincronización nocturna apunta en personal.grupos_entra:
--     e-ner-infantil → Infantil · e-ner-epo → Primaria · e-ner-eso → ESO · e-ner-bachillerato → Bachillerato · e-ner-ccff → CCFF
--   Quien está en varias etapas ve todas las suyas.
--   Ven TODO el colegio: quien tiene el permiso «banos» (gestiona las listas) o «todas».
--
-- A qué afecta
--   · Listas comunes «grupos» y «matriculas» (y las vistas «clases» y «alumnos», que las heredan):
--       Distribución del aula y Control de baños. En Control de baños no cambia nada en la práctica: ya solo
--       entraba el personal de ESO y Bachillerato, que sigue viendo ESO y Bachillerato.
--   · Distribuciones guardadas (aul_planos): las compartidas solo las ve el profesorado de la etapa de esa clase.
--   · Medida de Orientación «Ubicación cercana al profesor/a»: solo para los grupos que la persona puede ver.
--   · NO afecta al panel de Administración ni a Orientación (usan funciones propias) ni a quién CAMBIA las
--     listas (sigue siendo solo el permiso «banos»).
--
-- PASO 1 (solo lectura). Ejecutar primero esto suelto y revisar: personal activo que se quedaría sin listas.
--   select email, nombre, grupos_entra from personal
--   where activo and not (grupos_entra && array['infantil','primaria','eso','bachillerato','fp'])
--   order by nombre;
--   Si sale profesorado que debería ver listas, hay que meterlo en su grupo de etapa en Microsoft 365 antes.
--
-- PASO 2: ejecutar el bloque de abajo.

begin;

-- 1. Etapas que puede ver quien ha iniciado sesión (vacío = ninguna)
create or replace function mis_etapas() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct e), '{}') from (
    select case g when 'infantil' then 'Infantil' when 'primaria' then 'Primaria' when 'eso' then 'ESO'
                  when 'bachillerato' then 'Bachillerato' when 'fp' then 'CCFF' end as e
    from personal p, unnest(p.grupos_entra) g
    where p.email = email_actual() and p.activo
  ) x where e is not null
$$;
revoke execute on function mis_etapas() from public, anon;
grant execute on function mis_etapas() to authenticated;

-- 2. ¿Puede ver las listas de este grupo?
create or replace function puede_ver_grupo(p_grupo int) returns boolean
language sql stable security definer set search_path = public as $$
  select es_profesorado() and (
    es_admin() or tiene_permiso('todas')
    or exists (select 1 from grupos g where g.id = p_grupo and g.etapa = any(mis_etapas())))
$$;
revoke execute on function puede_ver_grupo(int) from public, anon;
grant execute on function puede_ver_grupo(int) to authenticated;

-- 3. Listas comunes: leer solo los grupos de la etapa propia
--    (se quitan TODAS las reglas de lectura que haya, tengan el nombre que tengan, y se pone una sola)
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies
           where schemaname = 'public' and tablename in ('grupos', 'matriculas') and cmd = 'SELECT' loop
    execute format('drop policy %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "leer grupos de mi etapa" on grupos for select to authenticated
  using (es_profesorado() and (es_admin() or tiene_permiso('todas') or etapa = any(mis_etapas())));
create policy "leer alumnado de mi etapa" on matriculas for select to authenticated
  using (puede_ver_grupo(clase_id));

-- 4. Distribuciones: lo propio siempre; lo compartido o de la tutoría, solo si la clase es de mi etapa
drop policy if exists "aul ver" on aul_planos;
create policy "aul ver" on aul_planos for select to authenticated
  using (es_profesorado() and (
    propietario = lower(auth.jwt() ->> 'email')
    or (puede_ver_grupo(clase_id) and (
          compartido or aul_es_de_tutoria(clase_id, propietario)
          or aul_es_de_tutoria(clase_id, lower(auth.jwt() ->> 'email'))
          or aul_tutor_de_mezcla(datos, lower(auth.jwt() ->> 'email'))))
  ));

-- 5. Medida de Orientación: solo de los grupos que se pueden ver
create or replace function aul_medidas_orientacion(p_curso int)
returns table (matricula_id int, medida text)
language sql stable security definer set search_path = public as $$
  select distinct m.id::int, cm.nombre::text
  from matriculas m
  join grupos g on g.id = m.clase_id and g.curso_id = p_curso
  join cursos c on c.id = g.curso_id
  join curso_academico ca on ca.nombre = left(c.nombre, 5) || right(c.nombre, 2)
  join ficha_curso f on f.alumno_id = m.alumno_id and f.curso_academico_id = ca.id
  join medida_alumno ma on ma.ficha_id = f.id
  join catalogo_medida cm on cm.id = ma.medida_id
  where es_profesorado() and puede_ver_grupo(g.id) and m.activo and cm.nombre = 'Ubicación cercana al profesor/a'
$$;
revoke execute on function aul_medidas_orientacion(int) from public, anon;
grant execute on function aul_medidas_orientacion(int) to authenticated;

commit;

-- Comprobación: reglas que quedan en las listas y en las distribuciones
select tablename, policyname, cmd, qual from pg_policies
where schemaname = 'public' and tablename in ('grupos', 'matriculas', 'aul_planos') order by tablename, cmd;

-- Para volver atrás (solo si algo falla): vuelve a dejar la lectura para cualquier cuenta de Nervión
-- begin;
-- drop policy if exists "leer grupos de mi etapa" on grupos;
-- drop policy if exists "leer alumnado de mi etapa" on matriculas;
-- create policy "leer clases"  on grupos     for select to authenticated using (es_profesorado());
-- create policy "leer alumnos" on matriculas for select to authenticated using (es_profesorado());
-- (y volver a ejecutar supabase/tutoria.sql para «aul ver» y aul_medidas_orientacion)
-- commit;
