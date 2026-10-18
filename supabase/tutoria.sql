-- Distribución del aula · Enlace con los datos comunes (tutoría y Orientación)
-- Ejecutar en Supabase → SQL Editor, en el proyecto común «Acceso Microsoft 365». Se puede volver a ejecutar.
--
-- 1. Tutor/a de cada grupo: se guarda su correo en la lista común de grupos («tutor_email»).
--    Se toma primero el tutor/a que Orientación ya tiene enlazado (grupo.tutor_id → personal) y, si no hay,
--    se busca el nombre del tutor/a de Séneca en «personal».
-- 2. Las distribuciones que hace el tutor/a de SU grupo las ve todo el profesorado (solo lectura), marcadas
--    «De la tutoría», sin tener que compartirlas.
-- 3. Atención a la diversidad: la web marca sola al alumnado que en Orientación tiene la medida
--    «Ubicación cercana al profesor/a» este curso, para sentarlo en las primeras filas. Solo se envía el
--    número de matrícula y el nombre de la medida (nada de la ficha).

begin;

-- 1. Correo del tutor/a en la lista común de grupos
alter table grupos add column if not exists tutor_email text;

update grupos g set tutor_email = p.email
from grupo og join personal p on p.id = og.tutor_id
where og.clase_id = g.id and g.tutor_email is null;

update grupos g set tutor_email = p.email
from personal p
where g.tutor_email is null and g.tutor is not null and p.activo and (
  normalizar_nombre(p.nombre_seneca) = normalizar_nombre(g.tutor) or
  normalizar_nombre(p.nombre) = normalizar_nombre(trim(split_part(g.tutor, ',', 2)) || ' ' || trim(split_part(g.tutor, ',', 1))) or
  normalizar_nombre(p.nombre) = normalizar_nombre(g.tutor)
);

-- 2. Las distribuciones de la tutoría las ve el profesorado
create or replace function aul_es_de_tutoria(p_clase int, p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from grupos g where g.id = p_clase and lower(g.tutor_email) = lower(p_email))
$$;
grant execute on function aul_es_de_tutoria(int, text) to authenticated;

drop policy if exists "aul ver" on aul_planos;
create policy "aul ver" on aul_planos for select to authenticated
  using (es_profesorado() and (
    propietario = lower(auth.jwt() ->> 'email') or compartido or aul_es_de_tutoria(clase_id, propietario)
  ));

-- 3. Medidas de Orientación que afectan a dónde se sienta el alumno/a (curso indicado de «cursos»)
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
  where es_profesorado() and m.activo and cm.nombre = 'Ubicación cercana al profesor/a'
$$;
grant execute on function aul_medidas_orientacion(int) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Comprobación: grupos del curso activo y el correo de su tutor/a. Los que salgan sin correo se completan a mano:
--   update grupos set tutor_email = 'nombre.apellido@salesianas.org' where id = 123;
select g.id, g.etapa, g.nombre, g.tutor, g.tutor_email
from grupos g join cursos c on c.id = g.curso_id and c.activo
order by g.tutor_email nulls first, g.orden;
