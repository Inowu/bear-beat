export enum StripeEvents {
  SUBSCRIPTION_CREATED = 'customer.subscription.created',
  SUBSCRIPTION_UPDATED = 'customer.subscription.updated',
  SUBSCRIPTION_DELETED = 'customer.subscription.deleted',
  PAYMENT_INTENT_SUCCEEDED = 'payment_intent.succeeded',
  PAYMENT_INTENT_FAILED = 'payment_intent.payment_failed',
  INVOICE_PAYMENT_FAILED = 'invoice.payment_failed',
  INVOICE_PAID = 'invoice.paid',
  CHECKOUT_SESSION_COMPLETED = 'checkout.session.completed',
  PRODUCT_UPDATED = 'product.updated',
  PRICE_UPDATED = 'price.updated',
}
