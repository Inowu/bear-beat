import * as Twilio from 'twilio';

type TwilioClient = ReturnType<typeof Twilio.default>;

let cachedClient: TwilioClient | null = null;

const getTwilioClient = (): TwilioClient => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error('Twilio no está configurado (faltan TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN)');
  }
  if (!cachedClient) {
    cachedClient = Twilio.default(accountSid, authToken);
  }
  return cachedClient;
};

export const twilio = {
  getVerificationCode: async (phoneNumber: string) => {
    const client = getTwilioClient();
    await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SID as string)
      .verifications.create({ to: phoneNumber, channel: 'whatsapp' });
    const verificationSms = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SID as string)
      .verifications.create({ to: phoneNumber, channel: 'sms' });

    return verificationSms.status;
  },
  verifyCode: async (phoneNumber: string, code: string) => {
    const client = getTwilioClient();
    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SID as string)
      .verificationChecks.create({ to: phoneNumber, code });

    return verification.status === 'approved';
  },
  sendMessage: async (phoneNumber: string, url: string) => {
    const client = getTwilioClient();
    const curatedPhoneNumber = phoneNumber.trim().replace(/\s/g, '');
    const message = await client.messages.create({
      contentSid: process.env.TWILIO_CONTENT_SID,
      contentVariables: JSON.stringify({ url }),
      messagingServiceSid: process.env.TWILIO_MESSAGING_SID,
      to: `whatsapp:${curatedPhoneNumber}`,
    });

    return message.status;
  },
};
