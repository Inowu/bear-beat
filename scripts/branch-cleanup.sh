#!/usr/bin/env bash
set -euo pipefail

echo "NO EJECUTADO AUTOMATICAMENTE. REVISA ANTES."
echo "Este script SOLO imprime comandos. No borra nada por si solo."
echo
echo "Base (segun origin/HEAD): origin/main"
echo

echo "# Local branches (SAFE TO DELETE)"
echo "git branch -d codex/crm-trial-checkout"
echo "git branch -d codex/fix-conekta-payments"
echo "git branch -d codex/fullsite-ux-audit"
echo "git branch -d codex/fullsite-ux-audit-2026"
echo "git branch -d codex/home-cro-2026"
echo "git branch -d codex/home-cro-pass2"
echo "git branch -d codex/home-cro-pass3"
echo "git branch -d codex/nivel-dios-crm-automation"
echo "git branch -d codex/ux-ui-cro-audit-20260209"
echo "git branch -d CURSOR-GUSTAVO"
echo

echo "# Remote branches on origin (SAFE TO DELETE)"
echo "git push origin --delete allow-non-admin-to-find-video-config"
echo "git push origin --delete backend"
echo "git push origin --delete codex/home-cro-2026"
echo "git push origin --delete CURSOR-GUSTAVO"
echo "git push origin --delete fix-anual-subscribers-renowal"
echo "git push origin --delete fixing-bad-subscriptions"
echo "git push origin --delete fixing-orders-not-being-marked-as-failed"
echo "git push origin --delete jorge"
echo "git push origin --delete list-of-allowed-countries"
echo "git push origin --delete redirecting-users-with-plan-to-upgrade-plan-page"
echo "git push origin --delete select-user-type-when-creating-new-user"
echo "git push origin --delete test"
echo "git push origin --delete uh-migration"
echo

echo "# Force (si confirmas) - NO INCLUIDO"
echo "# (No usar -D sin revisar ramas en REVIEW/DO NOT DELETE)"

