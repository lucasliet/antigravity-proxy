/**
 * Anthropic to OpenAI Stream Adapter
 * Converts Anthropic SSE events to OpenAI Chat Completion chunks
 */

import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

/**
 * Adapt Anthropic SSE event stream to OpenAI Chat Completion chunks
 * 
 * @param {AsyncGenerator} anthropicGenerator - Anthropic event generator
 * @param {string} model - Model name
 * @yields {Object|string} OpenAI format chunks or '[DONE]'
 */
export async function* adaptAnthropicStreamToOpenAI(anthropicGenerator, model) {
    const messageId = `chatcmpl-${crypto.randomBytes(16).toString('hex')}`;
    const created = Math.floor(Date.now() / 1000);
    
    // State tracking
    let currentToolCallIndex = -1;
    let accumulatedUsage = {
        prompt_tokens: 0,
        completion_tokens: 0
    };
    let hasEmittedRole = false;

    try {
        for await (const event of anthropicGenerator) {
            logger.debug(`[OpenAI Stream] Event: ${event.type}`);

            if (event.type === 'message_start') {
                // Emit role chunk first
                if (!hasEmittedRole) {
                    yield buildChunk(messageId, model, created, { role: 'assistant' });
                    hasEmittedRole = true;
                }
                
                // Capture initial usage
                const usage = event.message?.usage;
                if (usage) {
                    accumulatedUsage.prompt_tokens = usage.input_tokens + (usage.cache_read_input_tokens || 0);
                }
            }

            else if (event.type === 'content_block_start') {
                const block = event.content_block;
                
                if (block.type === 'tool_use') {
                    currentToolCallIndex++;
                    // Emit tool_call start with metadata
                    yield buildChunk(messageId, model, created, {
                        tool_calls: [{
                            index: currentToolCallIndex,
                            id: block.id,
                            type: 'function',
                            function: {
                                name: block.name,
                                arguments: ''
                            }
                        }]
                    });
                }
            }

            else if (event.type === 'content_block_delta') {
                const { delta } = event;

                if (delta.type === 'thinking_delta') {
                    // Stream reasoning content
                    yield buildChunk(messageId, model, created, {
                        reasoning_content: delta.thinking
                    });
                }

                else if (delta.type === 'text_delta') {
                    // Stream text content
                    yield buildChunk(messageId, model, created, {
                        content: delta.text
                    });
                }

                else if (delta.type === 'input_json_delta') {
                    // Stream tool call arguments
                    yield buildChunk(messageId, model, created, {
                        tool_calls: [{
                            index: currentToolCallIndex,
                            function: {
                                arguments: delta.partial_json
                            }
                        }]
                    });
                }
            }

            else if (event.type === 'content_block_stop') {
                // No-op - OpenAI doesn't need explicit block stop events
            }

            else if (event.type === 'message_delta') {
                // Capture output usage
                if (event.usage) {
                    accumulatedUsage.completion_tokens = event.usage.output_tokens;
                }

                // Map stop_reason
                const finishReasonMap = {
                    'end_turn': 'stop',
                    'max_tokens': 'length',
                    'tool_use': 'tool_calls',
                    'stop_sequence': 'stop'
                };
                const finish_reason = finishReasonMap[event.delta?.stop_reason] || null;

                // Emit final chunk with finish_reason and usage
                const finalUsage = {
                    prompt_tokens: accumulatedUsage.prompt_tokens,
                    completion_tokens: accumulatedUsage.completion_tokens,
                    total_tokens: accumulatedUsage.prompt_tokens + accumulatedUsage.completion_tokens
                };

                yield buildChunk(messageId, model, created, {}, finish_reason, finalUsage);
            }

            else if (event.type === 'message_stop') {
                // End of stream - emit [DONE]
                logger.debug('[OpenAI Stream] Emitting [DONE]');
            }
        }

        // Always emit [DONE] at the end
        yield '[DONE]';

    } catch (error) {
        logger.error('[OpenAI Stream] Adapter error:', error);
        throw error;
    }
}

/**
 * Build an OpenAI Chat Completion chunk
 * 
 * @param {string} id - Message ID
 * @param {string} model - Model name
 * @param {number} created - Unix timestamp
 * @param {Object} delta - Delta content
 * @param {string|null} finish_reason - Finish reason
 * @param {Object|null} usage - Usage statistics
 * @returns {Object} OpenAI chunk
 */
function buildChunk(id, model, created, delta, finish_reason = null, usage = null) {
    const chunk = {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
            index: 0,
            delta,
            finish_reason,
            logprobs: null
        }]
    };

    // Include usage in final chunk
    if (usage) {
        chunk.usage = usage;
    }

    return chunk;
}
