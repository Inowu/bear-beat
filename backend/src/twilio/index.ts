import * as Twilio from 'twilio';

export const twilio = {
    getVerificationCode: async (phoneNumber: string) => {
        const client = Twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

        const verification = await client.verify.v2.services(process.env.TWILIO_VERIFY_SID as string)
            .verifications
            .create({to: phoneNumber, channel: 'whatsapp'});

        console.log('this is verification', verification)
        return verification.status;
    },
    verifyCode: async (phoneNumber: string, code: string) => {
        const client = Twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        
        const verification = await client.verify.v2.services(process.env.TWILIO_VERIFY_SID as string)
            .verificationChecks
            .create({to: phoneNumber, code})
            
        return verification.status === 'approved'
    }
};
