-- Distribución del aula · Sondeos del alumnado (con quién sí, con quién no y propuesta de clase)
-- Ejecutar en Supabase → SQL Editor, proyecto común «Acceso Microsoft 365». PEDIR VISTO BUENO A MARIÁN ANTES.
-- Necesita lo de solo-profesorado-de-cada-etapa.sql (puede_ver_grupo) y tutoria.sql (aul_es_de_tutoria).
-- Se puede volver a ejecutar.
--
-- Qué crea
--   · aul_sondeos: cada sondeo de una clase (preguntas, código del QR, plazo, disposiciones de mesas).
--   · aul_sondeo_respuestas: lo que contesta cada alumno/a (con quién sí, con quién no, propuesta, mensaje).
--   · aul_claves: clave personal de 4 cifras de cada alumno/a (opcional; sirve para todo el curso).
--   · Funciones para el alumnado, que entra SIN cuenta: solo pueden ver el sondeo abierto con su código
--     (nombre corto de la clase, sin apellidos completos) y ENVIAR su respuesta. No pueden leer nada más.
--   · Borrado automático: cada noche se borran los sondeos, respuestas y claves cuya fecha de borrado
--     (el 31 de agosto del curso) ya ha pasado.
--
-- Quién ve qué (protección de datos)
--   · Respuestas y sondeos: solo quien lanza el sondeo y el tutor/a del grupo. Nadie más del claustro.
--   · Lanzar un sondeo: profesorado que puede ver ese grupo (su etapa).
--   · Claves: profesorado que puede ver ese grupo (para imprimir la hoja de claves).
--   · No se guarda nada de salud. El mensaje libre tiene un máximo de 300 caracteres.

begin;

-- 0. Fecha de borrado: el 31 de agosto del curso escolar en el que estamos
create or replace function aul_fin_curso() returns date
language sql stable as $$
  select make_date(extract(year from now())::int + case when extract(month from now()) >= 9 then 1 else 0 end, 8, 31)
$$;

-- 1. Tablas
create table if not exists aul_sondeos (
  id              uuid primary key default gen_random_uuid(),
  curso_id        int references cursos(id) on delete cascade,
  clase_id        int not null,
  creador         text not null default lower(auth.jwt() ->> 'email'),
  creador_nombre  text,
  nombre          text not null check (char_length(nombre) between 1 and 80),
  codigo          text not null unique check (codigo ~ '^[A-Z0-9]{6}$'),
  preguntas       jsonb not null default '{"si": true, "no": true, "plano": true, "msg": true}'::jsonb,
  max_si          int not null default 5 check (max_si between 1 and 10),
  max_no          int not null default 5 check (max_no between 1 and 10),
  identificacion  text not null default 'nombre' check (identificacion in ('nombre', 'clave')),
  disposiciones   jsonb not null default '[]'::jsonb check (pg_column_size(disposiciones) < 300000),
  abierto_hasta   timestamptz,               -- vacío: hasta que se cierre a mano
  cerrado         boolean not null default false,
  creado          timestamptz not null default now(),
  borrar_el       date not null default aul_fin_curso()
);
create index if not exists aul_sondeos_clase_idx on aul_sondeos (curso_id, clase_id);

create table if not exists aul_sondeo_respuestas (
  id         bigint generated always as identity primary key,
  sondeo_id  uuid not null references aul_sondeos(id) on delete cascade,
  alumno_id  int not null,                   -- id de matrícula
  si         int[] not null default '{}',
  no         int[] not null default '{}',
  plano      jsonb,                          -- {"disp": "...", "asientos": {"mesa:puesto": matrícula}}
  mensaje    text check (char_length(mensaje) <= 300),
  creado     timestamptz not null default now(),
  unique (sondeo_id, alumno_id)
);

create table if not exists aul_claves (
  curso_id   int not null references cursos(id) on delete cascade,
  alumno_id  int not null,
  clave      text not null check (clave ~ '^[0-9]{4}$'),
  fallos     int not null default 0,          -- intentos fallidos seguidos (a los 10 se bloquea)
  borrar_el  date not null default aul_fin_curso(),
  primary key (curso_id, alumno_id)
);

-- 2. Seguridad
alter table aul_sondeos enable row level security;
alter table aul_sondeo_respuestas enable row level security;
alter table aul_claves enable row level security;   -- sin reglas: solo se usa a través de funciones

-- ¿Puede ver este sondeo quien ha iniciado sesión? Quien lo lanzó o el tutor/a del grupo
create or replace function aul_sondeo_ve(p_clase int, p_creador text) returns boolean
language sql stable security definer set search_path = public as $$
  select es_profesorado() and (
    lower(p_creador) = lower(auth.jwt() ->> 'email')
    or aul_es_de_tutoria(p_clase, lower(auth.jwt() ->> 'email')))
$$;
revoke execute on function aul_sondeo_ve(int, text) from public, anon;
grant execute on function aul_sondeo_ve(int, text) to authenticated;

drop policy if exists "aul sondeos ver"    on aul_sondeos;
drop policy if exists "aul sondeos crear"  on aul_sondeos;
drop policy if exists "aul sondeos editar" on aul_sondeos;
drop policy if exists "aul sondeos borrar" on aul_sondeos;
create policy "aul sondeos ver" on aul_sondeos for select to authenticated
  using (aul_sondeo_ve(clase_id, creador));
create policy "aul sondeos crear" on aul_sondeos for insert to authenticated
  with check (es_profesorado() and creador = lower(auth.jwt() ->> 'email') and puede_ver_grupo(clase_id));
create policy "aul sondeos editar" on aul_sondeos for update to authenticated
  using (aul_sondeo_ve(clase_id, creador)) with check (aul_sondeo_ve(clase_id, creador));
create policy "aul sondeos borrar" on aul_sondeos for delete to authenticated
  using (aul_sondeo_ve(clase_id, creador));

drop policy if exists "aul respuestas ver"    on aul_sondeo_respuestas;
drop policy if exists "aul respuestas anular" on aul_sondeo_respuestas;
create policy "aul respuestas ver" on aul_sondeo_respuestas for select to authenticated
  using (exists (select 1 from aul_sondeos s where s.id = sondeo_id and aul_sondeo_ve(s.clase_id, s.creador)));
create policy "aul respuestas anular" on aul_sondeo_respuestas for delete to authenticated
  using (exists (select 1 from aul_sondeos s where s.id = sondeo_id and aul_sondeo_ve(s.clase_id, s.creador)));
-- (no hay regla de alta ni de cambio: las respuestas solo entran por aul_sondeo_responder)

revoke all on aul_sondeos, aul_sondeo_respuestas, aul_claves from anon;

-- 3. Nombre corto para la lista del alumnado: «Nombre + inicial del primer apellido» («García López, Lucía» → «Lucía G.»).
--    Si en la clase se repite, «Nombre + primer apellido».
create or replace function aul_nombre_corto(p_nombre text, p_largo boolean default false) returns text
language sql immutable as $$
  with p as (
    select case when position(',' in p_nombre) > 0 then trim(split_part(p_nombre, ',', 2)) else split_part(trim(p_nombre), ' ', 1) end as nom,
           regexp_replace(case when position(',' in p_nombre) > 0 then trim(split_part(p_nombre, ',', 1))
                               else trim(substr(trim(p_nombre), length(split_part(trim(p_nombre), ' ', 1)) + 1)) end,
                          '^((de|del|la|las|los|y|san|da|do|dos|van|von)\s+)+', '', 'i') as ape
  )
  select trim(nom || ' ' || case when ape = '' then '' when p_largo then split_part(ape, ' ', 1) else left(ape, 1) || '.' end) from p
$$;

-- 4. Funciones para el alumnado (sin cuenta)
-- Sondeo abierto con ese código (o nada si no existe, ha caducado o está cerrado)
create or replace function aul_sondeo_abierto(p_codigo text) returns aul_sondeos
language sql stable security definer set search_path = public as $$
  select s.* from aul_sondeos s
  where s.codigo = upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'))
    and not s.cerrado and (s.abierto_hasta is null or s.abierto_hasta > now())
$$;
revoke execute on function aul_sondeo_abierto(text) from public, anon, authenticated;

-- Lo que ve el alumno/a al entrar: preguntas, disposiciones de mesas y lista de la clase (nombre corto)
create or replace function aul_sondeo_ver(p_codigo text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s aul_sondeos;
begin
  s := aul_sondeo_abierto(p_codigo);
  if s.id is null then return null; end if;
  return jsonb_build_object(
    'nombre', s.nombre, 'profesor', s.creador_nombre,
    'clase', (select g.nombre from grupos g where g.id = s.clase_id),
    'preguntas', s.preguntas, 'max_si', s.max_si, 'max_no', s.max_no,
    'identificacion', s.identificacion, 'disposiciones', s.disposiciones,
    'alumnos', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'nombre', a.corto, 'hecho', a.hecho) order by a.corto)
      from (
        select m.id, case when count(*) over (partition by aul_nombre_corto(m.nombre)) > 1
                          then aul_nombre_corto(m.nombre, true) else aul_nombre_corto(m.nombre) end as corto,
               exists (select 1 from aul_sondeo_respuestas r where r.sondeo_id = s.id and r.alumno_id = m.id) as hecho
        from matriculas m where m.clase_id = s.clase_id and m.activo
      ) a), '[]'::jsonb));
end $$;

-- Comprueba que puede contestar: 'ok', 'cerrado', 'no_esta', 'ya', 'clave' (incorrecta) o 'bloqueado'
create or replace function aul_sondeo_entrar(p_codigo text, p_alumno int, p_clave text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare s aul_sondeos; c aul_claves;
begin
  s := aul_sondeo_abierto(p_codigo);
  if s.id is null then return 'cerrado'; end if;
  if not exists (select 1 from matriculas m where m.id = p_alumno and m.clase_id = s.clase_id and m.activo) then return 'no_esta'; end if;
  if exists (select 1 from aul_sondeo_respuestas r where r.sondeo_id = s.id and r.alumno_id = p_alumno) then return 'ya'; end if;
  if s.identificacion = 'clave' then
    select * into c from aul_claves k where k.curso_id = s.curso_id and k.alumno_id = p_alumno;
    if c.alumno_id is null then return 'clave'; end if;
    if c.fallos >= 10 then return 'bloqueado'; end if;
    if c.clave is distinct from trim(coalesce(p_clave, '')) then
      update aul_claves set fallos = fallos + 1 where curso_id = c.curso_id and alumno_id = c.alumno_id;
      return 'clave';
    end if;
    update aul_claves set fallos = 0 where curso_id = c.curso_id and alumno_id = c.alumno_id and fallos > 0;
  end if;
  return 'ok';
end $$;

-- Guarda la respuesta (una sola vez por alumno/a). Devuelve 'ok' o el motivo por el que no se guarda.
create or replace function aul_sondeo_responder(p_codigo text, p_alumno int, p_clave text, p_si int[], p_no int[], p_plano jsonb, p_mensaje text)
returns text
language plpgsql volatile security definer set search_path = public as $$
declare s aul_sondeos; e text; clase int[]; v_si int[]; v_no int[]; v_msg text; v_plano jsonb;
begin
  e := aul_sondeo_entrar(p_codigo, p_alumno, p_clave);
  if e <> 'ok' then return e; end if;
  s := aul_sondeo_abierto(p_codigo);
  select array_agg(m.id) into clase from matriculas m where m.clase_id = s.clase_id and m.activo;
  v_si := case when (s.preguntas ->> 'si')::boolean then array(select distinct x from unnest(coalesce(p_si, '{}')) x) else '{}' end;
  v_no := case when (s.preguntas ->> 'no')::boolean then array(select distinct x from unnest(coalesce(p_no, '{}')) x) else '{}' end;
  if cardinality(v_si) > s.max_si or cardinality(v_no) > s.max_no then return 'datos'; end if;
  if not (v_si <@ clase and v_no <@ clase) or p_alumno = any(v_si) or p_alumno = any(v_no) or v_si && v_no then return 'datos'; end if;
  v_msg := case when (s.preguntas ->> 'msg')::boolean then nullif(left(trim(coalesce(p_mensaje, '')), 300), '') end;
  v_plano := null;
  if (s.preguntas ->> 'plano')::boolean and p_plano is not null and jsonb_typeof(p_plano -> 'asientos') = 'object'
     and (p_plano -> 'asientos') <> '{}'::jsonb then
    if pg_column_size(p_plano) > 20000 then return 'datos'; end if;
    if not exists (select 1 from jsonb_array_elements(s.disposiciones) d where d ->> 'id' = p_plano ->> 'disp') then return 'datos'; end if;
    if exists (select 1 from jsonb_each_text(p_plano -> 'asientos') a where a.value !~ '^\d+$' or not (a.value::int = any(clase))) then return 'datos'; end if;
    v_plano := jsonb_build_object('disp', p_plano ->> 'disp', 'asientos', p_plano -> 'asientos');
  end if;
  insert into aul_sondeo_respuestas (sondeo_id, alumno_id, si, no, plano, mensaje)
  values (s.id, p_alumno, v_si, v_no, v_plano, v_msg);
  return 'ok';
exception when unique_violation then return 'ya';
end $$;

revoke execute on function aul_sondeo_ver(text) from public;
revoke execute on function aul_sondeo_entrar(text, int, text) from public;
revoke execute on function aul_sondeo_responder(text, int, text, int[], int[], jsonb, text) from public;
grant execute on function aul_sondeo_ver(text) to anon, authenticated;
grant execute on function aul_sondeo_entrar(text, int, text) to anon, authenticated;
grant execute on function aul_sondeo_responder(text, int, text, int[], int[], jsonb, text) to anon, authenticated;

-- 5. Claves personales de una clase: crea las que falten (o todas de nuevo con p_nuevas) y las devuelve
create or replace function aul_claves_clase(p_clase int, p_nuevas boolean default false)
returns table (alumno_id int, clave text)
language plpgsql volatile security definer set search_path = public as $$
declare v_curso int;
begin
  if not (es_profesorado() and puede_ver_grupo(p_clase)) then raise exception 'Sin permiso para este grupo'; end if;
  select g.curso_id into v_curso from grupos g where g.id = p_clase;
  if p_nuevas then
    delete from aul_claves k where k.curso_id = v_curso and k.alumno_id in (select m.id from matriculas m where m.clase_id = p_clase);
  end if;
  insert into aul_claves (curso_id, alumno_id, clave)
  select v_curso, m.id, lpad((floor(random() * 10000))::int::text, 4, '0')
  from matriculas m where m.clase_id = p_clase and m.activo
  on conflict do nothing;
  return query select k.alumno_id, k.clave from aul_claves k join matriculas m on m.id = k.alumno_id
    where k.curso_id = v_curso and m.clase_id = p_clase and m.activo;
end $$;
revoke execute on function aul_claves_clase(int, boolean) from public, anon;
grant execute on function aul_claves_clase(int, boolean) to authenticated;

-- 6. Borrado automático cada noche (3:15 en España en invierno)
create or replace function aul_sondeos_borrar() returns void
language sql security definer set search_path = public as $$
  delete from aul_sondeos where borrar_el < current_date;
  delete from aul_claves where borrar_el < current_date;
$$;
revoke execute on function aul_sondeos_borrar() from public, anon, authenticated;

commit;

select cron.schedule('aul-sondeos-borrar', '15 2 * * *', 'select aul_sondeos_borrar()');

notify pgrst, 'reload schema';

-- Comprobación (solo lectura): tablas creadas y tarea de borrado programada
select (select count(*) from aul_sondeos) as sondeos, (select count(*) from aul_sondeo_respuestas) as respuestas,
       (select count(*) from aul_claves) as claves,
       (select schedule from cron.job where jobname = 'aul-sondeos-borrar') as borrado_programado;
