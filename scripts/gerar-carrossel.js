#!/usr/bin/env node
/**
 * CineCrítica BR — gerar-carrossel.js
 * Reads a slides.json from a post directory and generates one PNG per slide.
 *
 * Usage:
 *   node scripts/gerar-carrossel.js conteudo/posts/01-super-xuxa/
 *
 * The post directory must contain a slides.json with this structure:
 * {
 *   "titulo_filme": "Super Xuxa contra o Baixo Astral",
 *   "ano": "1988",
 *   "slides": [
 *     { "tipo": "capa",      "hook": "..." },
 *     { "tipo": "conteudo",  "numero": "01/05", "corpo": "..." },
 *     { "tipo": "citacao",   "citacao": "...", "fonte": "..." },
 *     { "tipo": "fechamento","frase": "..." }
 *   ]
 * }
 *
 * Output: numbered PNGs (slide-01.png, slide-02.png, ...) inside the post dir.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { paths } = require('./utils/config');
const { gerarImagem } = require('./gerar-imagem');

// Map slide "tipo" to the template file within templates/carrossel/
const TEMPLATE_MAP = {
  capa:       'carrossel/capa',
  conteudo:   'carrossel/conteudo',
  citacao:    'carrossel/citacao',
  fechamento: 'carrossel/fechamento',
};

async function main() {
  const postDirArg = process.argv[2];

  if (!postDirArg) {
    console.error(
      'Uso: node scripts/gerar-carrossel.js <diretório-do-post>\n' +
      'Ex:  node scripts/gerar-carrossel.js conteudo/posts/01-super-xuxa/'
    );
    process.exit(1);
  }

  // Resolve post directory
  const postDir = path.isAbsolute(postDirArg)
    ? postDirArg
    : path.resolve(process.cwd(), postDirArg);

  const slidesFile = path.join(postDir, 'slides.json');

  if (!fs.existsSync(slidesFile)) {
    console.error(`Arquivo não encontrado: ${slidesFile}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(slidesFile, 'utf-8'));

  if (!Array.isArray(data.slides) || data.slides.length === 0) {
    console.error('O arquivo slides.json deve conter um array "slides" com pelo menos um item.');
    process.exit(1);
  }

  // Ensure output directory exists
  fs.mkdirSync(postDir, { recursive: true });

  // Share a single browser across all slides for speed
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const total = data.slides.length;

    for (let i = 0; i < total; i++) {
      const slide = data.slides[i];
      const tipo = slide.tipo;

      if (!tipo || !TEMPLATE_MAP[tipo]) {
        console.warn(
          `Slide ${i + 1}: tipo "${tipo}" desconhecido. Tipos válidos: ${Object.keys(TEMPLATE_MAP).join(', ')}. Pulando.`
        );
        continue;
      }

      const template = TEMPLATE_MAP[tipo];
      const num = String(i + 1).padStart(2, '0');
      const outputFile = path.join(postDir, `slide-${num}.png`);

      const outputPath = await gerarImagem({
        template,
        data: slidesFile,
        slide: i,
        output: outputFile,
        browser,
      });

      console.log(`[${num}/${String(total).padStart(2, '0')}] ${tipo} -> ${outputPath}`);
    }

    console.log(`\nCarrossel gerado com ${total} slide(s) em ${postDir}`);
  } finally {
    await browser.close();
  }
}

main();
