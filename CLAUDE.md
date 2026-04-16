# AVA - AI Voice Agent for Asterisk

## Project Overview

AVA (Asterisk AI Voice Agent) is an open-source AI voice agent that integrates with Asterisk/FreePBX phone systems via ARI (Asterisk Rest Interface). It enables natural voice conversations with callers, handling call transfers, voicemail, email summaries, and calendar integrations through AI-powered tool calling.

**Version:** 6.4.1
**License:** MIT
**Repository:** github.com/hkjarral/Asterisk-AI-Voice-Agent

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend (ai_engine)** | Python 3.11 |
| **Local AI Server** | Python 3.11 (optional) |
| **Admin UI Frontend** | React 18 + TypeScript + Vite + Tailwind CSS + Radix UI |
| **Admin UI Backend** | FastAPI (Python) |
| **Containerization** | Docker + Docker Compose |
| **Telephony** | Asterisk ARI, WebSockets |
| **AI Providers** | OpenAI, Deepgram, Google Vertex AI, ElevenLabs, Azure, Ollama, MiniMax, Telnyx |
| **Local AI** | Vosk, Faster Whisper, Whisper.cpp, Sherpa, Piper, Kokoro, MeloTTS, Silero, llama.cpp |

## Architecture

### Two-Container Design

1. **`ai_engine`** - Main orchestrator container. Connects to Asterisk via ARI, manages the full call lifecycle, coordinates providers and audio transport.
2. **`local_ai_server`** - Optional container for fully local AI inference (STT/LLM/TTS). Supports multiple backends (Vosk, Faster Whisper, Whisper.cpp, Sherpa, Piper, Kokoro, etc.).

### Audio Transports

- **AudioSocket** (default) - Asterisk connects via TCP to the engine's AudioSocket server. Uses `ulaw` or `slin16` format.
- **ExternalMedia RTP** - Asterisk sends RTP audio directly to the engine's RTP server. More efficient for some providers.

### Provider Types

**Full Agent Providers** (end-to-end speech-to-speech):
- `openai_realtime` - OpenAI Realtime API
- `google_live` - Google Gemini Live API
- `deepgram` - Deepgram Voice Agent
- `elevenlabs_agent` - ElevenLabs Conversational AI

**Pipeline Providers** (modular STT → LLM → TTS):
- `local` - Local AI server (hybrid or fully local)
- `ollama` - Ollama LLM
- `telnyx` - Telnyx LLM
- `minimax` - MiniMax LLM
- `groq` - Groq LLM
- `azure` - Azure Speech Services

## Directory Structure

```
src/                          # Main Python engine
├── engine.py                 # Core orchestration (~2400+ lines), Engine class, main event loop
├── engine_external_media.py  # ExternalMedia transport variant
├── ari_client.py             # Asterisk ARI WebSocket/HTTP client
├── config.py                 # Pydantic config models, 3-file config loading
├── logging_config.py         # Structured logging setup
├── rtp_server.py             # RTP server for ExternalMedia transport
├── pipelines/                # STT/LLM/TTS adapter implementations
│   ├── orchestrator.py       # PipelineOrchestrator - resolves per-call STT/LLM/TTS adapters
│   ├── base.py               # Component ABCs (STTComponent, LLMComponent, TTSComponent)
│   ├── openai.py            # OpenAI STT/LLM/TTS adapters
│   ├── deepgram.py          # Deepgram STT/TTS adapters
│   ├── deepgram_flux.py     # Deepgram Flux STT adapter
│   ├── google.py            # Google STT/LLM/TTS adapters
│   ├── elevenlabs.py        # ElevenLabs TTS adapter
│   ├── local.py            # Local STT/LLM/TTS (via local_ai_server)
│   ├── ollama.py           # Ollama LLM adapter
│   ├── telnyx.py           # Telnyx LLM adapter
│   ├── minimax.py          # MiniMax LLM adapter
│   ├── groq.py             # Groq STT/TTS adapters
│   ├── azure.py            # Azure STT/TTS adapters
│   └── cambai.py           # CAMB AI TTS adapter
├── providers/               # Full-agent provider implementations
│   ├── base.py              # AIProviderInterface ABC + ProviderCapabilities
│   ├── openai_realtime.py  # OpenAI Realtime provider
│   ├── google_live.py      # Google Gemini Live provider
│   ├── deepgram.py         # Deepgram Voice Agent provider
│   ├── elevenlabs_agent.py # ElevenLabs Conversational AI provider
│   └── local.py            # Local full-agent provider
├── core/                    # Core engine components
│   ├── session_store.py    # Thread-safe CallSession store (replaces dict soup)
│   ├── models.py           # CallSession, PlaybackRef, ProviderSession dataclasses
│   ├── playback_manager.py # File-based playback coordination
│   ├── streaming_playback_manager.py # Streaming playback with jitter buffer
│   ├── transport_orchestrator.py # Multi-provider audio format negotiation
│   ├── vad_manager.py      # Enhanced WebRTC VAD with adaptive threshold
│   ├── audio_gating_manager.py # OpenAI echo prevention
│   ├── conversation_coordinator.py # Coordinates TTS/audio with VAD
│   ├── call_context_analyzer.py   # In-call context analysis
│   ├── adaptive_streaming.py      # Adaptive streaming logic
│   └── outbound_store.py   # Outbound campaign dialer state (Milestone 22)
├── tools/                   # Tool calling system
│   ├── base.py             # Tool, ToolDefinition, ToolPhase, ToolCategory ABCs
│   ├── registry.py         # Singleton ToolRegistry - registers/looks up all tools
│   ├── parser.py          # Tool call parsing from LLM responses
│   ├── context.py          # Tool execution context
│   ├── runtime_guidance.py # Runtime guidance for providers
│   ├── telephony/          # Telephony tools (via ARI)
│   │   ├── unified_transfer.py  # Main transfer tool
│   │   ├── attended_transfer.py # Attended/warm transfer with screening
│   │   ├── queue_transfer.py    # ACD queue transfers
│   │   ├── live_agent_transfer.py # Agent availability routing
│   │   ├── cancel_transfer.py   # Cancel in-progress transfer
│   │   ├── check_extension_status.py # Extension/queue/ring group status lookup
│   │   ├── hangup.py            # Hangup with farewell
│   │   ├── hangup_policy.py     # Hangup intent detection
│   │   └── voicemail.py         # Voicemail routing
│   ├── business/           # Business tools (email, calendar)
│   │   ├── email_dispatcher.py
│   │   ├── email_summary.py     # Auto-send call summaries
│   │   ├── gcal_tool.py        # Google Calendar tool
│   │   └── request_transcript.py # Caller-requested transcript email
│   ├── http/               # HTTP-based tools
│   │   ├── generic_lookup.py   # Pre-call CRM lookups
│   │   ├── generic_webhook.py  # Post-call webhooks
│   │   └── in_call_lookup.py   # In-call HTTP lookups
│   ├── adapters/           # Provider-specific tool adapters
│   │   ├── openai.py, deepgram.py, elevenlabs.py, google.py
│   │   └── sanitize.py     # Output sanitization
│   └── mcp_tool.py         # MCP (Model Context Protocol) tool wrapper
├── mcp/                     # MCP client/manager
│   ├── manager.py          # MCPClientManager - starts stdio MCP servers, discovers tools
│   ├── stdio_client.py     # Stdio client for MCP servers
│   ├── naming.py           # Tool name sanitization
│   └── stdio_framing.py    # JSON-RPC framing for MCP
├── mcp_servers/            # Built-in MCP server implementations
│   ├── aviation_atis_server.py # Aviation weather ATIS server
│   └── weather_mcp_server.py   # Generic weather MCP server
├── audio/                  # Audio infrastructure
│   ├── audiosocket_server.py   # TCP AudioSocket server (Asterisk connects here)
│   └── resampler.py           # Audio resampling (8kHz ↔ 16kHz, μ-law/ALaw/PCM)
├── models/                # Model management
│   └── cache.py           # Model download caching
├── aviation/             # Aviation-specific modules
│   ├── atis.py, metar.py, awc.py, metno.py, speech.py
└── config/                # Config subsystem
    ├── loaders.py         # YAML loading with env expansion and local override merge
    ├── defaults.py        # Transport/barge-in default applier
    ├── normalization.py   # Pipeline/profile normalization
    └── security.py        # Credential injection (API keys, Asterisk credentials)

local_ai_server/          # Optional local inference server
├── server.py             # Main WebSocket server
├── control_plane.py      # Session control protocol
├── protocol_contract.py  # Protocol definitions
├── model_manager.py      # Model download/lifecycle management
├── backends/
│   ├── stt/             # Vosk, Faster Whisper, Whisper.cpp, Sherpa, Kroko, T-one
│   ├── tts/             # Piper, Kokoro, MeloTTS, Silero, Matcha
│   └── llm/             # llama.cpp
└── backends/registry.py  # Backend registration

admin_ui/
├── frontend/             # React TypeScript dashboard
│   └── src/
│       ├── App.tsx              # Main router with lazy-loaded pages
│       ├── pages/
│       │   ├── Dashboard.tsx     # Real-time metrics, container status
│       │   ├── Wizard.tsx        # First-time setup wizard
│       │   ├── CallHistoryPage.tsx  # Per-call debugging with LLM payload
│       │   ├── CallSchedulingPage.tsx # Outbound campaign scheduling
│       │   ├── ProvidersPage.tsx    # Provider configuration
│       │   ├── PipelinesPage.tsx    # Pipeline configuration
│       │   ├── ContextsPage.tsx      # Context/persona configuration
│       │   ├── ProfilesPage.tsx      # Audio profile configuration
│       │   ├── ToolsPage.tsx         # Tool configuration
│       │   ├── MCPPage.tsx           # MCP server management
│       │   └── Advanced/
│       │       ├── VADPage.tsx, StreamingPage.tsx, LLMPage.tsx
│       │       ├── TransportPage.tsx, BargeInPage.tsx, RawYamlPage.tsx
│       └── components/
│           ├── config/providers/  # Per-provider configuration forms
│           └── layout/            # AppShell, Header, Sidebar
└── backend/             # FastAPI backend
    ├── main.py         # FastAPI app, CORS, route mounting
    ├── auth.py         # JWT authentication
    ├── settings.py     # Settings loading
    └── api/            # API routes
        ├── config.py   # Config read/write via YAML
        ├── calls.py   # Call history
        ├── logs.py    # Log streaming
        ├── wizard.py  # First-run wizard
        └── ...        # system, tools, mcp, outbound, rebuild_jobs, etc.

config/
├── ai-agent.yaml             # Base configuration (git-tracked)
├── ai-agent.local.yaml        # Operator overrides (git-ignored, deep-merged)
├── ai-agent.example.yaml      # Example with all options
├── ai-agent.golden-*.yaml     # 6 production-ready baseline configs
└── platforms.yaml            # Platform-specific configs

docs/                     # Documentation
```

## Key Configuration

### Three-File Config System

1. **`config/ai-agent.yaml`** - Base config, git-tracked, upstream-managed
2. **`config/ai-agent.local.yaml`** - Operator overrides, git-ignored, deep-merged on top
3. **`.env`** - Secrets/API keys, git-ignored

### Active Pipeline vs Provider

- `active_pipeline: local_hybrid` - selects a named pipeline (modular STT→LLM→TTS)
- OR `contexts.<name>.provider: openai_realtime` - selects a full-agent provider

### Provider Precedence for a Call

1. `AI_PROVIDER` channel variable (set in dialplan)
2. `AI_CONTEXT` channel variable → `contexts.<name>.provider`
3. `default_provider` in config
4. `active_pipeline`

### Audio Transport Config

```yaml
audio_transport: audiosocket        # or "external_media"
audiosocket:
  format: slin                      # "ulaw" or "slin16" (wire format)
  host: 127.0.0.1
  port: 8090
external_media:
  rtp_host: 127.0.0.1
  rtp_port: 18080
  codec: ulaw                       # Asterisk-side codec
  format: slin16                    # Engine internal format
  sample_rate: 16000
```

## Core Classes

### `Engine` (src/engine.py)

Main orchestrator. Key attributes:
- `ari_client: ARIClient` - Asterisk connection
- `session_store: SessionStore` - call session state
- `pipeline_orchestrator: PipelineOrchestrator` - modular pipeline resolution
- `transport_orchestrator: TransportOrchestrator` - audio format negotiation
- `providers: Dict[str, AIProviderInterface]` - full-agent provider instances
- `provider_factories: Dict[str, Callable]` - per-call provider factory functions
- `streaming_playback_manager: StreamingPlaybackManager` - streaming TTS playback
- `playback_manager: PlaybackManager` - file-based playback
- `vad_manager: EnhancedVADManager` - WebRTC VAD
- `audio_gating_manager: AudioGatingManager` - OpenAI echo prevention
- `outbound_store` - outbound campaign state

### `SessionStore` (src/core/session_store.py)

Thread-safe centralized store for call sessions. Replaces scattered dicts (active_calls, caller_channels, etc.). Key methods:
- `upsert_call(session)` - add/update call
- `get_by_call_id(call_id)` / `get_by_channel_id(channel_id)` - lookups
- `remove_call(call_id)` - cleanup

### `PipelineOrchestrator` (src/pipelines/orchestrator.py)

Resolves per-call STT/LLM/TTS adapters from pipeline config. Returns `PipelineResolution` with adapter instances.

### `TransportOrchestrator` (src/core/transport_orchestrator.py)

Negotiates audio formats per-call based on profile, provider capabilities, and context. Produces `TransportProfile`.

### `ToolRegistry` (src/tools/registry.py)

Singleton registry of all tools. Tool name aliases handle provider naming differences. Key methods:
- `register(tool_class)` - register a tool
- `get(name)` - get tool with alias resolution
- `get_active_tools(context_name)` - tools for a context (respects `is_global`)

## Tool System

### Tool Phases

- `PRE_CALL` - Runs after answer, before AI speaks (CRM lookups, enrichment)
- `IN_CALL` - During conversation (transfers, hangup, email, HTTP lookups)
- `POST_CALL` - After call ends (webhooks, CRM updates)

### Telephony Tools

- `unified_transfer` - Transfer to extension/queue/ring group (replaces `blind_transfer`, `attended_transfer`, `queue_transfer`, `live_agent_transfer`)
- `cancel_transfer` - Cancel in-progress transfer
- `hangup_call` - End call gracefully
- `leave_voicemail` - Route to voicemail
- `check_extension_status` - Check if extension/queue/ring group is available

### Business Tools

- `send_email_summary` - Auto-send call summary to admin
- `request_transcript` - Email transcript to caller
- `gcal_tool` - Google Calendar integration

### HTTP Tools

- `generic_http_lookup` - Pre-call CRM enrichment
- `generic_webhook` - Post-call webhook
- `in_call_http_lookup` - In-call CRM lookup (intent routing)

## Six Golden Baseline Configurations

| Config | Provider | Response Time | Best For |
|--------|----------|---------------|----------|
| `golden-openai` | OpenAI Realtime API | <2s | Enterprise, quick setup |
| `golden-deepgram` | Deepgram Voice Agent | <3s | Deepgram ecosystem, Think stage |
| `golden-google-live` | Google Gemini Live | <2s | Google ecosystem, multimodal |
| `golden-elevenlabs` | ElevenLabs Agent | <2s | Voice quality priority |
| `golden-local-hybrid` | Local STT/TTS + Cloud LLM | varies | Privacy, audio stays local |
| `golden-telnyx` | Local STT/TTS + Telnyx LLM | varies | Model flexibility, cost control |

## Admin UI Routes

- `/` - Dashboard
- `/history` - Call History with LLM payload viewer
- `/scheduling` - Outbound campaign dialer
- `/providers` - AI provider config
- `/pipelines` - STT/LLM/TTS pipeline config
- `/contexts` - Context/persona config
- `/profiles` - Audio profile config
- `/tools` - Tool configuration
- `/mcp` - MCP server management
- `/vad`, `/streaming`, `/llm`, `/transport`, `/barge-in` - Advanced settings
- `/yaml` - Raw YAML editor (Monaco)
- `/env`, `/docker`, `/asterisk` - System management
- `/logs` - Live log streaming
- `/terminal` - Terminal emulator
- `/models` - Local AI model management
- `/updates` - System updates
- `/wizard` - First-run setup wizard

## Important Patterns

### Provider vs Pipeline Mode

A call uses **either** a full-agent provider (OpenAI Realtime, Google Live, etc.) **or** a modular pipeline (STT → LLM → TTS). The orchestrator handles both via `PipelineOrchestrator` for pipelines and direct provider management for full agents.

### Transport Orchestration

`TransportOrchestrator` resolves per-call audio formats from:
1. YAML audio profile (`profiles.<name>`)
2. Provider static capabilities
3. Runtime capability ACKs
4. Channel variable overrides (`AI_CONTEXT`)

### Tool Adapter Pattern

Each provider that supports tool calling has an adapter in `src/tools/adapters/` that translates between the provider's tool format and the internal `ToolDefinition` schema.

### Barge-In System

VAD-gated barge-in with:
- `initial_protection_ms` - grace period after TTS starts
- `min_ms` / `energy_threshold` - speech detection
- `cooldown_ms` - settle time before re-activating
- `provider_fallback_enabled` - fall back to provider VAD if local VAD fails

### Outbound Campaign Dialer (Milestone 22)

Engine has `outbound_store` with campaign scheduling, AMD (Answering Machine Detection), attempt retry logic, and ViciDial/FreePBX compatibility.

## Vicidiial Integration

AVA can work alongside Vicidiial on the same Asterisk/FreePBX system. Key integration notes:

### Shared Asterisk ARI
Both AVA and Vicidiial connect to Asterisk via ARI/Stasis. The `asterisk.app_name` in `ai-agent.yaml` (`asterisk-ai-voice-agent`) must not conflict with Vicidiial's ARI app registration.

### Dialplan Context Design
AVA uses its own dialplan context (`from-ai-agent` or custom) that routes calls to the Stasis app. Vicidiial's dialplan handles its own call flow. Calls can be transferred between them via extensions/queues.

Example integration dialplan (`/etc/asterisk/extensions_custom.conf`):
```asterisk
[ai-agent-test]
exten => 9999,1,NoOp(AVA Test Call)
same => n,Answer()
same => n,Wait(1)
same => n,Set(AI_CONTEXT=default)
same => n,Set(AI_PROVIDER=local)
same => n,Stasis(asterisk-ai-voice-agent)
same => n,Hangup()

[ai-agent-google]
exten => 8888,1,NoOp(AVA Google Live Test)
same => n,Answer()
same => n,Wait(1)
same => n,Set(AI_CONTEXT=default)
same => n,Set(AI_PROVIDER=google_live)
same => n,Stasis(asterisk-ai-voice-agent)
same => n,Hangup()

[default]
exten => 9999,1,Goto(ai-agent-test,9999,1)
exten => 8888,1,Goto(ai-agent-google,8888,1)
```

### Outbound Campaign Considerations
If using Vicidiial's built-in dialer, disable AVA's outbound scheduler to avoid double-dialing:
```bash
# In .env
AAVA_OUTBOUND_ENABLED=false
```

Vicidiial compatibility env vars:
- `AAVA_OUTBOUND_DIAL_CONTEXT` - dial context for outbound calls (default: `from-internal`)
- `AAVA_OUTBOUND_DIAL_PREFIX` - prefix for outbound dial strings
- `AAVA_OUTBOUND_PBX_TYPE` - set to `vicidial` for Vicidiial compatibility

## Security

### Security-First Config Design

**API keys and credentials MUST come from environment variables only** — never from YAML files. This is enforced by `src/config/security.py`:
- `inject_asterisk_credentials()` - Asterisk ARI credentials from env ONLY
- `inject_llm_config()` - API keys from env ONLY
- `inject_provider_api_keys()` - Per-provider keys from env ONLY

This separation prevents accidental credential exposure in version control.

### Admin UI Authentication

The Admin UI uses JWT authentication with:
- **Bcrypt password hashing** (`pbkdf2_sha256`)
- **Forced password change on first login** (`must_change_password: True` for default admin/admin)
- **24-hour token expiration**
- **Placeholder secret detection** - warns if `JWT_SECRET` is set to default/dev values

**Critical:** Change default admin password immediately and set a strong `JWT_SECRET` in `.env`.

### Port Inventory

| Port | Service | Protocol | Purpose | Access |
|------|---------|----------|---------|--------|
| 8088 | Asterisk ARI | TCP | Call control, channel events | Local only (`127.0.0.1`) |
| 8090 | AudioSocket | TCP | Audio streaming | Asterisk only |
| 18080 | ExternalMedia RTP | UDP | RTP audio | Asterisk only |
| 15000 | Health/Metrics | TCP | `/health` + `/metrics` | Local + monitoring |
| 3003 | Admin UI | TCP | Web dashboard | Behind Apache proxy |
| 8765 | Local AI Server | WS | WebSocket for STT/LLM/TTS | Local only |

### Firewall Configuration

AVA runs with Docker `network_mode: host`, sharing the host network namespace. Firewalld rules on the host should restrict access:

**Essential open ports:**
- 443/tcp - HTTPS (Apache reverse proxy)
- 5060/5061 - SIP/SIPS (VoIP calls)
- 10000-20000/udp - RTP audio

**Remove public exposure:**
- 3003/tcp - Should NOT be open directly; use Apache reverse proxy instead
- 8088/tcp - Only needed locally (Asterisk and AVA on same host)

**Example firewalld config:**
```bash
# Remove direct public access to Admin UI
firewall-cmd --permanent --remove-port=3003/tcp

# Keep ARI port restricted (it's loopback-only anyway, firewall is defense-in-depth)
# If Asterisk is on same host, 8088 is already loopback-only

# Reload after changes
firewall-cmd --runtime-to-permanent
```

### Admin UI HTTPS via Apache Reverse Proxy

The Admin UI (port 3003) should be accessed via a secure reverse proxy. Example Apache VirtualHost for a subdomain:

```apache
<VirtualHost *:443>
    ServerName ai.vocallremote.io
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/vocallremote.io/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/vocallremote.io/privkey.pem

    ProxyRequests Off
    ProxyPass / http://127.0.0.1:3003/ nocanon
    ProxyPassReverse / http://127.0.0.1:3003/
</VirtualHost>
```

### Production Security Checklist

From `docs/PRODUCTION_DEPLOYMENT.md`:
- [ ] `.env` file permissions: `chmod 600 .env`
- [ ] Default admin password changed
- [ ] Strong `JWT_SECRET` set (not default/dev value)
- [ ] API key rotation schedule (90 days for cloud providers)
- [ ] Firewall restricts access to only required ports/IPs
- [ ] TLS enabled for Asterisk ARI (use `https://` + `wss://` scheme)
- [ ] Docker containers run as non-root (`user: "appuser"`)
- [ ] Regular backups of config + call history
- [ ] Log rotation configured to prevent disk fill

### HIPAA/GDPR Considerations

For deployments handling sensitive data:
- Use **Local Hybrid** config — audio stays on-premises, only text transcripts sent to cloud LLM
- Enable **audit logging** in config
- Configure **data retention policies** (auto-delete audio files older than 30 days)
- Sign **Business Associate Agreements** with cloud providers

## Study Notes

Comprehensive Obsidian Vault study documentation is maintained at:
`/home/sohaib/Dropbox/Notes/Obsidian Vault/Studying/BACH MTNSACH/Project Vocallremote AI/`

**Completed sections:**
- Section 1: Admin UI (Dashboard, Sidebar, Pages, Providers, Call History) ✅
- Section 2: Core Architecture (Engine, Providers vs Pipelines, Transport Orchestrator, Session Store) ✅
- Section 3: AI Components (Pipeline System, Full Agent Providers, Tool Calling System, MCP Integration) ✅
- Section 4: Security & Deployment (Vicidiial Integration, Security & Firewall, Admin UI HTTPS Setup) ✅
- Section 5: Configuration Reference (Three-File Config, Contexts & Profiles, Dialplan Integration) ✅

**Files created:**
- `00 - Project Index.md` - Study map with 5 sections
- `01 - Admin UI Dashboard.md` - Status bar, SystemTopology, metrics
- `02 - Admin UI Sidebar Navigation.md` - Full sidebar tree, page descriptions
- `03 - Admin UI Pages Overview.md` - All 25 pages detailed
- `04 - Admin UI Providers Configuration.md` - Provider forms, health polling
- `05 - Admin UI Call History & Debugging.md` - Call records, transcripts
- `10 - Engine Architecture.md` - 9 key components, call lifecycle
- `11 - Providers vs Pipelines.md` - Full agent vs modular comparison
- `12 - Transport Orchestrator.md` - Audio profiles, format negotiation
- `13 - Session Store.md` - TTS gating, asyncio.Lock thread safety
- `20 - STT/LLM/TTS Pipeline System.md` - Component base classes, orchestrator
- `21 - Full Agent Providers.md` - OpenAI/Google/Deepgram/ElevenLabs implementations
- `22 - Tool Calling System.md` - ToolRegistry, phases, execution flow
- `23 - MCP Integration.md` - MCP stdio client, manager, protocol framing
- `30 - Vicidiial Integration.md` - Shared ARI, dialplan routing, transfers
- `31 - Security & Firewall.md` - Credential isolation, firewalld, HIPAA
- `32 - Admin UI HTTPS Setup.md` - Apache reverse proxy, SSL certificates
- `40 - Three-File Config System.md` - YAML/local/env deep merge architecture
- `41 - Contexts & Profiles.md` - Audio profiles, context resolution
- `42 - Dialplan Integration.md` - Asterisk dialplan examples, channel variables

## Troubleshooting

### Call reaches Stasis but AI doesn't respond

1. Check `docker logs ai_engine 2>&1 | grep -i "error\|provider\|session"`
2. Verify provider/API key is configured in `.env`
3. Check Local AI Server logs: `docker logs local_ai_server 2>&1`
4. If Vosk shows `preview=` (empty), mic is not capturing speech — check Linphone/audio device

### Dialplan not reaching AVA

1. Verify context is loaded: `asterisk -rx "dialplan show 9999@ai-agent-test"`
2. Check SIP peer context: `asterisk -rx "sip show peer <extension>" | grep context`
3. SIP calls go to `[default]` first — add redirect in `[default]` to route to AVA context

### Admin UI not loading

1. Check container: `docker ps | grep admin_ui`
2. Check logs: `docker logs admin_ui 2>&1 | tail -20`
3. Verify Apache proxy config: `apachectl configtest`
4. Check DNS/subdomain points to server

### Google Live / OpenAI provider not working

1. Verify API key in `.env`: `grep API_KEY .env`
2. Check engine logs for provider initialization errors
3. For Google Vertex AI: ensure `GOOGLE_APPLICATION_CREDENTIALS` points to valid service account JSON
4. Restart engine: `docker compose restart ai_engine`