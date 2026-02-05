# ManyChat – Etiquetas (tags) oficiales

Lista única de etiquetas que usa Bear Beat. Cualquier otra etiqueta en la cuenta se puede borrar.

---

## Etiquetas que SÍ se usan (7)

| Nombre en ManyChat       | Clave en código        | Cuándo se asigna                          |
|--------------------------|------------------------|-------------------------------------------|
| Usuario revisó planes    | USER_CHECKED_PLANS     | Usuario ve la lista de planes (API)       |
| Usuario registrado       | USER_REGISTERED        | Registro exitoso                          |
| Checkout Plan Oro        | CHECKOUT_PLAN_ORO      | Entra a checkout con plan Oro             |
| Checkout Plan Curioso    | CHECKOUT_PLAN_CURIOSO  | Entra a checkout con plan Curioso         |
| Pago exitoso             | SUCCESSFUL_PAYMENT     | Pago correcto (Stripe, PayPal, Conekta)  |
| Canceló suscripción      | CANCELLED_SUBSCRIPTION | Usuario cancela la suscripción           |
| Pago fallido             | FAILED_PAYMENT         | Pago fallido (tarjeta, renovación, etc.) |

Los IDs se guardan en `backend/src/many-chat/tags.ts`. Si cambian, actualizar ese archivo.

---

## Sincronizar ManyChat con el código

**Listar etiquetas actuales:**
```bash
cd backend && npm run manychat:tags
```

**Crear solo las que faltan (no borra nada):**
```bash
cd backend && npm run manychat:create-tags
```

**Sincronizar (borra las que no usamos y crea las que faltan):**
```bash
cd backend && npm run manychat:sync
```

- `manychat:sync` elimina de ManyChat cualquier etiqueta cuyo nombre **no** esté en la tabla de arriba.
- Luego crea las 7 etiquetas si no existen.
- Al final imprime el bloque para copiar en `tags.ts` si los IDs cambian.

Requisito: `MC_API_KEY` en `backend/.env`.

---

## Resumen

- Solo deben existir estas 7 etiquetas en ManyChat para Bear Beat.
- Las que no estén en esta lista se consideran “no usadas” y se pueden borrar con `manychat:sync`.
- Documentación detallada: `TRACKING_NIVEL_DIOS.md` y `MANUAL_TRACKING_MANYCHAT.md`.
