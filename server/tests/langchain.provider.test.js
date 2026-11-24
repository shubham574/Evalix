/**
 * LangChainStructuredProvider: same contract and error categories as the native Gemini provider,
 * plus the model fallback chain. Models are injected (LangChain fakes), so no network is used.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';

const { FakeListChatModel } = require('@langchain/core/utils/testing');
const { RunnableLambda } = require('@langchain/core/runnables');
const { AIMessage } = require('@langchain/core/messages');
const { LangChainStructuredProvider, parseJsonText } = require('../modules/common/llm/langchain.provider');
const { LlmProviderError, GeminiExtractionProvider } = require('../modules/document-intelligence/providers/llm.provider');
const env = require('../config/env');
const { createLlmProvider } = require('../modules/common/llm/provider-factory');

const fake = (name, ...responses) => ({ name, provider: 'fake', llm: new FakeListChatModel({ responses }) });
const failing = (name, message) => ({
  name,
  provider: 'fake',
  llm: RunnableLambda.from(async () => {
    throw new Error(message);
  }),
});
const slow = (name, ms) => ({
  name,
  provider: 'fake',
  llm: RunnableLambda.from(
    () =>
      new Promise((resolve) => {
        setTimeout(() => resolve(new AIMessage('{"late":true}')), ms).unref();
      })
  ),
});

const call = (provider, extra = {}) =>
  provider.generateStructuredJson({ systemInstruction: 'Return JSON.', userPrompt: 'Go', requestId: 'req-1', ...extra });

const rejectsWith = async (promise, category) => {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof LlmProviderError, `expected LlmProviderError, got ${err?.constructor?.name}`);
    assert.strictEqual(err.category, category, `expected ${category}, got ${err.category}: ${err.message}`);
    return true;
  });
};

describe('LangChainStructuredProvider', () => {
  it('returns parsed JSON with the native provider contract', async () => {
    const p = new LangChainStructuredProvider({ models: [fake('primary', '{"rating":4,"ok":true}')] });
    const res = await call(p);
    assert.deepStrictEqual(res.data, { rating: 4, ok: true });
    assert.strictEqual(res.provider, 'langchain');
    assert.strictEqual(res.model, 'primary');
    assert.strictEqual(res.requestId, 'req-1');
  });

  it('accepts JSON wrapped in a ```json fence', async () => {
    const p = new LangChainStructuredProvider({ models: [fake('primary', '```json\n{"b":2}\n```')] });
    assert.deepStrictEqual((await call(p)).data, { b: 2 });
  });

  it('falls back to the next model and reports which one answered', async () => {
    const p = new LangChainStructuredProvider({
      models: [failing('primary', '503 service unavailable'), fake('backup', '{"from":"backup"}')],
    });
    const res = await call(p);
    assert.deepStrictEqual(res.data, { from: 'backup' });
    assert.strictEqual(res.model, 'backup');
  });

  it('classifies errors like the native provider', async () => {
    await rejectsWith(call(new LangChainStructuredProvider({ models: [failing('m', 'API_KEY_INVALID')] })), 'AUTH_ERROR');
    await rejectsWith(call(new LangChainStructuredProvider({ models: [failing('m', '429 quota exceeded')] })), 'RATE_LIMIT');
    await rejectsWith(call(new LangChainStructuredProvider({ models: [failing('m', 'socket hang up')] })), 'TRANSIENT');
    await rejectsWith(call(new LangChainStructuredProvider({ models: [fake('m', 'not json at all')] })), 'INVALID_JSON');
  });

  it('fails with AUTH_ERROR when no model is configured (no API key)', async () => {
    await rejectsWith(call(new LangChainStructuredProvider({ models: [] })), 'AUTH_ERROR');
  });

  it('enforces one timeout budget across the whole call', async () => {
    const p = new LangChainStructuredProvider({ models: [slow('m', 5000)], timeoutMs: 50 });
    const started = Date.now();
    await rejectsWith(call(p), 'TIMEOUT');
    assert.ok(Date.now() - started < 2000, 'timeout should cut the call short');
  });

  it("honours the caller's abort signal (lease loss) as TIMEOUT", async () => {
    const p = new LangChainStructuredProvider({ models: [slow('m', 5000)], timeoutMs: 10000 });
    const ac = new AbortController();
    setTimeout(() => ac.abort(new Error('lease lost')), 30);
    await rejectsWith(call(p, { signal: ac.signal }), 'TIMEOUT');

    const already = new AbortController();
    already.abort();
    await rejectsWith(call(p, { signal: already.signal }), 'TIMEOUT');
  });

  it('parseJsonText throws INVALID_JSON on garbage', () => {
    assert.throws(() => parseJsonText('nope'), (e) => e.category === 'INVALID_JSON');
  });

  it('createLlmProvider honours LLM_ENGINE', () => {
    const original = env.LLM_ENGINE;
    try {
      env.LLM_ENGINE = 'native';
      assert.ok(createLlmProvider({ apiKey: 'x' }) instanceof GeminiExtractionProvider);
      env.LLM_ENGINE = 'langchain';
      assert.ok(createLlmProvider({ models: [fake('m', '{}')] }) instanceof LangChainStructuredProvider);
    } finally {
      env.LLM_ENGINE = original;
    }
  });
});
