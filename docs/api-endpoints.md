# API Endpoints

| Endpoint               | Method | Description                                                           |
| ---------------------- | ------ | --------------------------------------------------------------------- |
| `/health`              | GET    | Health check                                                          |
| `/account-limits`      | GET    | Account status and quota limits (add `?format=table` for ASCII table) |
| `/v1/messages`         | POST   | Anthropic Messages API                                                |
| `/v1/chat/completions` | POST   | OpenAI Chat Completions API (compatible)                              |
| `/v1/models`           | GET    | List available models                                                 |
| `/refresh-token`       | POST   | Force token refresh                                                   |

## OpenAI Compatibility

The proxy supports the **OpenAI Chat Completions API** format at `/v1/chat/completions`. This allows you to use any OpenAI-compatible client (openai-python, Continue.dev, Cursor, etc.) without modification.

See [OpenAI API Compatibility](./openai-compat.md) for detailed documentation and examples.
