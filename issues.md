# LLM Council+ Electron Packaging - GitHub Issues

## Issue #1: Initialize Electron Project Scaffolding
**Labels:** `setup`, `electron`, `foundation`
**Depends on:** None

### Description
Set up the Electron project structure within the existing repository. This is the foundational issue that all other work builds upon. The goal is to create the Electron main process entry point, configure electron-builder (or electron-forge) for macOS builds, and establish the project layout so that subsequent issues can be developed and tested incrementally.

**Key decisions to encode:**
- Use `electron-builder` for packaging (more mature DMG creation, better universal binary support, simpler extra resource bundling, and built-in code signing/notarization compared to electron-forge).
- Electron source lives in a top-level `electron/` directory (separate from `frontend/` and `backend/`).
- The app name is "LLM Council+" with bundle ID `com.llmcouncil.plus`.
- Target macOS universal binary (both Intel and Apple Silicon).

**Proposed directory structure:**
```
electron/
  main.js            # Electron main process
  preload.js         # Secure preload script (contextBridge)
assets/
  icon.icns          # macOS app icon
  icon.iconset/      # Source PNGs for icon generation
  dmg-background.png # DMG installer background
build/
  entitlements.mac.plist  # macOS code signing entitlements
scripts/
  notarize.js        # Code signing/notarization afterSign hook
  build-backend.sh   # PyInstaller build script
package.json         # Root package.json with electron + electron-builder config
```

**BrowserWindow configuration (macOS-specific):**
- Use `titleBarStyle: 'hiddenInset'` with `trafficLightPosition: { x: 16, y: 16 }` for native macOS feel with integrated traffic light buttons
- Set `backgroundColor: '#0a0a14'` to match the app's dark theme (`--bg-primary`) and prevent white flash
- Use `show: false` and `ready-to-show` event to prevent white flash during content load
- Minimum window size: 900x600; default: 1400x900

### Acceptance Criteria
- [ ] `electron/main.js` exists with a BrowserWindow using `titleBarStyle: 'hiddenInset'` and dark background color
- [ ] `electron/preload.js` exists with `contextBridge` skeleton (no IPC channels yet)
- [ ] Root `package.json` created with `electron`, `electron-builder` as dev dependencies
- [ ] `npm run electron:dev` script starts Electron in development mode (loads frontend dev server at `http://localhost:5173`)
- [ ] `npm run electron:build` script produces a runnable `.app` bundle (no backend yet, just the shell)
- [ ] `.gitignore` updated to exclude `dist/`, `build/`, and Electron output directories
- [ ] BrowserWindow configured with security defaults: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`
- [ ] Window uses `show: false` + `ready-to-show` pattern to prevent white flash on startup

---

## Issue #2: Configure App Icon (Menu Bar Icon Deferred)
**Labels:** `design`, `electron`, `macos`
**Depends on:** #1

### Description
Create and integrate the application icon for the macOS Electron app. The app icon appears in the Dock, Finder, Cmd+Tab switcher, and the "About" dialog.

**Note:** A menu bar (tray) icon is intentionally deferred to a future version. The electron architecture review concluded that a tray icon adds complexity without clear benefit for a deliberation tool that users interact with directly via its main window. A tray icon could be revisited later if a "quick ask" feature is desired.

**App icon requirements:**
- Must be an `.icns` file containing all required sizes: 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024 (both @1x and @2x variants)
- Can be generated from the existing `header.png` or a new design reflecting the "Council Chamber" dark theme with blue (#3b82f6) and gold (#fbbf24) accents
- Use `iconutil -c icns icon.iconset -o icon.icns` to convert from `.iconset` folder to `.icns`

### Acceptance Criteria
- [ ] `assets/icon.icns` exists with all required sizes (16x16 through 1024x1024, @1x and @2x)
- [ ] `assets/icon.iconset/` folder contains source PNGs for regeneration
- [ ] App icon appears correctly in Dock and Cmd+Tab switcher when running in dev mode
- [ ] electron-builder config references the icon for the built `.app` and DMG
- [ ] Icon design is consistent with the app's dark theme branding

---

## Issue #3: Relocate Data Paths to User Data Directory
**Labels:** `backend`, `data`, `security`, `breaking-change`
**Depends on:** #1

### Description
Currently, the backend uses two inconsistent path strategies that will both fail in a packaged Electron app:

1. **`backend/config.py:12`**: `DATA_DIR = "data/conversations"` -- a bare relative path that resolves from the current working directory. In a packaged `.app`, the CWD is unpredictable, so conversations would be written to arbitrary locations or fail entirely.

2. **`backend/settings.py:11`**: `SETTINGS_FILE = Path(__file__).parent.parent / "data" / "settings.json"` -- resolves relative to the Python source file. In a signed `.app` bundle, the source directory is read-only, so writing settings would raise a `PermissionError`.

Both paths must be changed to use an absolute, configurable base directory. In Electron, this will be `app.getPath('userData')` which maps to `~/Library/Application Support/LLM Council Plus/` on macOS. The Electron main process will pass this path to the backend at startup via the `LLM_COUNCIL_DATA_DIR` environment variable.

**Key design decision:** Both `settings.py` and `config.py` currently define their data paths independently using different relative bases. They must be unified under a single `LLM_COUNCIL_DATA_DIR` env var that points to the base `data/` directory. The directory structure under this base would be:

```
$LLM_COUNCIL_DATA_DIR/
  settings.json
  conversations/
    {uuid}.json
    conversations_index.json
```

**Proposed backend changes (minimal, backward-compatible):**

In `backend/config.py`:
```python
DATA_DIR = os.environ.get("LLM_COUNCIL_DATA_DIR",
    str(Path(__file__).parent.parent / "data" / "conversations"))
# If LLM_COUNCIL_DATA_DIR is set, append /conversations
```

In `backend/settings.py`:
```python
_data_base = os.environ.get("LLM_COUNCIL_DATA_DIR",
    str(Path(__file__).parent.parent / "data"))
SETTINGS_FILE = Path(_data_base) / "settings.json"
```

This also directly supports the clean uninstall requirement: all user data lives in one known location.

**Security note (from audit):** Storing data inside the `.app` bundle is not allowed for code-signed macOS apps. The `userData` directory is the correct macOS-sanctioned location.

### Acceptance Criteria
- [ ] `backend/config.py` accepts a `DATA_DIR` override via environment variable (e.g., `LLM_COUNCIL_DATA_DIR`)
- [ ] `backend/settings.py` accepts a `SETTINGS_FILE` override via environment variable (e.g., `LLM_COUNCIL_SETTINGS_FILE`)
- [ ] When no override is provided, both fall back to current behavior (backward compatible for non-Electron usage)
- [ ] Both paths are resolved to absolute paths at startup and logged
- [ ] `data/` subdirectories are created automatically if they do not exist
- [ ] Existing conversations and settings can be migrated to the new location (migration utility or documented manual steps)
- [ ] The `load_dotenv()` call in `config.py:6` is made resilient to missing `.env` files in packaged contexts

---

## Issue #4: Network Security Hardening for Desktop App
**Labels:** `security`, `backend`, `critical`
**Depends on:** #1

### Description
The current backend has several network security issues that are acceptable for a local development tool but unacceptable for a packaged desktop application:

**4a. Backend binds to `0.0.0.0` (CRITICAL)**
`backend/main.py:985` binds to all network interfaces, exposing the entire API (conversations, settings, API keys) to any device on the local network. Must change to `127.0.0.1`.

**4b. No API authentication (HIGH)**
Any local process can access all endpoints. A malicious app running on the same machine could exfiltrate API keys or conversation history. Implement a shared-secret token system: Electron generates a random token at startup, passes it to the backend, and the frontend includes it in all requests. The backend validates the token on every request.

**4c. Overly permissive CORS (MEDIUM)**
The regex `http://.*:(5173|5174|3000)` matches any hostname on those ports. For Electron, CORS must accommodate the app's origin (which may be `null` for `file://` protocol or a custom scheme like `app://`). For development mode, restrict to `http://127.0.0.1:*` patterns.

**Security audit reference:** Findings 3.1, 3.2, 3.3.

### Acceptance Criteria
- [ ] Backend binds to `127.0.0.1` by default; `0.0.0.0` binding available only via explicit flag (e.g., `--host 0.0.0.0`)
- [ ] Backend accepts a `--auth-token` CLI argument; if provided, all API requests must include `Authorization: Bearer <token>` header
- [ ] Unauthorized requests receive HTTP 401
- [ ] CORS configuration updated to allow Electron's origin (configurable, not hardcoded to dev ports)
- [ ] Frontend `api.js` updated to include auth token in request headers when available
- [ ] Backend port made configurable via `--port` argument (default remains 8001) with dynamic port option (`--port 0` for OS-assigned port)

---

## Issue #5: Encrypt API Keys at Rest with Electron safeStorage
**Labels:** `security`, `electron`, `critical`
**Depends on:** #1, #3

### Description
All API keys (OpenRouter, OpenAI, Anthropic, Google, Mistral, DeepSeek, Groq, Tavily, Brave, Serper, custom endpoint) are currently stored as plaintext in `data/settings.json`. For a distributed desktop application, this is unacceptable -- any process or user with filesystem access can read all credentials.

**Solution:** Use Electron's `safeStorage` API, which encrypts strings using the OS keychain (Keychain on macOS). The Electron main process encrypts API key values before writing to disk and decrypts them when reading. The keys in `settings.json` will contain encrypted blobs instead of plaintext.

**Architecture:**
1. Main process exposes `encrypt`/`decrypt` functions via IPC (through the secure preload script).
2. When saving settings, sensitive fields are encrypted before being passed to the backend or written to disk.
3. When loading settings, encrypted fields are decrypted by the main process before being passed to the backend.
4. The backend receives decrypted keys in memory only -- never writes them to disk in plaintext.

**Additional improvement:** Stop setting API keys in `os.environ` (currently done in `main.py:146-150,498-512` for search providers). Pass keys directly to HTTP client calls instead.

**Security audit reference:** Findings 1.1, 1.2.

### Acceptance Criteria
- [ ] API key fields in `settings.json` are stored as encrypted blobs (not plaintext) when running in Electron
- [ ] Encryption uses `safeStorage.encryptString()` backed by macOS Keychain
- [ ] Decryption happens in the Electron main process only; decrypted values never written to disk
- [ ] Backend receives decrypted API keys via startup configuration (not from reading the file directly)
- [ ] API keys are no longer set in `os.environ`; passed directly to HTTP client calls
- [ ] Non-Electron usage (development mode) continues to work with plaintext keys
- [ ] If `safeStorage.isEncryptionAvailable()` returns false, fall back to plaintext with a console warning

---

## Issue #6: Bundle Python Backend for macOS Distribution
**Labels:** `packaging`, `backend`, `macos`
**Depends on:** #3, #4

### Description
The Python backend must be bundled into the Electron app so that users do not need to install Python, `uv`, or any dependencies. There are several approaches, each with trade-offs:

| Approach | App Size | Startup Time | Complexity | Maintenance |
|----------|----------|--------------|------------|-------------|
| **PyInstaller one-file** | ~80-120MB | Slow (extract on launch) | Medium | Medium |
| **PyInstaller one-dir** | ~80-120MB | Fast | Medium | Medium |
| **Embedded Python + venv** | ~150-200MB | Medium | High | High |
| **Nuitka compiled** | ~60-100MB | Fast | High | Low |

**Recommended approach:** PyInstaller in `--onedir` mode. This produces a directory of files that can be included in the Electron app's `resources/` directory. It starts fast (no extraction step), handles all dependencies (including `ddgs`, `yake`, and their native components), and is well-documented for macOS.

**PyInstaller command (reference):**
```bash
pyinstaller --name llm-council-backend \
  --distpath electron/resources/backend \
  --noconfirm \
  --collect-all ddgs \
  --collect-all yake \
  --hidden-import uvicorn.logging \
  --hidden-import uvicorn.lifespan.on \
  --hidden-import uvicorn.protocols.http.auto \
  backend/main.py
```

**Key considerations:**
- Must produce separate Intel and ARM builds (or use `lipo` to combine). Build the PyInstaller binary on each architecture separately, then use electron-builder's `extraResources` with `${arch}` variable to include the correct binary:
  ```
  resources/backend/
    arm64/llm-council-backend   (built on Apple Silicon)
    x64/llm-council-backend     (built on Intel or via Rosetta)
  ```
- The backend currently requires being run as `python -m backend.main` for relative imports. PyInstaller handles this via its module bundling.
- The `pyproject.toml` dependencies must all be included: `fastapi`, `uvicorn[standard]`, `httpx`, `pydantic`, `ddgs`, `yake`, `python-dotenv`.
- `ddgs` and `yake` with their NLP dependencies are the main size contributors (expect 150-200MB total).
- The bundled backend must accept environment variables for data directory, auth token, host, and port (from Issues #3 and #4).
- **First launch warning:** macOS Gatekeeper scans new apps on first launch. Combined with PyInstaller binary loading, first launch may be noticeably slower. A splash screen (Issue #8) mitigates this.
- Use GitHub Actions with `macos-13` (Intel) and `macos-14` (Apple Silicon) runners for CI builds of both architectures.

### Acceptance Criteria
- [ ] PyInstaller spec file (`backend.spec`) created and tested on macOS
- [ ] `npm run build:backend` script runs PyInstaller and outputs to a known directory
- [ ] Bundled backend starts successfully and responds to health check endpoint
- [ ] All Python dependencies are included (no ImportError at runtime)
- [ ] Bundled binary accepts `--data-dir`, `--auth-token`, `--host`, `--port` arguments
- [ ] Build works on both Apple Silicon and Intel Macs (or universal binary)
- [ ] Backend binary size is documented and reasonable (target: under 150MB)

---

## Issue #7: Build Frontend for Electron and Fix Asset Loading
**Labels:** `frontend`, `packaging`, `electron`
**Depends on:** #1, #4

### Description
The Vite-built frontend needs adjustments to work correctly inside Electron:

**7a. Vite base path**
Currently, `vite.config.js` has no `base` setting (defaults to `/`). For Electron loading via `file://` protocol, asset paths must be relative. Set `base: './'` in the Vite config for production builds.

**7b. Frontend serving strategy (CORS implications)**
There are three options for loading the built frontend in Electron, each with different CORS trade-offs:

| Option | How it works | CORS behavior | Recommendation |
|--------|-------------|---------------|----------------|
| **A: Local HTTP server** | Serve `frontend/dist/` via a tiny static server (e.g., `serve-handler`) on a random port | Origin is `http://localhost:{port}`, normal CORS | **Recommended** -- fewest backend changes, CORS works normally |
| **B: `loadFile()`** | Load `index.html` directly via `file://` protocol | Origin is `null`, requires backend CORS changes | Simpler but requires CORS `null` origin handling |
| **C: Custom protocol** | Register `app://` protocol via `protocol.handle()` | Custom origin, most "Electron-native" | Most complex |

Option A is recommended because it avoids CORS complications entirely -- the backend just needs to allow `http://127.0.0.1:{port}` as an additional origin.

**7c. API URL resolution**
`frontend/src/api.js:7-13` falls back to `http://${window.location.hostname}:8001`. When loaded via `file://`, `window.location.hostname` is an empty string, producing an invalid URL `http://:8001`. The API base URL must be provided by the Electron main process via the preload script using `ipcRenderer.invoke('get-backend-url')`.

**7d. Google Fonts dependency**
`frontend/index.html` loads four font families from Google Fonts CDN. This requires an internet connection for proper UI rendering. For a desktop app, fonts should be bundled locally so the UI works offline.

**7e. Auth token injection**
The frontend needs to receive the auth token (from Issue #4) from the Electron main process and include it in all API requests.

### Acceptance Criteria
- [ ] `vite.config.js` sets `base: './'` for production builds
- [ ] `api.js` checks for an Electron-provided API base URL (via `window.electronAPI.getApiBase()` or similar) before falling back to hostname-based detection
- [ ] `api.js` includes auth token header in all fetch/SSE requests when running in Electron
- [ ] Google Fonts (Syne, Plus Jakarta Sans, JetBrains Mono, Source Serif 4) are downloaded and bundled as local assets
- [ ] `index.html` uses local font references in production builds
- [ ] Built frontend loads correctly via `file://` protocol in Electron
- [ ] All CSS renders correctly with local fonts (no FOUT or missing glyphs)

---

## Issue #8: Implement Electron Main Process and Backend Lifecycle
**Labels:** `electron`, `core`, `process-management`
**Depends on:** #1, #6, #7

### Description
This is the core integration issue: wire up the Electron main process to manage the full application lifecycle -- launching the Python backend, loading the frontend, and coordinating clean shutdown.

**Startup sequence:**
1. Electron main process starts
2. Generate random auth token for backend API security
3. Determine available port for backend (use `net.createServer()` on port 0 to get an OS-assigned free port)
4. Spawn the bundled Python backend as a child process with env vars: `LLM_COUNCIL_DATA_DIR=<userData>/data`, `LLM_COUNCIL_PORT=<port>`, `LLM_COUNCIL_AUTH_TOKEN=<token>`
5. Poll backend health check (`GET http://localhost:{port}/api/health`) every 500ms with a 30-second timeout (generous to accommodate first-launch Gatekeeper scan)
6. Create BrowserWindow, load the built frontend (via local HTTP server or `loadFile`)
7. Pass API base URL and auth token to the renderer via preload script IPC
8. Show the window once the frontend is loaded (`ready-to-show` event)

**Shutdown sequence:**
1. User closes window or selects Quit
2. On macOS, `window-all-closed` should call `app.quit()` (rather than staying in dock) to ensure backend cleanup
3. `app.on('before-quit')`: Send SIGTERM to the backend child process
4. Wait for backend to exit gracefully (timeout 5 seconds)
5. If backend hasn't exited, send SIGKILL
6. Electron process exits

**macOS lifecycle:**
- `app.on('activate')`: If all windows are closed and user clicks the Dock icon, recreate the window (standard macOS behavior)

**Error handling with crash recovery:**
- If backend fails to start within timeout, show an error dialog with "Retry" and "Quit" options
- If backend crashes during operation, implement automatic restart with exponential backoff:
  - Track crash count; auto-restart up to 3 times with increasing delay (1s, 2s, 3s)
  - After 3 auto-restarts, show a dialog offering manual restart or quit
  - Reset crash counter after 60 seconds of stable operation
- Log backend stdout/stderr to a log file in the userData directory

**Security requirements (from audit):**
- BrowserWindow: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Prevent navigation away from the app (`will-navigate` event)
- Prevent opening new windows (`setWindowOpenHandler`)
- Set Content Security Policy header/meta tag

### Acceptance Criteria
- [ ] Backend spawns automatically when Electron app launches
- [ ] Backend health is verified (polling every 500ms, 30s timeout) before showing the main window
- [ ] Auth token is generated, passed to backend via env var, and injected into the frontend via IPC
- [ ] Backend process is reliably terminated on app quit (SIGTERM with 5s timeout, then SIGKILL; no orphan processes)
- [ ] Backend crash triggers automatic restart with exponential backoff (up to 3 retries)
- [ ] After 3 failed auto-restarts, user is shown a dialog with "Restart" and "Quit" options
- [ ] Backend stdout/stderr logged to `<userData>/logs/backend.log`
- [ ] `app.on('activate')` recreates the window when Dock icon is clicked (standard macOS behavior)
- [ ] Window navigation is prevented (no accidental browsing away)
- [ ] New window creation is blocked
- [ ] Content Security Policy is set (allow `self`, `connect-src http://127.0.0.1:*`, `font-src self`, `style-src self unsafe-inline`)
- [ ] App shows a loading/splash state while backend starts up

---

## Issue #9: Implement Secure Preload Script and IPC Bridge
**Labels:** `electron`, `security`, `frontend`
**Depends on:** #1, #5, #8

### Description
The preload script is the security boundary between the untrusted renderer process and the trusted main process. It must expose a minimal, well-defined API via `contextBridge.exposeInMainWorld()`.

**Required IPC channels:**

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `get-api-config` | Renderer -> Main | Get backend URL and auth token |
| `encrypt-settings` | Renderer -> Main | Encrypt sensitive fields before save |
| `decrypt-settings` | Main -> Renderer | Decrypt sensitive fields on load |
| `get-app-version` | Renderer -> Main | Display version in UI |
| `show-about` | Renderer -> Main | Show native About dialog |
| `restart-backend` | Renderer -> Main | Restart crashed backend |
| `open-external-url` | Renderer -> Main | Safely open URLs in default browser |

**Security rules (from audit findings 5.2, 6.2):**
- NEVER expose `ipcRenderer` directly to the renderer
- Use `ipcMain.handle()` (async, returns values) not `ipcMain.on()` for all channels
- Validate all arguments in the main process handler before acting
- Sanitize any file paths to prevent directory traversal
- Each channel handler should validate argument types and ranges

### Acceptance Criteria
- [ ] `preload.js` exposes only the channels listed above via `contextBridge.exposeInMainWorld('electronAPI', ...)`
- [ ] All IPC uses `ipcMain.handle()` / `ipcRenderer.invoke()` pattern (not `send`/`on`)
- [ ] Main process validates argument types for every IPC handler
- [ ] `open-external-url` validates URLs (only `https://` protocol allowed)
- [ ] No direct `require('electron')` or Node.js APIs accessible from the renderer
- [ ] Preload script passes Electron security checklist (no `remote` module, no `eval`)

---

## Issue #10: macOS App Signing, Notarization, and DMG Creation
**Labels:** `packaging`, `macos`, `distribution`
**Depends on:** #2, #6, #7, #8

### Description
Configure the build pipeline to produce a signed, notarized macOS DMG that users can drag to their Applications folder.

**Code signing:**
- Requires an Apple Developer account and Developer ID Application certificate
- electron-builder handles signing automatically when the certificate is in the Keychain
- Environment variables: `CSC_LINK` (certificate path) or `CSC_NAME` (certificate name)
- Must sign all binaries including the bundled Python backend

**Notarization:**
- Required for macOS 10.15+ (Catalina and later) -- unsigned apps are blocked by Gatekeeper
- electron-builder supports `afterSign` hook for notarization via `@electron/notarize`
- Requires Apple ID, app-specific password, and team ID
- Notarization validates that all code is signed and no disallowed entitlements are used

**DMG configuration:**
- Custom background image showing drag-to-Applications arrow
- Window size, icon positions, and app icon placement
- Volume name: "LLM Council+"

**Entitlements (from security audit and electron architecture review):**
- `com.apple.security.cs.allow-unsigned-executable-memory` -- required for PyInstaller binaries
- `com.apple.security.network.client` -- required for API calls to OpenRouter, Anthropic, etc. and Ollama access
- `com.apple.security.network.server` -- required for the local FastAPI server
- `com.apple.security.cs.disable-library-validation` -- required for PyInstaller to load bundled Python `.so` files
- Hardened Runtime enabled (required for notarization)
- No App Sandbox (would restrict Ollama integration and filesystem access)

**Notarization script** (`scripts/notarize.js`):
- Use `@electron/notarize` package with `notarytool` (replaces deprecated `altool`)
- Triggered via electron-builder's `afterSign` hook
- Requires environment variables: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`

**DMG configuration:**
- Custom background image (`assets/dmg-background.png`) showing drag-to-Applications arrow
- Icon size: 128px
- Contents positioning: app icon at x:130 y:170, Applications link at x:380 y:170
- Volume name: "LLM Council+"

**Universal binary strategy:**
- Build the PyInstaller backend separately on each architecture
- Use electron-builder's `extraResources` with `${arch}` variable to include the correct binary
- Set `mac.target.arch: ["universal"]` in electron-builder config

### Acceptance Criteria
- [ ] `electron-builder.yml` or `package.json` build config produces a DMG file
- [ ] DMG has a custom background with drag-to-Applications instruction
- [ ] `.app` bundle is code-signed with Developer ID certificate
- [ ] All embedded binaries (Python backend, native modules) are signed
- [ ] App is notarized with Apple and includes a stapled ticket
- [ ] Signed app passes `spctl --assess --type execute` verification
- [ ] Entitlements file includes required permissions and hardened runtime
- [ ] CI/CD environment variables documented for automated builds (certificate, Apple ID, team ID)
- [ ] Unsigned development builds still work for contributors without Apple Developer accounts

---

## Issue #11: Implement Clean Uninstall and Data Management
**Labels:** `macos`, `ux`, `data`
**Depends on:** #3, #8

### Description
The user requirement states: "if the app is deleted nothing of config remains." On macOS, dragging an app to Trash removes only the `.app` bundle -- data in `~/Library/` persists. This issue addresses ensuring users can fully remove all app data.

**Data locations to manage:**
| Location | Contents | Created by |
|----------|----------|------------|
| `~/Library/Application Support/LLM Council Plus/` | Settings, conversations, logs | App (via `app.getPath('userData')`) |
| `~/Library/Caches/LLM Council Plus/` | Electron cache | Electron |
| `~/Library/Preferences/com.llmcouncil.plus.plist` | Window state, Electron defaults | Electron |
| `~/Library/Saved Application State/com.llmcouncil.plus.savedState/` | Window restore state | macOS |
| `~/Library/Logs/LLM Council Plus/` | Crash logs | Electron |

**Approach (multi-pronged):**
1. **In-app "Delete All Data" button** in Settings: Deletes all data directories, clears Keychain entries (safeStorage), and resets the app to fresh state.
2. **In-app "Uninstall" menu option** (Help > Uninstall): Deletes all data, then opens Finder with the `.app` selected for the user to trash.
3. **Documentation**: README section listing all data locations for manual cleanup.
4. **First-launch detection**: If `userData` directory is empty but the app has been installed before (check a version marker), offer to start fresh.

### Acceptance Criteria
- [ ] All user data (settings, conversations, logs, cache) stored exclusively in `~/Library/Application Support/LLM Council Plus/`
- [ ] Settings UI includes "Delete All Data & Reset" button with confirmation dialog
- [ ] Help menu includes "Uninstall LLM Council+" option that cleans all `~/Library/` data
- [ ] Uninstall process removes data from all five `~/Library/` locations listed above
- [ ] After uninstall cleanup + app deletion, no LLM Council+ data remains on the system
- [ ] Data locations documented in README for users who prefer manual cleanup
- [ ] Encrypted API keys in Keychain are cleared during uninstall

---

## Issue #12: Add Backend Health Check Endpoint
**Labels:** `backend`, `api`, `electron`
**Depends on:** #4

### Description
The Electron main process needs to verify that the backend has started successfully before showing the main window. Currently there is no dedicated health check endpoint. Add a lightweight `GET /api/health` endpoint that returns the backend status, version, and readiness state.

This endpoint is also useful for:
- The frontend to detect backend availability
- The tray menu to show backend status
- Crash recovery (polling to detect when the backend is back up after restart)

### Acceptance Criteria
- [ ] `GET /api/health` endpoint returns JSON: `{"status": "ok", "version": "0.2.1"}`
- [ ] Endpoint responds within 100ms (no heavy computation)
- [ ] Endpoint is exempt from auth token requirement (so Electron can poll during startup before the frontend is loaded)
- [ ] Returns HTTP 503 if the backend is still initializing (e.g., loading settings)
- [ ] Frontend `api.js` exports a `checkHealth()` function that calls this endpoint

---

## Issue #13: Implement macOS Native Menu Bar
**Labels:** `electron`, `macos`, `ux`
**Depends on:** #8

### Description
Configure a proper macOS application menu bar for the Electron app. macOS apps are expected to have a standard menu structure (App menu, Edit menu, View menu, Window menu, Help menu). Without this, basic operations like Copy/Paste, Quit, and Minimize do not work as expected.

**Menu structure:**
- **LLM Council+**: About, Preferences (opens Settings), Quit
- **Edit**: Undo, Redo, Cut, Copy, Paste, Select All
- **View**: Reload, Toggle DevTools (dev mode only), Zoom In/Out, Fullscreen
- **Window**: Minimize, Close, Zoom
- **Help**: Documentation (opens README in browser), Report Issue (opens GitHub), Uninstall (from Issue #11)

### Acceptance Criteria
- [ ] macOS menu bar shows "LLM Council+" as the app name
- [ ] Standard Edit menu enables keyboard shortcuts (Cmd+C, Cmd+V, Cmd+X, Cmd+A, Cmd+Z)
- [ ] About menu item shows app version, Electron version, and Python backend version
- [ ] Preferences menu item (Cmd+,) navigates to Settings in the frontend
- [ ] View menu includes zoom controls and fullscreen toggle
- [ ] DevTools toggle is only available in development mode
- [ ] Help menu links open in the default browser (not in the Electron window)
- [ ] Cmd+Q properly triggers the shutdown sequence (Issue #8)

---

## Issue #14: Implement Error Sanitization for Packaged App
**Labels:** `security`, `backend`, `low-priority`
**Depends on:** #6

### Description
In the current backend, raw exception messages are sent to the frontend (e.g., `main.py:299-301`). These can contain file paths, stack traces, Python version details, and internal state that should not be exposed in a distributed application. While not a critical vulnerability, it violates the principle of least information and could aid an attacker who has local access.

**Changes:**
- Log full error details (including stack traces) to a log file in the userData directory
- Send only generic, user-friendly error messages to the frontend (e.g., "Failed to generate response. Check backend logs for details.")
- Include a correlation ID in both the log entry and the user-facing message so users can reference specific errors when reporting issues

**Security audit reference:** Finding 6.3.

### Acceptance Criteria
- [ ] Backend errors are logged with full stack traces to `<userData>/logs/backend.log`
- [ ] Error responses to the frontend contain a generic message and a correlation ID
- [ ] No file paths, class names, or stack traces appear in API error responses
- [ ] Log rotation is implemented (max 10MB per log file, keep 3 rotations)
- [ ] A development mode flag preserves current verbose error behavior for debugging

---

## Issue #15: Add Auto-Update Support
**Labels:** `electron`, `ux`, `enhancement`
**Depends on:** #10

### Description
Once the app is distributed as a signed DMG, implement auto-update functionality so users receive new versions without manually downloading. Use `electron-updater` (part of electron-builder) with GitHub Releases as the update server.

**Flow:**
1. On app launch (and periodically), check GitHub Releases for a newer version
2. If available, show a non-intrusive notification: "Update available: v0.3.0. Download now?"
3. Download the update in the background
4. When ready, prompt: "Update downloaded. Restart to apply?"
5. On restart, apply the update and launch the new version

**Considerations:**
- Updates must be code-signed and notarized (same as initial release)
- The Python backend bundle must be included in updates (the entire app is replaced)
- Delta updates are not practical given the Python bundle size; use full replacement
- Users on metered connections should be able to defer updates

### Acceptance Criteria
- [ ] `electron-updater` configured with GitHub Releases as the update source
- [ ] App checks for updates on launch and every 4 hours while running
- [ ] Update notification is non-intrusive (no blocking dialogs on startup)
- [ ] User can choose "Download Now" or "Later"
- [ ] Downloaded update is verified (code signature check) before applying
- [ ] "Check for Updates" option available in the app menu
- [ ] Update process preserves user data (settings, conversations) -- they live in userData, not in the app bundle
- [ ] Release workflow documented: how to tag, build, sign, notarize, and publish a release

---

## Issue #16: End-to-End Testing and QA for Packaged App
**Labels:** `testing`, `qa`
**Depends on:** #8, #10, #11

### Description
Before the first release, perform comprehensive testing of the packaged application across the full user journey. This is not automated test infrastructure -- it is a structured manual QA pass with a checklist.

**Test matrix:**
- macOS versions: Ventura (13), Sonoma (14), Sequoia (15)
- Architectures: Apple Silicon (M1/M2/M3), Intel (if applicable)
- Network conditions: Online, offline (no internet), restricted (corporate firewall)

**Test scenarios:**

| Category | Test |
|----------|------|
| Install | DMG opens, drag to Applications works, first launch succeeds |
| Startup | Backend starts, frontend loads, no errors in console |
| Core flow | Full deliberation (all 3 stages) completes successfully |
| Providers | OpenRouter, Ollama (local), Groq, direct providers all work |
| Settings | API keys save/load correctly (encrypted), model selection persists |
| Search | Web search with DuckDuckGo, Tavily, Brave all function |
| Persistence | Conversations survive app restart, settings survive app restart |
| Menu | macOS native menu bar works, keyboard shortcuts function |
| Shutdown | Closing window quits cleanly, no orphan Python processes |
| Uninstall | "Delete All Data" removes everything, app deletion leaves no traces |
| Update | Auto-update detects new version, downloads, and applies correctly |
| Edge cases | Port 8001 already in use, Ollama not running, invalid API keys |

### Acceptance Criteria
- [ ] Test checklist completed on at least one Apple Silicon Mac
- [ ] No orphan Python processes after app quit (verified via Activity Monitor / `ps aux`)
- [ ] No crash reports or unhandled exceptions during normal use
- [ ] App launches in under 10 seconds (backend ready, window visible)
- [ ] All conversation data survives app restart
- [ ] App functions with no internet (minus API calls -- UI loads, settings work)
- [ ] DMG install/uninstall cycle leaves no data on the system
- [ ] Known issues documented with workarounds
