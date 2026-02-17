/**
 * OpenAI to Anthropic Request Converter
 * Converts OpenAI Chat Completions API requests to Anthropic Messages API format
 */

import crypto from 'crypto';
import { isThinkingModel } from '../../constants.js';
import { logger } from '../../utils/logger.js';

/**
 * Convert OpenAI Chat Completions request to Anthropic Messages API format
 * 
 * @param {Object} openaiRequest - OpenAI format request
 * @returns {Object} Anthropic format request
 */
export function convertOpenAIToAnthropic(openaiRequest) {
    const {
        model,
        messages,
        tools,
        tool_choice,
        max_tokens,
        max_completion_tokens,
        temperature,
        top_p,
        stop,
        stream,
        reasoning_effort
    } = openaiRequest;

    // Extract system messages and concatenate
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    const system = systemMessages.length > 0
        ? systemMessages.map(m => m.content).join('\n\n')
        : undefined;

    // Convert messages
    const anthropicMessages = [];
    let pendingToolResults = [];

    for (const msg of nonSystemMessages) {
        if (msg.role === 'user') {
            // Flush pending tool results first
            if (pendingToolResults.length > 0) {
                anthropicMessages.push({
                    role: 'user',
                    content: pendingToolResults
                });
                pendingToolResults = [];
            }
            
            // Add user message
            anthropicMessages.push({
                role: 'user',
                content: typeof msg.content === 'string' ? msg.content : msg.content
            });
        } else if (msg.role === 'assistant') {
            const content = [];
            
            // Add text content if present
            if (msg.content) {
                content.push({ type: 'text', text: msg.content });
            }
            
            // Convert tool_calls to tool_use blocks
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                for (const tc of msg.tool_calls) {
                    try {
                        content.push({
                            type: 'tool_use',
                            id: tc.id || `toolu_${crypto.randomBytes(12).toString('hex')}`,
                            name: tc.function.name,
                            input: typeof tc.function.arguments === 'string'
                                ? JSON.parse(tc.function.arguments)
                                : tc.function.arguments
                        });
                    } catch (parseError) {
                        logger.warn(`[OpenAI] Failed to parse tool arguments: ${parseError.message}`);
                        // Use empty object as fallback
                        content.push({
                            type: 'tool_use',
                            id: tc.id || `toolu_${crypto.randomBytes(12).toString('hex')}`,
                            name: tc.function.name,
                            input: {}
                        });
                    }
                }
            }
            
            if (content.length > 0) {
                anthropicMessages.push({ role: 'assistant', content });
            }
        } else if (msg.role === 'tool') {
            // Accumulate tool results to group them into user message
            pendingToolResults.push({
                type: 'tool_result',
                tool_use_id: msg.tool_call_id,
                content: msg.content
            });
        }
    }

    // Flush remaining tool results
    if (pendingToolResults.length > 0) {
        anthropicMessages.push({
            role: 'user',
            content: pendingToolResults
        });
    }

    // Convert tools
    const anthropicTools = tools?.map(t => ({
        name: t.function.name,
        description: t.function.description || '',
        input_schema: t.function.parameters || { type: 'object' }
    }));

    // Map tool_choice
    let anthropicToolChoice;
    if (tool_choice === 'none') {
        anthropicToolChoice = { type: 'none' };
    } else if (tool_choice === 'auto' || !tool_choice) {
        anthropicToolChoice = { type: 'auto' };
    } else if (typeof tool_choice === 'object' && tool_choice.type === 'function') {
        anthropicToolChoice = { type: 'tool', name: tool_choice.function.name };
    }

    // Map reasoning_effort to thinking budget
    let thinking;
    if (reasoning_effort && isThinkingModel(model)) {
        const budgetMap = {
            low: 4096,
            medium: 10000,
            high: 32000
        };
        thinking = {
            budget_tokens: budgetMap[reasoning_effort] || 10000
        };
        logger.debug(`[OpenAI] Mapped reasoning_effort '${reasoning_effort}' to thinking budget ${thinking.budget_tokens}`);
    }

    const anthropicRequest = {
        model,
        messages: anthropicMessages,
        max_tokens: max_completion_tokens || max_tokens || 4096,
        stream
    };

    // Add optional fields only if defined
    if (system) anthropicRequest.system = system;
    if (anthropicTools && anthropicTools.length > 0) anthropicRequest.tools = anthropicTools;
    if (anthropicToolChoice) anthropicRequest.tool_choice = anthropicToolChoice;
    if (temperature !== undefined) anthropicRequest.temperature = temperature;
    if (top_p !== undefined) anthropicRequest.top_p = top_p;
    if (stop) anthropicRequest.stop_sequences = Array.isArray(stop) ? stop : [stop];
    if (thinking) anthropicRequest.thinking = thinking;

    logger.debug(`[OpenAI] Converted request: ${anthropicMessages.length} messages, ${anthropicTools?.length || 0} tools`);

    return anthropicRequest;
}
