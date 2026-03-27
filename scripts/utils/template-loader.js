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
 * Inline all <link rel="stylesheet"> tags by replacing them with <style>
 * blocks containing the actual CSS content. This is necessary because
 * Puppeteer's setContent() uses about:blank as base URL, so relative
 * file:// links don't resolve.
 *
 * Also resolves url() references inside the inlined CSS to absolute paths.
 */
function inlineStylesheets(html, templateDir) {
  return html.replace(
    /<link\s+rel=["']stylesheet["']\s+href=["']([^"']+)["']\s*\/?>/gi,
    (match, href) => {
      // Skip external URLs
      if (/^https?:\/\//.test(href)) return match;

      const cssPath = path.resolve(templateDir, href);
      if (!fs.existsSync(cssPath)) {
        console.warn(`CSS file not found, skipping: ${cssPath}`);
        return '';
      }
      let css = fs.readFileSync(cssPath, 'utf-8');
      const cssDir = path.dirname(cssPath);

      // Remove @import url('https://...') lines (no network in Puppeteer)
      css = css.replace(/@import\s+url\([^)]+\)\s*;/g, '');

      // Resolve url() references inside the CSS to absolute file:// paths
      css = css.replace(
        /url\(["']?(?!https?:\/\/|data:|#)([^"')]+)["']?\)/g,
        (m, relPath) => {
          const absPath = path.resolve(cssDir, relPath);
          return `url("file://${absPath}")`;
        }
      );

      // Recursively inline any @import for local CSS files
      css = css.replace(
        /@import\s+["']([^"']+)["']\s*;/g,
        (m, importPath) => {
          const importAbsPath = path.resolve(cssDir, importPath);
          if (fs.existsSync(importAbsPath)) {
            return fs.readFileSync(importAbsPath, 'utf-8');
          }
          return '';
        }
      );

      return `<style>\n${css}\n</style>`;
    }
  );
}

/**
 * Convert remaining relative src="..." references to absolute file:// URLs.
 */
function resolveRelativePaths(html, templateDir) {
  html = html.replace(
    /src=["'](?!https?:\/\/|data:|file:\/\/|#)([^"']+)["']/g,
    (match, relPath) => {
      const absPath = path.resolve(templateDir, relPath);
      return `src="file://${absPath}"`;
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

  // --- Inline CSS <link> tags and resolve remaining paths ---
  let result = inlineStylesheets(rendered, templateDir);
  result = resolveRelativePaths(result, templateDir);
  return result;
}

module.exports = { loadTemplate };
