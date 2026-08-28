import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { summarySchema } from '@climatenote/shared';

import type { WorkerConfig } from '../config';
import { AiClient, type Transport } from './provider';
import type { GeminiRequest } from './gemini';

/**
 * Exercises the whole structured-generation path through Gemini with the
 * network stubbed, so the plumbing is proven before a real key touches it.
 */

function config(overrides: Partial<WorkerConfig> = {}): WorkerConfig {
  return {
    supabaseUrl: 'https://x.supabase.co',
    supabaseServiceKey: 'service',
    driveFolderId: 'folder',
    googleServiceAccount: {},
    aiProvider: 'gemini',
    openAiKey: null,
    openAiModel: 'gpt-4.1-mini',
    geminiKey: 'gemini-key',
    geminiTextModel: 'gemini-3.7-flash',
    geminiImageModel: 'gemini-3.5-flash-image',
    unsplashKey: null,
    pexelsKey: null,
    ...overrides,
  };
}

/** Replies with each response in turn, recording what it was asked. */
function stubTransport(replies: string[]): Transport & { calls: GeminiRequest[] } {
  const calls: GeminiRequest[] = [];
  let index = 0;

  return {
    calls,
    gemini: (_key, _model, request) => {
      calls.push(request);
      const text = replies[Math.min(index, replies.length - 1)] ?? '';
      index += 1;
      return Promise.resolve({ text, usage: { promptTokens: 5, totalTokens: 20 } });
    },
  };
}

const VALID_SUMMARY = JSON.stringify({
  problem: 'Cows burp methane, and there are a great many cows in the world today.',
  whyItMatters: 'Methane traps heat quickly, so cutting it slows warming within our lifetimes.',
  whatWeCanDo: ['Swap two beef meals for beans this week.', 'Finish the food already in your fridge.'],
  jargonAvoided: ['enteric fermentation'],
});

describe('structured generation through Gemini', () => {
  it('parses a valid response and reports usage', async () => {
    const transport = stubTransport([VALID_SUMMARY]);
    const ai = new AiClient(config(), transport);

    const summary = await ai.structured({
      system: 'system',
      user: 'user',
      schema: summarySchema,
      schemaName: 'summary',
    });

    assert.ok(summary.problem.includes('methane'));
    assert.equal(summary.whatWeCanDo.length, 2);
    assert.equal(ai.usage.tokens, 20);
    assert.equal(ai.usage.provider, 'gemini');
    assert.equal(ai.usage.model, 'gemini-3.7-flash');
  });

  it('constrains generation with a schema rather than just asking for JSON', async () => {
    const transport = stubTransport([VALID_SUMMARY]);
    await new AiClient(config(), transport).structured({
      system: 'system',
      user: 'user',
      schema: summarySchema,
      schemaName: 'summary',
    });

    const sent = transport.calls[0];
    assert.ok(sent?.responseSchema, 'no schema was sent, so output is unconstrained');
    assert.equal(sent.responseSchema.type, 'OBJECT');
    assert.ok(sent.responseSchema.required?.includes('problem'));
  });

  it('retries with the validation error fed back', async () => {
    // First reply is well-formed JSON but violates the schema: whatWeCanDo
    // needs at least two entries.
    const tooFew = JSON.stringify({
      problem: 'x'.repeat(50),
      whyItMatters: 'y'.repeat(50),
      whatWeCanDo: ['only one item here, which is not enough'],
    });

    const transport = stubTransport([tooFew, VALID_SUMMARY]);
    const ai = new AiClient(config(), transport);

    const summary = await ai.structured({
      system: 'system',
      user: 'original request',
      schema: summarySchema,
      schemaName: 'summary',
    });

    assert.equal(summary.whatWeCanDo.length, 2);
    assert.equal(transport.calls.length, 2, 'did not retry');

    // The retry must say what was wrong, or the model has no way to correct it.
    const retry = transport.calls[1]?.user ?? '';
    assert.ok(retry.includes('original request'), 'lost the original request');
    assert.ok(retry.includes('rejected'), 'did not tell the model it was rejected');
    assert.ok(/whatWeCanDo/.test(retry), 'did not name the offending field');
  });

  it('gives up with a useful message rather than looping', async () => {
    const transport = stubTransport(['not json at all']);
    const ai = new AiClient(config(), transport);

    await assert.rejects(
      ai.structured(
        { system: 's', user: 'u', schema: summarySchema, schemaName: 'summary' },
        2,
      ),
      /summary did not validate after 2 attempts/,
    );
    assert.equal(transport.calls.length, 2);
  });

  it('fills in a defaulted field the model omitted', async () => {
    const withoutOptional = JSON.stringify({
      problem: 'x'.repeat(50),
      whyItMatters: 'y'.repeat(50),
      whatWeCanDo: ['Swap two beef meals for beans.', 'Finish your leftovers.'],
    });

    const summary = await new AiClient(config(), stubTransport([withoutOptional])).structured({
      system: 's',
      user: 'u',
      schema: summarySchema,
      schemaName: 'summary',
    });

    assert.deepEqual(summary.jargonAvoided, []);
  });
});

describe('provider selection', () => {
  it('explains what to set when the Gemini key is missing', async () => {
    const ai = new AiClient(config({ geminiKey: null }), stubTransport([VALID_SUMMARY]));
    await assert.rejects(
      ai.text({ system: 's', user: 'u' }),
      /GEMINI_API_KEY is not set.*aistudio\.google\.com/s,
    );
  });

  it('points at the free option when OpenAI is selected without a key', async () => {
    const ai = new AiClient(
      config({ aiProvider: 'openai', openAiKey: null }),
      stubTransport([VALID_SUMMARY]),
    );
    await assert.rejects(ai.text({ system: 's', user: 'u' }), /free Gemini tier/);
  });
});
