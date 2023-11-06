export enum StripeEvents {
  SUBSCRIPTION_CREATED = 'customer.subscription.created',
  SUBSCRIPTION_UPDATED = 'customer.subscription.updated',
  SUBSCRIPTION_DELETED = 'customer.subscription.deleted',
  INVOICE_PAID = 'invoice.paid',
  INVOICE_PAYMENT_FAILED = 'invoice.payment_failed',
  INVOICE_VOID = 'invoice.voided',
}
