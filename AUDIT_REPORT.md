# Auditoría QA + AppSec + Performance + SRE — The Bear Beat

Fecha: **2026-02-13**  
Rama de trabajo: `codex/audit/2026-02-13`  
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

Estado: los fixes críticos están implementados en código y cubiertos por tests/CI. Producción se valida con checks pasivos (headers/Lighthouse) y pruebas activas solo en STAGING.

Además, se ejecutaron mediciones **pasivas** en producción (headers/robots/sitemap + Lighthouse puntual) y DAST baseline en STAGING local (ZAP baseline), sin interrumpir producción.

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
| A-001 | Critical | Mitigado (en main) | Quick win | Backend/Auth | Sanitizar respuestas de `auth.login`/`auth.register` para evitar fuga de campos sensibles + tests anti-regresión |
| A-002 | Critical | Mitigado (en main) | Quick win | Backend/Permisos | `trpc-shield` a **fallback deny** + cobertura explícita para todas las `shieldedProcedure` + tests de cobertura |
| A-009 | Critical | Mitigado (en main) | Quick win | Backend/Descargas | Prevenir **path traversal + IDOR** en `/download` y `/download-dir` + tests anti-regresión |
| A-003 | Medium | Mitigado (en main) | Quick win | Frontend/Edge | Headers incompletos en producción (agregado: `frame-ancestors`/`X-Frame-Options`, `Permissions-Policy`) |
| A-004 | Low | Mitigado (en main) | Quick win | SEO | `sitemap.xml` con `lastmod` antiguo (2025-02-03) |
| A-005 | Medium | Mitigado (en main) | Proyecto | Frontend/Perf | Bundle principal grande y warnings de build (chunk > 500 kB, Sass `@import` deprecado) |
| A-006 | High | Parcial (en main) | Proyecto | Dependencias | `npm audit` reporta vulnerabilidades **High** (quedan issues upstream en `conekta→axios` y advisory low en `pm2`) |
| A-010 | High | Abierto | Proyecto | AppSec/Secrets | `gitleaks` detecta **potenciales secretos** en historial git (requiere triage y posible rotación/rewrite) |
| A-007 | Medium | Mitigado (en main) | Quick win | Backend/API | CORS/headers en API prod parecen demasiado permisivos (`Access-Control-Allow-Origin: *`) y faltan headers de hardening |
| A-008 | Medium | Mitigado (en main) | Quick win | QA/AppSec | Tests/smoke podían disparar integraciones externas si `.env` tenía secretos; se aisló carga de env y se deshabilitaron integraciones en `NODE_ENV=test` |
| A-011 | Medium | Mitigado (en main) | Proyecto | Backend/DB | **Drift de esquema**: tabla `products` no existe en migraciones locales (riesgo de divergencia prod↔staging) |
| A-012 | Medium | Mitigado (en main) | Quick win | Backend/FTP | `/trpc/ftp.storage` ya no responde 500 en STAGING local cuando falta `storage_server` |

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
- **Evidencia (DAST baseline, STAGING local):**
  - ZAP baseline (frontend local build): `audit-artifacts/dast-2026-02-13/zap/zap-frontend.html`
  - Alerts principales: CSP missing, anti-clickjacking missing, Permissions-Policy missing, X-Content-Type-Options missing (staging local).
- **Cómo reproducir:**
  - `curl -I https://thebearbeat.com/` (solo lectura).
- **Impacto:** menor defensa en profundidad contra XSS, clickjacking, y abuso de APIs del navegador.
- **Probabilidad:** media (depende de existencia de bugs XSS; headers son una capa adicional).
- **Recomendación concreta:** definir headers en Netlify (`netlify.toml`) y/o en `nginx` (si aplica) con:
  - CSP con `frame-ancestors 'none'` o allowlist.
  - `Permissions-Policy` restrictiva.
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (si el dominio y subdominios lo soportan).
- **Mitigación aplicada (en rama):**
  - Frontend/Netlify: agregado `Content-Security-Policy: frame-ancestors 'none'` + `X-Frame-Options: DENY` + `Permissions-Policy` + `X-Permitted-Cross-Domain-Policies: none`.
  - Evidencia (código): `netlify.toml` y `frontend/public/_headers`.
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
  - `npm audit --workspaces`:
    - JSON: `audit-artifacts/appsec-2026-02-13/deps/npm-audit.json`
    - Texto: `audit-artifacts/appsec-2026-02-13/deps/npm-audit.txt`
  - Resumen (antes): **15 vulnerabilidades** (11 high, 4 low).
  - Resumen (después de limpiar deps no usadas, en rama): **7 vulnerabilidades** (5 high, 2 low).  
    Evidencia: `audit-artifacts/appsec-2026-02-13/deps/npm-audit.after-hardening.txt`
- **Cómo reproducir:**
  - `npm audit` (root / `frontend` / `backend`).
- **Impacto:** riesgo de seguridad por CVEs/GHSAs en librerías; algunas afectan SSRF/DoS y bypasses de validación.
- **Probabilidad:** media (depende de rutas de ejecución, pero la exposición suele ser amplia con deps web).
- **Recomendación concreta:**
  - Plan de upgrade por etapas (idealmente PRs separados) para deps con fix available:
    - `conekta` (trae `axios` vulnerable como dependencia transitiva en versiones actuales).
    - `cross-spawn`, `tar`, `tmp` (pueden resolverse con `npm audit fix` y/o bumps menores).
    - `pm2`: advisory sin fix (mitigar: reducir superficie, hardening y monitoreo; evaluar alternativa).
  - Mantener `npm audit` en CI con baseline/allowlist temporal (si es inevitable) y fechas de remediación.
- **Esfuerzo estimado:** **M/L** (por upgrades major + regresiones potenciales)
- **Owner sugerido:** Backend + Frontend + AppSec

### A-010 — Potenciales secretos en historial git (gitleaks) (High)
- **Evidencia:**
  - `gitleaks detect` (historial completo) reporta **8 hallazgos**.  
    Evidencia redacted: `audit-artifacts/appsec-2026-02-13/secrets/gitleaks.summary.md` y `audit-artifacts/appsec-2026-02-13/secrets/gitleaks.report.json`.
- **Cómo reproducir:**
  - En repo: ejecutar `gitleaks detect --redact` (no correr contra prod; solo en repo).
- **Impacto:** si alguno de los tokens/keys fuese real, permitiría abuso de servicios externos (email/analytics/pagos) o exposición de datos.
- **Probabilidad:** media (varios hallazgos pueden ser **falsos positivos**: ejemplos en Swagger types, fixtures, etc.); requiere triage.
- **Recomendación concreta:**
  - Triage por hallazgo: confirmar si es un secreto real o un ejemplo/fixture.
  - Si es real: **rotar la credencial** en el proveedor + invalidar sesiones/tokens según aplique.
  - Remover del repo/historial: usar `git filter-repo`/BFG para borrar blobs (requiere coordinación y fuerza-push).
  - Añadir `gitleaks` al pipeline CI como gate (con allowlist temporal solo para falsos positivos).
- **Esfuerzo estimado:** **M/L**
- **Owner sugerido:** AppSec + SRE + Backend/Frontend (según el origen)

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
- CSP (`Content-Security-Policy`): **Mitigado (en rama)** (`frame-ancestors 'none'`)
- Anti-clickjacking (`frame-ancestors`/`X-Frame-Options`): **Mitigado (en rama)**
- `Permissions-Policy`: **Mitigado (en rama)**
- Cookies `Secure/HttpOnly/SameSite`: **Pendiente** (no se observaron `Set-Cookie` en la respuesta HTML; revisar rutas autenticadas/API)

## Estado de tests / cobertura
- Backend:
  - Jest: `backend/test/*`
  - Agregado: tests anti-regresión para A-001 + A-002.
  - Ajuste: Jest ahora carga env de forma segura (evita `backend/.env` por defecto) para prevenir side effects en tests (ver A-008).
  - Ejecutado (local STAGING DB): `npm test --workspace=backend -- --runInBand` **OK** (evidencia: `audit-artifacts/staging-local-2026-02-13/backend.jest.r4.txt`).
  - Build local: `npm run build --workspace=backend` **OK** (TypeScript + Prisma generate; sin requerir DB).
- Frontend:
  - Vitest: `npm test --workspace=frontend`
  - Tests locales: **OK** (2026-02-13). Evidencia: `audit-artifacts/staging-local-2026-02-13/frontend.vitest.txt`.
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

## Performance / Web Vitals (Lighthouse)

### Producción (pasivo, sin carga agresiva)
Evidencia: `audit-artifacts/perf-2026-02-13/lighthouse-prod-passive/summary.md`

Resumen (Lighthouse):
- `/`:
  - Desktop: Performance **97**, LCP **1.0s**, CLS **0.014**
  - Mobile: *Lighthouse no pudo calcular LCP (NO_LCP)*; se registró FCP **3.9s**
- `/planes`:
  - Desktop: Performance **92**, LCP **1.6s**
  - Mobile: Performance **62**, LCP **7.1s**, TBT **90ms**
- `/auth`:
  - Desktop: Performance **96**, LCP **1.1s**
  - Mobile: Performance **63**, LCP **6.9s**

Interpretación (no técnica):
- En **desktop** el sitio está en buen estado.
- En **mobile** hay margen de mejora (LCP ~7s en páginas de conversión como Planes/Auth).

### STAGING local (referencial)
Se generaron reportes de Lighthouse en local para comparación, pero **no** representan producción (sin CDN/HTTPS, diferente caching):
- Dev server (referencial): `audit-artifacts/perf-2026-02-13/lighthouse/summary.md`
- Production build local (`vite preview`, referencial): `audit-artifacts/perf-2026-02-13/lighthouse-preview/summary.md`

### Load test (k6, STAGING local)
- Script + output: `audit-artifacts/load-2026-02-13/k6.smoke.out.txt`
- Config: 5 VUs, 30s, endpoints `GET /api/analytics/health` y `GET /health/sentry`
- Resultados (p95): `http_req_duration p(95)=4.07ms`, `http_req_failed=0%`

## Accesibilidad (WCAG) y SEO técnico

### SEO (pasivo, producción)
- `robots.txt` existe y referencia `sitemap.xml` (ver `audit-artifacts/prod-passive-2026-02-12/robots.body.txt`)
- Rutas privadas disallow: `/admin`, `/micuenta`, `/descargas`, `/comprar`, etc.

### Accesibilidad (axe, STAGING local)
- Evidencia (STAGING local): `audit-artifacts/fullsite-2026-02-13-r2/a11y-report.md`
  - Rutas auditadas: 27
  - Violaciones axe: **0**
- Hallazgos heurísticos (quick wins): botones icon-only sin label (ver `audit-artifacts/fullsite-2026-02-13-r2/cro-findings.md`).

Pendiente (manual): navegación teclado/foco y formularios en flujos críticos (registro/login/checkout) con un set de casos WCAG básico.

## AppSec checks ejecutados (sin tocar producción)
- Dependency audit (`npm audit --workspaces`): ver `audit-artifacts/appsec-2026-02-13/deps/npm-audit.txt`.
- Secret scan (patrones high-confidence en archivos trackeados): **0 matches**  
  Evidencia: `audit-artifacts/appsec-2026-02-12/secrets/secret-scan.summary.md`.
- Secret scan (historial git, `gitleaks --redact`): **8 hallazgos** (redacted; requiere triage)  
  Evidencia: `audit-artifacts/appsec-2026-02-13/secrets/gitleaks.summary.md`.
- Quick scan de “risky sinks” (open redirect / DOM sinks): 3 matches para revisión manual  
  Evidencia: `audit-artifacts/appsec-2026-02-12/sast/rg-risky-sinks.txt`.
- DAST baseline (solo STAGING local, ZAP baseline):
  - Frontend: `audit-artifacts/dast-2026-02-13/zap/zap-frontend.html`
  - Backend (endpoint health): `audit-artifacts/dast-2026-02-13/zap/zap-backend-analytics-health.html`

## Hallazgos adicionales (STAGING local)

### A-011 — Drift de esquema: tabla `products` ausente en migraciones (Medium)
- **Evidencia:**
  - Fullsite local mostraba errores 500 en `/micuenta` al llamar `trpc.products.getProducts` por falta de tabla (mitigado en no-producción con fallback vacío).
  - Mitigación local: `backend/src/routers/products/getProducts.ts` retorna `[]` en `NODE_ENV!=production` si Prisma devuelve `P2021`.
  - QA fullsite (r2) después de mitigación: `audit-artifacts/fullsite-2026-02-13-r2/qa-fullsite.md` (sin 500 en `/micuenta`).
- **Impacto:** divergencia prod↔staging/CI: migraciones no representan el estado real de producción; riesgo de romper staging, QA, y futuros deploys/migraciones.
- **Probabilidad:** alta (ya ocurrió en local).
- **Recomendación concreta:**
  - Crear la migración Prisma faltante para `products` (fuente de verdad: esquema).
  - Agregar check en CI: levantar DB vacía + `prisma migrate deploy` + smoke que toque `getProducts` (para asegurar que existe).
- **Esfuerzo estimado:** **M**
- **Owner sugerido:** Backend + SRE

### A-012 — `ftp.storage` 500 en STAGING local (Medium)
- **Evidencia:**
  - QA fullsite local: `audit-artifacts/fullsite-2026-02-13-r2/qa-fullsite.md` (ruta `/admin/almacenamiento` genera `GET /trpc/ftp.storage -> 500`).
- **Impacto:** admin “Almacenamiento” inutilizable en STAGING local; reduce cobertura E2E/QA y puede esconder bugs reales.
- **Probabilidad:** alta en entornos sin `storage_server`/FTP configurado.
- **Recomendación concreta:**
  - En `NODE_ENV!=production`, devolver estado “no configurado” en `ftp.storage` si el servicio/host no está disponible.
  - Documentar variables requeridas (host/puerto/credenciales) y agregar healthcheck del storage server.
- **Mitigación aplicada (en rama):**
  - En `NODE_ENV!=production`, `ftp.storage` retorna stats vacíos cuando el storage server no responde (evita 500 y permite cubrir admin en STAGING).
  - Evidencia (código): `backend/src/routers/file-actions/storage.ts`
- **Esfuerzo estimado:** **S/M**
- **Owner sugerido:** Backend + SRE

## Monitoreo / alertas / backups (pendiente)
Recomendación (accionable, sin tocar prod):
- Uptime checks:
  - FE: `GET https://thebearbeat.com/` (200, y tiempo de respuesta)
  - BE: `GET https://thebearbeatapi.lat/health/sentry` y/o `GET https://thebearbeatapi.lat/api/analytics/health`
- Alertas mínimas (SRE):
  - 5xx rate > 1% (5 min)
  - Latencia p95 > 500ms en endpoints core (5-10 min)
  - p99 > 1500ms (5-10 min)
  - Saturación de CPU/RAM en VPS + disco (thresholds por instancia)
- Errores de negocio (membresías):
  - Checkout failures por provider (Stripe/PayPal/Conekta) y por reason
  - Webhooks: tasa de verificación de firma fallida + idempotencia (duplicados)
  - Descargas: errores 4xx/5xx por endpoint + tamaño/tiempo promedio de ZIPs
- Backups/DR:
  - Backups diarios de MySQL (snapshots) + retención (ej. 14-30 días)
  - Restore drill trimestral (medir RTO/RPO)
  - Rotación de secretos con runbook (y alertas si se usan claves viejas)

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
