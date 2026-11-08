import { z } from 'zod';

const envSchema = z.object({
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DEEZER_API_URL: z.url().default('https://api.deezer.com'),
  /**
   * Lets a Claude model tell which film or series each track comes from (rounds about films
   * and series). Without it, only what Deezer's own titles and album names say is used.
   */
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  /** Defaults to claude-opus-5-5. */
  SOURCE_LOOKUP_MODEL: z.string().min(1).optional(),
  /** SQLite file for game designs; ':memory:' keeps them in memory (tests). */
  DATABASE_PATH: z.string().min(1).default('data/ubt.sqlite'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type AppConfig = z.infer<typeof envSchema>;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
};
