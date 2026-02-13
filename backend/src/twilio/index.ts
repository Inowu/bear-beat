import * as Twilio from 'twilio';

type TwilioClient = ReturnType<typeof Twilio.default>;

let cachedClient: TwilioClient | null = null;

const requireEnv = (key: string): string => {
  const value = (process.env[key] || '').trim();
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

// DB stores phones like "+52 1234567890". Twilio expects E.164 ("+521234567890").
const normalizeE164Phone = (input: string): string => {
  const raw = `${input ?? ''}`.trim();
  const compact = raw.replace(/\s+/g, '');
  if (!compact.startsWith('+')) {
    throw new Error('Phone number must be E.164 (example: +521234567890)');
  }
  if (!/^\+\d{8,15}$/.test(compact)) {
    throw new Error('Phone number must be E.164 (example: +521234567890)');
  }
  return compact;
};

const getTwilioClient = (): TwilioClient => {
  const accountSid = requireEnv('TWILIO_ACCOUNT_SID');
  const authToken = requireEnv('TWILIO_AUTH_TOKEN');
  if (!cachedClient) {
    cachedClient = Twilio.default(accountSid, authToken);
  }
  return cachedClient;
};

const getVerifyServiceSid = (): string => requireEnv('TWILIO_VERIFY_SID');
const getMessagingServiceSid = (): string => requireEnv('TWILIO_MESSAGING_SID');
const getContentSid = (): string => requireEnv('TWILIO_CONTENT_SID');

export type TwilioVerificationDelivery = {
  status: string;
  channel: 'whatsapp' | 'sms';
};

export const twilio = {
  getVerificationCode: async (phoneNumber: string): Promise<TwilioVerificationDelivery> => {
    const client = getTwilioClient();
    const to = normalizeE164Phone(phoneNumber);
    const verifySid = getVerifyServiceSid();

    // Important: do NOT request two verifications back-to-back (WhatsApp + SMS).
    // Twilio Verify may generate different codes per request; sending both can
    // invalidate the first code and confuse the user.
    try {
      const verification = await client.verify.v2
        .services(verifySid)
        .verifications.create({ to, channel: 'whatsapp' });
      return { status: verification.status, channel: 'whatsapp' };
    } catch (_whatsAppError) {
      const verification = await client.verify.v2
        .services(verifySid)
        .verifications.create({ to, channel: 'sms' });
      return { status: verification.status, channel: 'sms' };
    }
  },
  verifyCode: async (phoneNumber: string, code: string) => {
    const client = getTwilioClient();
    const to = normalizeE164Phone(phoneNumber);
    const verifySid = getVerifyServiceSid();
    const verification = await client.verify.v2
      .services(verifySid)
      .verificationChecks.create({ to, code });

    return verification.status === 'approved';
  },
  sendMessage: async (phoneNumber: string, url: string) => {
    const client = getTwilioClient();
    const curatedPhoneNumber = normalizeE164Phone(phoneNumber);
    const message = await client.messages.create({
      contentSid: getContentSid(),
      contentVariables: JSON.stringify({ url }),
      messagingServiceSid: getMessagingServiceSid(),
      to: `whatsapp:${curatedPhoneNumber}`,
    });

    return message.status;
  },
};
