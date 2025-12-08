import * as Twilio from 'twilio';

const client = Twilio.default(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

export const twilio = {
  getVerificationCode: async (phoneNumber: string) => {
    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SID as string)
      .verifications.create({ to: phoneNumber, channel: 'whatsapp' });
    const verificationSms = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SID as string)
      .verifications.create({ to: phoneNumber, channel: 'sms' });

    return verificationSms.status;
  },
  verifyCode: async (phoneNumber: string, code: string) => {
    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SID as string)
      .verificationChecks.create({ to: phoneNumber, code });

    return verification.status === 'approved';
  },
  sendMessage: async (phoneNumber: string, url: string) => {
    const curatedPhoneNumber = phoneNumber.trim().replace(' ', '');
    const message = await client.messages.create({
      contentSid: process.env.TWILIO_CONTENT_SID,
      contentVariables: JSON.stringify({ url }),
      messagingServiceSid: process.env.TWILIO_MESSAGING_SID,
      to: `whatsapp:${curatedPhoneNumber}`,
    });

    return message.status;
  },
};
