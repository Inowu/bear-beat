import { Api } from './brevo';

export const brevo = new Api({
  baseApiParams: {
    headers: { 'api-key': process.env.BREVO_API_KEY as string },
  },
});
