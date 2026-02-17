/**
 * Test OpenAI Chat Completions API with tool calling
 * Tests function calling conversion
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

async function testToolCalling() {
    console.log('\n=== Test 1: Tool Calling ===');
    
    const payload = {
        model: 'gemini-3-flash',
        messages: [
            { role: 'user', content: 'What is the weather in Tokyo?' }
        ],
        tools: [{
            type: 'function',
            function: {
                name: 'get_weather',
                description: 'Get current weather for a location',
                parameters: {
                    type: 'object',
                    properties: {
                        location: {
                            type: 'string',
                            description: 'City name'
                        },
                        unit: {
                            type: 'string',
                            enum: ['celsius', 'fahrenheit'],
                            description: 'Temperature unit'
                        }
                    },
                    required: ['location']
                }
            }
        }],
        max_tokens: 200
    };

    const { status, data } = await makeRequest(payload);
    
    if (status !== 200) {
        throw new Error(`Expected status 200, got ${status}`);
    }

    const message = data.choices[0].message;
    
    if (!message.tool_calls || message.tool_calls.length === 0) {
        console.log('⚠ Model did not call tool (answered directly)');
        console.log(`  Direct answer: ${message.content}`);
        // This is acceptable behavior - model chose to answer without tools
        return;
    }

    const toolCall = message.tool_calls[0];
    
    if (!toolCall.id) {
        throw new Error('Tool call missing id');
    }

    if (toolCall.type !== 'function') {
        throw new Error(`Expected type='function', got '${toolCall.type}'`);
    }

    if (!toolCall.function || !toolCall.function.name) {
        throw new Error('Tool call missing function name');
    }

    if (!toolCall.function.arguments) {
        throw new Error('Tool call missing arguments');
    }

    // Parse arguments to validate JSON
    let args;
    try {
        args = JSON.parse(toolCall.function.arguments);
    } catch (e) {
        throw new Error(`Invalid JSON in tool arguments: ${toolCall.function.arguments}`);
    }

    if (data.choices[0].finish_reason !== 'tool_calls') {
        throw new Error(`Expected finish_reason='tool_calls', got '${data.choices[0].finish_reason}'`);
    }

    console.log('✓ Tool call structure valid');
    console.log(`  Tool ID: ${toolCall.id}`);
    console.log(`  Function: ${toolCall.function.name}`);
    console.log(`  Arguments: ${JSON.stringify(args, null, 2)}`);
}

async function testToolResponse() {
    console.log('\n=== Test 2: Tool Response ===');
    
    // First request - model calls tool
    const firstPayload = {
        model: 'gemini-3-flash',
        messages: [
            { role: 'user', content: 'What is 15 times 7?' }
        ],
        tools: [{
            type: 'function',
            function: {
                name: 'calculate',
                description: 'Perform a calculation',
                parameters: {
                    type: 'object',
                    properties: {
                        expression: { type: 'string' }
                    },
                    required: ['expression']
                }
            }
        }],
        max_tokens: 200
    };

    const { data: firstData } = await makeRequest(firstPayload);
    
    if (!firstData.choices[0].message.tool_calls) {
        console.log('⚠ Model did not call tool (may have answered directly)');
        return;
    }

    const toolCall = firstData.choices[0].message.tool_calls[0];
    
    // Second request - provide tool result
    const secondPayload = {
        model: 'gemini-3-flash',
        messages: [
            { role: 'user', content: 'What is 15 times 7?' },
            {
                role: 'assistant',
                tool_calls: [toolCall]
            },
            {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: '105'
            }
        ],
        tools: firstPayload.tools,
        max_tokens: 100
    };

    const { status, data: secondData } = await makeRequest(secondPayload);
    
    if (status !== 200) {
        throw new Error(`Expected status 200, got ${status}`);
    }

    const finalMessage = secondData.choices[0].message;
    
    if (!finalMessage.content) {
        throw new Error('Expected content in final response');
    }

    console.log('✓ Tool response handling valid');
    console.log(`  Tool called: ${toolCall.function.name}`);
    console.log(`  Final answer: ${finalMessage.content.substring(0, 100)}`);
}

async function testMultipleTools() {
    console.log('\n=== Test 3: Multiple Tools ===');
    
    const payload = {
        model: 'gemini-3-flash',
        messages: [
            { role: 'user', content: 'Search for "AI news" and get the weather in London.' }
        ],
        tools: [
            {
                type: 'function',
                function: {
                    name: 'web_search',
                    description: 'Search the web',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string' }
                        },
                        required: ['query']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'get_weather',
                    description: 'Get weather',
                    parameters: {
                        type: 'object',
                        properties: {
                            location: { type: 'string' }
                        },
                        required: ['location']
                    }
                }
            }
        ],
        max_tokens: 300
    };

    const { status, data } = await makeRequest(payload);
    
    if (status !== 200) {
        throw new Error(`Expected status 200, got ${status}`);
    }

    const message = data.choices[0].message;
    
    if (!message.tool_calls) {
        console.log('⚠ No tool calls (model may have answered without tools)');
        return;
    }

    console.log('✓ Multiple tools handled');
    console.log(`  Tool calls: ${message.tool_calls.length}`);
    message.tool_calls.forEach((tc, i) => {
        console.log(`  [${i}] ${tc.function.name}`);
    });
}

async function runAllTests() {
    console.log('Starting OpenAI Tool Calling Tests...');
    console.log('Server: http://' + BASE_URL + ':' + PORT);
    
    try {
        await testToolCalling();
        await testToolResponse();
        await testMultipleTools();
        
        console.log('\n✅ All tool calling tests passed!\n');
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
