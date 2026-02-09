# UX/UI/CRO Audit (Full Site)

Generado: 2026-02-09

Objetivo: hacer que **toda la web** (público + auth + app + admin) sea extremadamente clara, consistente y orientada a conversión, con UX/UI impecable, accesible (WCAG AA) y sin romper funnels (registro → planes → checkout → success).

## Alcance (rutas)

- Público: `/`, `/planes`, `/legal`, `/instrucciones`
- Auth: `/auth`, `/auth/registro`, `/auth/recuperar`, `/auth/reset-password`
- App: `/micuenta`, `/descargas`, `/comprar`, `/comprar/success`, `/actualizar-planes`
- Admin: `/admin/*` (usuarios, ordenes, planesAdmin, cupones, catalogo, crm, analitica, almacenamiento, historiales, etc.)

Fuente de verdad (route-map): `docs/audit/route-map.json` (28 entradas; `/*` se excluye de la auditoría).

## Evidencia + Verificación Automática

Artifacts (tracked):

- `docs/audit/route-map.json`
- `docs/audit/ui-inventory.json` (inventario UI + consola + HTTP errors + requests fallidos + finalUrl)
- `docs/audit/a11y-report.md` (axe)
- `docs/audit/error-copy-catalog.json`
- `docs/audit/cro-findings.md`

Evidencia (screenshots por ruta, desktop+mobile): `audit/screenshots/*--desktop.png` y `audit/screenshots/*--mobile.png`.

### Cobertura real (reglas no negociables)

Última corrida:

- Rutas auditadas: 27
- A11y (axe): 0 violaciones
- Protected routes (auth): **0** terminan en `/auth` (finalUrl mismatch)
- Evidencia: **0** rutas sin screenshots
- Robustez: **0** rutas con `console.error`, **0** con HTTP 4xx/5xx, **1** con `requestfailed` (Stripe `m.stripe.network` abortado en headless en `/`)

## Inventario UI (automático, por ruta)

Este inventario se extrae con Playwright desde DOM visible (mobile viewport) y sirve como base para estandarizar componentes (Button/Input/Select/Modal/Toast/Table/Pagination/EmptyState).

| Ruta | Auth | Btn | Links | Inputs | Selects | Icono sin label | Axe | Console err | HTTP 4xx/5xx | Req fail |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `/` | anonymous | 4 | 15 | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `/actualizar-planes` | authenticated | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/admin` | authenticated | 14 | 0 | 1 | 2 | 0 | 0 | 0 | 0 | 0 |
| `/admin/almacenamiento` | authenticated | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/admin/analitica` | authenticated | 3 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| `/admin/catalogo` | authenticated | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/admin/crm` | authenticated | 3 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| `/admin/cupones` | authenticated | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/admin/dominios-bloqueados` | authenticated | 3 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/admin/historial-descargas` | authenticated | 5 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| `/admin/historialCheckout` | authenticated | 10 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| `/admin/live` | authenticated | 4 | 0 | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| `/admin/ordenes` | authenticated | 6 | 0 | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| `/admin/planesAdmin` | authenticated | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/admin/telefonos-bloqueados` | authenticated | 3 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/admin/usuarios` | authenticated | 14 | 0 | 1 | 2 | 0 | 0 | 0 | 0 | 0 |
| `/auth` | anonymous | 2 | 3 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/auth/recuperar` | anonymous | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/auth/registro` | anonymous | 3 | 2 | 5 | 1 | 0 | 0 | 0 | 0 | 0 |
| `/auth/reset-password` | anonymous | 3 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/comprar` | authenticated | 5 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/comprar/success` | authenticated | 5 | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/descargas` | authenticated | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/instrucciones` | anonymous | 0 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/legal` | anonymous | 0 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/micuenta` | authenticated | 6 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/planes` | anonymous | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Evidencia por Ruta (screenshots “después”)

| Ruta | Auth | Desktop | Mobile |
|---|---:|---|---|
| `/` | anonymous | `audit/screenshots/root--desktop.png` | `audit/screenshots/root--mobile.png` |
| `/actualizar-planes` | authenticated | `audit/screenshots/actualizar-planes--desktop.png` | `audit/screenshots/actualizar-planes--mobile.png` |
| `/admin` | authenticated | `audit/screenshots/admin--desktop.png` | `audit/screenshots/admin--mobile.png` |
| `/admin/almacenamiento` | authenticated | `audit/screenshots/admin-almacenamiento--desktop.png` | `audit/screenshots/admin-almacenamiento--mobile.png` |
| `/admin/analitica` | authenticated | `audit/screenshots/admin-analitica--desktop.png` | `audit/screenshots/admin-analitica--mobile.png` |
| `/admin/catalogo` | authenticated | `audit/screenshots/admin-catalogo--desktop.png` | `audit/screenshots/admin-catalogo--mobile.png` |
| `/admin/crm` | authenticated | `audit/screenshots/admin-crm--desktop.png` | `audit/screenshots/admin-crm--mobile.png` |
| `/admin/cupones` | authenticated | `audit/screenshots/admin-cupones--desktop.png` | `audit/screenshots/admin-cupones--mobile.png` |
| `/admin/dominios-bloqueados` | authenticated | `audit/screenshots/admin-dominios-bloqueados--desktop.png` | `audit/screenshots/admin-dominios-bloqueados--mobile.png` |
| `/admin/historial-descargas` | authenticated | `audit/screenshots/admin-historial-descargas--desktop.png` | `audit/screenshots/admin-historial-descargas--mobile.png` |
| `/admin/historialCheckout` | authenticated | `audit/screenshots/admin-historialcheckout--desktop.png` | `audit/screenshots/admin-historialcheckout--mobile.png` |
| `/admin/live` | authenticated | `audit/screenshots/admin-live--desktop.png` | `audit/screenshots/admin-live--mobile.png` |
| `/admin/ordenes` | authenticated | `audit/screenshots/admin-ordenes--desktop.png` | `audit/screenshots/admin-ordenes--mobile.png` |
| `/admin/planesAdmin` | authenticated | `audit/screenshots/admin-planesadmin--desktop.png` | `audit/screenshots/admin-planesadmin--mobile.png` |
| `/admin/telefonos-bloqueados` | authenticated | `audit/screenshots/admin-telefonos-bloqueados--desktop.png` | `audit/screenshots/admin-telefonos-bloqueados--mobile.png` |
| `/admin/usuarios` | authenticated | `audit/screenshots/admin-usuarios--desktop.png` | `audit/screenshots/admin-usuarios--mobile.png` |
| `/auth` | anonymous | `audit/screenshots/auth--desktop.png` | `audit/screenshots/auth--mobile.png` |
| `/auth/recuperar` | anonymous | `audit/screenshots/auth-recuperar--desktop.png` | `audit/screenshots/auth-recuperar--mobile.png` |
| `/auth/registro` | anonymous | `audit/screenshots/auth-registro--desktop.png` | `audit/screenshots/auth-registro--mobile.png` |
| `/auth/reset-password` | anonymous | `audit/screenshots/auth-reset-password--desktop.png` | `audit/screenshots/auth-reset-password--mobile.png` |
| `/comprar` | authenticated | `audit/screenshots/comprar--desktop.png` | `audit/screenshots/comprar--mobile.png` |
| `/comprar/success` | authenticated | `audit/screenshots/comprar-success--desktop.png` | `audit/screenshots/comprar-success--mobile.png` |
| `/descargas` | authenticated | `audit/screenshots/descargas--desktop.png` | `audit/screenshots/descargas--mobile.png` |
| `/instrucciones` | anonymous | `audit/screenshots/instrucciones--desktop.png` | `audit/screenshots/instrucciones--mobile.png` |
| `/legal` | anonymous | `audit/screenshots/legal--desktop.png` | `audit/screenshots/legal--mobile.png` |
| `/micuenta` | authenticated | `audit/screenshots/micuenta--desktop.png` | `audit/screenshots/micuenta--mobile.png` |
| `/planes` | anonymous | `audit/screenshots/planes--desktop.png` | `audit/screenshots/planes--mobile.png` |

## Hallazgos UX/UI/CRO (priorizados)

Formato por issue:

- **Ruta**
- **Componente/selector**
- **Qué está mal** (UX/UI/CRO/A11Y)
- **Impacto**
- **Fix propuesto / implementado**
- **Evidencia**

### P0 (bloquea funnels o rompe confianza)

| Issue | Ruta | Selector | Qué está mal | Impacto | Fix implementado | Evidencia |
|---|---|---|---|---|---|---|
| P0-1 | Global (auditoría) | `AuthRoute` + auditoría | La auditoría no cubría rutas protegidas: cada ruta abría tab nuevo y perdía `sessionStorage`, terminando en `/auth`. | Sin cobertura real de app/admin: se “aprueba” un sitio roto; impossible validar funnels completos. | Auditoría ahora extrae tokens de login y los inyecta con `page.addInitScript()` por page; hard-fail si una ruta `requiresAuth` termina en `/auth`. | Ver `docs/audit/ui-inventory.json` (protectedRedirects=0). |
| P0-2 | Backend/DB | Prisma tables | Rutas dependían de tablas inexistentes (ej. descargas + logs), causando errores silenciosos/ruido. | Páginas clave fallan (descargas/historiales). Confianza baja. | Migración Prisma agrega `dir_downloads`, `checkout_logs`, `download_history`. | N/A (error era server-side). |
| P0-3 | `/admin/crm` | `.crm-kpi-grid[role="list"]` | A11Y: `role="list"` sin hijos `role="listitem"`. | Lectores de pantalla: estructura inválida; axe critical. | KPI cards ahora renderizan `role="listitem"`. | Antes: `audit/screenshots/before-20260209-152804/admin-crm--mobile.png` · Después: `audit/screenshots/admin-crm--mobile.png` |
| P0-4 | `/admin/crm` | `.crm-table-wrap` | A11Y: región scroll sin acceso por teclado. | Keyboard-only no puede navegar/scroll; axe serious. | `tabIndex={0}` + `aria-label` en wraps + focus ring. | Antes: `audit/screenshots/before-20260209-152804/admin-crm--mobile.png` · Después: `audit/screenshots/admin-crm--mobile.png` |
| P0-5 | `/admin/ordenes`, `/admin/historialCheckout` | `CsvDownloader` wrapper | A11Y: nested interactive (`div[role=button]` conteniendo `<button>`). | Tab/focus se vuelve impredecible; riesgo de acciones erróneas en admin. | Export ahora usa `<span>` interno (sin focus) y el wrapper maneja interacción. | Antes: `audit/screenshots/before-20260209-152804/admin-ordenes--mobile.png`, `audit/screenshots/before-20260209-152804/admin-historialcheckout--mobile.png` · Después: `audit/screenshots/admin-ordenes--mobile.png`, `audit/screenshots/admin-historialcheckout--mobile.png` |
| P0-6 | `/admin/analitica` | `.analytics-alert--critical` | A11Y: `role="alert"` en `<article>` (role no permitido). | Axe minor hoy, pero erosiona AA/consistencia. | Alerts ahora usan `<div role="alert|status">`. | Antes: `audit/screenshots/before-20260209-152804/admin-analitica--mobile.png` · Después: `audit/screenshots/admin-analitica--mobile.png` |

### P1 (mejora fuerte de claridad/consistencia; reduce fricción)

| Issue | Ruta | Selector | Qué está mal | Impacto | Fix implementado | Evidencia |
|---|---|---|---|---|---|---|
| P1-1 | `/descargas` | `h1/h2` + estados | Heading order inválido y estados vacío/error poco accionables. | Confusión (screen readers) + frustración en activación (“¿y ahora qué?”). | `h1` claro, estados `loading/empty/error` con copy + CTA “Reintentar”. | Antes: `audit/screenshots/before-20260209-152804/descargas--mobile.png` · Después: `audit/screenshots/descargas--mobile.png` |
| P1-2 | `/actualizar-planes` + backend | `getCurrentSubscriptionPlan` | “No plan activo” se trataba como error/404. | Ruido y fricción en upgrade; confunde al usuario. | Backend devuelve `null` (estado esperado); UI muestra EmptyState con CTA. | Ver `audit/screenshots/actualizar-planes--mobile.png` |
| P1-3 | Global (DX + calidad) | SSE config | SSE por defecto generaba ruido (404) en entornos sin SSE. | Consola ruidosa, baja confianza, debugging difícil. | SSE opt-in via env (`REACT_APP_SSE_URL` o `REACT_APP_SSE_ENABLED=1`). | N/A |
| P1-4 | `/micuenta` | Stripe cards | Endpoint de tarjetas fallaba sin configuración Stripe, contaminando UI con errores. | Percepción de “sitio roto” en cuenta/pagos. | Si Stripe no está configurado, `listStripeCards` devuelve lista vacía (sin 500). | N/A |
| P1-5 | Admin (móvil) | tarjetas/rows | Controles interactivos anidados (cards clicables con botones adentro). | A11Y + taps erróneos en móvil. | Cards móviles convertidas a `<button>` único (sin nesting). | Ver `audit/screenshots/admin-usuarios--mobile.png` (patrón). |
| P1-6 | Checkout (local) | `createStripeCheckoutSession` | Local dev sin claves Stripe impedía probar funnel completo. | QA imposible; se rompe validación de conversión. | Backend devuelve `success_url` mock solo en localhost + no producción si Stripe no está configurado. | Smoke e2e cubre `/planes → /comprar → /comprar/success`. |

### P2 (próxima iteración)

- Unificar UI en TODAS las rutas hacia primitives (`frontend/src/components/ui/*`): reducir mezcla SCSS/Tailwind/Bootstrap, mejorar consistencia visual y de estados.
- Estándar de tablas/paginación/filtros en admin (mismo layout, misma jerarquía tipográfica, mismos estados vacío/error).
- Revisar contrastes reales (neón sobre fondos) con herramienta de contraste y ajustar tokens si hay casos borderline (AA).
- Expandir smoke e2e: recuperar password (`/auth/recuperar`), reset (`/auth/reset-password`) y un “happy path” de upgrade (`/actualizar-planes`) con datos seed.

### P3 (deuda técnica / calidad premium)

- Generar reporte “before/after” automatizado por ruta (hashing de screenshots) y guardarlo fuera de git.
- Agregar validaciones visuales ligeras (layout shifts / LCP budget) en auditoría.
- Normalizar copy de errores (catálogo `docs/audit/error-copy-catalog.json`) hacia un “Error Copy Guide” (tono, estructura, acciones).

## Conversion Funnel Review (Home → Registro → Planes → Checkout → Success)

1. **Home (`/`)**
   - Qué funciona: H1 claro + bullets de valor + CTA directo a registro con retorno a planes.
   - Riesgo: demasiados links secundarios pueden competir si no se jerarquizan.
   - Mitigación: mantener 1 CTA primario (actual) y medir `cta_primary_click` vs `cta_secondary_click`.

2. **Registro (`/auth/registro`)**
   - Qué funciona: labels visibles, validación inline, WhatsApp opcional (menos fricción).
   - Riesgo: errores server-side deben ser accionables (ya capturados en `error-copy-catalog.json`).
   - Mitigación: estandarizar mensajes (qué pasó + cómo corregir + alternativa: soporte).

3. **Planes (`/planes`)**
   - Qué funciona: CTA primario por plan + alternativas por método (MXN) sin bloquear.
   - Riesgo: coherencia de copy “catálogo total” vs “cuota mensual” (evitar confusión de límites).
   - Mitigación: repetir el mismo patrón de copy en Home/Planes/Checkout/MyAccount.

4. **Checkout (`/comprar`)**
   - Qué funciona: pasos + trust strip + métodos como radiogroup (claridad).
   - Riesgo: sin keys/provider, fallbacks deben guiar (en prod esto no aplica; en local ya hay mock para QA).
   - Mitigación: mensajes de error accionables por método (tarjeta vs SPEI vs efectivo).

5. **Success (`/comprar/success`)**
   - Qué funciona: confirmación clara + próximos pasos + CTAs a explorador y cuenta.
   - Mitigación: agregar (P2) verificación real de activación (polling a backend) para reducir tickets de “ya pagué y no tengo acceso”.
