# Workflow System Documentation

A structured step-by-step conversation flow system that runs **before** the AI provider session starts. Inspired by VAPI/ElevenLabs workflow features.

## Overview

Workflows replace free-form AI conversation with a defined sequence of steps. When a workflow completes or terminates, it either:
- **Hands off** to the normal AI provider session (with workflow variables injected)
- **Terminates** the call directly (transfer or hangup) — skipping the provider entirely

## Configuration

Workflows are defined under the top-level `workflows:` key in `ai-agent.yaml` or `ai-agent.local.yaml`:

```yaml
workflows:
  insurance_claim:
    name: insurance_claim
    description: Guide caller through insurance claim process
    version: "1.0"
    variables:
      claim_type: claim
      language: en
    steps:
      - id: greeting
        type: prompt
        prompt: "Welcome to Vocallremote Insurance. How can I help you today?"
        next: capture_policy_number

      - id: capture_policy_number
        type: collect
        entity: policy_number
        prompt: "Can you please provide your policy number?"
        validation:
          pattern: "^[A-Z]{2}[0-9]{6}$"
          max_attempts: 3
          retry_prompt: "Invalid format. Please provide a 2 letters followed by 6 digits."
        next: capture_incident_type
```

## Visual Workflow Builder

The Admin UI includes a visual workflow canvas at `/workflows`. Instead of writing YAML by hand, you can:

1. **Drag-and-drop nodes** onto a canvas with pan/zoom
2. **Connect nodes** by dragging from output ports to input ports
3. **Edit edge conditions** — click an edge label to add routing conditions
4. **Fill Global Prompt** — sets the AI personality across all conversation nodes
5. **Configure Global Voice** — provider and voice name for TTS output
6. **Bind to Context** — assign the workflow to an AI context directly from the canvas

### Canvas Node Types

| Canvas Node Type | Engine Step Type | Behavior |
|---|---|---|
| `conversation` | `prompt` | Speak text, wait for user reply |
| `api_request` | `action` | Execute `generic_http_lookup` tool |
| `transfer_call` | `action` | Execute `unified_transfer` tool |
| `end_call` | `action` | Execute `hangup_call` tool |
| `tool` | `action` | Execute user-specified tool |

### Canvas to Engine Step Conversion

On save, the backend automatically converts the canvas graph to engine workflow steps. This happens in `_build_workflow_steps()` (`admin_ui/backend/api/workflows.py`):

- `conversation` nodes → `type: prompt` with the node's `firstMessage`/`prompt` as the prompt text
- `api_request` nodes → `type: action` with `tool: generic_http_lookup` and URL from `data.url`
- `transfer_call` nodes → `type: action` with `tool: unified_transfer` and destination from `data.destination`
- `end_call` nodes → `type: action` with `tool: hangup_call`
- `tool` nodes → `type: action` with the tool name from `data.toolName`

**Edge conditions become branch routing:**
- A single labeled edge from a node → `next` goto on the step
- Multiple labeled edges from the same node → `type: branch` with `conditions` array

### Global Fields

When saving from the canvas, these additional fields are stored alongside the steps:

```yaml
workflows:
  my_workflow:
    global_prompt: |
      ## Identity & Purpose
      You are Alex, a customer service voice assistant...
    global_voice_provider: ElevenLabs
    global_voice_name: Elliot
    steps: [...]
    _canvas:
      nodes: [...]
      edges: [...]
```

- `global_prompt` — Full AI personality prompt injected into the bound context's `prompt` field on save
- `global_voice_provider` — TTS provider name
- `global_voice_name` — Voice name within that provider
- `_canvas` — The raw canvas graph (nodes + edges), preserved for reloading the visual editor

## Enabling Workflows in Contexts

To activate a workflow for a call, bind it to a context:

```yaml
contexts:
  insurance:
    workflow: insurance_claim
    provider: openai_realtime
```

The workflow can also be assigned from the Admin UI canvas via the **"Bind to context"** dropdown in the top bar. When a context binding is set, the backend writes `contexts.<name>.workflow` and injects `global_prompt` into `contexts.<name>.prompt` so the engine picks it up at call time automatically.

When a call uses the `insurance` context, the workflow executes first. After the workflow completes, the provider session starts with access to all workflow variables.

## Step Types

### 1. `prompt` — Speak and Wait

Speak text to the caller and wait for their response. The step blocks until TTS playback completes.

```yaml
- id: greeting
  type: prompt
  prompt: "Thank you for calling. How can I assist you today?"
  next: main_menu
```

**Fields:**
- `id` — Unique step identifier (used in `goto` references)
- `type` — Must be `prompt`
- `prompt` — Text or SSML to speak
- `next` — Step ID to go to after this step (optional, defaults to next in order)

### 2. `collect` — Extract Entity

Prompt for a specific entity (e.g., policy number, account ID), collect the caller's speech, and extract the value using LLM. Supports validation with regex patterns and retry logic.

```yaml
- id: capture_email
  type: collect
  entity: email
  prompt: "What is your email address?"
  validation:
    pattern: "^[^@]+@[^@]+\.[^@]+$"
    max_attempts: 3
    retry_prompt: "That doesn't look like a valid email. Please try again."
```

**Fields:**
- `entity` — Variable name to store the extracted value
- `validation.pattern` — Regex pattern to validate the extracted value
- `validation.max_attempts` — Maximum collection attempts (default: 3)
- `validation.retry_prompt` — Prompt to speak on validation failure

**Runtime behavior:**
1. Speak the prompt
2. Wait for user speech (via VAD)
3. Transcribe speech via STT
4. Extract entity using LLM
5. Validate against pattern (if provided)
6. Retry on failure up to `max_attempts`
7. Store value in `{{entity_name}}` variable

### 3. `action` — Execute Tool

Execute a registered AVA tool and use the result to route to the next step.

```yaml
- id: lookup_policy
  type: action
  tool: generic_http_lookup
  parameters:
    endpoint: "https://api.example.com/policy/{{policy_number}}"
    method: GET
  conditions:
    - if: "{{lookup_status}} == 'found'"
      goto: confirm_details
    - if: "{{lookup_status}} == 'not_found'"
      goto: create_case
  default: transfer_to_agent
```

**Fields:**
- `tool` — Registered tool name to execute
- `parameters` — Tool parameters (supports `{{variable}}` substitution)
- `conditions` — Route based on tool result values
- `default` — Step ID to goto if no conditions match
- `continue_on_failure` — If true, jump to `failure_default` instead of `next` on tool error
- `failure_default` — Step ID for failure path

**Result routing:**
- Tool result is stored in `{{tool_result_<tool_name>}}`
- Tool status is stored in `{{last_tool_status}}` (`success` or `failed`)
- `{{last_tool_result}}` holds the raw result string

### 4. `branch` — Decision Point

Evaluate conditions to determine the next step. First matching condition wins.

```yaml
- id: route_by_intent
  type: branch
  conditions:
    - if: "{{intent}} == 'claim'"
      goto: capture_claim
    - if: "{{intent}} == 'billing'"
      goto: billing_support
    - if: "{{intent}} == 'complaint'"
      goto: capture_complaint
  default: transfer_to_agent
```

**Condition expression syntax:**
- `{{variable}} == 'value'` — String equality
- `{{variable}} != 'value'` — String inequality
- `{{variable}} in ['value1', 'value2']` — Value in list
- `{{variable}} == 'value' or {{other}} == 'value2'` — Logical OR
- `{{last_tool_status}} == 'success'` — Tool result check

## Variable Substitution

All string fields support `{{variable_name}}` substitution:

```yaml
prompt: "Hello {{caller_name}}, welcome to {{company_name}}."
parameters:
  endpoint: "https://api.example.com/{{customer_type}}/{{customer_id}}"
```

Variables are resolved in this order:
1. Workflow-level defaults (`variables:` section)
2. Pre-call results from session
3. Extracted entities from `collect` steps
4. Tool execution results (`{{tool_result_<name>}}`, `{{last_tool_status}}`)

## Side-Effect Actions

Any step can include non-blocking side-effect actions that run in the background:

```yaml
- id: welcome
  type: prompt
  prompt: "Welcome. Please hold while I pull up your account."
  actions:
    - tool: generic_http_lookup
      parameters:
        endpoint: "https://api.example.com/customer/{{customer_id}}"
```

These execute without blocking the step progression — useful for pre-fetching data or logging.

## Ending a Workflow

### Normal Completion

When all steps complete without termination:

```yaml
- id: close
  type: prompt
  prompt: "Thank you for calling. Have a great day."
  # Workflow completes here — provider session starts with workflow_variables available
```

The provider session receives `workflow_variables` in the session, enabling personalized responses.

### Transfer

Use an `action` step with the `unified_transfer` tool to transfer the call:

```yaml
- id: transfer_agent
  type: action
  tool: unified_transfer
  parameters:
    destination: "102"
    context: from-internal
  next: end_call

- id: end_call
  type: prompt
  prompt: "Transferring you now."
```

**Important:** After a transfer, the workflow ends — AVA loses control of the call.

### Hangup

Use an `action` step with the `hangup_call` tool:

```yaml
- id: survey_complete
  type: prompt
  prompt: "Thank you for your feedback. Goodbye."
  actions:
    - tool: hangup_call
      parameters:
        reason: "survey_complete"
```

## Admin UI Workflows Page

The Admin UI includes a visual workflow builder at `/workflows`:

- **Visual canvas** — drag-and-drop nodes, bezier edges, pan/zoom
- **Node types** — conversation, api_request, transfer_call, end_call, tool
- **Edge conditions** — click edge label to add routing condition text
- **Global Prompt panel** — sets AI personality across all nodes
- **Global Voice panel** — provider + voice dropdown
- **Context binding dropdown** — assigns workflow to an AI context on save
- **JSON modal** — view raw workflow JSON with syntax highlighting
- **Variables panel** — shows VAPI built-in variables and extracted variable counts

### Visual Canvas UI Elements

| Element | Description |
|---|---|
| Top bar | Editable workflow name, context binding dropdown, Save button |
| Left sidebar | Add Node button, Global Prompt / Global Voice / Variables buttons |
| Canvas | Dot grid, nodes, bezier edges with teal arrow markers |
| Edge pill | Shows condition label text, click to edit, X to delete |
| Node card | Header (icon + label input), body (type-specific fields), always-visible action icons |
| Right panel | Selected node detail (type, firstMessage, prompt, model settings, tools, voice, transcriber) |
| Bottom bar | Toolbar: settings, lock, undo/redo, node list, auto-layout, zoom, fit view, pan/select |
| Minimap | Bottom-right overview of node positions |

## Example: Insurance Claim Workflow

```yaml
workflows:
  insurance_claim:
    name: insurance_claim
    description: Guide caller through insurance claim filing
    version: "1.0"
    variables:
      language: en
      claim_type: claim

    steps:
      - id: greeting
        type: prompt
        prompt: "Welcome to Vocallremote Insurance. For claims, say claim. For billing, say billing."
        next: route_intent

      - id: route_intent
        type: branch
        conditions:
          - if: "'claim' in '{{user_input}}'.lower()"
            goto: capture_policy
          - if: "'billing' in '{{user_input}}'.lower()"
            goto: billing_flow
        default: transfer_agent

      - id: capture_policy
        type: collect
        entity: policy_number
        prompt: "What is your policy number?"
        validation:
          pattern: "^[A-Z0-9]{8,12}$"
          max_attempts: 3
          retry_prompt: "Invalid format. Please try again."
        next: capture_incident_date

      - id: capture_incident_date
        type: collect
        entity: incident_date
        prompt: "When did the incident occur? Please say the date."
        next: capture_description

      - id: capture_description
        type: collect
        entity: description
        prompt: "Briefly describe what happened."
        actions:
          - tool: generic_webhook
            parameters:
              url: "https://api.example.com/claims/create"
              method: POST
        next: confirmation

      - id: confirmation
        type: prompt
        prompt: "Your claim has been filed. Reference number {{claim_ref}}. An agent will contact you within 24 hours. Goodbye."

      - id: billing_flow
        type: prompt
        prompt: "I'll transfer you to our billing department."
        actions:
          - tool: unified_transfer
            parameters:
              destination: "103"
              context: from-internal

      - id: transfer_agent
        type: prompt
        prompt: "Let me connect you with an agent."
        actions:
          - tool: unified_transfer
            parameters:
              destination: "101"
              context: from-internal
```

## Engine Integration

The `WorkflowEngine` is called from `engine.py` after pre-call tools execute and before the provider session starts:

```
Pre-call Tools → WorkflowEngine → AI Provider Session → (on call end) Post-call Tools
```

When the workflow completes, `workflow_variables` are injected into `CallSession` so the AI provider can reference them (e.g., "I see your policy number is {{policy_number}}").

### Call Flow

1. Call arrives, Asterisk dialplan sets `AI_CONTEXT=mycontext`
2. Engine reads `contexts.mycontext` from `TransportOrchestrator`
3. At call time (~line 13014 in `engine.py`): `ctx_cfg.workflow` resolved → `WorkflowEngine` created
4. `WorkflowEngine.execute()` runs steps
5. At ~line 10057: `context_config.prompt` injected into LLM options (global_prompt written here by the backend on save)
6. Normal provider session follows, or call terminates if workflow did transfer/hangup

## Status and Limitations

### Implemented:
- `prompt`, `collect`, `action`, `branch` step types
- Variable substitution in prompts and parameters
- Tool execution via tool registry
- Conditional routing (branch + action conditions)
- Side-effect actions (non-blocking)
- Workflow variables propagation to provider session
- YAML loading and validation
- Admin UI visual workflow canvas (drag-and-drop, pan/zoom, edge conditions)
- Canvas-to-engine step conversion on save
- Global prompt / global voice fields
- Context binding from canvas (writes `contexts.<name>.workflow` + injects prompt)

### Not Yet Implemented:
- `_wait_for_user_speech()` — Audio capture integration with Asterisk/VAD (speech input during workflows)
- Visual branch editor — branch conditions shown as labeled edges in canvas (conditions are saved via edge labels but the canvas doesn't yet render branching visually)
- Per-node voice/transcriber settings in canvas right panel

## File Reference

| File | Description |
|------|-------------|
| `src/core/workflow_models.py` | Pydantic models: Workflow, WorkflowStep, StepResult |
| `src/core/workflow_loader.py` | YAML config loader and validator |
| `src/core/workflow_engine.py` | Step execution engine with variable substitution |
| `src/core/transport_orchestrator.py` | ContextConfig with `workflow` field (line 66) |
| `admin_ui/backend/api/workflows.py` | REST API for workflow CRUD + canvas-to-engine bridge functions |
| `admin_ui/frontend/src/components/WorkflowCanvas.tsx` | Visual workflow canvas component (~1020 lines) |
| `admin_ui/frontend/src/pages/WorkflowsPage.tsx` | Admin UI workflow builder page + save/load wiring |