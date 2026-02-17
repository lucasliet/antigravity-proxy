# ⚠️ DO NOT USE THIS ANYMORE – GOOGLE IS ISSUING TOS VIOLATION BANS FOR THE ACCOUNTS CONNECTED

# Antigravity Claude Proxy

[![npm version](https://img.shields.io/npm/v/antigravity-claude-proxy.svg)](https://www.npmjs.com/package/antigravity-claude-proxy)
[![npm downloads](https://img.shields.io/npm/dm/antigravity-claude-proxy.svg)](https://www.npmjs.com/package/antigravity-claude-proxy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A proxy server that exposes an **Anthropic-compatible API** backed by **Antigravity's Cloud Code**, letting you use Claude and Gemini models with **Claude Code CLI** and **OpenClaw / ClawdBot**.

![Antigravity Claude Proxy Banner](images/banner.png)

<details>
<summary><strong>⚠️ Terms of Service Warning — Read Before Installing</strong></summary>

> [!CAUTION]
> Using this proxy may violate Google's Terms of Service. A small number of users have reported their Google accounts being **banned** or **shadow-banned** (restricted access without explicit notification).
>
> **High-risk scenarios:**
> - 🚨 **Fresh Google accounts** have a very high chance of getting banned
> - 🚨 **New accounts with Pro/Ultra subscriptions** are frequently flagged and banned
>
> **By using this proxy, you acknowledge:**
> - This is an unofficial tool not endorsed by Google
> - Your account may be suspended or permanently banned
> - You assume all risks associated with using this proxy
>
> **Recommendation:** Use an established Google account that you don't rely on for critical services. Avoid creating new accounts specifically for this proxy.

</details>

---

## How It Works

```
┌──────────────────┐     ┌─────────────────────┐     ┌────────────────────────────┐
│   Claude Code    │────▶│  This Proxy Server  │────▶│  Antigravity Cloud Code    │
│   (Anthropic     │     │  (Anthropic → Google│     │  (daily-cloudcode-pa.      │
│    API format)   │     │   Generative AI)    │     │   sandbox.googleapis.com)  │
└──────────────────┘     └─────────────────────┘     └────────────────────────────┘
```

1. Receives requests in **Anthropic Messages API format**
2. Uses OAuth tokens from added Google accounts (or Antigravity's local database)
3. Transforms to **Google Generative AI format** with Cloud Code wrapping
4. Sends to Antigravity's Cloud Code API
5. Converts responses back to **Anthropic format** with full thinking/streaming support

## Prerequisites

- **Node.js** 18 or later
- **Antigravity** installed (for single-account mode) OR Google account(s) for multi-account mode

---

## Installation

### Option 1: npm (Recommended)

```bash
# Run directly with npx (no install needed)
npx antigravity-claude-proxy@latest start

# Or install globally
npm install -g antigravity-claude-proxy@latest
antigravity-claude-proxy start
```

### Option 2: Clone Repository

```bash
git clone https://github.com/badri-s2001/antigravity-claude-proxy.git
cd antigravity-claude-proxy
npm install
npm start
```

---

## Quick Start

### 1. Start the Proxy Server

```bash
# If installed via npm
antigravity-claude-proxy start

# If using npx
npx antigravity-claude-proxy@latest start

# If cloned locally
npm start
```

The server runs on `http://localhost:8080` by default.

### 2. Authentication

The proxy supports three authentication methods (in priority order):

#### **Method 1: Direct Refresh Token (Quick Start)**

For quick testing or personal use, you can provide your Antigravity refresh token directly without configuring accounts:

**Option A: Environment Variable**

```bash
export ANTIGRAVITY_REFRESH_TOKEN="your-refresh-token-here"
npm start
```

**Option B: Request Header**

When making API requests, include your refresh token in the header:

```bash
# Anthropic format (x-api-key header)
curl -X POST http://localhost:8080/v1/messages \
  -H "x-api-key: your-refresh-token-here" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-4-5-thinking", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 100}'

# OpenAI format (Authorization header)
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer your-refresh-token-here" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-4-5-thinking", "messages": [{"role": "user", "content": "Hello"}]}'
```

**How to get your refresh token:**
1. Install Antigravity app and log in with your Google account
2. Find your token in Antigravity's local database (usually at `~/.antigravity/db.sqlite`)
3. Use a SQLite browser to extract the `refresh_token` from the `auth` table

> **Note:** Direct token mode bypasses account pool management, quota tracking, and prompt caching. For production use, configure account pool instead (Method 2).

#### **Method 2: Account Pool (Production)**

For multiple accounts, load balancing, and advanced features, configure the account pool:

##### **Method 2A: Web Dashboard (Recommended)**

1. With the proxy running, open `http://localhost:8080` in your browser.
2. Navigate to the **Accounts** tab and click **Add Account**.
3. Complete the Google OAuth authorization in the popup window.

> **Headless/Remote Servers**: If running on a server without a browser, the WebUI supports a "Manual Authorization" mode. After clicking "Add Account", you can copy the OAuth URL, complete authorization on your local machine, and paste the authorization code back.

##### **Method 2B: CLI (Desktop or Headless)**

If you prefer the terminal or are on a remote server:

```bash
# Desktop (opens browser)
antigravity-claude-proxy accounts add

# Headless (Docker/SSH)
antigravity-claude-proxy accounts add --no-browser
```

> For full CLI account management options, run `antigravity-claude-proxy accounts --help`.

##### **Method 2C: Automatic (Antigravity App)**

If you have the **Antigravity** app installed and logged in, the proxy will automatically detect your local session. No additional setup is required.

To use a custom port:

```bash
PORT=3001 antigravity-claude-proxy start
```

### 3. Verify It's Working

```bash
# Health check
curl http://localhost:8080/health

# Check account status and quota limits
curl "http://localhost:8080/account-limits?format=table"
```

---

## Using with Claude Code CLI

### Configure Claude Code

You can configure these settings in two ways:

#### **Via Web Console (Recommended)**

1. Open the WebUI at `http://localhost:8080`.
2. Go to **Settings** → **Claude CLI**.
3. Use the **Connection Mode** toggle to switch between:
   - **Proxy Mode**: Uses the local proxy server (Antigravity Cloud Code). Configure models, base URL, and presets here.
   - **Paid Mode**: Uses the official Anthropic Credits directly (requires your own subscription). This hides proxy settings to prevent accidental misconfiguration.
4. Click **Apply to Claude CLI** to save your changes.

> [!TIP] > **Configuration Precedence**: System environment variables (set in shell profile like `.zshrc`) take precedence over the `settings.json` file. If you use the Web Console to manage settings, ensure you haven't manually exported conflicting variables in your terminal.

#### **Manual Configuration**

Create or edit the Claude Code settings file:

**macOS:** `~/.claude/settings.json`
**Linux:** `~/.claude/settings.json`
**Windows:** `%USERPROFILE%\.claude\settings.json`

Add this configuration:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "test",
    "ANTHROPIC_BASE_URL": "http://localhost:8080",
    "ANTHROPIC_MODEL": "claude-opus-4-6-thinking",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-6-thinking",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-5-thinking",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-sonnet-4-5",
    "CLAUDE_CODE_SUBAGENT_MODEL": "claude-sonnet-4-5-thinking",
    "ENABLE_EXPERIMENTAL_MCP_CLI": "true"
  }
}
```

Or to use Gemini models:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "test",
    "ANTHROPIC_BASE_URL": "http://localhost:8080",
    "ANTHROPIC_MODEL": "gemini-3-pro-high[1m]",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "gemini-3-pro-high[1m]",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "gemini-3-flash[1m]",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "gemini-3-flash[1m]",
    "CLAUDE_CODE_SUBAGENT_MODEL": "gemini-3-flash[1m]",
    "ENABLE_EXPERIMENTAL_MCP_CLI": "true"
  }
}
```

### Load Environment Variables

Add the proxy settings to your shell profile:

**macOS / Linux:**

```bash
echo 'export ANTHROPIC_BASE_URL="http://localhost:8080"' >> ~/.zshrc
echo 'export ANTHROPIC_AUTH_TOKEN="test"' >> ~/.zshrc
source ~/.zshrc
```

> For Bash users, replace `~/.zshrc` with `~/.bashrc`

**Windows (PowerShell):**

```powershell
Add-Content $PROFILE "`n`$env:ANTHROPIC_BASE_URL = 'http://localhost:8080'"
Add-Content $PROFILE "`$env:ANTHROPIC_AUTH_TOKEN = 'test'"
. $PROFILE
```

**Windows (Command Prompt):**

```cmd
setx ANTHROPIC_BASE_URL "http://localhost:8080"
setx ANTHROPIC_AUTH_TOKEN "test"
```

Restart your terminal for changes to take effect.

### Run Claude Code

```bash
# Make sure the proxy is running first
antigravity-claude-proxy start

# In another terminal, run Claude Code
claude
```

> **Note:** If Claude Code asks you to select a login method, add `"hasCompletedOnboarding": true` to `~/.claude.json` (macOS/Linux) or `%USERPROFILE%\.claude.json` (Windows), then restart your terminal and try again.

### Proxy Mode vs. Paid Mode

Toggle in **Settings** → **Claude CLI**:

| Feature | 🔌 Proxy Mode | 💳 Paid Mode |
| :--- | :--- | :--- |
| **Backend** | Local Server (Antigravity) | Official Anthropic Credits |
| **Cost** | Free (Google Cloud) | Paid (Anthropic Credits) |
| **Models** | Claude + Gemini | Claude Only |

**Paid Mode** automatically clears proxy settings so you can use your official Anthropic account directly.

### Multiple Claude Code Instances (Optional)

To run both the official Claude Code and Antigravity version simultaneously, add this alias:

**macOS / Linux:**

```bash
# Add to ~/.zshrc or ~/.bashrc
alias claude-antigravity='CLAUDE_CONFIG_DIR=~/.claude-account-antigravity ANTHROPIC_BASE_URL="http://localhost:8080" ANTHROPIC_AUTH_TOKEN="test" command claude'
```

**Windows (PowerShell):**

```powershell
# Add to $PROFILE
function claude-antigravity {
    $env:CLAUDE_CONFIG_DIR = "$env:USERPROFILE\.claude-account-antigravity"
    $env:ANTHROPIC_BASE_URL = "http://localhost:8080"
    $env:ANTHROPIC_AUTH_TOKEN = "test"
    claude
}
```

Then run `claude` for official API or `claude-antigravity` for this proxy.

### Running as a System Service (systemd)

When running as a systemd service, the proxy runs under a different user (e.g. `root`), so it can't find your Claude CLI settings at `~/.claude/settings.json`. Set `CLAUDE_CONFIG_PATH` to point to the real user's `.claude` directory:

```ini
# /etc/systemd/system/antigravity-proxy.service
[Service]
Environment=CLAUDE_CONFIG_PATH=/home/youruser/.claude
ExecStart=/usr/bin/node /path/to/antigravity-claude-proxy/src/index.js
```

Without this, the WebUI's Claude CLI tab won't be able to read or write your Claude Code configuration.

---

## Using with OpenAI-Compatible Clients

The proxy supports the **OpenAI Chat Completions API** format, allowing you to use any OpenAI-compatible client or SDK:

```python
# Python example with account pool
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="test"  # Proxy API key (if configured)
)

response = client.chat.completions.create(
    model="gemini-3-flash",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)
```

**Using with Direct Refresh Token:**

```python
# Python example with direct refresh token (no account pool needed)
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="your-antigravity-refresh-token"  # Your Antigravity refresh token
)

response = client.chat.completions.create(
    model="claude-sonnet-4-5-thinking",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)
```

**Supported:**
- ✅ Streaming (SSE with `data: [DONE]`)
- ✅ Tool calling (function calling)
- ✅ Reasoning content (`thinking` ↔ `reasoning_content`)
- ✅ Direct refresh token authentication (bypasses account pool)
- ✅ Continue.dev, Cursor, LangChain, and other OpenAI-compatible tools

See [OpenAI API Compatibility](docs/openai-compat.md) for detailed documentation.

---

## Documentation

- [**OpenAI API Compatibility**](docs/openai-compat.md) - Use with OpenAI clients
- [Available Models](docs/models.md)
- [Multi-Account Load Balancing](docs/load-balancing.md)
- [Web Management Console](docs/web-console.md)
- [Advanced Configuration](docs/configuration.md)
- [macOS Menu Bar App](docs/menubar-app.md)
- [OpenClaw / ClawdBot Integration](docs/openclaw.md)
- [API Endpoints](docs/api-endpoints.md)
- [Testing](docs/testing.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Safety, Usage, and Risk Notices](docs/safety-notices.md)
- [Legal](docs/legal.md)
- [Development](docs/development.md)

---

## Credits

This project is based on insights and code from:

- [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) - Antigravity OAuth plugin for OpenCode
- [claude-code-proxy](https://github.com/1rgs/claude-code-proxy) - Anthropic API proxy using LiteLLM

---

## License

MIT

---

<a href="https://buymeacoffee.com/badrinarayanans" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50"></a>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=badrisnarayanan/antigravity-claude-proxy&type=date&legend=top-left&cache-control=no-cache)](https://www.star-history.com/#badrisnarayanan/antigravity-claude-proxy&type=date&legend=top-left)
