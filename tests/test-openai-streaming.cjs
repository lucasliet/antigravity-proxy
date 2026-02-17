/**
 * Test OpenAI Chat Completions API streaming
 * Tests SSE chunk format and [DONE] marker
 */

const http = require('http');

const BASE_URL = 'localhost';
const PORT = 8080;

function makeStreamRequest(payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const options = {
            hostname: BASE_URL,
            port: PORT,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const chunks = [];
        let buffer = '';
        let hasSeenDone = false;

        const req = http.request(options, (res) => {
            if (res.statusCode !== 200) {
                let errorData = '';
                res.on('data', chunk => errorData += chunk);
                res.on('end', () => {
                    reject(new Error(`HTTP ${res.statusCode}: ${errorData}`));
                });
                return;
            }

            res.on('data', (chunk) => {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const eventData = line.slice(6);
                        
                        if (eventData === '[DONE]') {
                            hasSeenDone = true;
                        } else if (eventData.trim()) {
                            try {
                                const parsed = JSON.parse(eventData);
                                chunks.push(parsed);
                            } catch (e) {
                                console.warn('Failed to parse chunk:', eventData);
                            }
                        }
                    }
                }
            });

            res.on('end', () => {
                resolve({ chunks, hasSeenDone });
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function testBasicStreaming() {
    console.log('\n=== Test 1: Basic Streaming ===');
    
    const payload = {
        model: 'gemini-3-flash',
        messages: [
            { role: 'user', content: 'Count from 1 to 5, one number per line.' }
        ],
        stream: true,
        max_tokens: 100
    };

    const { chunks, hasSeenDone } = await makeStreamRequest(payload);
    
    if (!hasSeenDone) {
        throw new Error('Stream did not end with [DONE] marker');
    }

    if (chunks.length === 0) {
        throw new Error('No chunks received');
    }

    // Validate first chunk (should have role)
    const firstChunk = chunks[0];
    if (!firstChunk.id || !firstChunk.id.startsWith('chatcmpl-')) {
        throw new Error(`Invalid chunk ID: ${firstChunk.id}`);
    }

    if (firstChunk.object !== 'chat.completion.chunk') {
        throw new Error(`Expected object='chat.completion.chunk', got '${firstChunk.object}'`);
    }

    if (firstChunk.choices[0].delta.role !== 'assistant') {
        throw new Error('First chunk should have role=assistant');
    }

    // Validate subsequent chunks have content deltas
    const contentChunks = chunks.filter(c => c.choices[0].delta.content);
    if (contentChunks.length === 0) {
        throw new Error('No content deltas received');
    }

    // Find finish chunk
    const finishChunk = chunks.find(c => c.choices[0].finish_reason);
    if (!finishChunk) {
        throw new Error('No finish_reason in any chunk');
    }

    console.log('✓ Stream structure valid');
    console.log(`  Total chunks: ${chunks.length}`);
    console.log(`  Content chunks: ${contentChunks.length}`);
    console.log(`  Finish reason: ${finishChunk.choices[0].finish_reason}`);
    console.log(`  Has [DONE]: ${hasSeenDone}`);
    
    // Reconstruct full content
    const fullContent = chunks
        .map(c => c.choices[0].delta.content || '')
        .join('');
    console.log(`  Content: ${fullContent.substring(0, 100)}...`);
}

async function testThinkingStreaming() {
    console.log('\n=== Test 2: Thinking Model Streaming ===');
    
    const payload = {
        model: 'claude-sonnet-4-5-thinking',
        messages: [
            { role: 'user', content: 'What is 5*7? Show your reasoning.' }
        ],
        stream: true,
        max_tokens: 300
    };

    const { chunks, hasSeenDone } = await makeStreamRequest(payload);
    
    if (!hasSeenDone) {
        throw new Error('Stream did not end with [DONE]');
    }

    // Check for reasoning_content chunks
    const reasoningChunks = chunks.filter(c => c.choices[0].delta.reasoning_content);
    
    console.log('✓ Thinking model stream valid');
    console.log(`  Total chunks: ${chunks.length}`);
    console.log(`  Reasoning chunks: ${reasoningChunks.length}`);
    
    if (reasoningChunks.length > 0) {
        const fullReasoning = reasoningChunks
            .map(c => c.choices[0].delta.reasoning_content)
            .join('');
        console.log(`  Reasoning: ${fullReasoning.substring(0, 100)}...`);
    }
}

async function testUsageInStream() {
    console.log('\n=== Test 3: Usage Data in Stream ===');
    
    const payload = {
        model: 'gemini-3-flash',
        messages: [
            { role: 'user', content: 'Say hello' }
        ],
        stream: true,
        max_tokens: 50
    };

    const { chunks } = await makeStreamRequest(payload);
    
    // Find chunk with usage data (should be in final chunk)
    const usageChunk = chunks.find(c => c.usage);
    
    if (!usageChunk) {
        console.log('⚠ No usage data in stream (this is optional)');
    } else {
        console.log('✓ Usage data present in stream');
        console.log(`  Prompt tokens: ${usageChunk.usage.prompt_tokens}`);
        console.log(`  Completion tokens: ${usageChunk.usage.completion_tokens}`);
        console.log(`  Total tokens: ${usageChunk.usage.total_tokens}`);
    }
}

async function runAllTests() {
    console.log('Starting OpenAI Streaming Tests...');
    console.log('Server: http://' + BASE_URL + ':' + PORT);
    
    try {
        await testBasicStreaming();
        await testThinkingStreaming();
        await testUsageInStream();
        
        console.log('\n✅ All streaming tests passed!\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

runAllTests();
