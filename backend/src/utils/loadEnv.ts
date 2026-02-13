import path from 'path';
import { config } from 'dotenv';

let didLoad = false;

export function resolveEnvPath(): string {
  const envFileOverride = String(process.env.ENV_FILE || '').trim();
  if (envFileOverride) {
    return path.isAbsolute(envFileOverride)
      ? envFileOverride
      : path.resolve(process.cwd(), envFileOverride);
  }

  // Safety: in test runs, default to the example env file to avoid accidentally loading
  // developer/production secrets from backend/.env.
  if (process.env.NODE_ENV === 'test') {
    return path.resolve(__dirname, '../../.env.example');
  }

  return path.resolve(__dirname, '../../.env');
}

export function loadEnvOnce(): void {
  if (didLoad) return;
  didLoad = true;

  config({
    path: resolveEnvPath(),
  });
}

