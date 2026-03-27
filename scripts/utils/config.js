/**
 * CineCrítica BR — Shared configuration
 * Dimensions, paths, and template-type mappings.
 */

const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const dimensions = {
  carrossel: { width: 1080, height: 1350 },
  feed:      { width: 1080, height: 1080 },
  story:     { width: 1080, height: 1920 },
  perfil:    { width:  400, height:  400 },
};

const paths = {
  root:      ROOT,
  templates: path.join(ROOT, 'templates'),
  content:   path.join(ROOT, 'conteudo'),
  export:    path.join(ROOT, 'assets', 'export'),
  fonts:     path.join(ROOT, 'templates', 'fonts'),
};

/**
 * Determine the dimension key for a given template path.
 * E.g. "carrossel/capa" -> "carrossel", "stories/algo" -> "story".
 */
function dimensionKeyForTemplate(templatePath) {
  const first = templatePath.split('/')[0];

  const mapping = {
    carrossel:     'carrossel',
    'imagem-unica': 'feed',
    feed:          'feed',
    stories:       'story',
    story:         'story',
    perfil:        'perfil',
  };

  return mapping[first] || 'feed';
}

module.exports = {
  dimensions,
  paths,
  dimensionKeyForTemplate,
};
