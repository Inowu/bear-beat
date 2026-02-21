import Stripe from 'stripe';

type StripeCustomerProfile = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  countryCode?: string | null;
};

const normalizeString = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
};

export const toStripeMetadataValue = (
  value: unknown,
  maxLen = 480,
): string | undefined => {
  const normalized = normalizeString(value);
  if (!normalized) return undefined;
  return normalized.slice(0, maxLen);
};

export const resolveStripeCustomerName = (
  profile: StripeCustomerProfile,
): string | undefined => {
  const fullName = normalizeString(
    `${profile.firstName ?? ''} ${profile.lastName ?? ''}`,
  );
  const username = normalizeString(profile.username);
  const emailPrefix = normalizeString(
    (profile.email ?? '').split('@')[0] ?? '',
  );

  const candidate = fullName || username || emailPrefix;
  if (!candidate) return undefined;
  return candidate.slice(0, 255);
};

export const resolveStripeCustomerPhone = (
  phone: unknown,
): string | undefined => {
  const normalized = normalizeString(phone);
  if (!normalized) return undefined;
  return normalized.slice(0, 30);
};

export const resolveStripeCustomerAddress = (
  profile: StripeCustomerProfile,
): Stripe.AddressParam | undefined => {
  const line1 = normalizeString(profile.addressLine1);
  const city = normalizeString(profile.city);
  const countryCandidate = normalizeString(profile.countryCode).toUpperCase();
  const country = /^[A-Z]{2}$/.test(countryCandidate) ? countryCandidate : '';

  const address: Stripe.AddressParam = {};
  if (line1) address.line1 = line1.slice(0, 255);
  if (city) address.city = city.slice(0, 120);
  if (country) address.country = country;

  return Object.keys(address).length > 0 ? address : undefined;
};
