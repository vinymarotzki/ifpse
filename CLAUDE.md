# CLAUDE.md

Dashboard dos riscos psicossociais da CGC (questionário **HSE IT**, 35 afirmativas, 7 fatores).
Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind 3 + Recharts + libSQL.
UI e comentários em pt-BR; comentários explicam o *porquê*.

## Testes e verificação — sempre em container Docker

Sempre subir um container Docker para testar/verificar (pedido explícito do dono do projeto).
Nesta máquina o App Control bloqueia binários nativos no host (git no Bash, `esbuild.exe`), então
`npm install`/`vitest`/`next build` **não rodam fora do Docker**. Tudo abaixo roda no container:

```bash
docker compose --profile check run --rm check          # typecheck + lint + vitest
docker compose --profile prod up --build -d             # app em http://localhost:3002
docker compose --profile dev up --build                 # hot-reload
docker run --rm hseit-check npx tsx scripts/simulate-webhook.ts \
  --url http://host.docker.internal:3002 --secret segredo-local-de-teste --count 150
docker compose --profile prod down -v                   # derruba e apaga o banco de teste
```

(`hseit-check` é a imagem do target `check`; rebuild com `docker compose --profile check build check`.)
Para regenerar o lockfile sem executar binários: `npm install --package-lock-only --ignore-scripts`.

## Arquitetura

- **Entrada de dados: um único webhook** `POST|GET /api/hse/webhook`
  (`src/app/api/hse/webhook/route.ts`), cadastrado no painel/API da SASI. Mesmo padrão do
  `cgc-atividades`: evento `io.sasi.message` com a mensagem em `data`; segredo
  `HSE_WEBHOOK_SECRET` no header `x-webhook-secret` ou `?secret=`; sem a env var, tudo é 401.
  Eventos que não são do HSE IT respondem 200 `ignored` (a SASI não deve reenviar).
  Toda chamada vai para `hse_webhook_log` com credenciais, dados do remetente e campos de
  identificação (nome…) mascarados (`src/lib/sasi/redact.ts`); guarda as últimas 500.
- **Mapper** (`src/lib/hse/mapper.ts`): os nomes dos campos do formulário no SASI não são
  documentados, então cada afirmativa é achada pelo texto, depois por `pergunta_N`/`qN`, depois
  por "N." no título. Resposta aceita 1–5 ou rótulo ("Nunca"…"Sempre"). Não armazena o nome.
  Se o formulário real tiver outro formato, o payload cru está em `hse_webhook_log`.
- **Armazenamento** (`src/lib/db.ts`, `store.ts`): libSQL; sem `TURSO_DATABASE_URL` usa
  `file:./data/hse-it.db` (volume no Docker). Upsert por `message_id`. Respostas em `answers_json`.
- **Regras de risco** (`questionnaire.ts`, `risk.ts`): fatores negativos (Demandas,
  Relacionamentos) × positivos (demais). Média do fator → Alto/Moderado/Baixo e contagem de
  respostas críticas (4–5 nos negativos, 1–2 nos positivos). `risk.ts` fecha as lacunas
  contínuas das faixas inteiras do PDF pelo inteiro mais próximo (Alto ≥ 3,5 no índice de risco).
  Escala 1–5 (a tabela 0–4 do PDF da matriz contradiz o próprio questionário e foi descartada).
- **Análise pura** (`analytics.ts`) → `GET /api/hse/dashboard` → página cliente
  (`src/components/dashboard/`) com auto-refresh de 30 s.
- Cores: variáveis CSS em `globals.css` (claro/escuro pelo SO); risco = status good/warning/critical
  sempre com ícone + rótulo.

## Git workflow

`main` e `develop` são as únicas branches de longa duração. Toda alteração (feature, fix, chore)
ganha branch própria a partir de `develop`, nomeada `FIX/<o-que-faz-em-ingles>` (kebab-case,
prefixo `FIX/` fixo para tudo), e sobe como PR **para `develop`** (`gh pr create --base develop`;
corpo com seção `## Summary`). Nunca commitar direto em `develop`/`main`. Depois de mergeada,
`develop` é promovida a `main` por um PR próprio (`--base main`), como passo deliberado à parte.
O PR não é mergeado automaticamente.

## Pendências conhecidas

- **Sem autenticação** na dashboard (os dados são agregados/anônimos, mas é saúde ocupacional).
  Os apps irmãos usam `?sasi-token=` validado em `AUTH_USER_ENDPOINT` — portar quando decidido.
- Nomes reais dos campos do formulário SASI ainda não conferidos contra um payload real.
