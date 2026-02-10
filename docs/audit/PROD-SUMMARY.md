# Production Audit Summary (Read-Only, No PII)

Base URL auditada: `https://thebearbeat.com`  
Fecha: 2026-02-10  
Modo: `AUDIT_READ_ONLY=1` (bloquea writes) + screenshots enmascaradas (no PII)  
Artifacts: `audit-artifacts/prod-2026-02-10/` (gitignored)

## Cómo correr el audit en producción

Requisitos:
- No hardcodear credenciales.
- Exportar `AUDIT_LOGIN_EMAIL` y `AUDIT_LOGIN_PASSWORD` en tu shell (no imprimirlos).

```bash
AUDIT_BASE_URL="https://thebearbeat.com" \
AUDIT_START_SERVERS=0 \
AUDIT_READ_ONLY=1 \
AUDIT_ARTIFACTS_DIR="./audit-artifacts/prod-YYYY-MM-DD" \
AUDIT_LOGIN_EMAIL="$AUDIT_LOGIN_EMAIL" \
AUDIT_LOGIN_PASSWORD="$AUDIT_LOGIN_PASSWORD" \
npm run audit:fullsite --workspace=backend
```

Outputs esperados (en `AUDIT_ARTIFACTS_DIR`):
- `route-map.json`
- `ui-inventory.json`
- `a11y-report.md` (axe)
- `qa-fullsite.md` (consola/red/redirects/read-only blocks)
- `cro-findings.md`
- `error-copy-catalog.json`
- `screenshots/` (desktop+mobile, con mask/blur)

## Resultados (producción)

Resumen numérico (corrida `prod-2026-02-10`):
- Rutas: 27
- Status: `ok=27`
- Redirects a `/auth` en rutas protegidas: 0 (PASS)
- Admin role mismatches: 0 (PASS)
- A11y (axe): 28 total (`critical=1`, `serious=27`)
- Consola: 189 errors, 171 warnings
- Network: 2 httpErrors, 2 failedRequests
- Read-only guard: 144 writes bloqueados

Notas:
- La mayoría de errores de consola fueron `net::ERR_BLOCKED_BY_CLIENT` causados por el read-only guard bloqueando trackers (ManyChat/Contentsquare/Stripe/PayPal). Se registran como evidencia, pero no representan necesariamente errores de UX.
- Turnstile/Cloudflare aparece en flujos de `recuperar/registro`. No se intenta bypass; se reporta como fricción para automatización.

## Top Issues Detectados (P0/P1)

P0
- `/` (landing): `aria-required-children` en bloque "Audios" (estructura `role=list` inválida). Impacto: lectores de pantalla (crítico).
- App/Admin (múltiples rutas): `aria-hidden-focus` en `aside` (menú lateral oculto a AT pero con elementos enfocables). Impacto: keyboard/screen reader (serious).
- Admin móvil (dominios/teléfonos/cupones): `nested-interactive` (botón dentro de “fila clickeable”). Impacto: teclado y lectores (serious).

P1
- Admin: `scrollable-region-focusable` (wrappers de tablas scrollables sin acceso por teclado). Impacto: navegación con teclado (serious).
- `/planes`: `color-contrast` en badge PayPal. Impacto: legibilidad/AA (serious).
- `/actualizar-planes`: `plans.findManyPlans` respondía 400 en prod (observado en `qa-fullsite.md`). Impacto: upgrade de plan (funnel).

## Fixes Implementados En Esta Rama (sin tocar reglas de negocio)

Cambios implementados:
- Fix a11y crítico en landing: lista/columnas de SocialProof ahora usan `aria-labelledby` + `role=list` correcto (sin headers dentro del list).
- PayPal badge en dark theme: fondo más claro para cumplir contraste.
- AsideNavbar: asegura que el drawer NO quede `aria-hidden` cuando está visible.
- Admin móvil: elimina nested-interactive (cada fila ahora es un solo `button`).
- Wrappers scrollables: `tabIndex=0` + `role=region` + `data-scroll-region` para permitir scroll con teclado y focus visible.
- `/actualizar-planes`: evita filtros BigInt en query (se filtra del lado del cliente) para reducir probabilidad de 400 por serialización/validación.

Verificación local (branch):
- `npm run e2e:smoke --workspace=backend` (PASS)
- `npm run audit:fullsite --workspace=backend` (PASS) con `a11yTotal=0` en local.

## Backlog / Siguientes Pasos

- Reducir “ruido” en auditoría READ_ONLY: separar conteos de consola “esperados” por bloqueos (trackers) vs errores reales.
- Evitar side-effects en queries del backend: `plans.findManyPlans` tiene side-effects (ManyChat) dentro de un `.query`; debería moverse a tracking best-effort (mutation/event) o guardarse por header/flag.
- Turnstile en auth: para automatización estable, usar staging/test keys o paso humano documentado.

