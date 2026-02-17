/**
 * OpenAI API Compatibility Module
 * Converts between OpenAI Chat Completions API format and Anthropic Messages API format
 */

export { convertOpenAIToAnthropic } from './request-converter.js';
export { convertAnthropicToOpenAI } from './response-converter.js';
export { adaptAnthropicStreamToOpenAI } from './stream-adapter.js';
export { parseErrorOpenAI } from './error-formatter.js';

// Import for default export
import { convertOpenAIToAnthropic } from './request-converter.js';
import { convertAnthropicToOpenAI } from './response-converter.js';
import { adaptAnthropicStreamToOpenAI } from './stream-adapter.js';
import { parseErrorOpenAI } from './error-formatter.js';

export default {
    convertOpenAIToAnthropic,
    convertAnthropicToOpenAI,
    adaptAnthropicStreamToOpenAI,
    parseErrorOpenAI
};
