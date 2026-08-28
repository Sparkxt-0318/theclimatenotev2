import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  figureSpecSchema,
  imageryPlanSchema,
  reflectionGradeSchema,
  reflectionSetSchema,
  summarySchema,
} from '@climatenote/shared';
import { z } from 'zod';

import { callGemini, zodToGeminiSchema, type GeminiSchema } from './gemini';

/**
 * The pipeline's real schemas, converted for Gemini.
 *
 * These are the ones that matter: if conversion silently drops a constraint,
 * the model is free to return something the Zod parse then rejects, and the
 * failure surfaces as an opaque retry loop rather than a clear error.
 */
describe('converting the pipeline schemas', () => {
  const schemas = {
    summary: summarySchema,
    'imagery plan': imageryPlanSchema,
    'figure spec': figureSpecSchema,
    reflections: reflectionSetSchema,
    'reflection grade': reflectionGradeSchema,
  };

  for (const [name, schema] of Object.entries(schemas)) {
    it(`converts the ${name} schema without throwing`, () => {
      const converted = zodToGeminiSchema(schema);
      assert.equal(converted.type, 'OBJECT');
      assert.ok(converted.properties, 'lost its properties');
    });
  }

  it('marks the summary fields the model must return', () => {
    const converted = zodToGeminiSchema(summarySchema);
    assert.ok(converted.required?.includes('problem'));
    assert.ok(converted.required?.includes('whyItMatters'));
    assert.ok(converted.required?.includes('whatWeCanDo'));
    // jargonAvoided has .default([]) — optional in, guaranteed out, so the
    // model must not be forced to produce it.
    assert.ok(!converted.required?.includes('jargonAvoided'));
  });

  it('keeps the reflection set pinned at exactly three options', () => {
    const converted = zodToGeminiSchema(reflectionSetSchema);
    const options = converted.properties?.options;
    assert.equal(options?.type, 'ARRAY');
    assert.equal(options?.minItems, 3);
    assert.equal(options?.maxItems, 3);
  });

  it('carries enum values through, so the model cannot invent a factor key', () => {
    const converted = zodToGeminiSchema(reflectionSetSchema);
    const option = converted.properties?.options?.items;
    const factorKey = option?.properties?.factorKey;
    assert.equal(factorKey?.type, 'STRING');
    assert.ok((factorKey?.enum?.length ?? 0) > 5, 'factor keys were not enumerated');
    assert.ok(factorKey?.enum?.includes('meal.beef_to_plant'));
  });

  it('distinguishes integers from numbers', () => {
    const converted = zodToGeminiSchema(reflectionGradeSchema);
    // The grader returns whole scores; a float would be nonsense.
    assert.equal(converted.properties?.specificity?.type, 'INTEGER');
  });

  it('flattens the chart x-axis union to a string', () => {
    // Gemini has no union type. x is string|number, and STRING accepts both
    // because Zod coerces on the way back.
    const converted = zodToGeminiSchema(figureSpecSchema);
    const point = converted.properties?.series?.items?.properties?.points?.items;
    assert.equal(point?.properties?.x?.type, 'STRING');
    assert.equal(point?.properties?.y?.type, 'NUMBER');
  });
});

describe('schema conversion edge cases', () => {
  it('refuses a union it cannot express rather than silently degrading', () => {
    // A dropped constraint would let malformed output reach the Zod parse and
    // surface as a confusing retry loop instead of a clear error.
    const impossible = z.object({ value: z.union([z.object({ a: z.string() }), z.boolean()]) });
    assert.throws(() => zodToGeminiSchema(impossible), /Cannot express this union/);
  });

  it('refuses an unsupported type rather than emitting a wrong schema', () => {
    assert.throws(() => zodToGeminiSchema(z.object({ when: z.date() })), /Unsupported Zod type/);
  });

  it('unwraps optional and nullable wrappers', () => {
    const converted = zodToGeminiSchema(
      z.object({ a: z.string().optional(), b: z.string().nullable() }),
    );
    assert.equal(converted.properties?.a?.type, 'STRING');
    assert.equal(converted.properties?.b?.type, 'STRING');
    assert.ok(!converted.required?.includes('a'), 'optional field was marked required');
  });
});

// ── Transport, exercised without a key ──────────────────────────────────────

/** Stands in for the network so request shape and error handling are provable. */
function stubFetch(handler: (url: string, init: RequestInit) => Response) {
  const original = globalThis.fetch;
  globalThis.fetch = ((url: string | URL, init?: RequestInit) =>
    Promise.resolve(handler(String(url), init ?? {}))) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

describe('the Gemini request', () => {
  const request = {
    system: 'You are a test.',
    user: 'Say something.',
    temperature: 0.3,
    maxTokens: 500,
  };

  const okResponse = () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"ok":true}' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 10, totalTokenCount: 25 },
      }),
      { status: 200 },
    );

  it('is shaped the way the API expects', async () => {
    type Captured = { url: string; body: Record<string, unknown>; headers: Headers };
    const seen: Captured[] = [];

    const restore = stubFetch((url, init) => {
      seen.push({
        url,
        body: JSON.parse(String(init.body)) as Record<string, unknown>,
        headers: new Headers(init.headers),
      });
      return okResponse();
    });

    try {
      await callGemini('test-key', 'gemini-3.7-flash', request);
    } finally {
      restore();
    }

    const captured = seen[0];
    assert.ok(captured, 'no request was made');
    const { url, body, headers } = captured;

    assert.ok(url.endsWith('/models/gemini-3.7-flash:generateContent'), url);
    // The key goes in a header, not the query string, so it stays out of logs.
    assert.equal(headers.get('x-goog-api-key'), 'test-key');
    assert.ok(!url.includes('test-key'), 'the API key leaked into the URL');

    assert.deepEqual(body.systemInstruction, { parts: [{ text: 'You are a test.' }] });
    assert.deepEqual(body.contents, [{ role: 'user', parts: [{ text: 'Say something.' }] }]);

    const generationConfig = body.generationConfig as Record<string, unknown>;
    assert.equal(generationConfig.temperature, 0.3);
    assert.equal(generationConfig.maxOutputTokens, 500);
    // No schema was passed, so JSON mode must not be switched on.
    assert.equal(generationConfig.responseMimeType, undefined);
  });

  it('switches on JSON mode when given a schema', async () => {
    let generationConfig: Record<string, unknown> = {};
    const schema: GeminiSchema = { type: 'OBJECT', properties: { ok: { type: 'BOOLEAN' } } };

    const restore = stubFetch((_url, init) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      generationConfig = body.generationConfig as Record<string, unknown>;
      return okResponse();
    });

    try {
      await callGemini('k', 'm', { ...request, responseSchema: schema });
    } finally {
      restore();
    }

    assert.equal(generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(generationConfig.responseSchema, schema);
  });

  it('reports token usage', async () => {
    const restore = stubFetch(() => okResponse());
    try {
      const { usage } = await callGemini('k', 'm', request);
      assert.equal(usage.totalTokens, 25);
    } finally {
      restore();
    }
  });

  it('explains a free-tier rate limit rather than dumping the payload', async () => {
    const restore = stubFetch(() => new Response('quota exceeded', { status: 429 }));
    try {
      await assert.rejects(callGemini('k', 'm', request), /free-tier rate limit/);
    } finally {
      restore();
    }
  });

  it('names truncation as the cause instead of failing to parse JSON', async () => {
    const restore = stubFetch(
      () =>
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"a"' }] }, finishReason: 'MAX_TOKENS' }] }),
          { status: 200 },
        ),
    );
    try {
      await assert.rejects(callGemini('k', 'm', request), /output token limit/);
    } finally {
      restore();
    }
  });

  it('surfaces a blocked prompt', async () => {
    const restore = stubFetch(
      () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 }),
    );
    try {
      await assert.rejects(callGemini('k', 'm', request), /blocked the prompt: SAFETY/);
    } finally {
      restore();
    }
  });
});
