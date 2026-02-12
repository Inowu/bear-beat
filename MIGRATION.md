# Migración Legacy -> Stack Actual (sin cambio funcional)

Fecha: 2026-02-12

## 1) Versión de Node fijada

Se estandarizó el proyecto en **Node 24 LTS** (`v24.13.1`).

Dónde se configura:

- `/.nvmrc`
- `/backend/.nvmrc`
- `/frontend/.nvmrc`
- `/package.json` -> `engines.node = "24.x"`
- `/backend/package.json` -> `engines.node = "24.x"`
- `/frontend/package.json` -> `engines.node = "24.x"`
- `/netlify.toml` -> `NODE_VERSION = "24"`
- `/backend/Dockerfile` y `/backend/Dockerfile.sse` -> imagen base `node:24.13.1-alpine`
- `/.github/workflows/backend-deploy.yml` -> usa `backend/.nvmrc` en lugar de `nvm default`
- `/deploy.sh` -> intenta seleccionar la versión de `backend/.nvmrc` antes de instalar/build

## 2) Comandos de build/test

Local (repositorio raíz):

```bash
npm run build
npm test --workspace=backend -- --runInBand
npm test --workspace=frontend
```

CI:

- Se agregó `/.github/workflows/ci.yml` para ejecutar:
  - `npm ci`
  - migraciones de Prisma sobre MySQL efímero de CI
  - `npm test --workspace=backend -- --runInBand`
  - `npm run build --workspace=backend`
  - `npm run build`
  - `npm test --workspace=frontend`

## 3) Cambios de dependencias (incrementales, sin major)

Backend:

- `@trpc/server` -> `10.45.4`
- `axios` -> `^1.13.5`
- `conekta` -> `^6.0.3`
- `dd-trace` -> `^4.55.0`
- `express` -> `^4.22.1`
- `firebase-admin` -> `^13.6.1`
- `prisma-zod-generator` -> `0.8.15`
- `twilio` -> `^5.12.1`
- `zod` -> `^3.25.76`
- `body-parser` -> `^1.20.4`
- `compression` -> `^1.8.1`
- `cors` -> `^2.8.6`
- `dotenv` -> `^16.6.1`
- `jsonwebtoken` -> `^9.0.3`

Frontend:

- `@trpc/client` -> `10.45.4`
- `ejs` -> `^3.1.10`
- `react-router-dom` -> `^6.30.3`
- `axios` -> `^1.13.5`
- `bootstrap` -> `^5.3.8`
- `formik` -> `^2.4.9`
- `react-bootstrap` -> `^2.10.10`
- `react-icons` -> `^4.12.0`
- `yup` -> `^1.7.1`
- Migración de bundler/test runner de `react-scripts` (CRA) a `vite` + `vitest`
- Se movieron binarios de Rollup a `optionalDependencies` para evitar fallas cross-platform de `npm` (Mac/Linux) durante `npm ci`

Root:

- `yup` -> `^1.7.1`
- `axios` -> `^1.13.5`
- `overrides` para forzar versión segura de `axios` donde aplica
- `overrides` para `@types/request@2.48.13` (evita arrastrar `form-data` vulnerable por tipados legacy)

Notas:

- Se evitó actualizar majors (React 19, Fastify 5, Prisma 7, etc.) para minimizar riesgo.
- Se actualizó `package-lock.json` para reproducibilidad.

## 4) Cobertura de humo y estabilidad

- Se mantuvieron y ejecutaron smoke tests actuales.
- Se reforzó `backend/test/api.test.ts` para crear/asegurar roles base (`admin`/`normal`) dentro del test, reduciendo dependencia de estado previo de DB.
- Se agregó `pretest` en backend para ejecutar `prisma generate` automáticamente antes de Jest.

## 5) Riesgos residuales y cómo probar paridad

Riesgos residuales:

- Warnings de ESLint en frontend existentes (no bloqueantes).
- Warnings de Sass deprecado (`@import`) durante `vite build` (no bloqueantes hoy, pero conviene migrar a `@use/@forward` en una fase separada).
- `backend` smoke tests dependen de una DB disponible y configurada.
- `npm audit` queda en **15 vulnerabilidades** (11 high, 4 low, 0 moderate, 0 critical) por dependencias que requieren cambios mayores o sin parche compatible:
  - `conekta` (para cerrar axios transitive requiere migrar a major 7)
  - `@fastify/secure-session` / `fastify` (requieren major para parche completo)
  - `prisma-trpc-generator` chain (requiere major)
  - `pm2` (advisory sin fix disponible al momento)

Checklist rápida de paridad:

1. Home carga y CTA principal navega a registro.
2. Login/registro funcionan.
3. Flujo planes -> checkout -> success (entorno de prueba).
4. API auth (`login`/`me`) responde igual.
5. Rutas admin críticas cargan tras autenticación.

## 6) Rollback rápido

Si necesitas revertir la migración:

1. Volver `/.nvmrc`, `/backend/.nvmrc`, `/frontend/.nvmrc` a la versión previa.
2. Revertir `engines` y configuración de deploy/hosting (`netlify.toml`, workflows, Dockerfiles).
3. Restaurar `package.json` y `package-lock.json` al commit anterior.
4. Ejecutar `npm ci` y validar con los mismos comandos de build/test.
