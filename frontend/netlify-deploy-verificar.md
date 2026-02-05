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

**Si el wizard de Sentry sigue en "Waiting to receive first event"** (doc oficial: [Verify your React Setup](https://docs.sentry.io/platforms/javascript/guides/react/#verify-your-react-setup)):

- **Ad blockers:** Desactívalos o prueba en **ventana de incógnito**. Los bloqueadores pueden impedir que se envíen eventos a Sentry.
- **Consola del navegador (F12):** Con `debug: true` verás mensajes del SDK (envío de eventos, errores de red). Si sale `[Sentry] REACT_APP_SENTRY_DSN no definido`, la variable no estuvo en el build: añádela en Netlify y haz **Trigger deploy** de nuevo.
- **429 (Too Many Requests):** Cuota llena; espera o revisa Sentry → Settings → Usage.
- **Probar:** En la pantalla de login hay un botón **"Break the world"** que lanza `new Error("Sentry Test Error")`. Los errores lanzados desde la consola del navegador no cuentan (están en un sandbox).
- Revisa **Sentry → Issues** por el error "Sentry Test Error"; a veces el wizard no se actualiza pero el evento ya está.
