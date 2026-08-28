/**
 * Model access.
 *
 * A thin wrapper so the pipeline talks to one interface and switching provider
 * or model is a config change rather than a rewrite. Structured output is
 * requested through JSON schema and then re-validated with Zod, because
 * "the API guarantees valid JSON" is a guarantee about syntax, not about the
 * content being anything we can use.
 */

import OpenAI from 'openai';
import { z, type ZodTypeAny } from 'zod';

import type { WorkerConfig } from '../config';

export type GenerateOptions = {
  system: string;
  user: string;
  /** Higher for drafting, near zero for grading. */
  temperature?: number;
  maxTokens?: number;
};

export class AiClient {
  private readonly openai: OpenAI;
  private readonly model: string;
  private tokensUsed = 0;

  constructor(private readonly config: WorkerConfig) {
    this.openai = new OpenAI({ apiKey: config.openAiKey });
    this.model = config.openAiModel;
  }

  /** Free-form text. Used only where structure is genuinely not needed. */
  async text(options: GenerateOptions): Promise<string> {
    const response = await this.openai.chat.completions.create({
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
      const response = await this.openai.chat.completions.create({
        model: this.model,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: options.system },
          {
            role: 'user',
            content: lastError
              ? `${options.user}\n\nYour previous reply was rejected: ${lastError}\nReturn corrected JSON.`
              : options.user,
          },
        ],
      });

      this.tokensUsed += response.usage?.total_tokens ?? 0;
      const raw = response.choices[0]?.message.content ?? '';

      try {
        // z.output, not z.input: a field with .default() is optional going in
        // and guaranteed coming out, and callers need the guaranteed shape.
        return options.schema.parse(JSON.parse(raw)) as z.output<S>;
      } catch (error) {
        lastError =
          error instanceof z.ZodError
            ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
            : 'response was not valid JSON';
      }
    }

    throw new Error(`${options.schemaName} did not validate after ${attempts} attempts: ${lastError}`);
  }

  /** Rough spend tracking, logged at the end of a run. */
  get usage(): { tokens: number; model: string } {
    return { tokens: this.tokensUsed, model: this.model };
  }

  get geminiKey(): string | null {
    return this.config.geminiKey;
  }
}
