# OpenAI API Compatibility

The Antigravity Claude Proxy supports the **OpenAI Chat Completions API** format, allowing you to use any OpenAI-compatible client, SDK, or application without modification.

## Quick Start

```bash
# Start the proxy server
antigravity-claude-proxy start

# Use with openai-python
pip install openai

python -c "
from openai import OpenAI
client = OpenAI(base_url='http://localhost:8080/v1', api_key='test')
response = client.chat.completions.create(
    model='gemini-3-flash',
    messages=[{'role': 'user', 'content': 'Hello!'}]
)
print(response.choices[0].message.content)
"
```

---

## Endpoint

```
POST /v1/chat/completions
```

**Authentication:** Reuses `/v1/*` authentication (set `API_KEY` environment variable or leave unset for localhost).

---

## Supported Features

| Feature | Status | Notes |
|---------|--------|-------|
| **Messages API** | ✅ Full support | User, assistant, system, tool messages |
| **Streaming** | ✅ Full support | SSE with `data: [DONE]` marker |
| **Tool Calling** | ✅ Full support | Function calling with arguments |
| **Reasoning** | ✅ Full support | `thinking` ↔ `reasoning_content` mapping |
| **Multi-turn** | ✅ Full support | Conversation history |
| **Temperature / top_p** | ✅ Full support | Sampling parameters |
| **Max tokens** | ✅ Full support | `max_tokens` and `max_completion_tokens` |
| **Stop sequences** | ✅ Full support | Custom stop strings |

### Not Supported

❌ **n > 1** (multiple completions per request)  
❌ **logprobs** (log probabilities)  
❌ **logit_bias** (token biasing)  
❌ **response_format** (JSON mode/structured outputs)  
❌ **seed** (deterministic sampling)

These fields are silently ignored if provided.

---

## Model Mapping

Use the same model IDs as with the Anthropic endpoint:

| Model ID | Description | Context | Thinking |
|----------|-------------|---------|----------|
| `claude-sonnet-4-5-thinking` | Claude Sonnet 4.5 | 200K | ✅ |
| `claude-opus-4-6-thinking` | Claude Opus 4.6 | 200K | ✅ |
| `claude-sonnet-4-5` | Claude Sonnet 4.5 (no thinking) | 200K | ❌ |
| `gemini-3-flash` | Gemini 3 Flash | 1M | ✅ |
| `gemini-3-pro-high` | Gemini 3 Pro High | 1M | ✅ |
| `gemini-3-pro-low` | Gemini 3 Pro Low | 1M | ✅ |

> **Note:** These are not native OpenAI models. The proxy translates requests to work with Claude/Gemini via Google Cloud Code.

---

## Usage Examples

### Python (openai-python)

```python
from openai import OpenAI

# Initialize client
client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="test"  # Required but not validated (unless API_KEY env is set)
)

# Basic completion
response = client.chat.completions.create(
    model="gemini-3-flash",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain quantum computing in simple terms."}
    ],
    max_tokens=200
)

print(response.choices[0].message.content)
```

### Node.js (openai-node)

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:8080/v1',
  apiKey: 'test'
});

const response = await client.chat.completions.create({
  model: 'claude-sonnet-4-5-thinking',
  messages: [{ role: 'user', content: 'Write a haiku about coding' }]
});

console.log(response.choices[0].message.content);
```

### Streaming

```python
stream = client.chat.completions.create(
    model="gemini-3-flash",
    messages=[{"role": "user", "content": "Count to 10"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end='', flush=True)
```

### Reasoning Content (Thinking)

```python
response = client.chat.completions.create(
    model="claude-opus-4-6-thinking",
    messages=[{"role": "user", "content": "Solve: If x + 5 = 12, what is x?"}]
)

# Access reasoning (thinking blocks)
if hasattr(response.choices[0].message, 'reasoning_content'):
    print("Reasoning:", response.choices[0].message.reasoning_content)

print("Answer:", response.choices[0].message.content)
```

> **Note:** `reasoning_content` is populated from Anthropic `thinking` blocks. Not all models/responses include this field.

### Tool Calling (Function Calling)

```python
tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather for a location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City name, e.g. 'London'"
                },
                "unit": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "description": "Temperature unit"
                }
            },
            "required": ["location"]
        }
    }
}]

response = client.chat.completions.create(
    model="gemini-3-flash",
    messages=[{"role": "user", "content": "What's the weather in Tokyo?"}],
    tools=tools
)

# Check if model wants to call a tool
if response.choices[0].message.tool_calls:
    for tool_call in response.choices[0].message.tool_calls:
        print(f"Tool: {tool_call.function.name}")
        print(f"Args: {tool_call.function.arguments}")
        
        # Execute the tool (your implementation)
        result = execute_tool(tool_call.function.name, tool_call.function.arguments)
        
        # Send result back to model
        messages = [
            {"role": "user", "content": "What's the weather in Tokyo?"},
            {
                "role": "assistant",
                "tool_calls": [tool_call.model_dump()]
            },
            {
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result
            }
        ]
        
        final_response = client.chat.completions.create(
            model="gemini-3-flash",
            messages=messages,
            tools=tools
        )
        
        print("Final answer:", final_response.choices[0].message.content)
```

---

## Field Mapping

### Request (OpenAI → Anthropic Internal)

| OpenAI Field | Anthropic Field | Notes |
|--------------|-----------------|-------|
| `messages[role="system"]` | `system` | Extracted from messages array, concatenated |
| `messages[role="user"]` | `messages[role="user"]` | Direct mapping |
| `messages[role="assistant"]` | `messages[role="assistant"]` | Direct mapping |
| `messages[role="assistant"].tool_calls` | `content[type="tool_use"]` | Converted to tool_use blocks |
| `messages[role="tool"]` | `content[type="tool_result"]` | Grouped into user messages |
| `tools[].function` | `tools[]` | Schema: `parameters` → `input_schema` |
| `tool_choice` | `tool_choice` | "auto"→"auto", "none"→"none", object→mapped |
| `max_tokens` / `max_completion_tokens` | `max_tokens` | Prefer `max_completion_tokens` |
| `temperature` | `temperature` | Passthrough |
| `top_p` | `top_p` | Passthrough |
| `stop` | `stop_sequences` | Array or string |
| `stream` | `stream` | Boolean |
| `reasoning_effort` | `thinking.budget_tokens` | "low"→4k, "medium"→10k, "high"→32k |

### Response (Anthropic → OpenAI)

| Anthropic Field | OpenAI Field | Notes |
|-----------------|--------------|-------|
| `id` (msg_xxx) | `id` | Prefix changed to `chatcmpl-` |
| `content[type="text"]` | `message.content` | Concatenated |
| `content[type="thinking"]` | `message.reasoning_content` | Concatenated |
| `content[type="tool_use"]` | `message.tool_calls[]` | Converted to function format |
| `stop_reason` | `finish_reason` | end_turn→stop, max_tokens→length, tool_use→tool_calls |
| `usage.input_tokens` | `usage.prompt_tokens` | Includes cache_read |
| `usage.output_tokens` | `usage.completion_tokens` | Direct mapping |
| - | `usage.total_tokens` | prompt + completion |

### Streaming (Anthropic Events → OpenAI Chunks)

| Anthropic Event | OpenAI Chunk | Notes |
|-----------------|--------------|-------|
| `message_start` | `delta: {role: "assistant"}` | First chunk |
| `content_block_delta[thinking_delta]` | `delta: {reasoning_content: "..."}` | Reasoning stream |
| `content_block_delta[text_delta]` | `delta: {content: "..."}` | Text stream |
| `content_block_start[tool_use]` | `delta: {tool_calls: [{...}]}` | Tool call start |
| `content_block_delta[input_json_delta]` | `delta: {tool_calls: [{function: {arguments: "..."}}]}` | Tool args stream |
| `message_delta` | `finish_reason: "..."` | Final chunk with reason |
| `message_stop` | `data: [DONE]` | End marker |

---

## Limitations

### 1. Tool Result Grouping

Multiple consecutive `tool` role messages are grouped into a single `user` message with multiple `tool_result` blocks. This is required by the Anthropic Messages API.

**Example:**
```python
# OpenAI format (multiple tool messages)
messages = [
    {"role": "tool", "tool_call_id": "call_1", "content": "Result 1"},
    {"role": "tool", "tool_call_id": "call_2", "content": "Result 2"}
]

# Converted to Anthropic format (grouped)
messages = [
    {
        "role": "user",
        "content": [
            {"type": "tool_result", "tool_use_id": "call_1", "content": "Result 1"},
            {"type": "tool_result", "tool_use_id": "call_2", "content": "Result 2"}
        ]
    }
]
```

### 2. System Message Concatenation

Multiple `system` role messages are concatenated with `\n\n` separator.

### 3. Reasoning Effort Approximation

The `reasoning_effort` parameter is mapped to approximate `thinking.budget_tokens` values. Actual token usage may vary.

### 4. Finish Reason Inference

When `tool_calls` are present in the response, `finish_reason` is always set to `"tool_calls"`, regardless of the underlying `stop_reason`.

---

## Integration Examples

### Continue.dev

Add to your Continue configuration (`~/.continue/config.json`):

```json
{
  "models": [{
    "title": "Gemini 3 Flash",
    "provider": "openai",
    "model": "gemini-3-flash",
    "apiBase": "http://localhost:8080/v1",
    "apiKey": "test"
  }]
}
```

### Cursor

In Cursor settings, configure a custom OpenAI endpoint:

- **Base URL:** `http://localhost:8080/v1`
- **API Key:** `test`
- **Model:** `gemini-3-flash` or `claude-sonnet-4-5-thinking`

### LangChain

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="http://localhost:8080/v1",
    api_key="test",
    model="gemini-3-flash"
)

response = llm.invoke("Explain recursion")
print(response.content)
```

---

## Troubleshooting

### "Field X is not supported"

Some OpenAI-specific fields (`logprobs`, `logit_bias`, `n`, `response_format`, `seed`) are not supported. These are silently ignored. If you require these features, use the official OpenAI API.

### Tool calls not working

Ensure your `tools` schema uses valid JSON Schema format. The proxy converts `function.parameters` to `input_schema` and applies sanitization.

### Streaming cuts off / no [DONE]

Make sure your client library waits for the `data: [DONE]` SSE marker. Some clients may timeout or close the connection prematurely.

### Reasoning content is empty

Not all models or responses include thinking blocks. For Claude models, use `-thinking` suffixed model IDs. For Gemini, all v3+ models support thinking.

### Rate limit errors

The proxy uses multi-account load balancing. If all accounts are exhausted, you'll receive a rate limit error. Add more accounts via `antigravity-claude-proxy accounts add` or wait for quota reset.

---

## Authentication

The OpenAI endpoints reuse the `/v1/*` authentication middleware:

- **No API Key:** Endpoints are open (localhost only recommended)
- **With API Key:** Set `API_KEY` environment variable. Clients must provide matching key in `Authorization: Bearer <key>` header or `x-api-key` header.

Example:

```bash
export API_KEY=my-secret-key
antigravity-claude-proxy start
```

```python
client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="my-secret-key"
)
```

---

## Performance Notes

- **Latency:** Adds ~10-50ms for format conversion (request + response)
- **Streaming:** Near-zero overhead (events converted in real-time)
- **Throughput:** Limited by upstream Google Cloud Code API and your account quotas
- **Caching:** Prompt caching works when using the sticky account selection strategy

---

## See Also

- [API Endpoints](./api-endpoints.md) - Full endpoint reference
- [Load Balancing](./load-balancing.md) - Multi-account configuration
- [Models](./models.md) - Available models and capabilities
- [Configuration](./configuration.md) - Advanced server settings
