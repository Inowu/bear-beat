# Reporte de tracking – Bear Beat

Tracking implementado para seguimiento en ManyChat, Facebook Pixel y API ManyChat.

---

## 1. Resumen ejecutivo

| Capa        | Eventos | Ubicación                                      |
|------------|---------|------------------------------------------------|
| ManyChat Pixel | 22     | `frontend/src/utils/manychatPixel.ts`          |
| Facebook Pixel  | 4      | `frontend/src/utils/facebookPixel.ts`          |
| API ManyChat (tags) | 5   | Backend `src/many-chat/`                       |

---

## 2. ManyChat Pixel – Eventos (MC_EVENTS)

Solo eventos del funnel de conversión.

| Evento | Cuándo | Componente |
|--------|--------|------------|
| `bear_beat_view_home` | Usuario ve la landing | PublicHome.tsx |
| `bear_beat_click_cta_register` | Clic en "Obtener Acceso", "QUIERO BLINDAR MI LIBRERÍA" | PublicHome.tsx |
| `bear_beat_click_plan_usd` | Clic en "Quiero el plan USD" | PublicHome.tsx |
| `bear_beat_click_plan_mxn` | Clic en "Quiero el plan MXN" | PublicHome.tsx |
| `bear_beat_view_auth` | Usuario entra a /auth | Auth.tsx |
| `bear_beat_login_success` | Login exitoso | LoginForm.tsx |
| `bear_beat_click_chat` | Clic en ChatButton (¿Ayuda DJ?) | ChatButton.tsx |
| `bear_beat_view_plans` | Usuario ve /planes | Plans.tsx |
| `bear_beat_select_plan` | Usuario selecciona plan / COMPRAR | PlanCard.tsx |
| `bear_beat_click_buy` | Clic en "COMPRAR CON TARJETA" | PlanCard.tsx |
| `bear_beat_click_spei` | Clic en "Pagar vía SPEI" | PlanCard.tsx |
| `bear_beat_click_paypal` | Clic en botón PayPal | PlanCard.tsx |
| `bear_beat_start_checkout` | Usuario entra a checkout | Checkout.tsx |
| `bear_beat_registration` | Registro exitoso | SignUpForm.tsx |
| `bear_beat_payment_success` | Pago exitoso | PlanCard, CheckoutForm |
| `bear_beat_cancel_subscription` | Clic en "Cancelar plan" | PlanCard.tsx |
| `bear_beat_change_plan` | Clic en "Cambiar plan" | PlanCard.tsx |

---

## 3. Facebook Pixel

| Evento | Cuándo | Función |
|--------|--------|---------|
| PageView | Init app | initFacebookPixel |
| Lead / CompleteRegistration | Registro | trackLead |
| BearBeatRegistro | Registro | trackLead (custom) |
| UsuarioRevisoPlanes | Ver planes | trackViewPlans |
| Purchase | Pago exitoso | trackPurchase |
| PagoExitoso | Pago exitoso | trackPurchase (custom) |

---

## 4. API ManyChat (tags)

| Tag | Cuándo | Origen |
|-----|--------|--------|
| USER_REGISTERED | Registro | register.ts (backend) |
| USER_CHECKED_PLANS | Ver/click plan | PlanCard, addManyChatTagToUser |
| CHECKOUT_PLAN_ORO | Checkout plan Oro | Checkout.tsx |
| CHECKOUT_PLAN_CURIOSO | Checkout plan Curioso | Checkout.tsx |
| SUCCESSFUL_PAYMENT | Pago confirmado | Webhooks (Stripe/PayPal/Conekta) + frontend |

---

## 5. Flujo del funnel

```
Landing (VIEW_HOME)
  → CTA (CLICK_CTA_REGISTER / CLICK_PLAN_USD / CLICK_PLAN_MXN)
    → Auth (VIEW_AUTH)
      → Registro → REGISTRATION + USER_REGISTERED
      → Login → LOGIN_SUCCESS
  → Chat (CLICK_CHAT)

Planes (VIEW_PLANS + USER_CHECKED_PLANS)
  → Select plan (SELECT_PLAN)
  → COMPRAR (CLICK_BUY)
  → SPEI (CLICK_SPEI)
  → PayPal (CLICK_PAYPAL)

Checkout (START_CHECKOUT + CHECKOUT_PLAN_X)
  → Stripe success → PAYMENT_SUCCESS + SUCCESSFUL_PAYMENT
  → PayPal success → PAYMENT_SUCCESS + SUCCESSFUL_PAYMENT

Post-compra
  → Catalog (VIEW_CATALOG)
  → MyAccount (VIEW_MY_ACCOUNT)
  → Plan upgrade (VIEW_PLAN_UPGRADE)
  → Cancel (CANCEL_SUBSCRIPTION)
  → Change plan (CHANGE_PLAN)
  → Instructions (VIEW_INSTRUCTIONS)
  → Downloads (VIEW_DOWNLOADS)
```

---

## 6. Pendiente: ManyChat Pixel Pro

Para que el ManyChat Pixel registre eventos:

1. ManyChat cuenta Pro.
2. ManyChat → Settings → Pixel.
3. Copiar el script del Pixel.
4. Pegarlo en `frontend/public/index.html` (donde indica el comentario).

Los eventos se emiten aunque el script no esté instalado; la app no falla.

---

## 7. Archivos modificados

- `frontend/src/utils/manychatPixel.ts` – utilidades y eventos
- `frontend/src/utils/facebookPixel.ts` – ya existente
- `frontend/src/index.tsx` – initFacebookPixel
- `frontend/public/index.html` – comentario para ManyChat Pixel
- `frontend/src/pages/PublicHome/PublicHome.tsx`
- `frontend/src/pages/Auth/Auth.tsx`
- `frontend/src/pages/Plans/Plans.tsx`
- `frontend/src/pages/Checkout/Checkout.tsx`
- `frontend/src/pages/PlanUpgrade/PlanUpgrade.tsx`
- `frontend/src/pages/Instructions/Instructions.tsx`
- `frontend/src/pages/MyAccount/MyAccount.tsx`
- `frontend/src/pages/Downloads/Downloads.tsx`
- `frontend/src/pages/Home/Home.tsx`
- `frontend/src/components/PlanCard/PlanCard.tsx`
- `frontend/src/components/ChatButton/ChatButton.tsx`
- `frontend/src/components/CheckoutForm/CheckoutForm.tsx`
- `frontend/src/components/Auth/LoginForm/LoginForm.tsx`
- `frontend/src/components/Auth/SignUpForm/SignUpForm.tsx`
- `frontend/src/components/Auth/ForgotPasswordForm/ForgotPasswordForm.tsx`
