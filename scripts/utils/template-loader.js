/**
 * CineCrítica BR — Template Loader
 * Reads an HTML template, reads a JSON data file, renders Mustache variables,
 * and resolves relative CSS / font paths to absolute file:// URLs so
 * Puppeteer can load everything correctly.
 */

const fs = require('fs');
const path = require('path');
const Mustache = require('mustache');
const { paths } = require('./config');

/**
 * Convert relative href/src references in HTML to absolute file:// URLs
 * based on the directory that contains the template file.
 *
 * Handles:
 *   href="..."  /  src="..."
 *   url('...')   inside inline CSS or <style> blocks
 */
function resolveRelativePaths(html, templateDir) {
  // Resolve href="..." and src="..." attributes
  html = html.replace(
    /(href|src)=["'](?!https?:\/\/|data:|#)([^"']+)["']/g,
    (match, attr, relPath) => {
      const absPath = path.resolve(templateDir, relPath);
      return `${attr}="file://${absPath}"`;
    }
  );

  // Resolve url('...') references (CSS @font-face, background-image, etc.)
  html = html.replace(
    /url\(["']?(?!https?:\/\/|data:)([^"')]+)["']?\)/g,
    (match, relPath) => {
      const absPath = path.resolve(templateDir, relPath);
      return `url("file://${absPath}")`;
    }
  );

  return html;
}

/**
 * Load and render a template.
 *
 * @param {string} templatePath  Relative template id (e.g. "carrossel/capa")
 *                               or absolute path to the .html file.
 * @param {object|string} data   Either a data object or a path to a JSON file.
 *                               When a JSON file path is given and the data
 *                               contains a "slides" array, you can pass
 *                               slideIndex to pick a single slide.
 * @param {number} [slideIndex]  Optional index into a "slides" array.
 * @returns {string}             Fully rendered HTML string with absolute paths.
 */
function loadTemplate(templatePath, data, slideIndex) {
  // --- Resolve template file path ---
  let templateFile = templatePath;
  if (!path.isAbsolute(templateFile)) {
    templateFile = path.join(paths.templates, templateFile);
  }
  if (!templateFile.endsWith('.html')) {
    templateFile += '.html';
  }

  if (!fs.existsSync(templateFile)) {
    throw new Error(`Template not found: ${templateFile}`);
  }

  const templateDir = path.dirname(templateFile);
  const rawHtml = fs.readFileSync(templateFile, 'utf-8');

  // --- Resolve data ---
  let viewData = data;
  if (typeof data === 'string') {
    const dataFile = path.isAbsolute(data)
      ? data
      : path.resolve(process.cwd(), data);

    if (!fs.existsSync(dataFile)) {
      throw new Error(`Data file not found: ${dataFile}`);
    }
    viewData = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  }

  // If the data has a slides array and an index was requested, pick the slide.
  if (
    viewData &&
    Array.isArray(viewData.slides) &&
    slideIndex !== undefined &&
    slideIndex !== null
  ) {
    // Merge top-level fields (titulo_filme, ano, etc.) with slide-specific data
    const { slides, ...topLevel } = viewData;
    viewData = { ...topLevel, ...slides[slideIndex] };
  }

  // --- Render ---
  const rendered = Mustache.render(rawHtml, viewData || {});

  // --- Make all relative paths absolute so Puppeteer can find them ---
  return resolveRelativePaths(rendered, templateDir);
}

module.exports = { loadTemplate };
