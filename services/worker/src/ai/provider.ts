/**
 * Model access.
 *
 * One interface, two providers, so `summary.ts`, `imagery.ts` and
 * `reflections.ts` never learn which is in use and switching is a config
 * change rather than a rewrite.
 *
 * Gemini is the default because its free tier needs no billing account and a
 * weekly publication sits far inside its limits. OpenAI is an upgrade, not a
 * requirement — an earlier version demanded an OpenAI key at startup, which
 * meant the pipeline could not run at all without a paid account.
 *
 * Structured output is requested through each provider's schema mechanism and
 * then re-validated with Zod, because "the API guarantees valid JSON" is a
 * guarantee about syntax, not about the content being usable.
 */

import OpenAI from 'openai';
import { z, type ZodTypeAny } from 'zod';

import type { WorkerConfig } from '../config';
import { callGemini, zodToGeminiSchema } from './gemini';

export type GenerateOptions = {
  system: string;
  user: string;
  /** Higher for drafting, near zero for grading. */
  temperature?: number;
  maxTokens?: number;
};

export type AiProvider = 'gemini' | 'openai';

/** Injectable transport, so the plumbing can be tested without a real key. */
export type Transport = {
  gemini: typeof callGemini;
};

export class AiClient {
  private readonly openai: OpenAI | null;
  private tokensUsed = 0;

  readonly provider: AiProvider;
  readonly model: string;

  constructor(
    private readonly config: WorkerConfig,
    private readonly transport: Transport = { gemini: callGemini },
  ) {
    this.provider = config.aiProvider;
    this.model = this.provider === 'gemini' ? config.geminiTextModel : config.openAiModel;
    this.openai = config.openAiKey ? new OpenAI({ apiKey: config.openAiKey }) : null;
  }

  /** Free-form text. Used only where structure is genuinely not needed. */
  async text(options: GenerateOptions): Promise<string> {
    if (this.provider === 'gemini') {
      const { text, usage } = await this.transport.gemini(
        this.requireGeminiKey(),
        this.model,
        {
          system: options.system,
          user: options.user,
          temperature: options.temperature ?? 0.4,
          maxTokens: options.maxTokens ?? 1200,
        },
      );
      this.tokensUsed += usage.totalTokens;
      return text;
    }

    const response = await this.requireOpenAi().chat.completions.create({
      model: this.model,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 1200,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user },
      ],
    });

    this.tokensUsed += response.usage?.total_tokens ?? 0;
    return response.choices[0]?.message.content ?? '';
  }

  /**
   * Structured output validated against a Zod schema.
   *
   * Retries on a validation failure with the error fed back, since a schema
   * violation is usually a near miss the model can correct when told exactly
   * what was wrong.
   */
  async structured<S extends ZodTypeAny>(
    options: GenerateOptions & { schema: S; schemaName: string },
    attempts = 2,
  ): Promise<z.output<S>> {
    let lastError = '';

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const user = lastError
        ? `${options.user}\n\nYour previous reply was rejected: ${lastError}\nReturn corrected JSON.`
        : options.user;

      const raw = await this.rawStructured({ ...options, user });

      try {
        // z.output, not z.input: a field with .default() is optional going in
        // and guaranteed coming out, and callers need the guaranteed shape.
        return options.schema.parse(JSON.parse(raw)) as z.output<S>;
      } catch (error) {
        lastError =
          error instanceof z.ZodError
            ? error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
            : 'response was not valid JSON';
      }
    }

    throw new Error(
      `${options.schemaName} did not validate after ${attempts} attempts: ${lastError}`,
    );
  }

  private async rawStructured(
    options: GenerateOptions & { schema: ZodTypeAny; schemaName: string },
  ): Promise<string> {
    if (this.provider === 'gemini') {
      const { text, usage } = await this.transport.gemini(this.requireGeminiKey(), this.model, {
        system: options.system,
        user: options.user,
        temperature: options.temperature ?? 0.4,
        maxTokens: options.maxTokens ?? 2000,
        // Constrains generation rather than merely asking for JSON.
        responseSchema: zodToGeminiSchema(options.schema),
      });
      this.tokensUsed += usage.totalTokens;
      return text;
    }

    const response = await this.requireOpenAi().chat.completions.create({
      model: this.model,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user },
      ],
    });

    this.tokensUsed += response.usage?.total_tokens ?? 0;
    return response.choices[0]?.message.content ?? '';
  }

  private requireGeminiKey(): string {
    if (!this.config.geminiKey) {
      throw new Error('GEMINI_API_KEY is not set. Get a free key at aistudio.google.com/apikey');
    }
    return this.config.geminiKey;
  }

  private requireOpenAi(): OpenAI {
    if (!this.openai) {
      throw new Error(
        'OPENAI_API_KEY is not set. Either set it, or use the free Gemini tier with ' +
          'GEMINI_API_KEY and AI_PROVIDER=gemini.',
      );
    }
    return this.openai;
  }

  /** Rough spend tracking, logged at the end of a run. */
  get usage(): { tokens: number; model: string; provider: AiProvider } {
    return { tokens: this.tokensUsed, model: this.model, provider: this.provider };
  }
}
