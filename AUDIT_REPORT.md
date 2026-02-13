# Auditoría QA + AppSec + Performance + SRE — The Bear Beat

Fecha: **2026-02-13**  
Rama de trabajo: `codex/audit/2026-02-12`  
Reglas operativas: **sin pruebas destructivas/DAST activo/load en producción**, sin exfiltrar PII/secretos.

## Resumen ejecutivo (no técnico, 1 página)
Este sitio es **crítico** porque maneja **membresías/suscripciones**, acceso a contenido y flujos de pago. En el repositorio se confirmaron **3 riesgos críticos**:

1. **Exposición de datos sensibles en respuestas de autenticación (A-001, Critical).**  
   Riesgo: si el backend devuelve campos sensibles (ej. `password`, códigos de activación, tokens), un atacante o un cliente comprometido podría recolectarlos y escalar a **toma de cuenta** o abuso de sesión.

2. **Control de acceso permisivo por defecto en la capa de permisos (A-002, Critical).**  
   Riesgo: procedimientos protegidos sin regla explícita podían quedar **accesibles por omisión** (por “fallback allow”), abriendo la puerta a **acceso no autorizado** a funciones internas/admin o datos.

3. **Descargas: riesgo de “path traversal/IDOR” en endpoints de descarga (A-009, Critical).**  
   Riesgo: un usuario autenticado podía manipular parámetros (`path`/`dirName`) para intentar acceder a archivos fuera del catálogo permitido o descargar ZIPs que no correspondían a su job, resultando en **exfiltración de archivos** o **acceso indebido a contenido**.

Qué se hizo para mitigar (sin tocar producción):
- Se **sanitizaron** las respuestas de `auth.login` y `auth.register` para retornar solo un “user DTO” seguro (sin campos sensibles) y se agregaron **tests anti-regresión** que fallan si reaparecen esos campos.
- Se cambió la política de permisos a **fallback deny** y se completó la cobertura de reglas para el **100%** de las `shieldedProcedure`. Además, se agregaron tests que fallan si aparece una `shieldedProcedure` nueva sin su regla en `permissions`.
- Se endurecieron los endpoints `/download` y `/download-dir` con **validación de paths** (deny-by-default) y chequeo de consistencia `dirName` vs `downloadUrl` generado por el servidor, más tests anti-regresión.

Estado: los fixes están implementados en código y cubiertos por tests; **pendiente** desplegar vía PR/merge y validar end-to-end en un **STAGING** aislado (local reproducible).

## Inventario (Fase 0 — descubrimiento)

### Stack / repos
- Frontend: **React 18 + Vite** (`/frontend`)
- Backend: **Node 24 + Express + tRPC + Prisma (MySQL)** (`/backend`)
- CI: **GitHub Actions** con servicio MySQL (`/.github/workflows/ci.yml`)
- Deploy FE: **Netlify** (producción: `https://thebearbeat.com`)
- Deploy BE: **VPS** via SSH + `deploy.sh` con `pm2` + `nginx` (`/.github/workflows/backend-deploy.yml`)

### STAGING
- Detectado deploy de branch en Netlify: `https://staging--incredible-druid-62114b.netlify.app` (frontend).  
  No hay evidencia confirmada de backend STAGING separado; por seguridad, **DAST/load** se planifican contra **STAGING local**.
- STAGING local reproducible: ver `docs/STAGING_LOCAL.md` (MySQL default `3310`, Redis `6380`).
  - Validado (local): `prisma migrate deploy` aplicado en DB local + `npm test --workspace=backend` pasando.
  - Evidencia: `audit-artifacts/staging-local-2026-02-12/prisma.migrate-deploy.txt` y `audit-artifacts/staging-local-2026-02-12/backend.jest.r3.txt`.

### Puntos de entrada (alto nivel)
- Web: rutas públicas + app autenticada + `/admin`
- API tRPC: `/trpc`
- Webhooks: `/webhooks.*` (PayPal/Stripe/Conekta)
- Descargas: endpoints `/download`, `/download-dir`, `/track-cover`

## Comandos planificados (safe vs potentially risky)

### Safe (no invasivos / no destructivos)
- Repo/lectura: `git status`, `git log`, `rg`, `cat`, `sed`
- Builds/tests locales:
  - `npm run build --workspace=backend`
  - `npm test --workspace=frontend`
  - `npm run build` (frontend)
- Producción (pasivo):
  - `curl -I https://thebearbeat.com/` (headers)
  - `curl https://thebearbeat.com/robots.txt`
  - `curl https://thebearbeat.com/sitemap.xml`
  - Lighthouse “light” (una corrida puntual; sin throttling/carga agresiva)

### Potentially risky (solo STAGING; NO producción)
- STAGING local:
  - `docker compose -f backend/docker-compose.staging.yml up -d`
  - `npx prisma migrate deploy --schema backend/prisma/schema.prisma` (solo DB local)
  - Seeds: `npm run seed:* --workspace=backend` (solo DB local, con guardrails)
  - DAST (ZAP baseline), load/perf (k6/artillery) contra `localhost`
- Infra/deploy:
  - cualquier `deploy.sh`, cambios de `nginx/pm2`, rotación de llaves, cambios en VPS/Netlify

## Hallazgos priorizados (Critical → Low)

Leyenda:
- **Quick win**: cambio acotado (S/M) con alto impacto.
- **Proyecto**: cambio mayor (L) o requiere coordinación/infra.

| ID | Sev | Estado | Tipo | Área | Resumen |
|---|---|---|---|---|---|
| A-001 | Critical | Mitigado (en rama) | Quick win | Backend/Auth | Sanitizar respuestas de `auth.login`/`auth.register` para evitar fuga de campos sensibles + tests anti-regresión |
| A-002 | Critical | Mitigado (en rama) | Quick win | Backend/Permisos | `trpc-shield` a **fallback deny** + cobertura explícita para todas las `shieldedProcedure` + tests de cobertura |
| A-009 | Critical | Mitigado (en rama) | Quick win | Backend/Descargas | Prevenir **path traversal + IDOR** en `/download` y `/download-dir` + tests anti-regresión |
| A-003 | Medium | Abierto | Quick win | Frontend/Edge | Headers incompletos en producción (no se observa CSP / frame-ancestors / Permissions-Policy) |
| A-004 | Low | Abierto | Quick win | SEO | `sitemap.xml` con `lastmod` antiguo (2025-02-03) |
| A-005 | Medium | Abierto | Proyecto | Frontend/Perf | Bundle principal grande y warnings de build (chunk > 500 kB, Sass `@import` deprecado) |
| A-006 | High | Abierto | Proyecto | Dependencias | `npm audit` reporta vulnerabilidades **High** (backend y frontend), varias requieren upgrades major |
| A-007 | Medium | Abierto | Quick win | Backend/API | CORS/headers en API prod parecen demasiado permisivos (`Access-Control-Allow-Origin: *`) y faltan headers de hardening |
| A-008 | Medium | Mitigado (en rama) | Quick win | QA/AppSec | Tests/smoke podían disparar integraciones externas si `.env` tenía secretos; se aisló carga de env y se deshabilitaron integraciones en `NODE_ENV=test` |

## Detalle de hallazgos (con evidencia + remediación)

### A-001 — Sanitizar responses de auth (Critical)
- **Evidencia (código):**
  - `backend/src/routers/auth/procedures/login.ts`: ahora retorna `user: serializeUser(user)` (no retorna el modelo completo).
  - `backend/src/routers/auth/procedures/register.ts`: ahora retorna `user: serializeUser(newUser)` y evita llamadas externas si no hay keys configuradas.
  - Tests anti-regresión: `backend/test/api.test.ts` (búsqueda profunda de keys sensibles en la respuesta).
- **Cómo reproducir (antes del fix):**
  1. Ejecutar `auth.login` o `auth.register`.
  2. Inspeccionar el JSON de respuesta.
  3. Verificar si aparecen keys sensibles (`password`, `activationcode`, `refresh_token`, etc.).
- **Impacto:** exposición de secretos/tokens/códigos en tráfico normal de auth; facilita toma de cuenta, abuso de sesión y reuso de credenciales.
- **Probabilidad:** alta (si el frontend/logs/terceros capturan respuestas; también si un atacante ejecuta el flujo).
- **Recomendación concreta:** mantener un DTO explícito (ej. `serializeUser`) en todas las respuestas; agregar denylist de keys en tests (ya agregado).
- **Esfuerzo estimado:** **S**
- **Owner sugerido:** Backend/AppSec

### A-002 — Fallback deny + cobertura permisos (Critical)
- **Evidencia (código):**
  - `backend/src/permissions/index.ts`: `fallbackRule: deny` + reglas explícitas para `query` y `mutation`.
  - Tests:
    - `backend/test/permissions.test.ts`: (1) procedimiento sin regla debe dar 403, (2) cobertura estática: toda `shieldedProcedure` en `backend/src/routers` debe existir en `permissions`.
- **Cómo reproducir (antes del fix):**
  1. Identificar un `shieldedProcedure` sin regla explícita en `permissions`.
  2. Invocarlo como anónimo.
  3. Observar que puede ejecutar (por fallback permissivo).
- **Impacto:** bypass de autorización a endpoints protegidos; potencial acceso a operaciones admin o datos sensibles.
- **Probabilidad:** media-alta (regresiones al agregar nuevos procedimientos; superficie amplia).
- **Recomendación concreta:** mantener **deny-by-default** y forzar cobertura con test estático (ya agregado).
- **Esfuerzo estimado:** **M**
- **Owner sugerido:** Backend/AppSec

### A-009 — Path traversal / IDOR en endpoints de descargas (Critical)
- **Evidencia (código):**
  - Fixes:
    - `backend/src/endpoints/download.endpoint.ts`: ahora valida que `path` permanezca bajo `SONGS_PATH` (deny-by-default).
    - `backend/src/endpoints/download-dir.endpoint.ts`: valida `dirName` como filename seguro y requiere que coincida con el `downloadUrl` generado por el worker (evita IDOR).
    - Helper: `backend/src/utils/safePaths.ts`
  - Tests anti-regresión: `backend/test/downloadEndpoints.security.test.ts`
- **Cómo reproducir (antes del fix):**
  1. Obtener un `token` válido (sesión).
  2. Probar `/download?token=...&path=../../...` (o variantes) para intentar salir de `SONGS_PATH`.
  3. Probar `/download-dir?token=...&jobId=<job propio>&dirName=<otro zip existente>` para forzar descargar otro archivo.
- **Impacto:** exfiltración de archivos o bypass de control de acceso a descargas; superficie directa de negocio (contenido premium).
- **Probabilidad:** media-alta (input controlable; depende de layout/permisos del filesystem, pero la clase de bug es explotable).
- **Recomendación concreta:**
  - Mantener **deny-by-default** para rutas de filesystem (resolver siempre bajo un root y rechazar escapes).
  - En `/download-dir`, validar `dirName` contra el `downloadUrl` server-side para evitar IDOR.
  - (Defensa extra, pendiente): migrar de `token` en query string a tokens de descarga de vida corta (reduce fugas por referer/historial).
- **Esfuerzo estimado:** **S/M**
- **Owner sugerido:** Backend + AppSec

### A-003 — Headers de seguridad incompletos en producción (Medium)
- **Evidencia (pasivo, prod):**
  - Captura de headers: `audit-artifacts/prod-passive-2026-02-12/thebearbeat.com.headers.txt`
  - Observado: `strict-transport-security`, `x-content-type-options`, `referrer-policy`
  - No observado (en esa respuesta): `content-security-policy`, `permissions-policy`, `x-frame-options` o `frame-ancestors` (CSP).
- **Cómo reproducir:**
  - `curl -I https://thebearbeat.com/` (solo lectura).
- **Impacto:** menor defensa en profundidad contra XSS, clickjacking, y abuso de APIs del navegador.
- **Probabilidad:** media (depende de existencia de bugs XSS; headers son una capa adicional).
- **Recomendación concreta:** definir headers en Netlify (`netlify.toml`) y/o en `nginx` (si aplica) con:
  - CSP con `frame-ancestors 'none'` o allowlist.
  - `Permissions-Policy` restrictiva.
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (si el dominio y subdominios lo soportan).
- **Esfuerzo estimado:** **S/M**
- **Owner sugerido:** Frontend + SRE/AppSec

### A-004 — Sitemap con lastmod antiguo (Low)
- **Evidencia (pasivo, prod):**
  - `audit-artifacts/prod-passive-2026-02-12/sitemap.body.head200.txt` muestra `lastmod` `2025-02-03`.
- **Impacto:** SEO (crawlers pueden tardar más en reflejar cambios).
- **Probabilidad:** media (si el sitio cambia seguido).
- **Recomendación concreta:** automatizar generación/actualización del sitemap en build/deploy.
- **Esfuerzo estimado:** **S/M**
- **Owner sugerido:** Frontend/SEO

### A-005 — Bundle principal grande + warnings de build (Medium)
- **Evidencia (local build):**
  - `npm run build` reporta warnings de:
    - Sass `@import` deprecado (migrar a `@use`/`@forward`).
    - Chunks > 500 kB tras minificación (bundle principal grande).
- **Cómo reproducir:**
  - Ejecutar `npm run build` (en repo root).
- **Impacto:** tiempos de carga y ejecución mayores (riesgo en LCP/INP), especialmente en mobile/datos limitados.
- **Probabilidad:** alta (afecta a todos los usuarios).
- **Recomendación concreta:**
  - Code-splitting por ruta (React Router + `lazy()`), y/o `build.rollupOptions.output.manualChunks`.
  - Reducir CSS global (evitar mega `index.css`, revisar Bootstrap import completo vs parcial).
  - Migrar Sass `@import` → `@use` para compatibilidad futura.
- **Esfuerzo estimado:** **M/L**
- **Owner sugerido:** Frontend/Performance

### A-006 — Vulnerabilidades High en dependencias (High)
- **Evidencia:**
  - `npm audit` (JSON) guardado en:
    - `audit-artifacts/appsec-2026-02-12/deps/npm-audit.root.json`
    - `audit-artifacts/appsec-2026-02-12/deps/npm-audit.frontend.json`
    - `audit-artifacts/appsec-2026-02-12/deps/npm-audit.backend.json`
  - Resumen (high/critical): `audit-artifacts/appsec-2026-02-12/deps/npm-audit.summary.md`
- **Cómo reproducir:**
  - `npm audit` (root / `frontend` / `backend`).
- **Impacto:** riesgo de seguridad por CVEs/GHSAs en librerías; algunas afectan SSRF/DoS y bypasses de validación.
- **Probabilidad:** media (depende de rutas de ejecución, pero la exposición suele ser amplia con deps web).
- **Recomendación concreta:**
  - Plan de upgrade por etapas (idealmente PRs separados) para deps con fix available:
    - `conekta` (implica actualizar `axios` transitive)
    - `fastify` y `@fastify/secure-session` (validar si se usan en runtime; si no se usan, remover deps)
    - toolchain Prisma generators (`prisma-trpc-generator`, etc.) con compatibilidad.
  - Mantener `npm audit` en CI con baseline/allowlist temporal (si es inevitable) y fechas de remediación.
- **Esfuerzo estimado:** **M/L** (por upgrades major + regresiones potenciales)
- **Owner sugerido:** Backend + Frontend + AppSec

### A-007 — CORS/headers permisivos en API producción (Medium)
- **Evidencia (pasivo, prod API):**
  - `audit-artifacts/prod-passive-2026-02-12/thebearbeatapi.lat.analytics-health.headers.txt`
  - `audit-artifacts/prod-passive-2026-02-12/thebearbeatapi.lat.analytics-health.headers.allowed-origin.txt`
  - `audit-artifacts/prod-passive-2026-02-12/thebearbeatapi.lat.analytics-health.headers.evil-origin.txt`
- **Cómo reproducir (pasivo):**
  - `curl -I https://thebearbeatapi.lat/api/analytics/health`
  - `curl -I -H 'Origin: https://evil.example' https://thebearbeatapi.lat/api/analytics/health`
- **Impacto:** si se replica en endpoints sensibles, un CORS demasiado abierto puede facilitar abuso desde sitios terceros (especialmente si hay auth basada en cookies) y reduce defensa en profundidad.
- **Probabilidad:** media (la evidencia muestra wildcard en respuestas; falta confirmar alcance en endpoints con auth).
- **Recomendación concreta:**
  - Alinear configuración de CORS (allowlist) y revisar si `nginx` está inyectando headers globales.
  - Confirmar que producción ejecuta el mismo comportamiento que el repo (evitar divergencia config-código).
  - Agregar hardening headers en el dominio del API (HSTS, X-Content-Type-Options, etc.) cuando aplique.
- **Esfuerzo estimado:** **S/M**
- **Owner sugerido:** Backend + SRE/AppSec

### A-008 — Tests podían ejecutar integraciones externas por carga de `.env` (Medium)
- **Evidencia (código):**
  - `backend/src/utils/loadEnv.ts`: carga de env centralizada con `ENV_FILE`; en `NODE_ENV=test` usa `.env.example` por default.
  - `backend/jest.config.js` + `backend/test/setupEnv.ts`: Jest deja de cargar `backend/.env` automáticamente.
  - `backend/src/routers/auth/procedures/register.ts`: en `NODE_ENV=test` se omiten llamadas externas (Stripe/Conekta/Brevo/Facebook/ManyChat).
- **Cómo reproducir (antes del fix):**
  1. Tener un `backend/.env` con keys reales (ManyChat/Facebook/Stripe/etc.).
  2. Correr tests o smoke que ejecuten `auth.register`.
  3. Observar llamadas externas best-effort (riesgo de “side effects” y datos hacia terceros).
- **Impacto:** riesgo de efectos colaterales (eventos/usuarios creados en 3ros) y posible fuga accidental de datos desde entornos de test/dev.
- **Probabilidad:** media (común en equipos con `.env` local configurado).
- **Recomendación concreta:** mantener `ENV_FILE` en STAGING local y deshabilitar integraciones en tests (ya mitigado en rama).
- **Esfuerzo estimado:** **S**
- **Owner sugerido:** Backend + QA/AppSec

## Checklist compliance/config (estado actual)
Fuente (pasivo prod): `audit-artifacts/prod-passive-2026-02-12/thebearbeat.com.headers.txt`

- HTTPS: **OK**
- HSTS: **Parcial** (presente `max-age=31536000`; falta evaluar `includeSubDomains/preload`)
- `X-Content-Type-Options: nosniff`: **OK**
- `Referrer-Policy`: **OK** (`strict-origin-when-cross-origin`)
- CSP (`Content-Security-Policy`): **Pendiente**
- Anti-clickjacking (`frame-ancestors`/`X-Frame-Options`): **Pendiente**
- `Permissions-Policy`: **Pendiente**
- Cookies `Secure/HttpOnly/SameSite`: **Pendiente** (no se observaron `Set-Cookie` en la respuesta HTML; revisar rutas autenticadas/API)

## Estado de tests / cobertura
- Backend:
  - Jest: `backend/test/*`
  - Agregado: tests anti-regresión para A-001 + A-002.
  - Ajuste: Jest ahora carga env de forma segura (evita `backend/.env` por defecto) para prevenir side effects en tests (ver A-008).
  - Ejecutado (local STAGING DB): `npm test --workspace=backend -- --runInBand` **OK** (evidencia: `audit-artifacts/staging-local-2026-02-12/backend.jest.r3.txt`).
  - Build local: `npm run build --workspace=backend` **OK** (TypeScript + Prisma generate; sin requerir DB).
- Frontend:
  - Vitest: `npm test --workspace=frontend`
  - Tests locales: **OK** (2026-02-12).
  - Build local: `npm run build` **OK** (2026-02-12) con warnings (Sass `@import` deprecado; chunks > 500 kB).
- E2E:
  - Playwright smoke: `backend/scripts/smokeE2e.ts` (registro → planes → checkout success mock + login/admin opcional).
    - Hardening: contextos aislados para evitar “session bleed” por BroadcastChannel + guardrail para no correr en localhost si el frontend apunta a API prod.
    - Evidencia: `audit-artifacts/staging-local-2026-02-12/e2e.smoke.r5.txt`.
  - Playwright smoke (nuevo): reset password local sin email providers `backend/scripts/e2eResetPassword.ts` (`npm run e2e:reset-password --workspace=backend`).
    - Evidencia: `audit-artifacts/staging-local-2026-02-12/e2e.reset-password.r1.txt`.
  - Playwright (nuevo): flujos negativos + gating `backend/scripts/e2eNegativeFlows.ts` (`npm run e2e:negative --workspace=backend`).
    - Cubre: redirect anon `/descargas`, credenciales inválidas (login), redirect non-admin fuera de `/admin`, y error handling de checkout (mocked).
    - Evidencia: `audit-artifacts/staging-local-2026-02-13/e2e.negative.r4.txt`.
  - Auditorías existentes: `backend/scripts/auditFullSite.ts`.
  - Pendiente: suite E2E completa de flujos críticos (registro/login/reset/checkout/acceso a descargas/roles).

## Performance / Web Vitals (pendiente de medición)
Pendiente ejecutar Lighthouse/Web Vitals en:
- Landing `/`
- Registro `/auth/registro`
- Login `/auth`
- Planes `/planes`
- Checkout `/comprar`
- App `/micuenta`, `/descargas`

Regla: medición profunda + load solo en **STAGING**.

## Accesibilidad (WCAG) y SEO técnico (parcial)
- SEO (pasivo):
  - `robots.txt` existe y referencia `sitemap.xml` (ver `audit-artifacts/prod-passive-2026-02-12/robots.body.txt`)
  - Rutas privadas disallow: `/admin`, `/micuenta`, `/descargas`, `/comprar`, etc.
- Accesibilidad: pendiente `axe`/Lighthouse + teclado/foco en flujos críticos.

## AppSec checks ejecutados (sin tocar producción)
- Dependency audit (`npm audit`): ver `audit-artifacts/appsec-2026-02-12/deps/npm-audit.summary.md`.
- Secret scan (patrones high-confidence en archivos trackeados): **0 matches**  
  Evidencia: `audit-artifacts/appsec-2026-02-12/secrets/secret-scan.summary.md`.
- Quick scan de “risky sinks” (open redirect / DOM sinks): 3 matches para revisión manual  
  Evidencia: `audit-artifacts/appsec-2026-02-12/sast/rg-risky-sinks.txt`.

## Monitoreo / alertas / backups (pendiente)
Pendiente:
- Confirmar Sentry (FE/BE) y tasas de error (sin exponer PII).
- Dashboards/alertas (latencia p95/p99 en endpoints críticos, tasa de fallos de checkout, cola de jobs).
- Backups + restore drill (MySQL) y rotación de secretos.

## Plan de ejecución (restante)
1. **STAGING local**: Docker compose + migraciones + tests unit/integration validados; pendiente seeds + E2E (`docs/STAGING_LOCAL.md`).
2. **Fase 1 (QA)**: E2E Playwright/Cypress para flujos críticos en STAGING.
3. **Fase 2 (AppSec)**: SAST + dependency audit + secret scanning (repo + historial).
4. **Fase 3 (Perf)**: Lighthouse + profiling + (final) load test con k6/artillery en STAGING.
5. **Fase 4 (A11y/SEO)**: axe + checks técnicos.
6. **Fase 5 (SRE)**: logging/PII, observabilidad, backups/DR, hardening CI/CD.

## Accesos humanos (solo si se vuelve inevitable)
Por ahora no bloquea. Puede ser necesario más adelante para:
- Aplicar headers/redirects a nivel Netlify si no están versionados en repo o si el deploy no lo toma.
- Revisar/activar Sentry/monitoring (tokens/DSN) si no están en CI/entornos.
- Confirmar configuración de VPS/nginx (headers server-side, rate limiting, logs).
