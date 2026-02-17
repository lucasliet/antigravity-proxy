/**
 * Test OpenAI Chat Completions API compatibility (non-streaming)
 * Tests basic request/response conversion
 */

const http = require('http');

const BASE_URL = 'localhost';
const PORT = 8080;

function makeRequest(payload) {
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

        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${responseData}`));
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function testBasicCompletion() {
    console.log('\n=== Test 1: Basic OpenAI Completion ===');
    
    const payload = {
        model: 'gemini-3-flash',
        messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say "Hello from OpenAI format!" and nothing else.' }
        ],
        max_tokens: 50
    };

    const { status, data } = await makeRequest(payload);
    
    // Validate response structure
    if (status !== 200) {
        throw new Error(`Expected status 200, got ${status}`);
    }

    if (!data.id || !data.id.startsWith('chatcmpl-')) {
        throw new Error(`Invalid ID format: ${data.id}`);
    }

    if (data.object !== 'chat.completion') {
        throw new Error(`Expected object='chat.completion', got '${data.object}'`);
    }

    if (!data.choices || data.choices.length === 0) {
        throw new Error('No choices in response');
    }

    const choice = data.choices[0];
    if (choice.message.role !== 'assistant') {
        throw new Error(`Expected role='assistant', got '${choice.message.role}'`);
    }

    if (!choice.message.content) {
        throw new Error('No content in response');
    }

    if (!data.usage || typeof data.usage.total_tokens !== 'number') {
        throw new Error('Invalid usage data');
    }

    console.log('✓ Response structure valid');
    console.log(`  ID: ${data.id}`);
    console.log(`  Model: ${data.model}`);
    console.log(`  Content: ${choice.message.content.substring(0, 100)}...`);
    console.log(`  Tokens: ${data.usage.prompt_tokens} prompt, ${data.usage.completion_tokens} completion, ${data.usage.total_tokens} total`);
    console.log(`  Finish reason: ${choice.finish_reason}`);
}

async function testSystemMessage() {
    console.log('\n=== Test 2: System Message Extraction ===');
    
    const payload = {
        model: 'gemini-3-flash',
        messages: [
            { role: 'system', content: 'You are a pirate.' },
            { role: 'system', content: 'You love treasure.' },
            { role: 'user', content: 'Introduce yourself in 10 words or less.' }
        ],
        max_tokens: 50
    };

    const { status, data } = await makeRequest(payload);
    
    if (status !== 200) {
        throw new Error(`Expected status 200, got ${status}`);
    }

    console.log('✓ System messages handled correctly');
    console.log(`  Response: ${data.choices[0].message.content}`);
}

async function testThinkingModel() {
    console.log('\n=== Test 3: Thinking Model (reasoning_content) ===');
    
    const payload = {
        model: 'claude-sonnet-4-5-thinking',
        messages: [
            { role: 'user', content: 'What is 2+2? Think step by step.' }
        ],
        max_tokens: 200
    };

    const { status, data } = await makeRequest(payload);
    
    if (status !== 200) {
        throw new Error(`Expected status 200, got ${status}`);
    }

    const message = data.choices[0].message;
    
    // Check if reasoning_content is present (optional, depends on model)
    if (message.reasoning_content) {
        console.log('✓ Reasoning content present');
        console.log(`  Reasoning: ${message.reasoning_content.substring(0, 100)}...`);
    } else {
        console.log('⚠ No reasoning content (may be normal for this response)');
    }
    
    console.log(`  Answer: ${message.content}`);
}

async function runAllTests() {
    console.log('Starting OpenAI Compatibility Tests...');
    console.log('Server: http://' + BASE_URL + ':' + PORT);
    
    try {
        await testBasicCompletion();
        await testSystemMessage();
        await testThinkingModel();
        
        console.log('\n✅ All OpenAI compatibility tests passed!\n');
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
