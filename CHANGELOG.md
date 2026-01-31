# Changelog

All notable changes to LLM Council Plus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-31

### Added
- **Mobile Responsiveness**: Full mobile support with hamburger menu, responsive layouts, and touch-friendly UI
- **Chat History Search**: Filter conversations by title in the sidebar
- **Source Validation**: Disable model source toggles when API key not configured with helpful tooltips
- **Version Display**: Show version number in sidebar and settings

### Changed
- **UI Redesign**: New "Council Chamber" dark theme with refined glassmorphism
- **Typography**: Updated font stack (Syne, Plus Jakarta Sans, Source Serif 4, JetBrains Mono)
- **Hero Animations**: Staggered fade-in animations for welcome screen elements

### Fixed
- Auto-cleanup of empty conversations when switching or creating new ones
- Duplicate API route in backend
- Duplicate CSS blocks causing style conflicts
- React key anti-pattern in message list
- Redundant decorator in provider base class

## [0.1.0] - Initial Release

### Added
- 3-stage deliberation system (Individual Responses → Peer Ranking → Chairman Synthesis)
- Multi-provider support: OpenRouter, Ollama, Groq, Direct providers, Custom endpoints
- Web search integration: DuckDuckGo, Tavily, Brave with Jina Reader
- Execution modes: Chat Only, Chat + Ranking, Full Deliberation
- Conversation persistence with JSON storage
- Settings management with import/export
- "I'm Feeling Lucky" random model selection
