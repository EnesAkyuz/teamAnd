# AgentScope — Live Agent Topology Canvas

## Pitch

"You give it a goal. It builds its own team — with skills, values, and rules — and you watch them think and collaborate live."

## What This Is NOT

This is NOT another n8n/Flowise where a human drags nodes around to build a workflow. Here, **the AI designs its own team**. The user provides a goal, the AI decides what agents it needs, gives them personalities/skills/values/rules, and the user watches the collaboration unfold in real-time on a visual canvas.

## Architecture

```
Frontend (Next.js + React Flow)
  ├── Task Input Panel (left)
  ├── Live Topology Canvas (center) — React Flow
  ├── Agent Detail Panel (right) — thought traces, output stream
  └── Event Log (bottom)

API Route (/api/orchestrate)
  ├── Step 1: Call Claude → get environment spec (JSON)
  ├── Step 2: Execute agents sequentially/parallel per dependsOn
  ├── Step 3: Stream events via SSE to frontend
  └── Step 4: Write events to Supabase (local) for replay

Database (Supabase Local)
  ├── sessions: id, task, environment_spec (jsonb), created_at
  └── events: id, session_id (FK), timestamp, event_type, agent_id, payload (jsonb)
```

## Environment Spec (AI-Generated)

```json
{
  "environment": {
    "name": "Landing Page Builder",
    "objective": "Build a landing page for a SaaS product",
    "agents": [
      {
        "id": "researcher",
        "role": "Market Researcher",
        "personality": "Thorough, data-driven, skeptical",
        "skills": ["competitive analysis", "data synthesis"],
        "values": ["accuracy over speed", "evidence-based"],
        "tools": ["web_search", "summarize"],
        "rules": ["Always cite sources", "Flag uncertainties"],
        "memory": [],
        "dependsOn": []
      }
    ],
    "rules": ["Use a single-page layout"]
  }
}
```

## SSE Event Types

```typescript
type AgentEvent =
  | { type: 'env_created'; spec: EnvironmentSpec }
  | { type: 'agent_spawned'; agent: AgentSpec }
  | { type: 'thinking'; agentId: string; content: string }
  | { type: 'output'; agentId: string; content: string }
  | { type: 'tool_call'; agentId: string; tool: string; input: any }
  | { type: 'message'; from: string; to: string; summary: string }
  | { type: 'agent_complete'; agentId: string; result: string }
  | { type: 'environment_complete'; summary: string }
```

## UI Layout

```
┌────────┬──────────────────────────────┬──────────────┐
│ Task   │     React Flow Canvas        │  Agent Detail │
│ Input  │                              │  (click node) │
│        │    ○ Planner                 │              │
│ Env    │     ├── ○ Researcher ←glow   │  Thinking:   │
│ Config │     ├── ○ Copywriter         │  streaming...│
│        │     └── ○ Designer           │              │
│ Rules  │                              │  Output:     │
│ • ...  │    edges animate             │  streaming...│
├────────┴──────────────────────────────┴──────────────┤
│  Event Log: [Researcher] Analyzing competitors...    │
└──────────────────────────────────────────────────────┘
```

## Replay System

- All SSE events written to Supabase with timestamps during live execution
- Replay mode reads events from DB, fires them at original timing (or sped up)
- Canvas animates identically to live run
- Browse past sessions from a session list

## Tech Stack

- Next.js 16, React 19, Tailwind v4, shadcn/ui
- React Flow for the canvas
- Claude API (Anthropic SDK) with streaming + extended thinking
- Supabase (local) for session/event persistence
- SSE for real-time frontend updates
- Bun as runtime

## Scope (Under 6 Hours)

### Core (hours 0-3.5)
- Three-panel layout with React Flow
- Claude API call to generate environment spec
- Render topology from spec with animated node states
- Sequential agent execution with SSE streaming
- Event log

### Polish (hours 3.5-5)
- Thought trace panel (extended thinking stream)
- Record events to Supabase
- Replay mode

### Final (hours 5-6)
- Visual polish (animations, colors, transitions)
- 2-3 demo tasks with interesting topologies
- End-to-end testing
