#!/usr/bin/env node
/**
 * CineCrítica BR — gerar-imagem.js
 * Renders a single template + data into a PNG using Puppeteer.
 *
 * Usage:
 *   node scripts/gerar-imagem.js \
 *     --template carrossel/capa \
 *     --data conteudo/posts/01-super-xuxa/slides.json \
 *     --slide 0 \
 *     --output path/to/output.png
 *
 * --template  Template id (e.g. "carrossel/capa") or path to .html
 * --data      Path to JSON data file
 * --slide     (optional) Index into the "slides" array inside the JSON
 * --output    (optional) Output PNG path. Defaults to assets/export/<template>.png
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { dimensions, paths, dimensionKeyForTemplate } = require('./utils/config');
const { loadTemplate } = require('./utils/template-loader');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith('--') && i + 1 < argv.length) {
      args[key.slice(2)] = argv[++i];
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Core image generation (exported so gerar-carrossel can reuse it)
// ---------------------------------------------------------------------------

/**
 * Generate a PNG from a template + data.
 *
 * @param {object}  opts
 * @param {string}  opts.template    Template id or path
 * @param {object|string} opts.data  Data object or path to JSON
 * @param {number}  [opts.slide]     Slide index
 * @param {string}  [opts.output]    Output file path
 * @param {import('puppeteer').Browser} [opts.browser]  Reusable browser instance
 * @returns {Promise<string>} Path to the generated PNG
 */
async function gerarImagem({ template, data, slide, output, browser }) {
  // Determine dimensions
  const dimKey = dimensionKeyForTemplate(template);
  const { width, height } = dimensions[dimKey];

  // Render template
  const slideIndex = slide !== undefined && slide !== null
    ? parseInt(slide, 10)
    : undefined;
  const html = loadTemplate(template, data, slideIndex);

  // Determine output path
  if (!output) {
    const safeName = template.replace(/\//g, '-');
    const suffix = slideIndex !== undefined ? `-${slideIndex}` : '';
    output = path.join(paths.export, `${safeName}${suffix}.png`);
  }
  if (!path.isAbsolute(output)) {
    output = path.resolve(process.cwd(), output);
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(output), { recursive: true });

  // Launch browser (or reuse provided one)
  const ownBrowser = !browser;
  if (ownBrowser) {
    const launchOpts = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    };
    // Use custom executable if set; otherwise let Puppeteer find its own
    const customExec = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (customExec) {
      launchOpts.executablePath = customExec;
    } else {
      // Fallback: check common locations
      const fs_ = require('fs');
      const candidates = [
        '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome-stable',
      ];
      for (const c of candidates) {
        if (fs_.existsSync(c)) { launchOpts.executablePath = c; break; }
      }
    }
    browser = await puppeteer.launch(launchOpts);
  }

  try {
    const page = await browser.newPage();

    await page.setViewport({
      width,
      height,
      deviceScaleFactor: 1,
    });

    // Load HTML with file:// access so fonts/CSS resolve
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });

    // Allow local file access for fonts
    await page.evaluateHandle('document.fonts.ready');

    await page.screenshot({
      path: output,
      type: 'png',
      clip: { x: 0, y: 0, width, height },
    });

    await page.close();
  } finally {
    if (ownBrowser) {
      await browser.close();
    }
  }

  return output;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv);

  if (!args.template || !args.data) {
    console.error(
      'Uso: node scripts/gerar-imagem.js --template <template> --data <json> [--slide N] [--output path.png]'
    );
    process.exit(1);
  }

  try {
    const outputPath = await gerarImagem({
      template: args.template,
      data: args.data,
      slide: args.slide,
      output: args.output,
    });
    console.log(`Imagem gerada: ${outputPath}`);
  } catch (err) {
    console.error('Erro ao gerar imagem:', err.message);
    process.exit(1);
  }
}

// Run only when executed directly
if (require.main === module) {
  main();
}

module.exports = { gerarImagem };
