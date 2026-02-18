# Configuración de Meta (Facebook) Pixel y Conversions API

Guía para dejar funcionando el Pixel en el frontend y la Conversions API (CAPI) en el backend.

---

## 1. Obtener el ID del Pixel

1. Entra en [Meta Business Suite](https://business.facebook.com) (o Facebook Business Manager).
2. **Configuración de negocio** → **Configuración de datos** → **Pixels**.
3. Selecciona tu pixel (o crea uno).
4. El **ID del pixel** es un número (ej. `1325763147585869`). Este valor se usa en frontend y backend.

---

## 2. Frontend – Variable de entorno

- **Variable:** `REACT_APP_FB_PIXEL_ID`
- **Valor:** el ID del pixel (ej. `1325763147585869`).
- **Dónde configurarla:**
  - **Local:** en `frontend/.env`: `REACT_APP_FB_PIXEL_ID=1325763147585869`
  - **Netlify:** Site → Site configuration → Environment variables → Add variable → `REACT_APP_FB_PIXEL_ID` con el mismo valor.

Si esta variable no está definida, el pixel **no se carga** en la app (no hay ID por defecto en código).

---

## 3. Backend – Conversions API (CAPI)

La CAPI envía eventos desde el servidor (registro y compras) para que Meta los use en medición y optimización de anuncios.

### Variables de entorno en el backend

| Variable                 | Descripción |
|--------------------------|-------------|
| `FACEBOOK_PIXEL_ID`      | El mismo ID del pixel que en el frontend. |
| `FACEBOOK_ACCESS_TOKEN`  | Token de acceso para la Conversions API (ver abajo). |

Si **falta** `FACEBOOK_ACCESS_TOKEN` o `FACEBOOK_PIXEL_ID`, el backend no envía eventos a Meta y escribe un aviso en log; el resto de la app sigue funcionando.

### Cómo obtener el token de acceso (CAPI)

1. En Meta Business Suite: **Configuración de datos** → **Pixels** → tu pixel.
2. Entra en **Configuración** del pixel.
3. En la sección **Conversions API**, usa la opción para **generar un token de acceso**.
4. Copia el token y guárdalo como `FACEBOOK_ACCESS_TOKEN` en el `.env` del backend (o en las variables de entorno del servidor).

Importante: usa un token que no expire o configúralo para larga duración; si caduca, hay que generar uno nuevo y actualizar la variable.

---

## 4. Eventos que se envían

- **Registro (sign up):** Pixel dispara `Lead` y `CompleteRegistration`; CAPI envía `CompleteRegistration`.
- **Compra (Stripe o PayPal):** Pixel dispara `Purchase` (con value/currency); CAPI envía `Purchase` con `value` y `currency`.
- **Ver planes:** Pixel dispara el evento personalizado `UsuarioRevisoPlanes`.

---

## 5. Comprobar que funciona

- **Pixel:** En Meta Business Suite → Configuración de datos → Pixels → tu pixel → **Prueba de eventos**. Navega por la web y registra/compra; deberías ver eventos en tiempo real.
- **CAPI:** En la misma pantalla de “Prueba de eventos” o en **Herramienta de diagnóstico de la CAPI**; los eventos enviados desde el servidor aparecen como “Conversions API”.

Si no ves eventos, revisa que las variables de entorno estén bien definidas en frontend (Netlify) y backend (servidor).
