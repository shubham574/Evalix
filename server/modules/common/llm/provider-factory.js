/**
 * Single place that decides which structured-JSON LLM provider the modules use.
 *
 * LLM_ENGINE=langchain (default) -> LangChainStructuredProvider (retries, fallbacks, tracing)
 * LLM_ENGINE=native              -> GeminiExtractionProvider (direct @google/genai SDK)
 *
 * Both expose the same `generateStructuredJson` contract, so callers never need to know.
 */
const env = require('../../../config/env');
const { GeminiExtractionProvider } = require('../../document-intelligence/providers/llm.provider');
const { LangChainStructuredProvider } = require('./langchain.provider');

const createLlmProvider = (options = {}) =>
  env.LLM_ENGINE === 'native'
    ? new GeminiExtractionProvider(options)
    : new LangChainStructuredProvider(options);

module.exports = { createLlmProvider };
