import { z } from 'zod';

export const LoginHistoryScalarFieldEnumSchema = z.enum([
  'id',
  'user',
  'client_ip',
  'server_ip',
  'protocol',
  'when',
]);
