/**
 * Worker configuration.
 *
 * Read once at startup and validated, so a missing secret fails immediately
 * with a clear message rather than halfway through processing an article.
 */

export type WorkerConfig = {
  supabaseUrl: string;
  supabaseServiceKey: string;
  driveFolderId: string;
  googleServiceAccount: Record<string, unknown>;
  openAiKey: string;
  openAiModel: string;
  geminiKey: string | null;
  geminiImageModel: string;
  unsplashKey: string | null;
  pexelsKey: string | null;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
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
    openAiKey: required('OPENAI_API_KEY'),
    openAiModel: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4.1-mini',
    geminiKey: process.env.GEMINI_API_KEY ?? null,
    geminiImageModel: process.env.GEMINI_IMAGE_MODEL ?? 'gemini-2.5-flash-image',
    unsplashKey: process.env.UNSPLASH_ACCESS_KEY ?? null,
    pexelsKey: process.env.PEXELS_API_KEY ?? null,
  };
}
