type ConektaErrorDetail = {
  code?: unknown;
  debug_message?: unknown;
  message?: unknown;
  param?: unknown;
};

export type ConektaErrorInfo = {
  status: number | null;
  message: string;
  detailMessages: string[];
  detailCodes: string[];
  searchable: string;
};

const toCleanText = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const summarizeDetail = (detail: ConektaErrorDetail): string => {
  const message = toCleanText(detail?.message);
  const debug = toCleanText(detail?.debug_message);
  const param = toCleanText(detail?.param);
  const code = toCleanText(detail?.code);

  const parts = [message, debug, param ? `param:${param}` : '', code ? `code:${code}` : ''].filter(Boolean);
  return parts.join(' | ');
};

export const getConektaErrorInfo = (error: unknown): ConektaErrorInfo => {
  const err = error as any;
  const responseData = err?.response?.data;
  const details = Array.isArray(responseData?.details) ? responseData.details : [];
  const detailMessages = details.map((item: ConektaErrorDetail) => summarizeDetail(item)).filter(Boolean);
  const detailCodes = details
    .map((item: ConektaErrorDetail) => toCleanText(item?.code))
    .filter(Boolean);

  const message =
    toCleanText(responseData?.message)
    || toCleanText(err?.message)
    || 'Error inesperado con Conekta';

  const searchable = `${message} ${detailMessages.join(' ')} ${detailCodes.join(' ')}`.toLowerCase();

  return {
    status: Number.isFinite(Number(err?.response?.status)) ? Number(err.response.status) : null,
    message,
    detailMessages,
    detailCodes,
    searchable,
  };
};

export const formatConektaErrorForClient = (error: unknown): string => {
  const info = getConektaErrorInfo(error);
  const details = info.detailMessages.join(' · ');
  return details ? `${info.message} (${details})` : info.message;
};

export const isConektaCustomerReferenceError = (error: unknown): boolean => {
  const info = getConektaErrorInfo(error);
  if (info.status === 404) return true;
  const codes = info.detailCodes;
  if (codes.includes('resource_not_found_error')) return true;

  const text = info.searchable;
  const hasCustomerToken = text.includes('customer') || text.includes('customer_id');
  const hasReferenceProblem =
    text.includes('not found')
    || text.includes('no existe')
    || text.includes('resource_not_found')
    || text.includes('invalid')
    || text.includes('inválid');

  return hasCustomerToken && hasReferenceProblem;
};

export const isConektaProductTypeError = (error: unknown): boolean => {
  const info = getConektaErrorInfo(error);
  const text = info.searchable;
  if (text.includes('product_type')) return true;
  if (text.includes('bbva_pay_by_bank')) return true;
  return text.includes('pay_by_bank') && text.includes('invalid');
};

export const normalizeConektaPhoneE164Mx = (phone: string | null | undefined): string => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return `+52${digits.slice(-10)}`;
  return '+5215555555555';
};
