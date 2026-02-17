/**
 * Anthropic to OpenAI Response Converter
 * Converts Anthropic Messages API responses to OpenAI Chat Completions format
 */

import crypto from 'crypto';

/**
 * Convert Anthropic response to OpenAI Chat Completion format
 * 
 * @param {Object} anthropicResponse - Anthropic format response
 * @returns {Object} OpenAI format response
 */
export function convertAnthropicToOpenAI(anthropicResponse) {
    const { id, model, content, stop_reason, usage } = anthropicResponse;

    // Convert ID (msg_xxx -> chatcmpl-xxx)
    const openaiId = id.replace(/^msg_/, 'chatcmpl-');

    // Extract content by type
    const textBlocks = content.filter(b => b.type === 'text');
    const thinkingBlocks = content.filter(b => b.type === 'thinking');
    const toolUseBlocks = content.filter(b => b.type === 'tool_use');

    // Build message object
    const message = {
        role: 'assistant'
    };

    // Concatenate text content
    if (textBlocks.length > 0) {
        message.content = textBlocks.map(b => b.text).join('');
    } else {
        // OpenAI expects content to be present even if empty when no tool calls
        message.content = null;
    }

    // Add reasoning_content if thinking blocks present
    if (thinkingBlocks.length > 0) {
        message.reasoning_content = thinkingBlocks.map(b => b.thinking).join('');
    }

    // Convert tool_use blocks to tool_calls array
    if (toolUseBlocks.length > 0) {
        message.tool_calls = toolUseBlocks.map(b => ({
            id: b.id,
            type: 'function',
            function: {
                name: b.name,
                arguments: JSON.stringify(b.input)
            }
        }));
    }

    // Map stop_reason to finish_reason
    // If tool_calls are present, always use 'tool_calls' as finish_reason
    let finish_reason;
    if (toolUseBlocks.length > 0) {
        finish_reason = 'tool_calls';
    } else {
        const finishReasonMap = {
            'end_turn': 'stop',
            'max_tokens': 'length',
            'tool_use': 'tool_calls',
            'stop_sequence': 'stop'
        };
        finish_reason = finishReasonMap[stop_reason] || 'stop';
    }

    // Build OpenAI response
    return {
        id: openaiId,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
            index: 0,
            message,
            finish_reason,
            logprobs: null
        }],
        usage: {
            prompt_tokens: usage.input_tokens + (usage.cache_read_input_tokens || 0),
            completion_tokens: usage.output_tokens,
            total_tokens: usage.input_tokens + (usage.cache_read_input_tokens || 0) + usage.output_tokens
        },
        system_fingerprint: null
    };
}
