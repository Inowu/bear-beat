import * as Twilio from 'twilio';

const client = Twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

export const twilio = {
    getVerificationCode: async (phoneNumber: string) => {
        const verification = await client.verify.v2.services(process.env.TWILIO_VERIFY_SID as string)
            .verifications
            .create({to: phoneNumber, channel: 'whatsapp'});

        return verification.status;
    },
    verifyCode: async (phoneNumber: string, code: string) => {        
        const verification = await client.verify.v2.services(process.env.TWILIO_VERIFY_SID as string)
            .verificationChecks
            .create({to: phoneNumber, code})
            
        return verification.status === 'approved'
    },
    sendMessage: async(phoneNumber: string, url: string) => {
        const body = `Se envió una solicitud de recuperación de contraseña. Haz clic en el siguiente link para cambiar la contraseña.
        ${url}`;
        // const body = `Se envió una solicitud de recuperación de contraseña. Haz clic en el siguiente link para cambiar la contraseña.`;
        const curatedPhoneNumber = phoneNumber.trim().replace(' ', '');
        const message = await client.messages.create({
            to: `whatsapp:${curatedPhoneNumber}`, 
            body,
            from: 'whatsapp:+15138776826',
            messagingServiceSid: process.env.TWILIO_MESSAGING_SID,
        });

        return message.status;
    }
};