# Bear Beat

- **Documentación completa:** ver carpeta [docs/](docs/). Destacado: [docs/CAMBIOS-UX-MOBILE-APP-NATIVA-Y-DEPLOY.md](docs/CAMBIOS-UX-MOBILE-APP-NATIVA-Y-DEPLOY.md) para UX/UI, experiencia móvil tipo app nativa y **deploy a producción** (Netlify).

---

## Qué necesitas para correr el proyecto en local y hacer cambios

### Requisitos

- **Node.js** v18 (recomendado; el backend usa `.nvmrc` con `v18.18.2`)
- **npm** (viene con Node)
- **Docker** y **Docker Compose** (para MySQL y, opcionalmente, Redis)
- **Git**

### 1. Clonar e instalar dependencias

```bash
# En la raíz del repo
npm install
```

Esto instala dependencias del monorepo y de los workspaces `backend` y `frontend`.

### 2. Base de datos (MySQL)

El backend usa MySQL vía Prisma. La base se levanta con Docker:

```bash
cd backend
# Crea un .env en backend/ con al menos (ver punto 3):
# DATABASE_NAME=bearbeat
# DATABASE_USER=user
# DATABASE_PASSWORD=password
# DATABASE_PORT=3306
docker compose up -d db
cd ..
```

Asegúrate de tener el archivo `.env` en `backend/` antes de levantar el contenedor si usas variables como `DATABASE_NAME`, `DATABASE_USER`, etc. en el `docker-compose.yaml`.

### 3. Archivo `.env` del backend

En **`backend/.env`** debe existir un archivo de variables de entorno. El backend lo carga desde `backend/.env`. Sin este archivo la API no arranca correctamente.

Variables **mínimas** para desarrollo local:

- **`DATABASE_URL`** – URL de conexión a MySQL, por ejemplo:  
  `mysql://USER:PASSWORD@localhost:3306/DATABASE_NAME`
- **`PORT`** – Puerto del servidor (ej: `5000`)
- **`JWT_SECRET`** – Clave secreta para los JWT (cualquier string largo y aleatorio)

Otras variables que usa el proyecto (puedes dejarlas vacías o con valores de prueba para desarrollo):

- Stripe: `STRIPE_KEY`, `STRIPE_TEST_KEY`, `STRIPE_WH_SECRET`, `STRIPE_WH_PI_SECRET`, `STRIPE_WH_PRODUCTS_SECRET`, `STRIPE_API_VERSION`
- PayPal: `PAYPAL_URL`, `PAYPAL_SANDBOX_URL`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_TEST_CLIENT_ID`, `PAYPAL_TEST_CLIENT_SECRET`, `PAYPAL_WH_ID`, `PAYPAL_TEST_WH_ID`
- Conekta, Twilio, Turnstile (Cloudflare)
- FTP/SFTP: `FTP_HOST`, `SFTP_PORT`, `FTP_USERNAME`, `FTP_PASSWORD`
- Meilisearch: `MEILISEARCH_HOST`, `MEILISEARCH_KEY`
- Rutas: `SONGS_PATH`, `COMPRESSED_DIRS_NAME`
- Redis, colas: `REMOVE_USERS_QUEUE_NAME`, etc.
- Facebook: `FACEBOOK_ACCESS_TOKEN`, `FACEBOOK_PIXEL_ID`

Para producción o pruebas más completas, rellena las que uses según la documentación en [docs/](docs/).

### 4. Prisma (schema y migraciones)

Con la base de datos levantada y `DATABASE_URL` en `backend/.env`:

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
# o, si quieres aplicar migraciones pendientes en desarrollo:
# npx prisma migrate dev
cd ..
```

### 5. Arrancar backend y frontend

**Solo backend (API):**

```bash
cd backend
npm run dev
```

El servidor corre con `nodemon` (recarga al cambiar archivos). Escucha en el `PORT` definido en `.env`.

**Solo frontend (React):**

```bash
cd frontend
npm run start
```

Abre el navegador en la URL que indique (normalmente `http://localhost:3000`). El frontend llama a la API; si la API está en otro host/puerto, puede que necesites configurar la URL base (por ejemplo en `frontend/src` o con variables de entorno).

**Backend y frontend a la vez (desde la raíz):**

```bash
# En la raíz del repo (donde están backend/ y frontend/)
npm run start
```

Esto ejecuta en paralelo el backend (`npm run dev` en `backend`) y el frontend (`npm run start` en `frontend`) usando `concurrently.js`.

### 6. Hacer cambios

- **Backend:** código en `backend/src/`. TypeScript; `nodemon` reinicia el proceso al guardar.
- **Frontend:** código en `frontend/src/`. React con TypeScript; el dev server recarga al guardar.
- **Prisma:** tras cambiar `backend/prisma/schema.prisma`, ejecuta `npx prisma generate` (y si aplica, `npx prisma migrate dev`) dentro de `backend/`.
- **Variables de entorno:** cualquier cambio en `backend/.env` requiere reiniciar el backend.

---

## Resumen rápido (ya con `.env` y DB creada)

```bash
npm install
cd backend && docker compose up -d db && npx prisma generate && npx prisma migrate deploy && cd ..
npm run start
```

(Luego abres el frontend en el puerto que indique, por ejemplo `http://localhost:3000`, y la API en `http://localhost:5000` si `PORT=5000`.)

---

## Running backend (referencia)

- Start the database:  
  `cd backend && docker compose up -d db`
- Run the API (needs `backend/.env`):  
  `cd backend && npm run dev`

## Running both projects

From the repo root:

```bash
npm run start
```

This runs both backend and frontend concurrently.
