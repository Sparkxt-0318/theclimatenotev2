/**
 * Worker configuration.
 *
 * Read once at startup and validated, so a missing secret fails immediately
 * with a clear message rather than halfway through processing an article.
 */

export type AiProvider = 'gemini' | 'openai';

export type WorkerConfig = {
  supabaseUrl: string;
  supabaseServiceKey: string;
  driveFolderId: string;
  googleServiceAccount: Record<string, unknown>;
  /** Which provider the pipeline talks to. Gemini unless told otherwise. */
  aiProvider: AiProvider;
  openAiKey: string | null;
  openAiModel: string;
  geminiKey: string | null;
  geminiTextModel: string;
  geminiImageModel: string;
  unsplashKey: string | null;
  pexelsKey: string | null;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

/**
 * Picks the provider from an explicit setting, or from whichever key exists.
 *
 * Gemini wins a tie because its free tier costs nothing and the volume here is
 * one article a week.
 */
export function resolveProvider(): AiProvider {
  // Empty rather than absent is the normal shape in GitHub Actions, where an
  // unset repository variable still expands to "". A value that is neither
  // empty nor a provider name is a typo, and must not fall through to the
  // key-presence logic below — that would quietly run the provider the author
  // was trying to override.
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (explicit) {
    if (explicit !== 'gemini' && explicit !== 'openai') {
      throw new Error(`AI_PROVIDER is "${explicit}"; it must be "gemini" or "openai".`);
    }
    const key = explicit === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
    if (!process.env[key]) {
      throw new Error(`AI_PROVIDER is set to ${explicit}, but ${key} is not set.`);
    }
    return explicit;
  }

  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENAI_API_KEY) return 'openai';

  throw new Error(
    'No AI provider configured. Set GEMINI_API_KEY (free, no billing account needed — ' +
      'get one at aistudio.google.com/apikey) or OPENAI_API_KEY.',
  );
}

export function loadConfig(): WorkerConfig {
  const serviceAccountRaw = required('GOOGLE_SERVICE_ACCOUNT_JSON');

  let googleServiceAccount: Record<string, unknown>;
  try {
    googleServiceAccount = JSON.parse(serviceAccountRaw) as Record<string, unknown>;
  } catch {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the whole key file as one line.',
    );
  }

  if (typeof googleServiceAccount.private_key === 'string') {
    // Secret stores commonly escape the newlines in a PEM key; restore them or
    // the JWT signature silently fails to verify.
    googleServiceAccount.private_key = googleServiceAccount.private_key.replace(/\\n/g, '\n');
  }

  return {
    supabaseUrl: required('SUPABASE_URL'),
    supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    driveFolderId: required('GOOGLE_DRIVE_FOLDER_ID'),
    googleServiceAccount,
    aiProvider: resolveProvider(),
    // Neither key is required on its own — one of them is, which
    // resolveProvider enforces with a message naming both options.
    openAiKey: process.env.OPENAI_API_KEY ?? null,
    openAiModel: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4.1-mini',
    geminiKey: process.env.GEMINI_API_KEY ?? null,
    // Pinned, not a -latest alias: Google's own guidance for production, and
    // aliases move under you without warning.
    geminiTextModel: process.env.GEMINI_TEXT_MODEL ?? 'gemini-3.7-flash',
    geminiImageModel: process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.5-flash-image',
    unsplashKey: process.env.UNSPLASH_ACCESS_KEY ?? null,
    pexelsKey: process.env.PEXELS_API_KEY ?? null,
  };
}
