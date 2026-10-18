-- Distribución del aula · Distribuciones de la tutoría
-- Ejecutar UNA vez en Supabase → SQL Editor, en el proyecto común «Acceso Microsoft 365».
-- 1. Añade a la lista común de grupos el correo del tutor/a («tutor_email») y lo rellena buscando su nombre en «personal».
-- 2. Las distribuciones que hace el tutor/a de SU grupo las ve automáticamente todo el profesorado (solo lectura),
--    sin necesidad de compartirlas. Nadie más que su autor/a puede cambiarlas ni borrarlas.
-- Se puede volver a ejecutar sin perder datos.

begin;

alter table grupos add column if not exists tutor_email text;

-- El nombre del tutor/a en los grupos viene como en Séneca («Apellidos, Nombre»)
update grupos g set tutor_email = p.email
from personal p
where g.tutor_email is null and g.tutor is not null and p.activo and (
  normalizar_nombre(p.nombre_seneca) = normalizar_nombre(g.tutor) or
  normalizar_nombre(p.nombre) = normalizar_nombre(trim(split_part(g.tutor, ',', 2)) || ' ' || trim(split_part(g.tutor, ',', 1))) or
  normalizar_nombre(p.nombre) = normalizar_nombre(g.tutor)
);

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

commit;

notify pgrst, 'reload schema';

-- Comprobación: grupos del curso activo y el correo de su tutor/a. Los que salgan sin correo se rellenan a mano:
--   update grupos set tutor_email = 'nombre.apellido@salesianas.org' where id = 123;
select g.id, g.nombre, g.tutor, g.tutor_email
from grupos g join cursos c on c.id = g.curso_id and c.activo
order by g.tutor_email nulls first, g.orden;
