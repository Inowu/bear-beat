# Branch Audit (actualizado)

- Generado: **2026-02-17 14:47 EST**
- Base branch: `origin/main`

## Resumen ejecutivo

- Ramas locales: **18**
- Ramas remotas (`origin/*`, sin `origin/HEAD` y sin alias `origin`): **27**
- Estado de rama productiva: `main` <-> `origin/main` (**sin drift**).
- Estado de `staging`: **0 ahead / 403 behind** contra `origin/main`.

Conclusión operativa:

- `main` es la rama de verdad para producción.
- `staging` hoy está desactualizada para usarse como promoción.
- Hay ramas legacy remotas de 2024 que deben revisarse para cierre/archivo.

## Inventario local (completo)

| Rama local | Upstream | Estado |
| --- | --- | --- |
| `main` | `origin/main` | `ahead:0 behind:0` |
| `staging` | `origin/staging` | `ahead:0 behind:0` |
| `ux-ui-cro-feb-2026` | `origin/ux-ui-cro-feb-2026` | `ahead:0 behind:0` |
| `prod-audit-uxui-cro-2026-02-10` | `origin/prod-audit-uxui-cro-2026-02-10` | `ahead:0 behind:0` |
| `codex/auth-login-polish-2026-02-10` | `origin/codex/auth-login-polish-2026-02-10` | `ahead:0 behind:0` |
| `codex/home-demo-playback-2026-02-10` | `origin/codex/home-demo-playback-2026-02-10` | `ahead:0 behind:0` |
| `codex/home-planes-demo-fixes-2026-02-10` | `origin/codex/home-planes-demo-fixes-2026-02-10` | `ahead:0 behind:0` |
| `codex/home-plans-primitives-selectors` | `origin/codex/home-plans-primitives-selectors` | `ahead:0 behind:0` |
| `codex/home-polish-2026-02-10` | `origin/codex/home-polish-2026-02-10` | `ahead:0 behind:0` |
| `codex/legal-polish-2026-02-10` | `origin/codex/legal-polish-2026-02-10` | `ahead:0 behind:0` |
| `codex/sentry-pipeline-hardening` | `origin/codex/sentry-pipeline-hardening` | `ahead:0 behind:0` |
| `codex/ux-ui-cro-release-2026-02-10` | `origin/codex/ux-ui-cro-release-2026-02-10` | `ahead:0 behind:0` |
| `codex/audit/2026-02-13` | `origin/codex/audit/2026-02-13 (gone)` | upstream eliminado |
| `codex/a006-conekta-axios-override` | - | sin upstream |
| `codex/audit/2026-02-12` | - | sin upstream |
| `codex/checkout-skeleton` | - | sin upstream |
| `codex/resolve-pr-57` | - | sin upstream |
| `codex/winback-email` | - | sin upstream |

## Inventario remoto (completo, con señal de drift)

`ahead_vs_main` y `behind_vs_main` se calculan contra `origin/main`.

| Rama remota | Último commit | Drift vs `origin/main` |
| --- | --- | --- |
| `origin/main` | 2026-02-17 | `ahead:0 behind:0` |
| `origin/staging` | 2026-02-08 | `ahead:0 behind:403` |
| `origin/codex/backend-driven-pricing-ui-state` | 2026-02-17 | `ahead:1 behind:7` |
| `origin/codex/backend-upgrade-options` | 2026-02-17 | `ahead:1 behind:6` |
| `origin/codex/downloadhistory-scale-plan` | 2026-02-17 | `ahead:0 behind:4` |
| `origin/codex/fix-checkoutlogs-403` | 2026-02-17 | `ahead:1 behind:11` |
| `origin/codex/p0-hardening-release` | 2026-02-17 | `ahead:1 behind:3` |
| `origin/codex/remove-main-push-rule` | 2026-02-17 | `ahead:1 behind:2` |
| `origin/codex/unify-shell-all-routes` | 2026-02-17 | `ahead:1 behind:8` |
| `origin/codex/visual-unification-all-routes` | 2026-02-17 | `ahead:1 behind:9` |
| `origin/codex/visual-unification-point1` | 2026-02-17 | `ahead:1 behind:10` |
| `origin/codex/checkout-backend-default-method` | 2026-02-15 | `ahead:1 behind:12` |
| `origin/codex/home-plans-primitives-selectors` | 2026-02-15 | `ahead:1 behind:14` |
| `origin/codex/home-visual-hero-card` | 2026-02-15 | `ahead:1 behind:15` |
| `origin/codex/hotfix-has-live-catalog` | 2026-02-15 | `ahead:1 behind:16` |
| `origin/codex/home-pricing-hero-card` | 2026-02-15 | `ahead:1 behind:17` |
| `origin/codex/sentry-pipeline-hardening` | 2026-02-15 | `ahead:1 behind:13` |
| `origin/codex/auth-login-polish-2026-02-10` | 2026-02-10 | `ahead:0 behind:375` |
| `origin/codex/home-demo-playback-2026-02-10` | 2026-02-10 | `ahead:15 behind:389` |
| `origin/codex/home-planes-demo-fixes-2026-02-10` | 2026-02-10 | `ahead:0 behind:377` |
| `origin/codex/home-polish-2026-02-10` | 2026-02-10 | `ahead:0 behind:381` |
| `origin/codex/legal-polish-2026-02-10` | 2026-02-10 | `ahead:0 behind:379` |
| `origin/codex/ux-ui-cro-release-2026-02-10` | 2026-02-10 | `ahead:0 behind:357` |
| `origin/prod-audit-uxui-cro-2026-02-10` | 2026-02-09 | `ahead:7 behind:390` |
| `origin/ux-ui-cro-feb-2026` | 2026-02-09 | `ahead:5 behind:390` |
| `origin/adding-phone-number-to-manychat` | 2024-05-06 | `ahead:1 behind:772` |
| `origin/folderDownload` | 2024-02-15 | `ahead:1 behind:1086` |

## Recomendaciones

### Mantener (core)

- `main`
- `origin/main`

### Mantener pero marcar como legacy temporal

- `staging`
- `origin/staging`

Acción recomendada:

1. No usar `staging` para promoción hasta rebase/sync formal contra `main`.
2. Si no se va a reactivar, documentar su deprecación explícita.

### Revisar para limpieza

- Ramas locales sin upstream:
  - `codex/a006-conekta-axios-override`
  - `codex/audit/2026-02-12`
  - `codex/checkout-skeleton`
  - `codex/resolve-pr-57`
  - `codex/winback-email`
- Rama local con upstream eliminado:
  - `codex/audit/2026-02-13`
- Remotas legacy 2024:
  - `origin/adding-phone-number-to-manychat`
  - `origin/folderDownload`

## Comandos para refrescar este documento

```bash
# timestamp
date '+%Y-%m-%d %H:%M:%S %Z'

# conteo de ramas
echo "local=$(git for-each-ref refs/heads --format='%(refname:short)' | wc -l | tr -d ' ')"
echo "remote=$(git for-each-ref refs/remotes/origin --format='%(refname:short)' | grep -v '^origin/HEAD$' | grep -v '^origin$' | wc -l | tr -d ' ')"

# drift de staging
git rev-list --left-right --count origin/staging...origin/main

# ramas locales mergeadas a main
git branch --merged main
```

## Nota de auditoría

Este archivo es un snapshot operativo; no reemplaza la verificación de PRs abiertos/cerrados en GitHub.  
Para estado de PRs, validar en GitHub antes de borrar ramas remotas.
