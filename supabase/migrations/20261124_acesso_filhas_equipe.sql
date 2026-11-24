-- Equipe da agência mãe ganha acesso automático às agências filhas.
-- Remover o acesso (delete em usuarios_agencias) continua valendo: os gatilhos só agem na criação.

-- 1) Nova agência filha → todos os usuários da mãe recebem acesso
create or replace function public.dar_acesso_equipe_nova_filha() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.parent_id is not null then
    insert into usuarios_agencias (usuario_id, agencia_id)
      select u.id, new.id from usuarios u where u.agencia_id = new.parent_id
      on conflict (usuario_id, agencia_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_acesso_equipe_nova_filha on agencias;
create trigger trg_acesso_equipe_nova_filha after insert on agencias
  for each row execute function public.dar_acesso_equipe_nova_filha();

-- 2) Novo usuário na agência mãe → acesso a todas as filhas existentes
create or replace function public.dar_acesso_filhas_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.agencia_id is not null and exists (select 1 from agencias where id = new.agencia_id and parent_id is null) then
    insert into usuarios_agencias (usuario_id, agencia_id)
      select new.id, f.id from agencias f where f.parent_id = new.agencia_id
      on conflict (usuario_id, agencia_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_acesso_filhas_novo_usuario on usuarios;
create trigger trg_acesso_filhas_novo_usuario after insert on usuarios
  for each row execute function public.dar_acesso_filhas_novo_usuario();

-- 3) Agora: equipe atual com acesso a todas as filhas que já existem
insert into usuarios_agencias (usuario_id, agencia_id)
  select u.id, f.id from usuarios u
  join agencias m on m.id = u.agencia_id and m.parent_id is null
  join agencias f on f.parent_id = m.id
  on conflict (usuario_id, agencia_id) do nothing;
