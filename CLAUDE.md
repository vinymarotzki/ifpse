# CLAUDE.md

**IFPSE** — dashboard dos riscos psicossociais da CGC, baseada no Management Standards Indicator Tool: 7 fatores; o questionário real do canal tem 15 afirmativas (ver "Dois questionários").
Nome do sistema nas plataformas: repo GitHub `vinymarotzki/ifpse`, projeto Vercel `ifpse`, banco
Turso `ifpse`, app SASI "IFPSE" (id 2644). A pasta local ainda se chama "HSE IT" (o dono renomeia).
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
docker run --rm ifpse-check npx tsx scripts/simulate-webhook.ts \
  --url http://host.docker.internal:3002 --secret segredo-local-de-teste --count 150
docker compose --profile prod down -v                   # derruba e apaga o banco de teste
```

(`ifpse-check` é a imagem do target `check`; rebuild com `docker compose --profile check build check`.)
Para regenerar o lockfile sem executar binários: `npm install --package-lock-only --ignore-scripts`.

## Arquitetura

- **Entrada de dados: um único webhook** `POST|GET /api/hse/webhook`
  (`src/app/api/hse/webhook/route.ts`), cadastrado no painel/API da SASI. Mesmo padrão do
  `cgc-atividades`: evento `io.sasi.message` com a mensagem em `data`; segredo
  `HSE_WEBHOOK_SECRET` no header `x-webhook-secret` ou `?secret=`; sem a env var, tudo é 401.
  Eventos que não são do IFPSE respondem 200 `ignored` (a SASI não deve reenviar).
  Toda chamada vai para `hse_webhook_log` com credenciais, dados do remetente e campos de
  identificação (nome…) mascarados (`src/lib/sasi/redact.ts`); guarda as últimas 500.
- **Webhook de teste** (`src/app/api/hse/webhook-test/`): captura o payload do canal de teste
  em `hse_test_captures` (mascarado, últimas 50) e devolve `inspectMessage` — diagnóstico do
  mapper sem gravar resposta. Leitura em `.../captures?secret=`. Segredo `HSE_TEST_WEBHOOK_SECRET`
  (cai em `HSE_WEBHOOK_SECRET`). Nunca alimenta a dashboard.
- **Formato real (canal 38274, app 2644 "IFPSE", capturado em 2026-10-06):** evento
  `io.sasi.message`; cada afirmativa é um dataField `type: "radios"` com `title` = texto da
  pergunta, `name` = slug do título cortado em 50 caracteres, `value` = `"2_raramente"` e
  `formattedValue` = `"Raramente"`. **Não há campos de setor, idade nem data**: setor =
  `data.team.name` (hoje só existe o time de teste), data = `generatedAt` (fuso Campo Grande).
  `profile`/`profileFields` carregam dados pessoais e são mascarados no log.
- **Dois questionários** (`questionnaire.ts`): `escola15` (o do canal: 15 afirmativas de segurança
  escolar/CIPA Escolar) e `hse35` (questionário original de 35 afirmativas dos PDFs). Mesmos 7 fatores. O agrupamento do
  `escola15` (3-2-2-2-2-2-2, na ordem) e o sentido de cada afirmativa (só a 2 e a 4 são negativas)
  foram **inferidos do conteúdo — confirmar com a CGC**.
- **Mapper** (`src/lib/hse/mapper.ts`): acha a afirmativa pelo texto no `title`/`name`, depois
  pelo slug do `name`, e (só `hse35`) por `pergunta_N`/"N." no título. O questionário da mensagem é
  o que mais casar. Resposta aceita 1–5, rótulo, ou `"2_raramente"`. Não armazena o nome. Se o
  formato mudar, o payload cru está em `hse_webhook_log`/`hse_test_captures`.
- **Armazenamento** (`src/lib/db.ts`, `store.ts`): libSQL; sem `TURSO_DATABASE_URL` usa
  `file:./data/ifpse.db` (volume no Docker). Upsert por `message_id`. Respostas em `answers_json`.
- **Regras de risco** (`questionnaire.ts`, `risk.ts`): o sentido é da AFIRMATIVA (`highIsBad`),
  não do fator. Toda resposta vira **nota de risco** (1–5, maior = pior: `highIsBad ? nota : 6 − nota`);
  a média das notas do fator é o **índice de risco** → Alto/Moderado/Baixo; resposta crítica =
  nota de risco ≥ 4 (4–5 nas negativas, 1–2 nas de proteção, como nos PDFs). `risk.ts` fecha as
  lacunas contínuas das faixas inteiras do PDF pelo inteiro mais próximo (Alto ≥ 3,5).
  Escala 1–5 (a tabela 0–4 do PDF da matriz contradiz o próprio questionário e foi descartada).
  `hse_responses.questionnaire` guarda qual formulário gerou a linha (linhas antigas = `hse35`).
- **Análise pura** (`analytics.ts`) → `GET /api/hse/dashboard` → página cliente
  (`src/components/dashboard/`) com auto-refresh de 30 s.
- Cores: variáveis CSS em `globals.css` (claro/escuro pelo SO); risco = status good/warning/critical
  sempre com ícone + rótulo.

## Deploy (Vercel)

Projeto Vercel `ifpse` (time `vinyciosasis-projects`, hobby), conectado ao repo GitHub: push em
`main` publica em produção; outras branches geram preview (protegido por login do Vercel — a SASI
não alcança, use só a URL de produção). Produção: **https://ifpse.vercel.app** (domínio do projeto, público; o `hse-it.vercel.app` antigo
segue ativo só como transição — remover quando a SASI apontar para o novo).

- Webhook para a SASI: `https://ifpse.vercel.app/api/hse/webhook?secret=<HSE_WEBHOOK_SECRET>`;
  teste: `.../api/hse/webhook-test?secret=<HSE_TEST_WEBHOOK_SECRET>` (leitura em `.../captures`).
- Banco: Turso via marketplace (`ifpse`, plano Starter, iad1). O Vercel injeta
  `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`; sem disco persistente, o `file:` local só vale no Docker.
  Essas duas variáveis valem também para Preview — previews usam o MESMO banco de produção.
- Segredos `HSE_WEBHOOK_SECRET`/`HSE_TEST_WEBHOOK_SECRET` são `sensitive` (não voltam por
  `vercel env pull`); cópia local em `.env.vercel-secrets.local` (gitignored). Trocar:
  `vercel env rm <nome> production` + `vercel env add <nome> production --sensitive` + redeploy.
- `.vercelignore` impede subir `.env*`, `.claude`, `.agents`. Nunca deixar um `.env.local` com as
  credenciais do Turso de produção no repo: o `docker-compose` o lê e o Docker local passaria a
  escrever no banco real.
- Deploy manual: `vercel deploy --prod --yes`.

## Git workflow

`main` e `develop` são as únicas branches de longa duração. Toda alteração (feature, fix, chore)
ganha branch própria a partir de `develop`, nomeada `FIX/<o-que-faz-em-ingles>` (kebab-case,
prefixo `FIX/` fixo para tudo), e sobe como PR **para `develop`** (`gh pr create --base develop`;
corpo com seção `## Summary`). Nunca commitar direto em `develop`/`main`. Depois de mergeada,
`develop` é promovida a `main` por um PR próprio (`--base main`), como passo deliberado à parte.
O PR não é mergeado automaticamente.

**Só o dono do repositório (Vinycios) aprova o que sobe para `main`.** Ninguém mais (nem agente de
IA) faz merge em `main` nem push direto em `main` sem aprovação explícita dele para aquele merge;
aprovação anterior não vale para o próximo. Cuidado: o Vercel publica `main` em produção pelo Git,
e `vercel deploy --prod` também publica — só com ele pedindo. Abrir o PR `develop` → `main` e
avisar que está pronto é permitido; aprovar e mergear é dele.

## Pendências conhecidas

- **Sem autenticação** na dashboard (os dados são agregados/anônimos, mas é saúde ocupacional).
  Os apps irmãos usam `?sasi-token=` validado em `AUTH_USER_ENDPOINT` — portar quando decidido.
- Confirmar com a CGC: agrupamento em fatores e sentido das afirmativas do `escola15`; se "setor"
  deve ser o time da SASI (hoje só "Time de Teste"); corte Alto ≥ 3,5.
- Dados reais do canal só chegaram ao webhook de TESTE; o webhook principal ainda não foi
  cadastrado na SASI.
