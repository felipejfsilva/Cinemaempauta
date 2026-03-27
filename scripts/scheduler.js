#!/usr/bin/env node
/**
 * CineCrítica BR — Scheduler
 *
 * Gerencia a fila de publicação automática.
 * Lê o arquivo schedule.json, identifica o próximo post a publicar,
 * e executa a publicação via instagram-publisher.js.
 *
 * Uso:
 *   node scripts/scheduler.js --status       # Mostra agenda
 *   node scripts/scheduler.js --next         # Publica o próximo post da fila
 *   node scripts/scheduler.js --generate     # Gera slides do próximo post pendente
 *   node scripts/scheduler.js --run          # Verifica se há post para hoje e publica
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCHEDULE_PATH = path.join(ROOT, 'schedule.json');
const POSTS_DIR = path.join(ROOT, 'conteudo', 'posts');

// ---------------------------------------------------------------------------
// Schedule management
// ---------------------------------------------------------------------------

function loadSchedule() {
  if (!fs.existsSync(SCHEDULE_PATH)) {
    console.error('schedule.json não encontrado. Execute --init para criar.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf-8'));
}

function saveSchedule(schedule) {
  fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(schedule, null, 2), 'utf-8');
}

function initSchedule() {
  // Gera schedule com 3 posts por semana (ter/qui/sab) por 8 semanas
  const posts = [
    '01-super-xuxa',
    '02-agente-secreto',
    '03-ainda-estou-aqui',
    '04-bacurau',
    '05-cidade-de-deus',
    '06-central-station',
    '07-bandido-luz-vermelha',
    '08-terra-em-transe',
    '09-tropa-de-elite',
    '10-carandiru',
  ];

  const schedule = {
    profile: '@cinecriticabrasil',
    frequency: '3x/semana (ter/qui/sab)',
    timezone: 'America/Sao_Paulo',
    publish_time: '18:00',
    posts: [],
  };

  // Start from next Tuesday
  const now = new Date();
  let current = new Date(now);
  // Find next Tuesday (day 2)
  const dayOfWeek = current.getDay();
  const daysUntilTuesday = (2 - dayOfWeek + 7) % 7 || 7;
  current.setDate(current.getDate() + daysUntilTuesday);

  // Publishing days: Tuesday (2), Thursday (4), Saturday (6)
  const publishDays = [2, 4, 6]; // ter, qui, sab
  let postIndex = 0;
  let dayIndex = 0;

  while (postIndex < posts.length) {
    const targetDay = publishDays[dayIndex % publishDays.length];

    // Advance to target day
    while (current.getDay() !== targetDay) {
      current.setDate(current.getDate() + 1);
    }

    const dateStr = current.toISOString().split('T')[0]; // YYYY-MM-DD
    const slug = posts[postIndex];
    const postDir = path.join('conteudo', 'posts', slug);

    // Check what content exists
    const absPostDir = path.join(ROOT, postDir);
    const hasSlidesJson = fs.existsSync(path.join(absPostDir, 'slides.json'));
    const hasPngs = fs.readdirSync(absPostDir).some(f => /^slide-\d+\.png$/.test(f));
    const hasLegenda = fs.existsSync(path.join(absPostDir, 'legenda.md'));

    schedule.posts.push({
      date: dateStr,
      day: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][current.getDay()],
      slug,
      dir: postDir,
      status: 'pendente', // pendente | slides_gerados | publicado | erro
      content_ready: hasSlidesJson && hasLegenda,
      slides_generated: hasPngs,
    });

    postIndex++;
    dayIndex++;
    current.setDate(current.getDate() + 1); // Move to next day
  }

  saveSchedule(schedule);
  console.log(`Schedule criado com ${schedule.posts.length} posts.`);
  console.log(`Primeiro post: ${schedule.posts[0].date} (${schedule.posts[0].slug})`);
  console.log(`Último post: ${schedule.posts[schedule.posts.length - 1].date} (${schedule.posts[schedule.posts.length - 1].slug})`);
  return schedule;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function showStatus() {
  const schedule = loadSchedule();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`CINECRÍTICA BR — Agenda de Publicação`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Frequência: ${schedule.frequency}`);
  console.log(`Horário: ${schedule.publish_time} (${schedule.timezone})\n`);

  const today = new Date().toISOString().split('T')[0];

  schedule.posts.forEach((post, i) => {
    const isToday = post.date === today;
    const isPast = post.date < today;
    const statusIcon = {
      pendente: '○',
      slides_gerados: '◐',
      publicado: '●',
      erro: '✗',
    }[post.status] || '?';

    const todayMark = isToday ? ' ← HOJE' : '';
    const contentMark = post.content_ready ? '✓' : '✗';
    const slidesMark = post.slides_generated ? '✓' : '✗';

    console.log(
      `  ${statusIcon} ${post.date} (${post.day}) | ${post.slug.padEnd(25)} | ` +
      `conteúdo:${contentMark} slides:${slidesMark} | ${post.status}${todayMark}`
    );
  });

  const published = schedule.posts.filter(p => p.status === 'publicado').length;
  const pending = schedule.posts.filter(p => p.status === 'pendente').length;
  console.log(`\nPublicados: ${published}/${schedule.posts.length} | Pendentes: ${pending}\n`);
}

function generateNext() {
  const schedule = loadSchedule();
  const next = schedule.posts.find(
    p => p.status === 'pendente' && p.content_ready && !p.slides_generated
  );

  if (!next) {
    console.log('Nenhum post pendente com conteúdo pronto para gerar slides.');
    return;
  }

  console.log(`Gerando slides para: ${next.slug}...`);
  try {
    execSync(`node scripts/gerar-carrossel.js ${next.dir}/`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
    next.slides_generated = true;
    next.status = 'slides_gerados';
    saveSchedule(schedule);
    console.log(`\n✓ Slides gerados para ${next.slug}`);
  } catch (err) {
    console.error(`Erro ao gerar slides: ${err.message}`);
    next.status = 'erro';
    saveSchedule(schedule);
  }
}

function publishNext() {
  const schedule = loadSchedule();
  const next = schedule.posts.find(
    p => p.status !== 'publicado' && p.slides_generated
  );

  if (!next) {
    console.log('Nenhum post pronto para publicar.');
    return;
  }

  console.log(`Publicando: ${next.slug}...`);
  try {
    execSync(`node scripts/instagram-publisher.js ${next.dir}/`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
    next.status = 'publicado';
    next.published_at = new Date().toISOString();
    saveSchedule(schedule);
    console.log(`\n✓ ${next.slug} publicado com sucesso`);
  } catch (err) {
    console.error(`Erro ao publicar: ${err.message}`);
    next.status = 'erro';
    saveSchedule(schedule);
  }
}

function runScheduled() {
  const schedule = loadSchedule();
  const today = new Date().toISOString().split('T')[0];

  const todayPost = schedule.posts.find(
    p => p.date === today && p.status !== 'publicado'
  );

  if (!todayPost) {
    console.log(`Nenhum post agendado para hoje (${today}).`);
    const nextPost = schedule.posts.find(p => p.status !== 'publicado' && p.date > today);
    if (nextPost) {
      console.log(`Próximo: ${nextPost.date} (${nextPost.day}) — ${nextPost.slug}`);
    }
    return;
  }

  console.log(`Post de hoje: ${todayPost.slug}`);

  // Generate slides if needed
  if (!todayPost.slides_generated && todayPost.content_ready) {
    console.log('Gerando slides...');
    try {
      execSync(`node scripts/gerar-carrossel.js ${todayPost.dir}/`, {
        cwd: ROOT,
        stdio: 'inherit',
      });
      todayPost.slides_generated = true;
    } catch (err) {
      console.error(`Erro ao gerar slides: ${err.message}`);
      todayPost.status = 'erro';
      saveSchedule(schedule);
      return;
    }
  }

  if (!todayPost.slides_generated) {
    console.error('Slides não disponíveis e conteúdo não está pronto. Abortando.');
    return;
  }

  // Publish
  try {
    execSync(`node scripts/instagram-publisher.js ${todayPost.dir}/`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
    todayPost.status = 'publicado';
    todayPost.published_at = new Date().toISOString();
    saveSchedule(schedule);
  } catch (err) {
    console.error(`Erro ao publicar: ${err.message}`);
    todayPost.status = 'erro';
    saveSchedule(schedule);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const arg = process.argv[2];

switch (arg) {
  case '--init':
    initSchedule();
    break;
  case '--status':
    showStatus();
    break;
  case '--generate':
    generateNext();
    break;
  case '--next':
    publishNext();
    break;
  case '--run':
    runScheduled();
    break;
  default:
    console.log('CineCrítica BR — Scheduler');
    console.log('');
    console.log('Comandos:');
    console.log('  --init       Cria schedule.json com agenda de 8 semanas');
    console.log('  --status     Mostra status da agenda');
    console.log('  --generate   Gera slides do próximo post pendente');
    console.log('  --next       Publica o próximo post da fila');
    console.log('  --run        Verifica se há post para hoje e publica');
    console.log('');
}
