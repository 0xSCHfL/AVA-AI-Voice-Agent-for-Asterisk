# IVR + Workflow System Implementation Plan

## Overview

AVA's IVR (Interactive Voice Response) system provides a visual flowchart editor for routing incoming calls through a series of decision points and actions, ultimately connecting callers to AI agents (Workflows).

---

## Call Flow Architecture

```
Caller
  │
  ▼
┌─────────────────────────┐
│  Appel Entrant          │  (Start node - always present)
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Date / Hours Check     │  (Logic node - check working hours / holidays)
│  "We are open"          │
│  "We are closed"        │
└────────────┬────────────┘
             │
             │ (Open path)
             ▼
┌─────────────────────────┐
│  Language Selection SVI │  (Audio node - "Press 1 for English, Press 2 for French")
└────────────┬────────────┘
             │
       ┌─────┴─────┐
       ▼           ▼
   English       French
   Branch       Branch
       │           │
       ▼           ▼
┌─────────────────────────┐
│  Service SVI (EN)       │  (Audio node - "Press 1 for Services, Press 2 for Offers...")
└────────────┬────────────┘
             │
       ┌─────┴─────┐
       ▼           ▼
   Services     Offers
   Branch       Branch
       │           │
       ▼           ▼
┌─────────────────────────┐
│  Redirect to Agent      │  (Redirect node - routes to specific AI agent)
│  "Sophie"               │  "Karim"
└─────────────────────────┘
```

---

## Node Types

### 1. Primary Action Node (Terminal)
**Appearance:** Dark navy rounded capsule pill
**Purpose:** Start and end points of the flow

| Name | Label | Color |
|------|-------|-------|
| Incoming Call | "Appel entrant" | #1e293b |
| End Call | "Terminer l'appel" | #1e293b |

---

### 2. Logic/Decision Nodes
**Appearance:** White rounded rectangle with colored left border
**Purpose:** Decision points that split the flow

| Type | Label | Icon | Color | Description |
|------|-------|------|-------|-------------|
| `hours` | Hours | Clock | #f59e0b | Business hours check |
| `date` | Date | Calendar | #8b5cf6 | Holiday / special date check |

**Hours Node Branches:**
- Business Hours (based on schedule)
- All other times

**Date Node Branches:**
- Normal date
- No special date

---

### 3. Audio SVI Node (New)
**Appearance:** White rounded rectangle with teal/green left border
**Purpose:** Play an audio prompt and wait for DTMF input

| Type | Label | Icon | Color | Description |
|------|-------|------|-------|-------------|
| `svi_audio` | Audio SVI | Volume2 | #0d9488 | Play audio and collect DTMF |

**Fields:**
- `id: string` - Unique identifier
- `type: 'svi_audio'`
- `audioUrl: string` - URL or path to the audio file to play
- `language: string` - Language code (en, fr, nl, etc.)
- `timeout: number` - Seconds to wait for DTMF (default: 5)
- `branches: Branch[]` - DTMF options (e.g., [{"dtmf": "1", "label": "Services"}, {"dtmf": "2", "label": "Offers"}])
- `invalidMessage: string` - Audio message for invalid input
- `children: (string | null)[]` - Child node IDs per branch
- `next: string | null` - Fallback next node if no branch matches

**Branches (DTMF Options):**
- Label shown on the branch line (e.g., "Press 1", "Press 2")
- Each branch leads to a child node or redirect

---

### 4. Redirect Node (New)
**Appearance:** White rounded rectangle with purple/indigo left border
**Purpose:** Route the call to a specific AI agent (Workflow)

| Type | Label | Icon | Color | Description |
|------|-------|------|-------|-------------|
| `redirect` | Redirect | UserCheck | #7c3aed | Redirect to AI agent |

**Fields:**
- `id: string` - Unique identifier
- `type: 'redirect'`
- `agentId: string` - ID of the agent to redirect to
- `agentName: string` - Display name of the agent
- `inviteMessage: string` - Optional custom audio/prompt override
- `timeout: number` - Seconds to wait before fallback (default: 30)
- `fallbackNodeId: string | null` - Node to go to if agent unavailable

**Agent Data Source:**
- Agents are stored in the backend as Workflows
- Fetched from `/api/workflows` or `/api/agents`
- Each agent has: `id`, `name`, `provider`, `context`, `status`

---

### 5. DTMF Menu Node (Existing, Refined)
**Appearance:** White rounded rectangle with teal/green left border
**Purpose:** Simple DTMF menu without audio (inline prompt)

| Type | Label | Icon | Color | Description |
|------|-------|------|-------|-------------|
| `dtmf` | DTMF Menu | Key | #0d9488 | Touch-tone menu selection |

**Note:** This is a simpler version of `svi_audio` without audio playback. Use `svi_audio` when audio prompts are needed.

---

## Branch Labels (Condition Labels)

**Appearance:** Dark navy small rounded capsule placed on the vertical branch lines

| Branch | Label |
|--------|-------|
| Hours - Open | "Open" or schedule text |
| Hours - Closed | "Closed" |
| Date - Normal | "Normal date" |
| Date - Special | "Holiday" |
| DTMF 1 | "Press 1" or custom |
| DTMF 2 | "Press 2" or custom |
| Language - English | "English" or "EN" |
| Language - French | "French" or "FR" |
| Service | "Services" |
| Offers | "Offers" |

---

## Visual Design System

### Colors
| Element | Color | Usage |
|---------|-------|-------|
| Primary Navy | #1e293b | Capsules, condition labels |
| Teal | #0d9488 | Lines, connectors, DTMF nodes |
| Amber | #f59e0b | Hours node |
| Purple | #8b5cf6 | Date node |
| Indigo | #7c3aed | Redirect node |
| Background | #f1f5f9 | Canvas background |
| White | #ffffff | Node cards, panels |

### Canvas
- Light gray dotted grid background
- `radial-gradient(circle, #cbd5e1 1px, transparent 1px)` at 24px spacing

### Connectors
- Thin solid teal lines (#0d9488), 2px width
- White circular dots with black border at every entry/exit point
- All dots are **clickable** insertion points for adding new nodes

### Typography
- Font: Sans-serif (Inter or system font)
- Node title: 14px semibold
- Node subtitle: 11px regular
- Labels: 12px semibold

### Node Dimensions
- Width: 280px
- Corner radius: 16px (rounded-2xl)
- Icon container: 40x40px with 12px radius

---

## Data Structures

### IVRNode (Extended)
```typescript
type NodeType = 'hours' | 'date' | 'dtmf' | 'svi_audio' | 'redirect';

interface Branch {
  id: string;
  label: string;       // Display label on branch line
  dtmf?: string;       // DTMF digit (for svi_audio/dtmf)
  route?: string;      // Agent ID (for redirect)
}

interface IVRNode {
  id: string;
  type: NodeType;
  timezone?: string;
  schedule?: string;
  dateTimezone?: string;
  branches: Branch[];
  inviteMessage?: string;   // Audio URL or text
  inviteLanguage?: string;
  audioUrl?: string;       // For svi_audio
  agentId?: string;         // For redirect
  agentName?: string;       // For redirect display
  timeout?: number;
  children: (string | null)[];
  next: string | null;
}
```

### Agent / Workflow (from backend)
```typescript
interface Agent {
  id: string;
  name: string;
  provider: string;
  context: string;
  status: 'active' | 'inactive';
  // ... other fields from /api/workflows
}
```

---

## Implementation Phases

### Phase 1: Add svi_audio Node
- [ ] Add `svi_audio` to `NodeType`
- [ ] Add `svi_audio` to `NODE_META` with Volume2 icon
- [ ] Create `SVIPanel` config component with:
  - Audio URL input
  - Language selector
  - DTMF option builder (add/remove branches)
  - Timeout setting
- [ ] Update `getBranchLabels()` to handle svi_audio

### Phase 2: Add redirect Node
- [ ] Add `redirect` to `NodeType`
- [ ] Add `redirect` to `NODE_META` with UserCheck icon
- [ ] Create `RedirectPanel` config component with:
  - Agent selector (dropdown from API)
  - Custom message field
  - Timeout setting
  - Fallback node selector
- [ ] Fetch agents from `/api/workflows` or `/api/agents`

### Phase 3: Connect Branch Labels
- [ ] Update branch label display for svi_audio (show DTMF digit)
- [ ] Add ability to edit branch labels inline on canvas
- [ ] Support branch-specific custom labels

### Phase 4: Audio Player Preview
- [ ] Add play button in SVIPanel to preview audio
- [ ] Show audio waveform or duration

### Phase 5: Execution Engine (Backend)
- [ ] Add IVR execution logic to `engine.py`
- [ ] Implement audio playback via Asterisk
- [ ] Implement DTMF collection
- [ ] Implement redirect to agent via ARI

---

## Example Workflow Configuration

### Agents (Workflows)
```yaml
agents:
  - id: sophie-en-services
    name: Sophie (Services EN)
    provider: openai_realtime
    context: sales_en
    language: en

  - id: sophie-fr-services
    name: Sophie (Services FR)
    provider: openai_realtime
    context: sales_fr
    language: fr

  - id: karim-en-offers
    name: Karim (Offers EN)
    provider: openai_realtime
    context: offers_en
    language: en
```

### IVR Flow JSON
```json
{
  "flow": {
    "nodes": {
      "n1": {
        "id": "n1",
        "type": "date",
        "timezone": "Europe/Brussels",
        "children": ["n2", null]
      },
      "n2": {
        "id": "n2",
        "type": "svi_audio",
        "audioUrl": "/audio/welcome-en-fr.mp3",
        "language": "multi",
        "branches": [
          { "id": "b1", "label": "English", "dtmf": "1" },
          { "id": "b2", "label": "French", "dtmf": "2" }
        ],
        "children": ["n3", "n4"]
      },
      "n3": {
        "id": "n3",
        "type": "svi_audio",
        "audioUrl": "/audio/services-en.mp3",
        "branches": [
          { "id": "b3", "label": "Services", "dtmf": "1" },
          { "id": "b4", "label": "Offers", "dtmf": "2" }
        ],
        "children": ["n5", "n6"]
      },
      "n4": {
        "id": "n4",
        "type": "svi_audio",
        "audioUrl": "/audio/services-fr.mp3",
        "branches": [...],
        "children": ["n7", "n8"]
      },
      "n5": {
        "id": "n5",
        "type": "redirect",
        "agentId": "sophie-en-services",
        "agentName": "Sophie"
      },
      "n6": {
        "id": "n6",
        "type": "redirect",
        "agentId": "karim-en-offers",
        "agentName": "Karim"
      }
    },
    "rootHead": "n1"
  }
}
```

---

## Notes

- The IVR editor is purely visual — actual call execution happens in the `ai_engine` container via Asterisk ARI
- Audio files should be uploaded to a shared volume or fetched from a URL
- DTMF digits are collected using Asterisk's `Read()` application
- Redirect to agent uses Asterisk's `Stasis()` or transfer mechanisms
