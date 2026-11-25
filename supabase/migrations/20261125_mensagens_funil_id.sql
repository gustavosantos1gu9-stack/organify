-- O envio de funil (app/api/funis/enviar) grava mensagens.funil_id; a coluna não existia
-- e o registro da mídia na conversa falhava em silêncio (a mensagem era enviada, mas não aparecia no Inbox).
alter table mensagens add column if not exists funil_id uuid references funis(id) on delete set null;
