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
