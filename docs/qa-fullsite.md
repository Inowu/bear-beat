# QA Checklist (Full Site)

Scope: rutas públicas, auth, app (usuario) y admin. Objetivo: UX/UI consistente, accesible y sin romper funnels (registro → planes → checkout).

## 1) Precondiciones Local (dev)
1. `node -v` y `npm -v` funcionan.
2. Backend + DB local listos:
   - `DATABASE_URL` apunta a local (`localhost` / `127.0.0.1`).
3. Frontend apunta a API local:
   - `REACT_APP_ENVIRONMENT=development` (o `REACT_APP_API_BASE_URL=http://localhost:5001`).

## 2) Seed (solo local)
Estos scripts se rehúsan a correr si `DATABASE_URL` no parece local.

1. Exportar una contraseña de auditoría (no se imprime):
```bash
export AUDIT_SEED_PASSWORD="un-password-largo-de-10+"
```

2. Crear/actualizar admin local:
```bash
npm run seed:audit-user --workspace=backend
```

3. Crear/actualizar planes mínimos (para que `/planes` no quede vacío en local):
```bash
npm run seed:audit-plan --workspace=backend
```

## 3) Smoke Tests (Playwright, dev-only)
1. Smoke básico (arranca servers automáticamente):
```bash
SMOKE_START_SERVERS=1 \
REACT_APP_ENVIRONMENT=development \
REACT_APP_API_BASE_URL=http://localhost:5001 \
SMOKE_LOGIN_EMAIL="audit-admin@local.test" \
SMOKE_LOGIN_PASSWORD="$AUDIT_SEED_PASSWORD" \
npm run e2e:smoke --workspace=backend
```

Validaciones incluidas:
- Home carga y CTA lleva a `/auth/registro`.
- `/planes` renderiza al menos 1 plan card.
- Login (opcional) y `/admin/usuarios` carga con heading `Usuarios`.

## 4) Auditoría Automática (routes + UI inventory + a11y + errores)
```bash
AUDIT_START_SERVERS=1 \
REACT_APP_ENVIRONMENT=development \
REACT_APP_API_BASE_URL=http://localhost:5001 \
AUDIT_LOGIN_EMAIL="audit-admin@local.test" \
AUDIT_LOGIN_PASSWORD="$AUDIT_SEED_PASSWORD" \
npm run audit:fullsite --workspace=backend
```

Outputs (commiteados):
- `docs/audit/route-map.json`
- `docs/audit/ui-inventory.json`
- `docs/audit/error-copy-catalog.json`
- `docs/audit/a11y-report.md`
- `docs/audit/cro-findings.md`

## 5) Checklist Manual (Mobile + Desktop)

### A) Público
1. `/`:
   - H1 claro (qué es + límite mensual).
   - CTA primario coherente (no lleva a login ambiguo).
   - Modal demo abre/cierra con teclado.
2. `/legal`:
   - FAQ legible; headings correctos; links funcionan.
3. `/instrucciones`:
   - Pasos legibles en móvil.

### B) Auth (logged-out)
1. `/auth` (login):
   - Validación: email inválido muestra error cerca del campo.
   - Error credenciales: mensaje en español (modal/banner) y no se rompe layout.
2. `/auth/registro`:
   - Campos con label visible.
   - Errores de validación inline.
3. `/auth/recuperar` y `/auth/reset`:
   - Mensajes claros de éxito/fracaso.

### C) Planes / Checkout
1. `/planes`:
   - Siempre muestra estado claro: planes o estado vacío con CTA.
   - Botones de métodos (SPEI/BBVA/Efectivo/PayPal) no rompen layout.
2. `/comprar?priceId=<id>`:
   - No debe mostrar “plan sin Stripe configurado” para planes activos.
   - Métodos mostrados según moneda/config.
   - Errores de pago (si ocurren) deben ser accionables (qué pasó + qué hacer).

### D) App (logged-in)
1. Login exitoso redirige fuera de `/auth`.
2. `Navbar`/`AsideNavbar`:
   - foco visible, navegación por teclado.
3. `/micuenta`:
   - estados vacíos claros (sin plan activo vs con plan).
4. `/descargas`:
   - tabla legible, estado vacío con explicación.

### E) Admin (role=admin)
1. `/admin/usuarios`:
   - filtros funcionan, paginación, acciones por usuario.
   - editar usuario: éxito/error claros y sin PII en toasts/logs.
2. `/admin/ordenes`:
   - filtros por status/rango no rompen.
3. `/admin/analitica` y `/admin/crm`:
   - gráficas/tablas no rompen en móvil (si aplica).

## 6) Accesibilidad (rápido)
1. Keyboard-only:
   - `Tab` llega a CTAs principales en rutas públicas.
   - Focus visible en botones/links/inputs.
2. Modales:
   - `Esc` cierra.
   - al cerrar, foco vuelve al trigger cuando aplica.
3. Formularios:
   - `aria-invalid` en inputs con error.

## 7) Analytics (sanity)
1. En consola:
   - `window.bbAnalyticsStatus?.()` devuelve objeto.
   - `window.__bbGrowthQueue` existe y crece al navegar/clickear.
2. Eventos mínimos:
   - `page_view` al cambiar de ruta
   - `auth_*` en login/registro
   - `checkout_*` en `/comprar` (cuando aplique)
   - `cta_click` en CTAs principales (Home/Planes)
   - `admin_action` en acciones admin críticas (ej. editar usuario)

