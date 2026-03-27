# CineCritica BR

**Cinema brasileiro. Critica. Sem neutralidade.**

Handle: `@cinecriticabrasil`

---

## O que e este repositorio

Sistema editorial completo para o perfil de Instagram **CineCritica BR**. Inclui:

- **Identidade visual** codificada em CSS (preto/branco/ouro, Playfair Display + Barlow Condensed)
- **Templates HTML** para carrossel, imagem unica, stories e foto de perfil -- exportaveis como PNG via Puppeteer
- **Conteudo editorial** organizado por filme (posts, legendas, roteiros de Reels)
- **Calendario editorial** de 8 semanas com 10 filmes
- **Estrategia** de crescimento organico + trafego pago + metricas
- **Scripts Node.js** para geracao automatizada de imagens

## Setup

```bash
npm install
cp .env.example .env
# Preencha .env com suas credenciais (veja instruções abaixo)
```

## Publicação automática

O sistema publica automaticamente 3x/semana (terça, quinta, sábado às 18h BRT).

### Opção 1: GitHub Actions (recomendado)

1. Configure os secrets no GitHub:
   - `INSTAGRAM_ACCESS_TOKEN`
   - `INSTAGRAM_ACCOUNT_ID`
   - `IMGBB_API_KEY`
2. O workflow `.github/workflows/publish.yml` roda automaticamente

### Opção 2: Cron local

```bash
bash scripts/setup-cron.sh
```

### Comandos manuais

```bash
# Ver agenda completa
node scripts/scheduler.js --status

# Publicar próximo post da fila
node scripts/scheduler.js --next

# Verificar se há post para hoje e publicar
node scripts/scheduler.js --run

# Gerar slides do próximo post pendente
node scripts/scheduler.js --generate
```

## Gerar imagens de um post

```bash
# Gerar todos os slides de um carrossel
node scripts/gerar-carrossel.js conteudo/posts/01-super-xuxa/

# Gerar um slide específico
node scripts/gerar-imagem.js --template carrossel/capa --data conteudo/posts/01-super-xuxa/slides.json --slide 0
```

## Configuração do Instagram

Para publicar via API, você precisa:

1. **Conta Instagram Business/Creator** conectada a uma Página do Facebook
2. **App no Meta for Developers** (developers.facebook.com) com produto "Instagram Graph API"
3. **Token de longa duração** (60 dias) gerado via Graph API Explorer
4. **IMGBB API key** (grátis em api.imgbb.com) para hospedagem temporária das imagens

Detalhes completos em `.env.example`.

## Estrutura

```
identidade/     Guia visual, tom de voz, logos
templates/      HTML/CSS dos templates visuais + fontes
conteudo/       Corpus de referência + posts + roteiros de Reels
calendario/     Calendário editorial (8 semanas)
estrategia/     Crescimento orgânico, tráfego pago, métricas
scripts/        Automação (geração de imagens, publicação, agendamento)
assets/         Imagens exportadas (gitignored)
schedule.json   Fila de publicação com status de cada post
```

## Paleta

| Cor | Hex | Uso |
|-----|-----|-----|
| Preto | `#000000` | Fundo dominante |
| Branco | `#FFFFFF` | Texto sobre preto |
| Ouro | `#C9A84C` | Acento (titulos, destaques, logo) |

## Tipografia

- **Titulos**: Playfair Display (serif)
- **Corpo**: Barlow Condensed (sans-serif)
