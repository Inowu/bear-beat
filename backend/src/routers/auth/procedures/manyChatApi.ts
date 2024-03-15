import axios, { AxiosResponse } from 'axios';
import { log } from '../../../server';

const client = axios.create({
  baseURL: 'https://api.manychat.com',
  headers: {
    Authorization: `Bearer ${process.env.MC_API_KEY}`,
  },
});

export async function getInfo(userId: number) {
  try {
    const response = await client(
      `/fb/subscriber/getInfo?subscriber_id=${userId}`,
    );

    return response.data;
  } catch (error) {
    log.error('[MANYCHAT] Error getting user information:', error);
    throw error;
  }
}
export async function findByCustomField(
  customFieldKey: string,
  customFieldValue: string,
) {
  try {
    const response = await client(
      `/fb/subscriber/findByCustomField?key=${customFieldKey}&value=${customFieldValue}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error('Error getting user information:', error);
    throw error;
  }
}
export async function createSubscriber(users: any): Promise<any> {
  try {
    const response: AxiosResponse = await axios.post(
      'https://api.manychat.com/fb/subscriber/createSubscriber',
      {
        first_name: users.first_name,
        last_name: users.last_name,
        phone: users.phone,
        whatsapp_phone: users.whatsapp_phone,
        email: users.email,
        gender: users.gender,
        has_opt_in_sms: users.has_opt_in_sms,
        has_opt_in_email: users.has_opt_in_email,
        consent_phrase: users.consent_phrase,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}
export async function setCustomField_phone(
  userId: string,
  fieldKey: string | null,
  fieldValue: string,
): Promise<any> {
  try {
    const response: AxiosResponse = await axios.post(
      'https://api.manychat.com/fb/subscriber/setCustomField',
      {
        subscriber_id: userId,
        field_name: fieldKey,
        field_value: fieldValue,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error('Error setting custom field:', error);
    throw error;
  }
}
export async function updateSubscriber(users: any, mc_id: any): Promise<any> {
  try {
    const response: AxiosResponse = await axios.post(
      'https://api.manychat.com/fb/subscriber/updateSubscriber',
      {
        first_name: users.first_name,
        last_name: users.last_name,
        phone: users.phone,
        whatsapp_phone: users.whatsapp_phone,
        email: users.email,
        gender: users.gender,
        has_opt_in_sms: users.has_opt_in_sms,
        has_opt_in_email: users.has_opt_in_email,
        consent_phrase: users.consent_phrase,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    return response.data;
  } catch (error) {
    console.error('Error updating subscriber:', error);
    throw error;
  }
}
