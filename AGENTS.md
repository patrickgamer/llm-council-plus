# AGENTS.md

This file provides guidance to AI agents (Codex, etc.) when working with code in this repository.

## Project Overview

LLM Council Plus is a 3-stage deliberation system where multiple LLMs collaboratively answer user questions through:
1. **Stage 1**: Individual model responses (with optional web search context)
2. **Stage 2**: Anonymous peer review/ranking to prevent bias
3. **Stage 3**: Chairman synthesis of collective wisdom

**Key Innovation**: Hybrid architecture supporting OpenRouter (cloud), Ollama (local), Groq (fast inference), direct provider connections, and custom OpenAI-compatible endpoints.

# Project Context

## Branching Strategy
- `main` branch is the key link for pulling from and making PRs for `jacob-bd/llm-council-plus:main`
- PRs back to upstream should come from feature branches off `main`
- `prod` branch contains production-quality custom modifications not intended for upstream
- fixes and features intended for upstream should always be cut from 'main' and have full regresion & integreation testing with both `main` and `prod`
- fixes and features not intended for upstream should always be cut from `prod` and only require regression & integration testing with `prod`
- fix and feature branches should be deleted after PRs are merged into `main` or `prod`
    - when a fix/feature branch is deleted, close the related issue

## Conventions
- Issues are tracked in this fork's issue tracker (not upstream)
- Commit messages follow conventional commits format
- `CLAUDE.md` and `AGENTS.md` should always have the exact same content. changes to one should *always* trigger updates to the other



## Running the Application

**Quick Start:**
```bash
./start.sh
```

**Manual Start:**
```bash
# Backend (from project root)
uv run python -m backend.main

# Frontend (in new terminal)
cd frontend
npm run dev
```

**Ports:**
- Backend: `http://localhost:8001` (NOT 8000 - avoid conflicts)
- Frontend: `http://localhost:5173`

**Network Access:**
```bash
# Backend already listens on 0.0.0.0:8001
# Frontend with network access:
cd frontend && npm run dev -- --host
```

**Installing Dependencies:**
```bash
# Backend
uv sync

# Frontend
cd frontend
npm install
```

**Important**: If switching between Intel/Apple Silicon Macs with iCloud sync:
```bash
rm -rf frontend/node_modules && cd frontend && npm install
```
This fixes binary incompatibilities (e.g., `@rollup/rollup-darwin-*` variants).

## Architecture Overview

### Backend (`backend/`)

**Provider System** (`backend/providers/`)
- **Base**: `base.py` - Abstract interface for all LLM providers
- **Implementations**: `openrouter.py`, `ollama.py`, `groq.py`, `openai.py`, `anthropic.py`, `google.py`, `mistral.py`, `deepseek.py`, `custom_openai.py`
- **Auto-routing**: Model IDs with prefix (e.g., `openai:gpt-4.1`, `ollama:llama3`, `custom:model-name`) route to correct provider
- **Routing logic**: `council.py:get_provider_for_model()` handles prefix parsing

**Core Modules**

| Module | Purpose |
|--------|---------|
| `council.py` | Orchestration: stage1/2/3 collection, rankings, title generation |
| `search.py` | Web search: DuckDuckGo, Tavily, Brave with Jina Reader content fetch |
| `settings.py` | Config management, persisted to `data/settings.json` |
| `prompts.py` | Default system prompts for all stages |
| `main.py` | FastAPI app with streaming SSE endpoint |
| `storage.py` | Conversation persistence in `data/conversations/{id}.json` |

### Frontend (`frontend/src/`)

| Component | Purpose |
|-----------|---------|
| `App.jsx` | Main orchestration, SSE streaming, conversation state |
| `ChatInterface.jsx` | User input, web search toggle, execution mode |
| `Stage1.jsx` | Tab view of individual model responses |
| `Stage2.jsx` | Peer rankings with de-anonymization, aggregate scores |
| `Stage3.jsx` | Chairman synthesis (final answer) |
| `CouncilGrid.jsx` | Visual grid of council members with provider icons |
| `Settings.jsx` | 5-section settings: LLM API Keys, Council Config, System Prompts, Search Providers, Backup & Reset |
| `Sidebar.jsx` | Conversation list with inline delete confirmation |
| `SearchableModelSelect.jsx` | Searchable dropdown for model selection |

**Styling**: "Council Chamber" dark theme (refined Midnight Glass). CSS variables in `index.css` (`--font-display`: Syne, `--font-ui`: Plus Jakarta Sans, `--font-content`: Source Serif 4, `--font-code`: JetBrains Mono). Primary accent blue (#3b82f6), chairman gold (#fbbf24). Staggered hero/card animations; glass panels with backdrop-filter.

### Electron (`electron/`)

Desktop application shell using Electron with electron-builder for macOS packaging.

| File | Purpose |
|------|---------|
| `main.js` | Main process: creates BrowserWindow, loads frontend (dev server or built files) |
| `preload.js` | Preload script: contextBridge skeleton for secure renderer ↔ main IPC |

**App Identity**: "LLM Council+" — bundle ID `com.llmcouncil.plus`, macOS universal binary (Intel + Apple Silicon).

**Running Electron:**
```bash
# Development (requires backend + frontend already running)
npm run electron:dev

# Build macOS .app bundle (requires frontend built first)
cd frontend && npm run build && cd .. && npm run electron:build
```

**Key Configuration:**
- `titleBarStyle: 'hiddenInset'` with `trafficLightPosition: { x: 16, y: 16 }`
- `backgroundColor: '#0a0a14'` prevents white flash on load
- `show: false` + `ready-to-show` pattern for clean startup
- Security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`
- Window: 1400x900 default, 900x600 minimum

## Critical Implementation Details

### Python Module Imports
**ALWAYS** use relative imports in backend modules:
```python
from .config import ...
from .council import ...
```
**NEVER** use absolute imports like `from backend.config import ...`

**Run backend as module** from project root:
```bash
uv run python -m backend.main  # Correct
cd backend && python main.py  # WRONG - breaks imports
```

### Model ID Prefix Format
```
openrouter:anthropic/claude-sonnet-4  → Cloud via OpenRouter
ollama:llama3.1:latest                → Local via Ollama
groq:llama3-70b-8192                  → Fast inference via Groq
openai:gpt-4.1                        → Direct OpenAI connection
anthropic:claude-sonnet-4             → Direct Anthropic connection
custom:model-name                     → Custom OpenAI-compatible endpoint
```

### Model Name Display Helper
Use this pattern in Stage components to handle both `/` and `:` delimiters:
```jsx
const getShortModelName = (modelId) => {
  if (!modelId) return 'Unknown';
  if (modelId.includes('/')) return modelId.split('/').pop();
  if (modelId.includes(':')) return modelId.split(':').pop();
  return modelId;
};
```

### Provider Icon Detection (CouncilGrid.jsx)
Check prefixes FIRST before name-based detection to avoid mismatches:
```jsx
const getProviderInfo = (modelId) => {
    const id = modelId.toLowerCase();
    // Check prefixes FIRST (order matters!)
    if (id.startsWith('custom:')) return PROVIDER_CONFIG.custom;
    if (id.startsWith('ollama:')) return PROVIDER_CONFIG.ollama;
    if (id.startsWith('groq:')) return PROVIDER_CONFIG.groq;
    // Then check name-based patterns...
};
```

### Stage 2 Ranking Format
The prompt enforces strict format for parsing:
```
1. Individual evaluations
2. Blank line
3. "FINAL RANKING:" header (all caps, with colon)
4. Numbered list: "1. Response C", "2. Response A", etc.
```
Fallback regex extracts "Response X" patterns if format not followed.

### Streaming & Abort Logic
- Backend checks `request.is_disconnected()` inside loops
- Frontend aborts via AbortController signal
- **Critical**: Always inject raw `Request` object into streaming endpoints (Pydantic models lack `is_disconnected()`)

### ReactMarkdown Safety
```jsx
<div className="markdown-content">
  <ReactMarkdown>
    {typeof content === 'string' ? content : String(content || '')}
  </ReactMarkdown>
</div>
```
Always wrap in `.markdown-content` div and ensure string type (some providers return arrays/objects).

### Tab Bounds Safety
In Stage1/Stage2, auto-adjust activeTab when out of bounds during streaming:
```jsx
useEffect(() => {
  if (activeTab >= responses.length && responses.length > 0) {
    setActiveTab(responses.length - 1);
  }
}, [responses.length]);
```

## Common Gotchas

1. **Port Conflicts**: Backend uses 8001 (not 8000). Update `backend/main.py` and `frontend/src/api.js` together.

2. **CORS Errors**: Frontend origins must match `main.py` CORS middleware (localhost:5173 and :3000).

3. **Missing Metadata**: `label_to_model` and `aggregate_rankings` are ephemeral - only in API responses, not stored.

4. **Duplicate Tabs**: Use immutable state updates (spread operator), not mutations. StrictMode runs effects twice.

5. **Search Rate Limits**: DuckDuckGo can rate-limit. Retry logic in `search.py` handles this.

6. **Jina Reader 451 Errors**: Many news sites block AI scrapers. Use Tavily/Brave or set `full_content_results` to 0.

7. **Model Deduplication**: When multiple sources provide same model, use Map-based deduplication preferring direct connections.

8. **Binary Dependencies**: `node_modules` in iCloud can break between Mac architectures. Delete and reinstall.

9. **Custom Endpoint Icons**: Models from custom endpoints may match name patterns (e.g., "claude"). Check `custom:` prefix first.

## Data Flow

```
User Query (+ optional web search)
    ↓
[Web Search: DuckDuckGo/Tavily/Brave + Jina Reader]
    ↓
Stage 1: Parallel queries → Stream individual responses
    ↓
Stage 2: Anonymize → Parallel peer rankings → Parse rankings
    ↓
Calculate aggregate rankings
    ↓
Stage 3: Chairman synthesis → Stream final answer
    ↓
Save conversation (stage1, stage2, stage3 only)
```

## Execution Modes

Three modes control deliberation depth:
- **Chat Only**: Stage 1 only (quick responses)
- **Chat + Ranking**: Stages 1 & 2 (peer review without synthesis)
- **Full Deliberation**: All 3 stages (default)

## Testing & Debugging

```bash
# Check Ollama models
curl http://localhost:11434/api/tags

# Test custom endpoint
curl https://your-endpoint.com/v1/models -H "Authorization: Bearer $API_KEY"

# View logs
# Watch terminal running backend/main.py
```

## Web Search

**Providers**: DuckDuckGo (free), Tavily (API), Brave (API)

**Full Content Fetching**: Jina Reader (`https://r.jina.ai/{url}`) extracts article text for top N results (configurable 0-10, default 3). Falls back to summary if fetch fails or yields <500 chars. 25-second timeout per article, 60-second total search budget.

**Search Query Processing**:
- **Direct** (default): Send exact query to search engine
- **YAKE**: Extract keywords first (useful for long prompts)

## Settings

**UI Sections** (sidebar navigation):
1. **LLM API Keys**: OpenRouter, Groq, Ollama, Direct providers, Custom endpoint
2. **Council Config**: Model selection with Remote/Local toggles, temperature controls, "I'm Feeling Lucky" randomizer
3. **System Prompts**: Stage 1/2/3 prompts with reset-to-default
4. **Search Providers**: DuckDuckGo, Tavily, Brave + Jina full content settings
5. **Backup & Reset**: Import/Export config, reset to defaults

**Auto-Save Behavior**:
- **Credentials auto-save**: API keys and URLs save immediately on successful test
- **Configs require manual save**: Model selections, prompts, temperatures
- UX flow: Test → Success → Auto-save → Clear input → "Settings saved!"

**Storage**: `data/settings.json`

## Design Principles

- **Graceful Degradation**: Single model failure doesn't block entire council
- **Transparency**: All raw outputs inspectable via tabs
- **De-anonymization**: Models receive "Response A/B/C", frontend displays real names
- **Progress Indicators**: "X/Y completed" during streaming
- **Provider Flexibility**: Mix cloud, local, and custom endpoints freely

## Code Safety Guidelines

**Communication:**
- NEVER make assumptions when requirements are vague - ask for clarification
- Provide options with pros/cons for different approaches
- Confirm understanding before significant changes

**Code Safety:**
- NEVER use placeholders like `// ...` in edits - this deletes code
- Always provide full content when writing/editing files
- FastAPI: Inject raw `Request` object to access `is_disconnected()`
- React: Use spread operators for immutable state updates (StrictMode runs effects twice)
