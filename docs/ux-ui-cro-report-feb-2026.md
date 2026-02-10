# UX/UI/CRO Report (Feb 2026)

Generado: 2026-02-10

Branch de trabajo: `ux-ui-cro-feb-2026` (base: `origin/main`)

## Alcance Auditado (Contrato)

- Público: `/`, `/planes`, `/legal`, `/instrucciones`
- Auth: `/auth`, `/auth/registro`, `/auth/recuperar`, `/auth/reset-password`
- App: `/micuenta`, `/descargas`, `/comprar`, `/comprar/success`, `/actualizar-planes`
- Admin: `/admin/*` (rutas incluidas en `docs/audit/route-map.json`)

## Resumen Ejecutivo (P0/P1 Fixes)

- Auditoría “fullsite” ahora captura evidencia por ruta en **desktop + mobile** (screenshots + inventory + a11y) y no permite falsos positivos de auth.
- Auditoría “fullsite” ahora marca **FAIL** si una ruta protegida termina en `/auth` (`status=auth_redirect`) o si una ruta admin no aterriza en `/admin/*` (`status=role_mismatch`).
- Navegación lateral (`AsideNavbar`) corregida para evitar `aria-hidden` en desktop y evitar contenido focusable oculto en mobile (cumple axe).
- Regiones scrollables (tablas) ahora son accesibles por teclado (focusable + `role="region"` + label).
- Copy/errores normalizados: evita `[object Object]` y errores JSON `"validation"`; mensajes más consistentes y accionables.
- Auth forms: labels visibles + `aria-invalid` + `aria-describedby` + errores inline (`role="alert"`).
- Recuperación de contraseña: Turnstile invisible y ejecución en submit (menos fricción sin cambiar negocio).
- Admin: icon-buttons ahora tienen `aria-label` (más confianza + WCAG AA).
- Smoke e2e amplió cobertura (ruta `/auth/recuperar` validada logged-out).

## Evidencia (Antes/Después)

Commits relevantes:
- **Antes (baseline artifacts):** `625a6a1`
- **Cambios UX/UI/A11y/Audit (código):** `3a32345`
- **Después (audit artifacts):** `c99aad4`

Resultados de auditoría (después, `c99aad4`):
- `docs/audit/ui-inventory.json`: 27 rutas auditadas, `status=ok` en todas, `protected redirects to /auth = 0`, `admin role mismatches = 0`, `missing screenshots = 0`.
- `docs/audit/a11y-report.md`: **0** violaciones axe (desktop + mobile).
- Screenshots por ruta: `audit/screenshots/*--desktop.png` y `audit/screenshots/*--mobile.png` (nota: gitignored por posible PII; evidencia local reproducible).

## Cambios Implementados (con rutas)

### P0 — Auditoría confiable (sin falsos positivos)

- **Problema:** la auditoría anterior podía “pasar” sin cubrir desktop o sin fallar explícitamente ante redirects/role mismatches.
- **Fix:** auditoría fullsite endurecida (status + exit code) y evidencia completa desktop/mobile.
- **Código:** `backend/scripts/auditFullSite.ts`

### P0 — A11y: navegación lateral (WCAG/axe)

- **Problema:** `aria-hidden` aplicado de forma incompatible con desktop y/o drawer mobile, causando `aria-hidden-focus` cuando existían elementos focusables dentro.
- **Fix:** sidebar siempre accesible en desktop; drawer mobile se desmonta cuando está cerrado; `Esc` cierra el drawer y foco inicial se va al botón de cerrar (mobile).
- **Código:** `frontend/src/components/AsideNavbar/AsideNavbar.tsx`

### P1 — A11y: regiones scrollables

- **Problema:** wrappers con `overflow-x-auto` sin acceso por teclado (`scrollable-region-focusable`).
- **Fix:** `tabIndex={0}` + `role="region"` + `aria-label` + estilo de focus.
- **Código:** 
  - `frontend/src/pages/Admin/Ordens/Ordens.tsx`
  - `frontend/src/pages/MyAccount/MyAccount.tsx`
  - `frontend/src/styles/index.scss`

### P1 — Formularios auth: accesibilidad + CRO

- **Problema:** errores inconsistentes/no accionables; falta de `aria-*`; labels no siempre visibles; Turnstile podía meter fricción.
- **Fix:** normalización de errores + labels visibles + errores inline accesibles + Turnstile invisible y ejecución en submit (recuperación).
- **Código:**
  - `frontend/src/utils/errorMessage.ts`
  - `frontend/src/components/Modals/ErrorModal/ErrorModal.tsx`
  - `frontend/src/components/Auth/LoginForm/LoginForm.tsx`
  - `frontend/src/components/Auth/SignUpForm/SignUpForm.tsx`
  - `frontend/src/components/Auth/ForgotPasswordForm/ForgotPasswordForm.tsx`
  - `frontend/src/components/Auth/ResetPassword/ResetPassword.tsx`
  - `frontend/src/components/Auth/ResetPassword/ResetPassword.scss`

### P1 — Admin: icon-buttons con nombres accesibles

- **Problema:** botones de ícono sin nombre accesible (riesgo WCAG + confusión).
- **Fix:** `aria-label` en acciones clave.
- **Código:** `frontend/src/pages/Admin/Admin.tsx`

## Checklist Por Ruta (Auditoría Automática)

| path | type | requiresAuth | role | finalUrl | status | a11y(d) | a11y(m) | consoleErrors | httpErrors | failedReq | screenshot(d) | screenshot(m) |
|---|---|---:|---|---|---|---:|---:|---:|---:|---:|---|---|
| `/` | public | no | — | `/` | ok | 0 | 0 | 0 | 0 | 1 | `audit/screenshots/root--desktop.png` | `audit/screenshots/root--mobile.png` |
| `/actualizar-planes` | app | yes | — | `/actualizar-planes` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/actualizar-planes--desktop.png` | `audit/screenshots/actualizar-planes--mobile.png` |
| `/admin` | admin | yes | admin | `/admin/usuarios` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/admin--desktop.png` | `audit/screenshots/admin--mobile.png` |
| `/admin/almacenamiento` | admin | yes | admin | `/admin/almacenamiento` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/admin-almacenamiento--desktop.png` | `audit/screenshots/admin-almacenamiento--mobile.png` |
| `/admin/analitica` | admin | yes | admin | `/admin/analitica` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/admin-analitica--desktop.png` | `audit/screenshots/admin-analitica--mobile.png` |
| `/admin/catalogo` | admin | yes | admin | `/admin/catalogo` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/admin-catalogo--desktop.png` | `audit/screenshots/admin-catalogo--mobile.png` |
| `/admin/crm` | admin | yes | admin | `/admin/crm` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/admin-crm--desktop.png` | `audit/screenshots/admin-crm--mobile.png` |
| `/admin/cupones` | admin | yes | admin | `/admin/cupones` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/admin-cupones--desktop.png` | `audit/screenshots/admin-cupones--mobile.png` |
| `/admin/dominios-bloqueados` | admin | yes | admin | `/admin/dominios-bloqueados` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/admin-dominios-bloqueados--desktop.png` | `audit/screenshots/admin-dominios-bloqueados--mobile.png` |
| `/admin/historial-descargas` | admin | yes | admin | `/admin/historial-descargas` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/admin-historial-descargas--desktop.png` | `audit/screenshots/admin-historial-descargas--mobile.png` |
| `/admin/historialCheckout` | admin | yes | admin | `/admin/historialCheckout` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/admin-historialcheckout--desktop.png` | `audit/screenshots/admin-historialcheckout--mobile.png` |
| `/admin/live` | admin | yes | admin | `/admin/live` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/admin-live--desktop.png` | `audit/screenshots/admin-live--mobile.png` |
| `/admin/ordenes` | admin | yes | admin | `/admin/ordenes` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/admin-ordenes--desktop.png` | `audit/screenshots/admin-ordenes--mobile.png` |
| `/admin/planesAdmin` | admin | yes | admin | `/admin/planesAdmin` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/admin-planesadmin--desktop.png` | `audit/screenshots/admin-planesadmin--mobile.png` |
| `/admin/telefonos-bloqueados` | admin | yes | admin | `/admin/telefonos-bloqueados` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/admin-telefonos-bloqueados--desktop.png` | `audit/screenshots/admin-telefonos-bloqueados--mobile.png` |
| `/admin/usuarios` | admin | yes | admin | `/admin/usuarios` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/admin-usuarios--desktop.png` | `audit/screenshots/admin-usuarios--mobile.png` |
| `/auth` | auth | no | — | `/auth` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/auth--desktop.png` | `audit/screenshots/auth--mobile.png` |
| `/auth/recuperar` | auth | no | — | `/auth/recuperar` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/auth-recuperar--desktop.png` | `audit/screenshots/auth-recuperar--mobile.png` |
| `/auth/registro` | auth | no | — | `/auth/registro` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/auth-registro--desktop.png` | `audit/screenshots/auth-registro--mobile.png` |
| `/auth/reset-password` | auth | no | — | `/auth/reset-password` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/auth-reset-password--desktop.png` | `audit/screenshots/auth-reset-password--mobile.png` |
| `/comprar` | app | yes | — | `/comprar` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/comprar--desktop.png` | `audit/screenshots/comprar--mobile.png` |
| `/comprar/success` | app | yes | — | `/comprar/success` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/comprar-success--desktop.png` | `audit/screenshots/comprar-success--mobile.png` |
| `/descargas` | app | yes | — | `/descargas` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/descargas--desktop.png` | `audit/screenshots/descargas--mobile.png` |
| `/instrucciones` | public | no | — | `/instrucciones` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/instrucciones--desktop.png` | `audit/screenshots/instrucciones--mobile.png` |
| `/legal` | public | no | — | `/legal` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/legal--desktop.png` | `audit/screenshots/legal--mobile.png` |
| `/micuenta` | app | yes | — | `/micuenta` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/micuenta--desktop.png` | `audit/screenshots/micuenta--mobile.png` |
| `/planes` | public | no | — | `/planes` | ok | 0 | 0 | 0 | 0 | 0 | `audit/screenshots/planes--desktop.png` | `audit/screenshots/planes--mobile.png` |

Notas:
- `/` muestra `failedReq=1` por `https://m.stripe.network/inner.html (net::ERR_ABORTED)` en Playwright. No hay `consoleErrors` ni `httpErrors` y no se considera regresión del funnel.

## Comandos Ejecutados (y resultado)

```bash
# Seeds
export AUDIT_SEED_PASSWORD="(local)"
npm run seed:audit-user --workspace=backend
npm run seed:audit-plan --workspace=backend

# Typecheck / build
npm run compile --workspace=backend
npm run build --workspace=frontend

# Smoke e2e
SMOKE_START_SERVERS=1 REACT_APP_ENVIRONMENT=development REACT_APP_API_BASE_URL=http://localhost:5001 \\
SMOKE_LOGIN_EMAIL="audit-admin@local.test" SMOKE_LOGIN_PASSWORD="$AUDIT_SEED_PASSWORD" \\
npm run e2e:smoke --workspace=backend

# Auditoría fullsite (evidencia + a11y)
AUDIT_START_SERVERS=1 REACT_APP_ENVIRONMENT=development REACT_APP_API_BASE_URL=http://localhost:5001 \\
AUDIT_LOGIN_EMAIL="audit-admin@local.test" AUDIT_LOGIN_PASSWORD="$AUDIT_SEED_PASSWORD" \\
npm run audit:fullsite --workspace=backend
```

## Backlog (P2/P3)

P2
- Reducir ruido en auditoría por requests abortados cross-origin (ej. `stripe.network`) sin ocultar fallas reales.
- Consolidar warnings de hooks/unused-vars (CRA eslint warnings) en rutas críticas para mejorar calidad (no bloquea build).

P3
- Migración off CRA (`react-scripts`) a Vite/Next (warning recurrente de `babel-preset-react-app`).
- `npm audit` reporta vulnerabilidades (revisar y planear updates sin romper Stripe/Conekta).

