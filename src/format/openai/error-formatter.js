/**
 * OpenAI Error Formatter
 * Converts errors to OpenAI API error format
 */

import { logger } from '../../utils/logger.js';

/**
 * Parse error and convert to OpenAI format
 * 
 * @param {Error} error - The error object
 * @returns {Object} Object with statusCode and error object in OpenAI format
 */
export function parseErrorOpenAI(error) {
    let type = 'api_error';
    let statusCode = 500;
    let message = error.message;

    // Authentication errors
    if (error.message.includes('401') || error.message.includes('UNAUTHENTICATED') || error.message.includes('AUTH_INVALID')) {
        type = 'invalid_request_error';
        statusCode = 401;
        message = 'Authentication failed. Make sure the proxy is configured with valid credentials.';
    }
    
    // Rate limit errors
    else if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('QUOTA_EXHAUSTED')) {
        type = 'rate_limit_exceeded';
        statusCode = 429;
        
        // Try to extract reset time from error message
        const resetMatch = error.message.match(/quota will reset after ([\dh\dm\ds]+)/i);
        const modelMatch = error.message.match(/Rate limited on ([^.]+)\./) || error.message.match(/"model":\s*"([^"]+)"/);
        const model = modelMatch ? modelMatch[1] : 'the model';
        
        if (resetMatch) {
            message = `Rate limit exceeded on ${model}. Quota will reset after ${resetMatch[1]}.`;
        } else {
            message = `Rate limit exceeded on ${model}. Please wait for your quota to reset.`;
        }
    }
    
    // Invalid request errors
    else if (error.message.includes('invalid_request_error') || error.message.includes('INVALID_ARGUMENT')) {
        type = 'invalid_request_error';
        statusCode = 400;
        
        // Try to extract specific error message
        const msgMatch = error.message.match(/"message":"([^"]+)"/);
        if (msgMatch) {
            message = msgMatch[1];
        }
    }
    
    // Permission errors
    else if (error.message.includes('PERMISSION_DENIED') || error.message.includes('403')) {
        type = 'permission_denied';
        statusCode = 403;
        message = error.message.includes('VALIDATION_REQUIRED') 
            ? 'Account requires verification. Please check the WebUI for details.'
            : message;
    }
    
    // Service unavailable
    else if (error.message.includes('All endpoints failed') || error.message.includes('503')) {
        type = 'api_error';
        statusCode = 503;
        message = 'Service temporarily unavailable. The upstream API may be experiencing issues.';
    }
    
    // No accounts available
    else if (error.message.includes('No accounts available') || error.message.includes('All accounts are invalid')) {
        type = 'invalid_request_error';
        statusCode = 400;
        message = error.message;
    }

    logger.debug(`[OpenAI Error] ${statusCode} ${type}: ${message}`);

    return {
        statusCode,
        error: {
            message,
            type,
            code: null
        }
    };
}
