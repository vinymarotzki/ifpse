# IFPSE — Dashboard de Riscos Psicossociais

Painel responsivo que mostra os resultados do questionário do IFPSE, baseado no Management
Standards Indicator Tool, da CGC. É uma ferramenta de **triagem**, não de diagnóstico: uma
resposta crítica isolada não classifica risco alto; a CIPA valida recorrência, outros respondentes
e a relação com a segurança escolar.

**Produção:** https://ifpse.vercel.app

## O que a página mostra

- Indicadores gerais: respondentes, índice geral de risco e quantos dos 7 fatores estão em risco Alto.
- Perfil de risco (radar) e as afirmativas mais críticas.
- Um cartão por fator (Demandas, Relacionamentos, Controle, Apoio da Chefia, Apoio dos Colegas,
  Cargo, Comunicação e Mudanças), com índice, nível e proporção de respostas críticas.
- Evolução no tempo (a partir de 3 pontos) e mapa de calor setor × fator (a partir de 2 setores).
- Plano de ação com as medidas sugeridas para os fatores Moderado e Alto.
- "Como ler esta dashboard": escala, classificação e respostas críticas (recolhido por padrão).
- Filtros por setor e período (30 dias, 90 dias, este ano ou datas personalizadas).

**Idioma e tema:** o cabeçalho tem os botões PT/EN e automático/claro/escuro. A escolha fica salva
no navegador. A tradução vale só para a apresentação (textos, fatores, ações, metodologia, as 15
afirmativas do questionário escolar, números e datas); servidor e banco continuam em português.

## Como o risco é calculado

- Escala de resposta: Nunca = 1, Raramente = 2, Às vezes = 3, Frequentemente = 4, Sempre = 5.
- **N/A ("Não tenho elementos para avaliar") não entra no cálculo.**
- O sentido é da afirmativa: nas negativas vale a própria resposta; nas positivas a escala é
  invertida. O resultado é a **nota de risco** (1–5, maior = pior).
- A média das notas do fator é o **índice de risco**: Alto a partir de 3,5, Moderado a partir de
  2,5, Baixo abaixo disso.
- Resposta crítica = nota de risco 4 ou 5.
- Questionário do canal (`escola15`, 15 afirmativas de segurança escolar/CIPA Escolar): as
  afirmativas 2 e 4 são negativas (críticas em 4–5); as outras 13 são críticas em 1–2.
- Mensagens com menos de 10 respostas válidas (`HSE_MIN_ANSWERS`) são descartadas.

## Webhook

As respostas chegam **somente** por um webhook, conectado à API da SASI:

```
POST https://<host>/api/hse/webhook?secret=<HSE_WEBHOOK_SECRET>
```

Também aceita o segredo no header `x-webhook-secret`. Evento esperado: `io.sasi.message` com a
mensagem (e seus `dataFields`) em `data`. Variáveis em [.env.example](.env.example).

Em produção (Vercel): `https://ifpse.vercel.app/api/hse/webhook?secret=<HSE_WEBHOOK_SECRET>`.

### Webhook de teste

Para conferir o formato de um canal novo antes de gravar dados:

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

Os binários nativos não rodam no host desta máquina, então tudo roda em container:

```bash
docker compose --profile check run --rm check   # typecheck + lint + testes
docker compose --profile prod up --build -d     # http://localhost:3002
docker compose --profile dev up --build         # com hot-reload
docker run --rm ifpse-check npx tsx scripts/simulate-webhook.ts \
  --url http://host.docker.internal:3002 --secret segredo-local-de-teste --count 150
docker compose --profile prod down -v           # derruba e apaga o banco de teste
```

Sem `TURSO_DATABASE_URL`, o app usa um arquivo local `./data/ifpse.db` (volume no Docker).

## Deploy

Vercel, projeto `ifpse`, ligado ao repositório: push em `main` publica em produção. O banco é um
Turso (`ifpse`) injetado pelo Vercel. Segredos e cuidados em [CLAUDE.md](CLAUDE.md).

## Fluxo de trabalho

`main` e `develop` são as únicas branches de longa duração. Toda alteração sai de `develop` em uma
branch `FIX/<o-que-faz>` e sobe por PR para `develop`; `develop` vai para `main` por PR próprio.
**Só o dono do repositório aprova o que sobe para `main`.**

## Mais detalhes

Arquitetura, regras de classificação, formato real do canal e pendências conhecidas em
[CLAUDE.md](CLAUDE.md).
