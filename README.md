# IFPSE — Dashboard de Riscos Psicossociais

Painel responsivo (claro/escuro) que mostra os resultados do questionário do IFPSE, baseado no Management Standards Indicator Tool, da CGC: perfil de risco por fator, respostas favoráveis × críticas,
evolução no tempo, mapa de calor setor × fator, afirmativas mais críticas e plano de ação.

As respostas chegam **somente** por um webhook, conectado à API da SASI.

## Webhook

```
POST https://<host>/api/hse/webhook?secret=<HSE_WEBHOOK_SECRET>
```

Também aceita o segredo no header `x-webhook-secret`. Evento esperado: `io.sasi.message` com a
mensagem (e seus `dataFields`) em `data`. Variáveis em [.env.example](.env.example).

Em produção (Vercel): `https://ifpse.vercel.app/api/hse/webhook?secret=<HSE_WEBHOOK_SECRET>`.

## Webhook de teste (primeiro payload)

Para o canal de teste da SASI, que ainda não tem formato conhecido:

```
POST https://<host>/api/hse/webhook-test?secret=<HSE_TEST_WEBHOOK_SECRET>
GET  https://<host>/api/hse/webhook-test/captures?secret=<HSE_TEST_WEBHOOK_SECRET>
```

O primeiro só **captura** a chamada (mascarando credenciais, dados do remetente e o campo
Nome) e devolve um diagnóstico do mapper: quantas afirmativas reconheceu, quais faltaram e
quais campos não reconheceu. **Não grava respostas** e não alimenta a dashboard. O segundo lista
as últimas capturas, em JSON legível no navegador. Sem `HSE_TEST_WEBHOOK_SECRET`, vale o
`HSE_WEBHOOK_SECRET`.

## Rodando (Docker)

```bash
docker compose --profile prod up --build -d     # http://localhost:3002
docker run --rm ifpse-check npx tsx scripts/simulate-webhook.ts \
  --url http://host.docker.internal:3002 --secret segredo-local-de-teste
docker compose --profile check run --rm check   # typecheck + lint + testes
```

Detalhes de arquitetura e regras de classificação em [CLAUDE.md](CLAUDE.md).
