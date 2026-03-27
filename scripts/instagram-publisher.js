#!/usr/bin/env node
/**
 * CineCrítica BR — Instagram Publisher
 *
 * Publica carrosséis no Instagram via Graph API.
 * Requer:
 *   - INSTAGRAM_ACCESS_TOKEN (long-lived token)
 *   - INSTAGRAM_ACCOUNT_ID (business account ID)
 *
 * Uso:
 *   node scripts/instagram-publisher.js conteudo/posts/01-super-xuxa/
 *
 * O script:
 *   1. Lê slides.json e legenda.md do diretório do post
 *   2. Faz upload de cada slide como imagem
 *   3. Cria o carrossel no Instagram
 *   4. Publica
 *
 * Para obter o token:
 *   1. Criar app em developers.facebook.com
 *   2. Conectar conta Instagram Business
 *   3. Gerar token de longa duração (60 dias)
 *   4. Salvar em .env como INSTAGRAM_ACCESS_TOKEN
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ENV_PATH = path.resolve(__dirname, '..', '.env');

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const env = {};
  fs.readFileSync(ENV_PATH, 'utf-8')
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .forEach(line => {
      const [key, ...rest] = line.split('=');
      env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    });
  return env;
}

const env = loadEnv();
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || env.INSTAGRAM_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID || env.INSTAGRAM_ACCOUNT_ID;
const GRAPH_API = 'https://graph.facebook.com/v21.0';

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function request(url, method = 'GET', postData = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const transport = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {},
    };

    if (postData) {
      const body = JSON.stringify(postData);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

function graphGet(endpoint, params = {}) {
  const url = new URL(`${GRAPH_API}${endpoint}`);
  url.searchParams.set('access_token', ACCESS_TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return request(url.toString());
}

function graphPost(endpoint, params = {}) {
  const url = new URL(`${GRAPH_API}${endpoint}`);
  url.searchParams.set('access_token', ACCESS_TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return request(url.toString(), 'POST');
}

// ---------------------------------------------------------------------------
// Image hosting (local HTTP server to serve images to Graph API)
// ---------------------------------------------------------------------------
let localServer = null;
let localPort = 0;

function startLocalServer(postDir) {
  return new Promise((resolve) => {
    localServer = http.createServer((req, res) => {
      const filePath = path.join(postDir, decodeURIComponent(req.url.slice(1)));
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    localServer.listen(0, () => {
      localPort = localServer.address().port;
      resolve(localPort);
    });
  });
}

function stopLocalServer() {
  if (localServer) localServer.close();
}

// ---------------------------------------------------------------------------
// Image upload via public URL (requires images to be publicly accessible)
// For local development, use a tunnel (ngrok) or upload to a hosting service
// ---------------------------------------------------------------------------

/**
 * Upload images to a free image hosting service (imgbb) for Graph API access.
 * If IMGBB_API_KEY is set, uses imgbb. Otherwise falls back to requiring
 * PUBLIC_URL env var pointing to where images are hosted.
 */
async function getPublicImageUrl(postDir, filename) {
  const IMGBB_KEY = process.env.IMGBB_API_KEY || env.IMGBB_API_KEY;
  const PUBLIC_URL = process.env.PUBLIC_URL || env.PUBLIC_URL;

  if (IMGBB_KEY) {
    // Upload to imgbb (free image hosting)
    const filePath = path.join(postDir, filename);
    const base64 = fs.readFileSync(filePath).toString('base64');

    const formData = `key=${IMGBB_KEY}&image=${encodeURIComponent(base64)}&name=${path.basename(filename, '.png')}`;

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.imgbb.com',
        path: '/1/upload',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(formData),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.data && parsed.data.url) {
              resolve(parsed.data.url);
            } else {
              reject(new Error(`imgbb upload failed: ${data}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.write(formData);
      req.end();
    });
  }

  if (PUBLIC_URL) {
    return `${PUBLIC_URL}/${filename}`;
  }

  // Fallback: use GitHub raw URL if images are committed
  const GITHUB_RAW = process.env.GITHUB_RAW_BASE || env.GITHUB_RAW_BASE;
  if (GITHUB_RAW) {
    return `${GITHUB_RAW}/${filename}`;
  }

  throw new Error(
    'Nenhum método de hospedagem de imagens configurado.\n' +
    'Configure uma das opções no .env:\n' +
    '  IMGBB_API_KEY=<chave da api imgbb.com (grátis)>\n' +
    '  PUBLIC_URL=<URL pública onde os slides estão hospedados>\n' +
    '  GITHUB_RAW_BASE=<URL raw do GitHub para os slides>'
  );
}

// ---------------------------------------------------------------------------
// Instagram API operations
// ---------------------------------------------------------------------------

/**
 * Create a single image container (for carousel items)
 */
async function createImageContainer(imageUrl, isCarouselItem = true) {
  const params = {
    image_url: imageUrl,
    is_carousel_item: isCarouselItem.toString(),
  };

  const res = await graphPost(`/${ACCOUNT_ID}/media`, params);
  if (res.data.error) {
    throw new Error(`Erro ao criar container de imagem: ${JSON.stringify(res.data.error)}`);
  }
  return res.data.id;
}

/**
 * Create and publish a carousel post
 */
async function publishCarousel(containerIds, caption) {
  // Step 1: Create carousel container
  const carouselRes = await graphPost(`/${ACCOUNT_ID}/media`, {
    media_type: 'CAROUSEL',
    children: containerIds.join(','),
    caption,
  });

  if (carouselRes.data.error) {
    throw new Error(`Erro ao criar carrossel: ${JSON.stringify(carouselRes.data.error)}`);
  }

  const carouselId = carouselRes.data.id;
  console.log(`Carrossel criado (ID: ${carouselId}). Aguardando processamento...`);

  // Step 2: Wait for processing
  await waitForProcessing(carouselId);

  // Step 3: Publish
  const publishRes = await graphPost(`/${ACCOUNT_ID}/media_publish`, {
    creation_id: carouselId,
  });

  if (publishRes.data.error) {
    throw new Error(`Erro ao publicar: ${JSON.stringify(publishRes.data.error)}`);
  }

  return publishRes.data.id;
}

/**
 * Wait for media container to finish processing
 */
async function waitForProcessing(containerId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await graphGet(`/${containerId}`, { fields: 'status_code,status' });

    if (res.data.status_code === 'FINISHED') {
      return;
    }

    if (res.data.status_code === 'ERROR') {
      throw new Error(`Processamento falhou: ${res.data.status}`);
    }

    console.log(`  Processando... (${i + 1}/${maxAttempts})`);
    await new Promise(r => setTimeout(r, 2000));
  }

  throw new Error('Timeout esperando processamento do Instagram');
}

// ---------------------------------------------------------------------------
// Read post data
// ---------------------------------------------------------------------------
function readPostData(postDir) {
  const absDir = path.resolve(process.cwd(), postDir);

  // Read caption
  const legendaPath = path.join(absDir, 'legenda.md');
  if (!fs.existsSync(legendaPath)) {
    throw new Error(`Legenda não encontrada: ${legendaPath}`);
  }
  let caption = fs.readFileSync(legendaPath, 'utf-8');
  // Remove markdown title
  caption = caption.replace(/^#\s+.*\n+/, '').trim();

  // Find slide PNGs
  const slides = fs.readdirSync(absDir)
    .filter(f => /^slide-\d+\.png$/.test(f))
    .sort();

  if (slides.length === 0) {
    throw new Error(`Nenhum slide PNG encontrado em ${absDir}`);
  }

  return { absDir, caption, slides };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const postDir = process.argv[2];

  if (!postDir) {
    console.error('Uso: node scripts/instagram-publisher.js <diretório-do-post>');
    console.error('Ex:  node scripts/instagram-publisher.js conteudo/posts/01-super-xuxa/');
    process.exit(1);
  }

  if (!ACCESS_TOKEN || !ACCOUNT_ID) {
    console.error('='.repeat(60));
    console.error('CONFIGURAÇÃO NECESSÁRIA');
    console.error('='.repeat(60));
    console.error('');
    console.error('Crie o arquivo .env na raiz do projeto com:');
    console.error('');
    console.error('  INSTAGRAM_ACCESS_TOKEN=<seu-token>');
    console.error('  INSTAGRAM_ACCOUNT_ID=<seu-account-id>');
    console.error('  IMGBB_API_KEY=<chave-imgbb-gratis>');
    console.error('');
    console.error('Para obter o token do Instagram:');
    console.error('  1. Acesse developers.facebook.com');
    console.error('  2. Crie um app do tipo "Business"');
    console.error('  3. Adicione o produto "Instagram Graph API"');
    console.error('  4. Conecte sua conta Instagram Business/Creator');
    console.error('  5. Gere um token de longa duração (Graph API Explorer)');
    console.error('');
    console.error('Para o IMGBB_API_KEY (hospedagem de imagens grátis):');
    console.error('  1. Acesse api.imgbb.com');
    console.error('  2. Crie uma conta grátis');
    console.error('  3. Copie sua API key');
    console.error('');
    process.exit(1);
  }

  try {
    const { absDir, caption, slides } = readPostData(postDir);
    console.log(`\nPublicando: ${path.basename(postDir)}`);
    console.log(`Slides: ${slides.length}`);
    console.log(`Legenda: ${caption.substring(0, 80)}...`);
    console.log('');

    // Upload each slide
    const containerIds = [];
    for (let i = 0; i < slides.length; i++) {
      const filename = slides[i];
      console.log(`[${i + 1}/${slides.length}] Enviando ${filename}...`);

      const imageUrl = await getPublicImageUrl(absDir, filename);
      const containerId = await createImageContainer(imageUrl);
      containerIds.push(containerId);

      // Wait for individual container processing
      await waitForProcessing(containerId);
      console.log(`  ✓ ${filename} pronto`);
    }

    // Publish carousel
    console.log('\nPublicando carrossel...');
    const postId = await publishCarousel(containerIds, caption);
    console.log(`\n✓ PUBLICADO com sucesso!`);
    console.log(`  Post ID: ${postId}`);
    console.log(`  Perfil: instagram.com/cinecriticabrasil`);

  } catch (err) {
    console.error(`\nErro: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { publishCarousel, createImageContainer, getPublicImageUrl, readPostData };
