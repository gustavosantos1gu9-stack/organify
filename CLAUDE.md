# SALX Convert: regras permanentes

## Deploy
- Deploy de produção só a partir de commit no Git, nunca de arquivos locais não commitados.
- Sem merge na main e sem deploy em produção sem aprovação explícita.

## Como trabalhar
- Nunca usar subagentes para alterar código.
- Editar arquivos com a ferramenta de edição (Edit/Write), nunca com sed ou scripts.
- Nunca escrever tokens, chaves ou secrets em comandos.
- Nunca reescrever uma função que "sumiu": restaurar da branch de referência (`producao-atual`) com git (`git checkout producao-atual -- <arquivo>` / `git show`).

## Mudanças visuais
- Mudanças "visuais" não alteram lógica, queries, rotas, APIs, `lib/`, hooks, crons, `next.config.js`, `tsconfig.json` nem `package.json` sem perguntar.
- Paleta oficial: `#0A1826`, `#1C6CA6`, `#144E73`, `#8CC6EC`, `#EEF1F4`, `#F3F5F7`.

## Build
- Nunca desligar checagens (`ignoreBuildErrors`, `ignoreDuringBuilds`, `@ts-ignore`) para o build passar.

## Preview
- No preview, nunca rodar ações que alteram dados (enviar, importar, reclassificar, sincronizar, salvar).
