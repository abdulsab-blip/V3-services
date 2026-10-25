import 'dotenv/config';

export function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v.trim() === '') throw new Error(`Missing env var ${name}. See .env.example`);
  return v;
}
