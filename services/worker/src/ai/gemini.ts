/**
 * Gemini text generation.
 *
 * The default provider, because Google's free tier is a real product that
 * needs no billing account and one article a week sits far inside its limits.
 * OpenAI remains available as an upgrade.
 *
 * Structured output uses `responseMimeType: 'application/json'` with a
 * `responseSchema`, which constrains generation rather than merely asking for
 * JSON. The result is still parsed through Zod — a schema-constrained response
 * is guaranteed to be well-formed JSON of the right shape, not to contain
 * anything sensible.
 */

import { z, type ZodTypeAny } from 'zod';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export type GeminiRequest = {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  /** Present for structured calls; omitted for free-form text. */
  responseSchema?: GeminiSchema;
};

/**
 * Gemini's schema dialect: an OpenAPI subset. Notably it has no `additionalProperties`,
 * no `$ref`, and requires `type` on every node.
 */
export type GeminiSchema = {
  type: 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';
  description?: string;
  nullable?: boolean;
  enum?: string[];
  items?: GeminiSchema;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  minItems?: number;
  maxItems?: number;
};

export type GeminiUsage = { promptTokens: number; totalTokens: number };

export async function callGemini(
  apiKey: string,
  model: string,
  request: GeminiRequest,
): Promise<{ text: string; usage: GeminiUsage }> {
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: request.system }] },
    contents: [{ role: 'user', parts: [{ text: request.user }] }],
    generationConfig: {
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
      ...(request.responseSchema
        ? {
            responseMimeType: 'application/json',
            responseSchema: request.responseSchema,
          }
        : {}),
    },
  };

  const response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Header rather than a query parameter, so the key stays out of logs
      // and proxy access records.
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    // 429 on the free tier means the per-minute quota, which recovers on its
    // own; say so rather than leaving the reader to decode Google's payload.
    const hint =
      response.status === 429
        ? ' — free-tier rate limit; it clears within a minute, or set AI_PROVIDER=openai'
        : '';
    throw new Error(`Gemini returned ${response.status}${hint}: ${detail.slice(0, 500)}`);
  }

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; totalTokenCount?: number };
    promptFeedback?: { blockReason?: string };
  };

  if (payload.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the prompt: ${payload.promptFeedback.blockReason}`);
  }

  const candidate = payload.candidates?.[0];

  // MAX_TOKENS yields a truncated response that will fail JSON parsing with a
  // confusing message; name the real cause instead.
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error('Gemini hit the output token limit; raise maxTokens for this step.');
  }

  const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  if (!text) throw new Error(`Gemini returned no text (finishReason: ${candidate?.finishReason})`);

  return {
    text,
    usage: {
      promptTokens: payload.usageMetadata?.promptTokenCount ?? 0,
      totalTokens: payload.usageMetadata?.totalTokenCount ?? 0,
    },
  };
}

// ── Zod to Gemini schema ────────────────────────────────────────────────────

/**
 * Converts a Zod schema into Gemini's OpenAPI subset.
 *
 * Only the constructs the pipeline's schemas actually use are handled, and
 * anything unrecognised throws rather than silently degrading — a schema that
 * quietly loses its constraints would let malformed output through to the Zod
 * parse, which is a far more confusing failure than a startup error here.
 */
export function zodToGeminiSchema(schema: ZodTypeAny): GeminiSchema {
  const def = schema._def as { typeName: string; [key: string]: unknown };

  switch (def.typeName) {
    case z.ZodFirstPartyTypeKind.ZodString:
      return { type: 'STRING' };

    case z.ZodFirstPartyTypeKind.ZodNumber:
      return { type: (def.checks as { kind: string }[])?.some((c) => c.kind === 'int')
        ? 'INTEGER'
        : 'NUMBER' };

    case z.ZodFirstPartyTypeKind.ZodBoolean:
      return { type: 'BOOLEAN' };

    case z.ZodFirstPartyTypeKind.ZodEnum:
      return { type: 'STRING', enum: [...(def.values as string[])] };

    case z.ZodFirstPartyTypeKind.ZodArray: {
      const inner = zodToGeminiSchema(def.type as ZodTypeAny);
      const exact = def.exactLength as { value: number } | null | undefined;
      const min = (def.minLength as { value: number } | null | undefined)?.value;
      const max = (def.maxLength as { value: number } | null | undefined)?.value;
      return {
        type: 'ARRAY',
        items: inner,
        ...(exact ? { minItems: exact.value, maxItems: exact.value } : {}),
        ...(min !== undefined ? { minItems: min } : {}),
        ...(max !== undefined ? { maxItems: max } : {}),
      };
    }

    case z.ZodFirstPartyTypeKind.ZodObject: {
      const shape = (def.shape as () => Record<string, ZodTypeAny>)();
      const properties: Record<string, GeminiSchema> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToGeminiSchema(value);
        // A field with a default is optional on input; the model may omit it
        // and Zod fills it in.
        if (!isOptional(value)) required.push(key);
      }
      return { type: 'OBJECT', properties, required };
    }

    // Unwrap the wrappers the pipeline's schemas use.
    case z.ZodFirstPartyTypeKind.ZodDefault:
    case z.ZodFirstPartyTypeKind.ZodOptional:
    case z.ZodFirstPartyTypeKind.ZodNullable:
      return zodToGeminiSchema(def.innerType as ZodTypeAny);

    case z.ZodFirstPartyTypeKind.ZodUnion: {
      // Gemini has no union type. The only union in use is string|number for a
      // chart's x value, where STRING accepts both and Zod coerces on the way
      // back. Anything more exotic should not be silently flattened.
      const options = def.options as ZodTypeAny[];
      const kinds = new Set(options.map((o) => (o._def as { typeName: string }).typeName));
      const stringLike = new Set([
        z.ZodFirstPartyTypeKind.ZodString,
        z.ZodFirstPartyTypeKind.ZodNumber,
      ]);
      if ([...kinds].every((kind) => stringLike.has(kind as z.ZodFirstPartyTypeKind))) {
        return { type: 'STRING' };
      }
      throw new Error(`Cannot express this union in Gemini's schema dialect: ${[...kinds].join(', ')}`);
    }

    default:
      throw new Error(`Unsupported Zod type for Gemini schema: ${def.typeName}`);
  }
}

function isOptional(schema: ZodTypeAny): boolean {
  const typeName = (schema._def as { typeName: string }).typeName;
  return (
    typeName === z.ZodFirstPartyTypeKind.ZodOptional ||
    typeName === z.ZodFirstPartyTypeKind.ZodDefault
  );
}
