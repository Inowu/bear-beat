const findUniqueMock = jest.fn();

jest.mock('../src/db', () => ({
  prisma: {
    webhookInboxEvent: {
      findUnique: findUniqueMock,
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('../src/services/webhookInbox', () => ({
  computeBackoff: jest.fn(() => 1000),
  markFailed: jest.fn(),
  markProcessed: jest.fn(),
  markProcessing: jest.fn(),
}));

jest.mock('../src/routers/webhooks/stripe', () => ({
  processStripeWebhookPayload: jest.fn(),
}));

jest.mock('../src/routers/webhooks/stripe/paymentIntentsWh', () => ({
  processStripePaymentWebhookPayload: jest.fn(),
}));

jest.mock('../src/routers/webhooks/stripe/productsWh', () => ({
  stripeProductsWebhook: jest.fn(),
}));

jest.mock('../src/routers/webhooks/paypal', () => ({
  processPaypalWebhookPayload: jest.fn(),
}));

jest.mock('../src/routers/webhooks/conekta', () => ({
  processConektaWebhookPayload: jest.fn(),
}));

import { processWebhookInboxEvent } from '../src/webhookInbox/service';
import {
  markFailed,
  markProcessed,
  markProcessing,
} from '../src/services/webhookInbox';
import { processStripeWebhookPayload } from '../src/routers/webhooks/stripe';
import { processStripePaymentWebhookPayload } from '../src/routers/webhooks/stripe/paymentIntentsWh';
import { processPaypalWebhookPayload } from '../src/routers/webhooks/paypal';
import { processConektaWebhookPayload } from '../src/routers/webhooks/conekta';

const markFailedMock = markFailed as jest.Mock;
const markProcessedMock = markProcessed as jest.Mock;
const markProcessingMock = markProcessing as jest.Mock;
const processStripeWebhookPayloadMock = processStripeWebhookPayload as jest.Mock;
const processStripePaymentWebhookPayloadMock = processStripePaymentWebhookPayload as jest.Mock;
const processPaypalWebhookPayloadMock = processPaypalWebhookPayload as jest.Mock;
const processConektaWebhookPayloadMock = processConektaWebhookPayload as jest.Mock;

describe('processWebhookInboxEvent provider dispatch', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    markFailedMock.mockReset();
    markProcessedMock.mockReset();
    markProcessingMock.mockReset();
    processStripeWebhookPayloadMock.mockReset();
    processStripePaymentWebhookPayloadMock.mockReset();
    processPaypalWebhookPayloadMock.mockReset();
    processConektaWebhookPayloadMock.mockReset();

    markProcessingMock.mockResolvedValue(true);
    markFailedMock.mockResolvedValue(undefined);
    markProcessedMock.mockResolvedValue(undefined);
    processStripeWebhookPayloadMock.mockResolvedValue(undefined);
    processStripePaymentWebhookPayloadMock.mockResolvedValue(undefined);
  });

  it('routes stripe payment events from stripe provider to payment handler', async () => {
    findUniqueMock.mockResolvedValue({
      id: 200,
      provider: 'stripe',
      status: 'RECEIVED',
      attempts: 0,
      payload_raw: '{"id":"evt_1","type":"invoice.paid","data":{"object":{}}}',
      event_id: 'evt_1',
      event_type: 'invoice.paid',
    });

    await processWebhookInboxEvent(200);

    expect(processStripePaymentWebhookPayloadMock).toHaveBeenCalledWith({
      id: 'evt_1',
      type: 'invoice.paid',
      data: { object: {} },
    });
    expect(processStripeWebhookPayloadMock).not.toHaveBeenCalled();
    expect(markProcessedMock).toHaveBeenCalledWith(200);
  });

  it('routes subscription events from stripe_pi provider to subscription handler', async () => {
    findUniqueMock.mockResolvedValue({
      id: 204,
      provider: 'stripe_pi',
      status: 'RECEIVED',
      attempts: 0,
      payload_raw: '{"id":"evt_2","type":"customer.subscription.updated","data":{"object":{}}}',
      event_id: 'evt_2',
      event_type: 'customer.subscription.updated',
    });

    await processWebhookInboxEvent(204);

    expect(processStripeWebhookPayloadMock).toHaveBeenCalledWith({
      id: 'evt_2',
      type: 'customer.subscription.updated',
      data: { object: {} },
    });
    expect(processStripePaymentWebhookPayloadMock).not.toHaveBeenCalled();
    expect(markProcessedMock).toHaveBeenCalledWith(204);
  });

  it('processes paypal payload and marks event as PROCESSED', async () => {
    findUniqueMock.mockResolvedValue({
      id: 201,
      provider: 'paypal',
      status: 'RECEIVED',
      attempts: 0,
      payload_raw: '{"id":"WH-1","event_type":"BILLING.SUBSCRIPTION.ACTIVATED"}',
      event_id: 'WH-1',
      event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
    });
    processPaypalWebhookPayloadMock.mockResolvedValue(undefined);

    await processWebhookInboxEvent(201);

    expect(processPaypalWebhookPayloadMock).toHaveBeenCalledWith({
      id: 'WH-1',
      event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
    });
    expect(markProcessedMock).toHaveBeenCalledWith(201);
  });

  it('processes conekta payload and marks event as PROCESSED', async () => {
    findUniqueMock.mockResolvedValue({
      id: 202,
      provider: 'conekta',
      status: 'RECEIVED',
      attempts: 0,
      payload_raw: '{"id":"evt_1","type":"order.paid"}',
      event_id: 'evt_1',
      event_type: 'order.paid',
    });
    processConektaWebhookPayloadMock.mockResolvedValue(undefined);

    await processWebhookInboxEvent(202);

    expect(processConektaWebhookPayloadMock).toHaveBeenCalledWith({
      id: 'evt_1',
      type: 'order.paid',
    });
    expect(markProcessedMock).toHaveBeenCalledWith(202);
  });

  it('marks event as FAILED/IGNORED path when handler throws', async () => {
    findUniqueMock.mockResolvedValue({
      id: 203,
      provider: 'paypal',
      status: 'RECEIVED',
      attempts: 1,
      payload_raw: '{"id":"WH-3","event_type":"PAYMENT.SALE.DENIED"}',
      event_id: 'WH-3',
      event_type: 'PAYMENT.SALE.DENIED',
    });
    processPaypalWebhookPayloadMock.mockRejectedValue(new Error('handler_failed'));

    await processWebhookInboxEvent(203);

    expect(markFailedMock).toHaveBeenCalledTimes(1);
    expect(markFailedMock.mock.calls[0][0]).toBe(203);
    expect(markFailedMock.mock.calls[0][2]).toBeInstanceOf(Date);
    expect(markProcessedMock).not.toHaveBeenCalled();
  });
});
