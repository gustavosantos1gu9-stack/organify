-- Agência filha nova nasce com a chave e o modelo de IA da agência mãe (se não vier com uma própria)
create or replace function public.filha_herda_chave_ia() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if new.parent_id is not null and coalesce(new.openai_key, '') = '' then
    select openai_key, openai_modelo into p from agencias where id = new.parent_id;
    if coalesce(p.openai_key, '') <> '' then
      new.openai_key := p.openai_key;
      new.openai_modelo := coalesce(p.openai_modelo, new.openai_modelo);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_filha_herda_chave_ia on agencias;
create trigger trg_filha_herda_chave_ia before insert on agencias
  for each row execute function public.filha_herda_chave_ia();
