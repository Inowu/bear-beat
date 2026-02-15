#!/usr/bin/env bash
set -euo pipefail

echo "NO EJECUTADO AUTOMATICAMENTE. REVISA ANTES."
echo
echo "# Local branches (SAFE TO DELETE)"
echo git branch -d codex/home-polish-2026-02-10
echo
echo "# Remote branches (SAFE TO DELETE)"
echo git push origin --delete codex/home-polish-2026-02-10
echo
echo "# Force delete (si confirmas)"
echo "# (vacío por defecto; no usar -D salvo que se justifique)"
