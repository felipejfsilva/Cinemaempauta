#!/bin/bash
# CineCrítica BR — Setup de Cron para publicação automática
#
# Uso: bash scripts/setup-cron.sh
#
# Configura cron para executar o scheduler ter/qui/sab às 18:00 BRT.
# Requer: .env configurado com credenciais do Instagram.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
NODE_PATH="$(which node)"

# Cron job: terça, quinta e sábado às 18:00 BRT (21:00 UTC)
CRON_SCHEDULE="0 21 * * 2,4,6"
CRON_CMD="cd $PROJECT_DIR && $NODE_PATH scripts/scheduler.js --run >> /tmp/cinecriticabr-publish.log 2>&1"

echo "CineCrítica BR — Configuração de Cron"
echo "======================================"
echo ""
echo "Projeto:  $PROJECT_DIR"
echo "Node:     $NODE_PATH"
echo "Schedule: Ter/Qui/Sab às 18:00 BRT (21:00 UTC)"
echo ""

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "cinecriticabr"; then
  echo "⚠ Cron job já existe. Removendo anterior..."
  crontab -l 2>/dev/null | grep -v "cinecriticabr" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "# cinecriticabr - publicação automática"; echo "$CRON_SCHEDULE $CRON_CMD") | crontab -

echo "✓ Cron configurado:"
echo "  $CRON_SCHEDULE $CRON_CMD"
echo ""
echo "Para verificar: crontab -l"
echo "Para remover:   crontab -l | grep -v cinecriticabr | crontab -"
echo "Logs em:        /tmp/cinecriticabr-publish.log"
