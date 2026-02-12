# Seguimiento ManyChat – Nivel Dios

## Resumen

Tracking completo: tags API, pixel, custom fields y carritos abandonados.

**Lista oficial de etiquetas:** ver `MANYCHAT_ETIQUETAS.md`. Comando para listar/borrar no usadas y crear las que faltan: `cd backend && npm run manychat:sync`.

---

## 1. Tags API (Backend)

| Tag | Cuándo | Dónde |
|-----|--------|-------|
| `USER_REGISTERED` | Registro exitoso | register.ts |
| `USER_CHECKED_PLANS` | Usuario ve lista de planes | Plans.findManyPlans |
| `CHECKOUT_PLAN_ORO` | Entra a checkout con plan Oro | Plans.findManyPlans |
| `CHECKOUT_PLAN_CURIOSO` | Entra a checkout con plan Curioso | Plans.findManyPlans |
| `SUCCESSFUL_PAYMENT` | Pago exitoso (Stripe, PayPal, Conekta) | Webhooks, subscribe flows |
| `TRIAL_STARTED` | Trial iniciado (Stripe) | Stripe webhooks |
| `TRIAL_CONVERTED` | Trial convertido a pago (Stripe) | Stripe webhooks |
| `SUBSCRIPTION_RENEWED` | Renovación (Stripe/PayPal) | Stripe/PayPal webhooks |
| `CANCELLED_SUBSCRIPTION` | Usuario cancela suscripción | cancelServicesSubscriptions |
| `FAILED_PAYMENT` | Pago fallido (Stripe, PayPal, Conekta) | Webhooks |

---

## 2. Custom Fields (Backend)

Al entrar a checkout y/o al crear ofertas, se guardan en ManyChat:

| Campo | Valor |
|-------|-------|
| `ultimo_plan_checkout` | Nombre del plan (ej. "Plan Oro") |
| `ultimo_precio_checkout` | Precio del plan |
| `bb_offer_code` | Cupón (si existe) |
| `bb_offer_pct` | Porcentaje de descuento (si existe) |
| `bb_offer_expires_at` | Expiración ISO (si existe) |

**Configuración en ManyChat:**  
1. Settings → Fields → User Fields → + New User Field  
2. Crear campos con **Key** exacto (Text): `ultimo_plan_checkout`, `ultimo_precio_checkout`, `bb_offer_code`, `bb_offer_pct`, `bb_offer_expires_at`  
3. Los valores se rellenan automáticamente cuando el usuario entra a checkout

---

## 2.1 Automatizaciones (Backend automation runner)

El backend tiene un "automation runner" que puede poner tags para re-engagement/ofertas. En ManyChat puedes hacer Rules con **Trigger: Tag added**:

| Tag | Qué significa |
|-----|---------------|
| `AUTOMATION_TRIAL_NO_DOWNLOAD_24H` | Trial iniciado y sin descargas en 24h |
| `AUTOMATION_PAID_NO_DOWNLOAD_24H` | Pagó y sin descargas en 24h |
| `AUTOMATION_REGISTERED_NO_PURCHASE_7D` | Registrado hace 7 días y no compró |
| `AUTOMATION_ACTIVE_NO_DOWNLOAD_7D` | Activo y sin descargas en 7 días |
| `AUTOMATION_ACTIVE_NO_DOWNLOAD_14D` | Activo y sin descargas en 14 días |
| `AUTOMATION_ACTIVE_NO_DOWNLOAD_21D` | Activo y sin descargas en 21 días |
| `AUTOMATION_PLANS_OFFER_10` | Oferta 10% (planes vistos, no checkout) |
| `AUTOMATION_PLANS_OFFER_30` | Escalación oferta 30% |
| `AUTOMATION_PLANS_OFFER_50` | Escalación oferta 50% |

---

## 3. Carritos Abandonados

No hace falta un tag extra. ManyChat ya tiene todo:

### Cómo detectar carrito abandonado

1. Usuario entra a checkout → recibe `CHECKOUT_PLAN_ORO` o `CHECKOUT_PLAN_CURIOSO`
2. No completa el pago → no recibe `SUCCESSFUL_PAYMENT`

### Crear automatización en ManyChat

1. Ir a Automations → New Rule
2. **Trigger:** Tag added → "Checkout Plan Oro" o "Checkout Plan Curioso"
3. **Wait:** 1 hora (o 30 min)
4. **Condition:** Subscriber does NOT have tag "Pago exitoso"
5. **Action:** Enviar mensaje / secuencia de recuperación

Puedes usar los custom fields para personalizar: "¿Te quedó alguna duda sobre el Plan Oro de $X?"

---

## 4. Win-back (Usuarios que cancelaron)

Tag `CANCELLED_SUBSCRIPTION` → secuencia de retención o oferta especial para volver.

## 5. Pagos fallidos (Recuperación)

Tag `FAILED_PAYMENT` cuando:
- **Stripe:** `incomplete_expired` (primer pago falló), `past_due` (renovación falló)
- **PayPal:** `PAYMENT_SALE_DENIED`
- **Conekta:** `ORDER_VOIDED`, `ORDER_DECLINED`

Usar para secuencias: "Tu pago no se procesó, actualiza tu tarjeta" / soporte.

---

## 6. Funnel visual

```
Landing → CTA → Auth → Registro/Login
    ↓
Planes (USER_CHECKED_PLANS)
    ↓
Selecciona plan → Checkout (CHECKOUT_PLAN_ORO/CURIOSO)
    ↓
¿Pagó? → SUCCESSFUL_PAYMENT
¿Falló? → FAILED_PAYMENT (Stripe/PayPal/Conekta)
¿Abandonó? → Regla ManyChat (CHECKOUT_* sin SUCCESSFUL_PAYMENT)

Suscriptor activo → ¿Cancela? → CANCELLED_SUBSCRIPTION → Win-back
Suscriptor activo → ¿Pago renovación falló? → FAILED_PAYMENT → Recuperación
```

---

## 7. Mejoras opcionales futuras

- **Chargeback:** Tag separado `CHARGEBACK` si quieres tratarlo distinto (fraude vs pago fallido)
- **Login tracking:** Tag `USER_LOGGED_IN` para re-engagement
- **Renovación:** Distinguir primera compra vs renovación si hace falta
- **Form abandonment:** Si el registro tiene pasos, eventos por paso
