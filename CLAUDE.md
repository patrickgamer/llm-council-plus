# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LLM Council Plus is a 3-stage deliberation system where multiple LLMs collaboratively answer user questions through:
1. **Stage 1**: Individual model responses (with optional web search context)
2. **Stage 2**: Anonymous peer review/ranking to prevent bias
3. **Stage 3**: Chairman synthesis of collective wisdom

**Key Innovation**: Hybrid architecture supporting OpenRouter (cloud), Ollama (local), and mixed councils.

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
- **Implementations**: `openrouter.py`, `ollama.py`, `groq.py`, `openai.py`, `anthropic.py`, `google.py`, `mistral.py`, `deepseek.py`
- **Auto-routing**: Model IDs with prefix (e.g., `openai:gpt-4.1`, `ollama:llama3`, `groq:llama3-70b-8192`) route to correct provider
- **Fallback**: Unprefixed IDs use `settings.llm_provider` (openrouter/ollama/groq/hybrid/direct)

**Core Modules**

`council.py` - Orchestration logic
- `stage1_collect_responses()`: Parallel queries with optional search context, **yields** incremental results for streaming
- `stage2_collect_rankings()`: Anonymizes responses as "Response A/B/C", prompts peer evaluation
- `stage3_synthesize_final()`: Chairman synthesizes final answer
- `calculate_aggregate_rankings()`: Computes average rank positions
- `generate_conversation_title()`: Auto-titles conversations from first message
- `generate_search_query()`: Extracts search terms from user query

`search.py` - Web search integration
- **Providers**: DuckDuckGo (free), Tavily (API), Brave (API)
- **Full Content Fetch**: Top N results fetched via Jina Reader (configurable, default 3)
- **Rate Limiting**: Auto-retry with exponential backoff for DuckDuckGo
- **Graceful Degradation**: Falls back to summaries if full fetch fails/times out

`settings.py` - Configuration management
- **Storage**: `data/settings.json` (persisted, not `.env` only)
- **LLM Modes**: `openrouter`, `ollama`, `groq`, `hybrid`, `direct`
- **Enabled Providers**: Toggle which sources are available (OpenRouter, Ollama, Groq, Direct Connections)
- **Customization**: System prompts for Stage 1/2/3, search query generation
- **Available Models**: Curated list in `AVAILABLE_MODELS` for UI dropdown

`prompts.py` - Default system prompts
- `STAGE1_PROMPT_DEFAULT`: Initial model query template
- `STAGE2_PROMPT_DEFAULT`: Peer ranking prompt with strict format enforcement
- `STAGE3_PROMPT_DEFAULT`: Chairman synthesis instructions
- `SEARCH_QUERY_PROMPT_DEFAULT`: Search term extraction template
- All customizable via Settings UI

`main.py` - FastAPI application
- **Standard Endpoint**: `POST /api/conversations/{id}/message` - batch processing
- **Streaming Endpoint**: `POST /api/conversations/{id}/message/stream` - SSE for real-time updates
- **Abort Support**: Checks `request.is_disconnected()` in loops to honor client disconnects
- **Metadata**: Returns `label_to_model` mapping and `aggregate_rankings` (ephemeral, not persisted)

`storage.py` - Conversation persistence
- **Format**: JSON files in `data/conversations/{id}.json`
- **Structure**: `{id, created_at, title, messages[]}`
- **Messages**: User messages have `{role, content}`, assistant messages have `{role, stage1, stage2, stage3}`
- **Note**: Metadata (label_to_model, rankings) NOT saved, only returned via API

### Frontend (`frontend/src/`)

**Key Components**

`App.jsx` - Main orchestration
- Manages conversation list and current conversation state
- Handles SSE streaming via `EventSource`
- Stores ephemeral metadata (label_to_model, rankings) in UI state
- **Important**: Uses immutable state updates to prevent duplicate tabs (React StrictMode issue)

`components/ChatInterface.jsx`
- Multiline textarea (3 rows, resizable)
- Enter = send, Shift+Enter = newline
- Web search toggle checkbox
- User messages wrapped in `.markdown-content` for padding

`components/Stage1.jsx`
- Tab view of individual model responses
- Real-time progress counter: "X/Y completed" during streaming
- ReactMarkdown rendering with `.markdown-content` wrapper

`components/Stage2.jsx`
- **Critical**: Shows RAW peer evaluation text (models receive anonymous labels)
- Client-side de-anonymization for display (model names in **bold**)
- "Extracted Ranking" section below each evaluation for validation
- Aggregate rankings with average position and vote count
- Explanatory text clarifies anonymization

`components/Stage3.jsx`
- Final synthesized answer from chairman
- Green-tinted background (`#f0fff0`) to highlight conclusion

`components/Settings.jsx`
- **Sidebar Navigation**: 4-section layout (Council Config, API Keys, System Prompts, General & Search)
- Configure API keys (OpenRouter, Groq, Ollama, Direct providers)
- **Available Model Sources**: Toggle which providers are enabled (OpenRouter, Ollama, Groq, Direct Connections)
- **Council Configuration**:
  - Per-member Remote/Local toggles for model selection
  - "I'm Feeling Lucky" button to randomize all models
  - Rate limit warnings for OpenRouter and Groq configurations
- Customizable system prompts with reset to defaults
- Full content fetch slider (0-10 results)
- Settings saved to `data/settings.json` via backend API
- Import/Export functionality for backing up and sharing settings

**Styling**
- Light mode theme (not dark mode)
- Primary color: `#4a90e2` (blue)
- Global markdown: `.markdown-content` class in `index.css` (12px padding)

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
python -m backend.main  # Correct
cd backend && python main.py  # WRONG - breaks imports
```

### Stage 2 Ranking Format
The Stage 2 prompt enforces strict format for reliable parsing:
```
1. Individual evaluations of each response
2. Blank line
3. "FINAL RANKING:" header (all caps, with colon)
4. Numbered list: "1. Response C", "2. Response A", etc.
5. No additional text after ranking
```

Fallback regex extracts any "Response X" patterns if format not followed.

### Streaming & Abort Logic
- Streaming uses **generator functions** that `yield` results incrementally
- Backend checks `request.is_disconnected()` inside loops to detect aborts
- Frontend sends abort by closing `EventSource` connection
- **Critical**: Always inject raw `Request` object into streaming endpoints (Pydantic models lack `is_disconnected()`)

### Markdown Rendering
**All** `<ReactMarkdown>` components must be wrapped:
```jsx
<div className="markdown-content">
  <ReactMarkdown>{content}</ReactMarkdown>
</div>
```
This class is defined in `index.css` and provides consistent spacing.

### Model ID Prefix Format
Models use prefix format to determine routing:
- `openrouter:anthropic/claude-sonnet-4` - Cloud model via OpenRouter
- `ollama:llama3.1:latest` - Local model via Ollama
- `groq:llama3-70b-8192` - Fast inference via Groq
- `openai:gpt-4.1`, `anthropic:claude-sonnet-4`, etc. - Direct provider connections
- Prefix determines routing in `council.py:get_provider_for_model()`

## Common Gotchas

1. **Port Conflicts**: Backend uses 8001 (not 8000). Update `backend/main.py` and `frontend/src/api.js` together if changing.

2. **CORS Errors**: Frontend origins must match `main.py` CORS middleware (currently localhost:5173 and :3000).

3. **Missing Metadata**: `label_to_model` and `aggregate_rankings` are ephemeral - only in API responses, not stored in JSON.

4. **Duplicate Tabs**: Use immutable state updates in React (spread operator), not direct mutations. StrictMode runs effects twice.

5. **Search Rate Limits**: DuckDuckGo news search can rate-limit. Retry logic in `search.py` handles this.

6. **Ranking Parse Failures**: If models ignore format, fallback regex extracts "Response X" patterns in order of appearance.

7. **React StrictMode**: Effects run twice in dev. Ensure idempotent operations and immutable state updates.

8. **Binary Dependencies**: `node_modules` in iCloud can break when switching Mac architectures. Delete and reinstall if needed.

## Recent Fixes & Improvements (Nov 2025)

### Settings UX: Hybrid Auto-Save Approach
**Implementation Date:** Nov 29, 2025

**Auto-saved credentials** (immediately on successful validation):
- All API keys: Tavily, Brave, OpenRouter, Direct providers (OpenAI, Anthropic, Google, Mistral, DeepSeek)
- Ollama Base URL

**Manual save required** (experimental configurations):
- Council member selections
- Chairman model
- Search provider choice
- System prompts
- Utility models

**UX Flow:**
```
Enter credential → Click "Test" → ✓ Success → Auto-save → Clear input → "Settings saved!" → Status: "✓ configured"
```

**Key Implementation Details:**
- `Settings.jsx`: All test handlers (`handleTestTavily`, `handleTestBrave`, etc.) auto-save on success
- State preservation during reload: `const currentProvider = selectedLlmProvider; await loadSettings(); setSelectedLlmProvider(currentProvider);`
- Prevents credential auto-save from overwriting user's current provider selection
- `hasChanges` effect excludes auto-saved fields to avoid false positives

**Files Modified:** `frontend/src/components/Settings.jsx`

### Bug Fixes

**Provider Selection Jump** (Nov 29, 2025)
- **Issue:** Selecting "Ollama" then testing connection jumped selection back to saved value ("Hybrid")
- **Root Cause:** Auto-save's `loadSettings()` overwrote local UI state with backend values
- **Fix:** Preserve `selectedLlmProvider` during credential reload
- **File:** `frontend/src/components/Settings.jsx` - all test handlers

**Ollama Status Indicator Conflict** (Nov 29, 2025)
- **Issue:** Failed connection test showed red error but green "Connected" status persisted
- **Root Cause:** Parent `ollamaStatus` only refreshed on success, not failure
- **Fix:** Call `onRefreshOllama()` on both success AND failure/exception
- **Files:** `frontend/src/components/Settings.jsx` (handleTestOllama), `frontend/src/App.jsx` (testOllamaConnection)

**titleModel Code Cleanup** (Nov 29, 2025)
- Removed all leftover `titleModel` state, effects, checks (backend no longer uses separate model for titles)
- Updated Utility Models description to only mention search query generation
- **File:** `frontend/src/components/Settings.jsx`

### Code Quality Improvements (Nov 28-29, 2025)
See `BUGS_AND_OPTIMIZATIONS.md` for comprehensive analysis report:
- ✅ 3/3 critical bugs fixed (broken endpoint, duplicate returns, error handling)
- ✅ 4/4 medium bugs fixed (AbortController race, search timeout, error standardization, logging)
- ✅ 3/5 optimizations (async search, connection pooling, logging infrastructure)
- **Net result:** -30 lines, cleaner codebase, 10 bugs fixed

## Data Flow

```
User Query (+ optional web search)
    ↓
[Generate search query via LLM] (if web search enabled)
    ↓
[Fetch search results + full content for top N]
    ↓
Stage 1: Parallel queries → [individual responses] → Stream to frontend
    ↓
Stage 2: Anonymize → Parallel peer rankings → [evaluations + parsed rankings] → Stream to frontend
    ↓
Calculate aggregate rankings → [sorted by avg position]
    ↓
Stage 3: Chairman synthesis with full context → Stream to frontend
    ↓
Save conversation (stage1, stage2, stage3 only - no metadata)
    ↓
Return: {stage1, stage2, stage3, metadata} to frontend
```

All stages run asynchronously/in parallel where possible to minimize latency.

## Testing & Debugging

**Test OpenRouter connectivity:**
```bash
uv run python backend/test_openrouter.py
```

**Test search providers:**
```bash
uv run python backend/test_search.py
uv run python backend/debug_search.py
```

**Check Ollama models:**
```bash
curl http://localhost:11434/api/tags
```

**View backend logs:** Watch terminal running `backend/main.py` for detailed error messages and timing info.

## Web Search Features

**Providers:**
- **DuckDuckGo**: Free, uses news search for better results
- **Tavily**: Requires `TAVILY_API_KEY`, optimized for LLM/RAG
- **Brave**: Requires `BRAVE_API_KEY`, high-quality web results

**Full Content Fetching:**
- Uses Jina Reader (`https://r.jina.ai/{url}`) to extract article text
- Configurable: top 0-10 results (default 3)
- Fallback to summary if fetch fails or yields <500 chars
- Timeout: 25 seconds per article
- Content truncated to 2000 chars per result in LLM context

**Search Query Generation:**
- LLM (default: `gemini-2.5-flash`) extracts 3-6 key terms from user query
- Removes question words, focuses on entities and topics
- Customizable via `search_query_prompt` in Settings

## Settings & Configuration

**UI-Configurable:**
- API keys (OpenRouter, Groq, Tavily, Brave, Anthropic, OpenAI, Google, Mistral, DeepSeek)
- Available Model Sources (OpenRouter, Ollama, Groq, Direct Connections)
- Council models (multiple selection with Remote/Local toggles per member)
- Chairman model (single selection with Remote/Local toggle)
- Search query generator model (with Remote/Local toggle)
- Search provider (duckduckgo/tavily/brave)
- Full content results (0-5)
- System prompts (Stage 1/2/3, search query)
- "I'm Feeling Lucky" - Randomize all models

**Storage Location:** `data/settings.json`

**Reset to Defaults:** Settings UI has "Reset to Default" button for each prompt.

## Design Principles

### Error Handling Philosophy
- **Graceful Degradation**: Continue with successful responses if some models fail
- **Never Fail Entirely**: Single model failure doesn't block entire council
- **Log but Hide**: Errors logged to backend, not exposed to user unless all models fail
- **Fallbacks**: Search failures return system note, full fetch falls back to summary

### UI/UX Transparency
- All raw outputs inspectable via tabs (Stage 1 and Stage 2)
- Parsed rankings shown below raw text for validation
- Users can verify system's interpretation (builds trust, aids debugging)
- Progress indicators during streaming (X/Y completed)

### De-anonymization Strategy
- Models receive: "Response A", "Response B", etc. (no identifying info)
- Backend creates mapping: `{"Response A": "openai/gpt-4.1", ...}`
- Frontend displays model names in **bold** for readability
- Explanatory text clarifies original evaluation used anonymous labels
- Prevents bias while maintaining transparency

## Recent Work & Known Issues

**Recent Fixes (Nov 28-29, 2025):**

### Nov 28
- Stage 1 progress counter with real-time "X/Y completed" display
- Abort functionality via "Stop" button (backend checks `request.is_disconnected()`)
- Title generation now works even if query is aborted early
- Fixed `UnboundLocalError`, `AttributeError`, and `NameError` in `backend/main.py`
- Fixed duplicate tabs in Stage 1/2 via immutable state updates in `App.jsx`
- Settings import/export functionality implemented and working

### Nov 29 - Comprehensive Code Analysis
✅ **ALL CRITICAL BUGS FIXED (3/3):**
- Removed broken non-streaming endpoint and `run_full_council()` function (~60 lines dead code)
- Fixed duplicate return statement in title generation
- Added error handling for None/invalid inputs in title generation
- Fixed "Consulting the council..." not disappearing after Stage 3 completes

✅ **ALL MEDIUM-PRIORITY BUGS FIXED (4/4):**
- Fixed AbortController race condition (rapid Send→Stop→Send clicks)
- Added 60-second timeout budget for search operations
- Standardized error handling across all stages with consistent format
- Replaced all `print()` with proper `logging` module

✅ **PERFORMANCE OPTIMIZATIONS (3/5 completed):**
- Made search operations fully async (Tavily, Brave) - removed thread overhead
- Added HTTP connection pooling - persistent clients reuse connections
- Improved logging infrastructure throughout backend

**Code Impact:**
- Removed: ~110 lines (dead code, duplicates)
- Added: ~80 lines (error handling, pooling, logging)
- Net: -30 lines (cleaner codebase)
- 10 bugs fixed, 3 optimizations implemented

### Nov 29 - Settings UI Refactor & Streaming Safety
**Major Settings UX Overhaul:**
- Removed provider selector entirely
- Changed "Hybrid" section to unified "Council Configuration"
- Added toggles for which model sources are available (OpenRouter, Ollama, Direct Connections)
- Per-member Remote/Local toggle for each council member
- Unified council configuration works across all providers
- Updated descriptions to clarify settings apply to search generator, council members, and chairman
- Added helper text explaining 8 member limit and batching behavior

**White Screen Crash Fixes (4 iterations):**
1. **Model ID Format Handling:**
   - Added `getShortModelName()` helper to Stage1, Stage2, Stage3
   - Handles both `/` delimiter (e.g., `openai/gpt-4`) and `:` delimiter (e.g., `ollama:llama3`, `anthropic:claude-sonnet-4`)
   - Returns 'Unknown' for null/undefined model IDs

2. **Backend Error Handling:**
   - Filter out None responses in Stage 3 synthesis (failed models don't crash synthesis)
   - Added null checks for prompt templates with fallback to defaults
   - Enhanced exception handling to catch AttributeError and TypeError

3. **Streaming Bounds Safety:**
   - Added useEffect in Stage1/Stage2 to auto-adjust activeTab when out of bounds
   - Added safeActiveTab calculation: `Math.min(activeTab, responses.length - 1)`
   - Prevents crashes when user clicks tabs during streaming

4. **ReactMarkdown Type Safety:**
   - Added type checking before passing data to ReactMarkdown
   - Ensures component always receives strings, not objects
   - Pattern: `typeof value === 'string' ? value : String(value || 'fallback')`

**Files Modified:**
- `frontend/src/components/Settings.jsx` - Unified council config, per-member toggles
- `frontend/src/components/Stage1.jsx` - Model name parsing, bounds checking, type safety
- `frontend/src/components/Stage2.jsx` - Model name parsing, bounds checking, type safety
- `frontend/src/components/Stage3.jsx` - Model name parsing, type safety
- `backend/council.py` - Null filtering, prompt template validation

5. **API Response Type Safety:**
   - Some providers (Mistral) occasionally return `content` as arrays/objects instead of strings
   - Added `isinstance()` checks in Stage 1 and Stage 2 processing
   - Convert non-string content to strings before processing
   - Added defensive programming in `parse_ranking_from_text()` function
   - Prevents "expected string or bytes-like object" errors and `[object Object]` display

6. **Model Deduplication:**
   - When multiple sources provide same model (e.g., OpenRouter + Direct Mistral), duplicates appeared
   - Added Map-based deduplication in `getAllAvailableModels()`
   - Prefers direct connections over OpenRouter for same model ID
   - Eliminates React "duplicate key" warnings

7. **Settings UI Sidebar Refactor (Nov 29, 2025 Evening - Gemini):**
   - Replaced single-page scrolling layout with **sidebar navigation**
   - 4 sections: Council Config, API Keys, System Prompts, General & Search
   - Left sidebar (220px) with active state highlighting, main panel scrolls independently
   - Eliminates excessive scrolling, improves organization

8. **Groq Provider Integration (Nov 29, 2025 Evening - Gemini):**
   - Added `backend/providers/groq.py` with OpenAI-compatible API
   - Models prefixed with `groq:` (e.g., `groq:llama3-70b-8192`)
   - Toggle in Available Model Sources section
   - Rate limits: 30 requests/minute, 14,400 requests/day (Llama models)
   - API key validation and test functionality

9. **"I'm Feeling Lucky" Feature (Nov 29, 2025 Evening - Gemini):**
   - Purple gradient button (🎲) to randomize all models
   - Randomizes council members, chairman, and search query generator
   - Respects "Show free only" filter
   - Tries to select unique models for council (refills pool when exhausted)
   - Auto-sets Remote/Local filters based on selected models

10. **Rate Limit Warning System (Nov 29, 2025 Evening - Gemini):**
    - Smart warnings based on council configuration
    - Calculates total requests per run: `(council_members × 2) + 2`
    - OpenRouter warnings: 🛑 Error for >10 requests/run with 3+ free models (20 RPM limit), ⚠️ Warning for all free models (50 RPD limit)
    - Groq warnings: ⚠️ Caution for >20 requests/run (30 RPM limit)
    - Visual banners with icons and actionable messages

**Pending Work:**
- Optional optimizations: Settings state simplification, request caching
- Testing: Verify Groq integration, sidebar navigation, "I'm Feeling Lucky" feature

### Dec 1 - UI/UX Polish & Layout Fixes
**Major UI refinements after Gemini's Midnight Glass Phase 1-3 implementation (28 commits):**

**Welcome Page Fixes:**
- Fixed `.empty-state` centering (absolute positioning with `transform: translate(-50%, -50%)`)
- Added FOUC prevention using `will-change: transform` (eliminates page load flash)
- Added `.app-footer` at bottom (40px) for version/creator info
- Proper vertical spacing and alignment

**Sidebar Restoration:**
- Restored missing "+ New Council" button with blue gradient styling
- Fixed glassmorphic conversation cards (rgba backgrounds + `backdrop-filter: blur(8px)`)
- Added gradient to "Plus" in title (`linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)`)
- Added inline delete confirmation (✓/✕ buttons) replacing browser popup
- Improved UX: no scrolling needed for multiple deletions

**Layout Overflow Fixes:**
- Removed `width: 100%` from `.chat-interface` and `.messages-area` (conflicted with `flex: 1`)
- Fixed sidebar being cut off when starting new conversations
- Proper flexbox hierarchy preventing horizontal scroll

**Font Consistency:**
- Standardized all stage content to Merriweather 15px/1.7 line-height
- Standardized all error messages to JetBrains Mono
- Consistent typography across Stage 1, Stage 2, and Stage 3

**Chat Window Enhancements:**
- Added `.hero-footer` positioned at 350px (high enough to clear floating input area)
- Increased input container opacity to 0.95 for better visibility
- Stronger border (2px solid rgba(59, 130, 246, 0.5)) for floating input
- Fully opaque background (rgba(30, 41, 59, 1)) when input focused

**Stage 2 Improvements:**
- Added trophy emoji (🏆) to aggregate rankings header
- Made rank scores white and bold (`color: #ffffff; font-weight: 600;`)
- Enhanced visibility of leaderboard

**Files Modified:**
- `frontend/src/components/ChatInterface.css` - Welcome page, footer positioning, input visibility
- `frontend/src/components/ChatInterface.jsx` - Removed fadeIn animations
- `frontend/src/components/Sidebar.css` - New council button, cards, inline confirmation, gradient title
- `frontend/src/components/Sidebar.jsx` - Inline delete confirmation state management
- `frontend/src/components/Stage1.css` - Font standardization
- `frontend/src/components/Stage2.css` - Trophy emoji, score visibility, font consistency
- `frontend/src/components/Stage2.jsx` - Header emoji
- `frontend/src/App.jsx` - Removed window.confirm (inline confirmation handles it)

**Communication Lesson:**
Multiple iterations on footer positioning due to confusion between "Welcome Page" (no conversation) vs "Chat Window" (active conversation). Different positioning requirements because Chat Window has floating input blocking lower region. Final solution: `app-footer` at 40px, `hero-footer` at 350px.

**Result:** 28 commits, polished UI with proper centering, no layout shifts, consistent typography, and improved UX for common actions.

## AI Coding Best Practices (Lessons Learned)

**CRITICAL - Communication & Requirements:**
- **NEVER make assumptions** when user provides vague requests or requests with gaps
- **ALWAYS ask for clarification** when requirements are unclear or ambiguous
- **Provide multiple options** with pros/cons when there are different valid approaches
- **Confirm understanding** before implementing significant changes
- **Think about edge cases** and ask about desired behavior
- **Goal**: Achieve optimal results to delight the user, not just complete the task

**CRITICAL - For AI Code Editors:**
- **NEVER use placeholders** like `// ...` or `/* rest of code */` in file edits - this will delete actual code
- **Always provide full content** when writing or editing files
- **FastAPI `Request` injection**: Always inject raw `Request` object (not Pydantic models) to access `is_disconnected()`
- **React Strict Mode**: Effects run twice in dev mode - ensure idempotent operations and immutable state updates
- **State mutations**: Use spread operators (`...`) not direct mutations to prevent duplicate renders

## Future Enhancement Areas

**Not Yet Implemented:**
- Model performance analytics over time
- Export conversations to markdown/PDF
- Custom ranking criteria (beyond accuracy/insight)
- Special handling for reasoning models (o1, etc.)
- Backend caching for repeated queries
- Conversation import/export (settings import/export is complete)
