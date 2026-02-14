# STAGING Local (Reproducible, sin tocar produccion)

Objetivo: levantar **frontend + backend** en `localhost` con **MySQL + Redis** via Docker, usando configs reproducibles (similares a CI) y sin depender de credenciales externas.

> Regla: cualquier **DAST (ZAP)** o **load/perf** debe correr **solo** contra este STAGING local (o un STAGING remoto confirmado).

## Requisitos
- Docker Desktop
- Node `24.x` + `npm`

## 1) Levantar MySQL + Redis (solo local)
```bash
docker compose -f backend/docker-compose.staging.yml up -d
```

Opcional (sanity check):
```bash
docker ps --filter name=bearbeat-staging-
```

## 2) Variables de entorno (sin secretos reales)

### Backend
1. Crear un env file local (no se commitea):
```bash
cp backend/.env.example backend/.env.staging.local
```

Nota: cuando ejecutas scripts con `--workspace=backend`, el `cwd` es `backend/`. Por eso en los comandos se usa `ENV_FILE=.env.staging.local` (no `backend/.env.staging.local`).

2. Editar `backend/.env.staging.local` y definir **minimo**:
```bash
NODE_ENV=development
PORT=5001
CLIENT_URL=http://localhost:3000

DATABASE_URL=mysql://root:root@127.0.0.1:3310/bearbeat_staging
JWT_SECRET=change-me-local-only

REDIS_HOST=127.0.0.1
REDIS_PORT=6380
COMPRESSION_QUEUE_NAME=bearbeat_staging_compression
REMOVE_USERS_QUEUE_NAME=bearbeat_staging_remove_users
```

Notas:
- Para **pagos**, por defecto deja keys vacias (Stripe/Conekta/PayPal). En local, los flujos deben comportarse en modo sandbox/mock (sin cobros reales).
- Turnstile: en no-produccion se permite bypass; para tests se puede usar el token `__TURNSTILE_LOCAL_BYPASS__`.

### Frontend
1. Crear env file local:
```bash
cp frontend/.env.example frontend/.env.local
```

2. Editar `frontend/.env.local` (minimo):
```bash
REACT_APP_ENVIRONMENT=development
REACT_APP_API_BASE_URL=http://localhost:5001
REACT_APP_TRPC_URL=http://localhost:5001/trpc
```

## 3) Migraciones de DB (solo DB local)
Antes de aplicar migraciones, revisa el estado para confirmar si STAGING local esta atrasado.

### 3.1) Ver estado de migraciones (STAGING local)
```bash
DATABASE_URL="mysql://root:root@127.0.0.1:3310/bearbeat_staging" \
npx prisma migrate status --schema backend/prisma/schema.prisma
```

### 3.2) Aplicar migraciones (STAGING local)
Esto aplica migraciones Prisma **solo** a `bearbeat_staging` (puerto `3310` por default). No hace resets.

```bash
DATABASE_URL="mysql://root:root@127.0.0.1:3310/bearbeat_staging" \
npx prisma migrate deploy --schema backend/prisma/schema.prisma
```

### Nota importante: tests no deben correr contra STAGING
Los tests (`npm test --workspace=backend`) deben correr contra una DB **de test** (`bearbeat_test`) como en CI.

Para replicar CI localmente sin depender de `bearbeat_staging`:
```bash
npm run test:local
```

Variables opcionales:
- `TEST_MYSQL_PORT` (default `3306`)
- `TEST_KEEP_DB=1` para no apagar la DB al terminar

Nota (puerto 3306): si ya tienes MySQL local u otro servicio usando `3306`, usa otro puerto:
```bash
TEST_MYSQL_PORT=3307 npm run test:local
```

## 4) Seeds (usuarios/planes de prueba)
Estos scripts se rehusan a correr si `DATABASE_URL` **no parece local** (guardrail).

1. Definir password de auditoria (no se imprime):
```bash
export AUDIT_SEED_PASSWORD="un-password-largo-de-10+"
```

2. Crear/actualizar admin local:
```bash
ENV_FILE=.env.staging.local npm run seed:audit-user --workspace=backend
```

3. Crear/actualizar planes minimos:
```bash
ENV_FILE=.env.staging.local npm run seed:audit-plan --workspace=backend
```

Credenciales default:
- Admin: `audit-admin@local.test`
- Password: `$AUDIT_SEED_PASSWORD`

## 5) Arrancar backend + frontend
Backend:
```bash
ENV_FILE=.env.staging.local npm run dev --workspace=backend
```

Frontend:
```bash
REACT_APP_ENVIRONMENT=development \
REACT_APP_API_BASE_URL=http://localhost:5001 \
npm run dev --workspace=frontend
```

Abrir:
- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:5001/health/sentry` (si esta habilitado en no-produccion)

## 6) E2E Smoke (Playwright) contra STAGING local
Recomendado: arrancar servers manualmente (seccion 5) y correr smoke sin boot automatico.

```bash
SMOKE_START_SERVERS=0 \
REACT_APP_ENVIRONMENT=development \
REACT_APP_API_BASE_URL=http://localhost:5001 \
SMOKE_LOGIN_EMAIL="audit-admin@local.test" \
SMOKE_LOGIN_PASSWORD="$AUDIT_SEED_PASSWORD" \
ENV_FILE=.env.staging.local \
npm run e2e:smoke --workspace=backend
```

Reset password (sin email providers; genera un usuario local + token en DB local y valida el flujo UI):
```bash
ENV_FILE=.env.staging.local \
npm run e2e:reset-password --workspace=backend
```

Negative flows (auth gating + credenciales invalidas + checkout error mocked):
```bash
ENV_FILE=.env.staging.local \
npm run e2e:negative --workspace=backend
```

## 7) Apagar STAGING local
```bash
docker compose -f backend/docker-compose.staging.yml down
```
