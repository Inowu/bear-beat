# Si thebearbeat.com sigue en 404 (Netlify)

## 1. Revisar que netlify.toml esté en el repo
En la raíz del repo debe existir `netlify.toml` con:
- `base = "frontend"`
- `command = "npm run build"`
- `publish = "build"`

## 2. En Netlify Dashboard → Site → Build & deploy → Build settings

Comprueba que coincida con el `netlify.toml` (el toml tiene prioridad, pero si hay 404 puede que no se esté leyendo):

| Setting           | Debe ser          |
|-------------------|-------------------|
| Base directory    | `frontend`        |
| Build command     | `npm run build`   |
| Publish directory | `build`           |

Si **Base directory** está vacío en la UI, entonces:
- Build command: `cd frontend && npm run build`
- Publish directory: `frontend/build`

## 3. Ver el último deploy
- Deploys → último deploy → "Build log".
- Si el build falla, no se publican archivos y verás 404.
- Si el build pasa, revisa que "Publish directory" contenga `index.html`.

## 4. Probar deploy manual
- Deploys → "Trigger deploy" → "Deploy site".
- Espera a que termine y recarga https://thebearbeat.com

---

## 5. Sentry (variable de entorno en Netlify)

Para que Sentry reciba errores en producción:

1. **Netlify Dashboard** → tu sitio (thebearbeat) → **Site configuration** → **Environment variables**.
2. **Add a variable** (o "Add new variable" / "New variable").
3. **Key:** `REACT_APP_SENTRY_DSN`
4. **Value:**  
   `https://b1199b86d9489b928d5a58660bc79c6b@o4508382588305408.ingest.us.sentry.io/4510831772237824`
5. **Scopes:** marca **All scopes** (o al menos "Production" y "Deploy previews" si quieres).
6. **Importante:** Guarda y haz un **nuevo deploy** (Deploys → "Trigger deploy" → "Deploy site"). En Create React App el DSN se incluye en el build; si la variable se añadió después del último deploy, el sitio actual **no** tiene Sentry hasta que vuelvas a desplegar.

**Desde la terminal** (después de `netlify login` y `netlify link`):

```bash
netlify env:set REACT_APP_SENTRY_DSN "https://b1199b86d9489b928d5a58660bc79c6b@o4508382588305408.ingest.us.sentry.io/4510831772237824"
```

Luego dispara un deploy desde el dashboard o con `netlify deploy --prod`.

**Si el wizard de Sentry sigue en "Waiting to receive first event":**
- Abre la **consola del navegador** (F12) en tu sitio en producción. Si sale `[Sentry] REACT_APP_SENTRY_DSN no definido`, la variable no estuvo en el build: añádela en Netlify y haz **Trigger deploy** de nuevo.
- Si sale **429 (Too Many Requests)**, la cuota de Sentry está llena: espera unos minutos o revisa Sentry → Settings → Usage.
- Revisa en **Sentry → Issues** si el error "This is your first error!" ya llegó (a veces el wizard no se actualiza pero el evento sí está).
