# HSE IT — Dashboard de Riscos Psicossociais

Painel responsivo (claro/escuro) que mostra os resultados do questionário **HSE IT** (Management
Standards Indicator Tool) da CGC: perfil de risco por fator, respostas favoráveis × críticas,
evolução no tempo, mapa de calor setor × fator, afirmativas mais críticas e plano de ação.

As respostas chegam **somente** por um webhook, conectado à API da SASI.

## Webhook

```
POST https://<host>/api/hse/webhook?secret=<HSE_WEBHOOK_SECRET>
```

Também aceita o segredo no header `x-webhook-secret`. Evento esperado: `io.sasi.message` com a
mensagem (e seus `dataFields`) em `data`. Variáveis em [.env.example](.env.example).

## Rodando (Docker)

```bash
docker compose --profile prod up --build -d     # http://localhost:3002
docker run --rm hseit-check npx tsx scripts/simulate-webhook.ts \
  --url http://host.docker.internal:3002 --secret segredo-local-de-teste
docker compose --profile check run --rm check   # typecheck + lint + testes
```

Detalhes de arquitetura e regras de classificação em [CLAUDE.md](CLAUDE.md).
