# CineCritica BR

**Cinema brasileiro. Critica. Sem neutralidade.**

Handle: `@cinecriticabr`

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
```

## Gerar imagens de um post

```bash
# Gerar todos os slides de um carrossel
node scripts/gerar-carrossel.js conteudo/posts/01-super-xuxa/

# Gerar um slide especifico
node scripts/gerar-imagem.js --template carrossel/capa --data conteudo/posts/01-super-xuxa/slides.json --slide 0
```

## Estrutura

```
identidade/     Guia visual, tom de voz, logos
templates/      HTML/CSS dos templates visuais + fontes
conteudo/       Corpus de referencia + posts + roteiros de Reels
calendario/     Calendario editorial (8 semanas)
estrategia/     Crescimento organico, trafego pago, metricas
scripts/        Automacao (geracao de imagens, dashboard)
assets/         Imagens exportadas (gitignored)
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
