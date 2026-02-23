# team&

**AI designs and runs its own team.** You give it a goal, configure the resources, and watch specialized agents think and collaborate in real-time on a visual canvas.

<!-- Test: This line was added as a demonstration of editing skills. -->

<img width="3358" height="1924" alt="image" src="https://github.com/user-attachments/assets/f8da3b3f-ccd4-416f-8edc-47c51a90d75a" />


---

## What is this?

team& is a live agent topology platform. Unlike workflow builders where *you* drag nodes around, here **the AI architects its own team** — deciding what agents it needs, giving them personalities, skills, values, and rules, then executing them with real tools like web search and code execution.

You control the *environment* (what resources are available). The AI controls the *team design*.

### Key Ideas

- **Environment Bucket** — A palette of reusable resources (rules, skills, values, tools) that you pre-configure. The AI can only use what's in the bucket.
- **Design then Run** — Team design and execution are separate steps. Design the team, edit it, drag-drop resources onto agents, *then* run with a specific prompt.
- **Structured Skills** — Skills aren't just labels. They're full markdown methodology files that get injected into agent system prompts.
- **Real Tools** — Agents can use Claude's built-in web search and code execution, not just conceptual tool names.
- **Parallel Execution** — Agents without dependencies run simultaneously. Events stream in real-time from all concurrent agents.

---

## Screenshots

### Canvas with Agent Topology
The main workspace. Agents appear as nodes with their assigned resources visible. Edges show dependencies. Active agents glow, completed agents turn green.

<img width="3360" height="1926" alt="image" src="https://github.com/user-attachments/assets/618c85a6-d569-4db1-89c8-df2fe42a47e4" />

### Environment Bucket
Pre-configure rules, skills, values, and tools. AI generators can create these for you. Drag items from the bucket onto agent nodes.

<img width="3360" height="1928" alt="image" src="https://github.com/user-attachments/assets/3860c92d-5313-4be3-b22f-cc7e4dc71a03" />

### Chat Panel — Design & Run
Multi-turn chat for designing teams and editing configs. Separate "Edit Config" and "Run Agents" buttons. Type a prompt to run agents with specific instructions.

<img width="3360" height="1920" alt="image" src="https://github.com/user-attachments/assets/83df6d16-1912-4d29-a3e5-0207d3d929cc" />

### Agent Detail Panel
Click any agent node to see its full config, streaming thought traces, and markdown-rendered output. Edit skills/values/rules/tools in-place.

<img width="702" height="1116" alt="image" src="https://github.com/user-attachments/assets/a6219a9a-9262-489e-8e9a-1bc164c6b0b9" />

### Thinking Indicators
Watch agents think in real-time. Collapsible thinking traces show the reasoning process. Bouncing dots indicate active work.

<img width="620" height="490" alt="image" src="https://github.com/user-attachments/assets/c839fd6b-e876-4922-81ea-8ae42a9d63b3" />

### AI-Powered Skill Generation
Describe what you need and the AI generates structured skill definitions with methodology, principles, and pitfalls.

<img width="640" height="296" alt="image" src="https://github.com/user-attachments/assets/88af07c4-c4f6-4291-84ad-ae8142f483bf" />


### Environment Switcher
Multiple environments with their own buckets, configs, and run history. Save team designs as named configs. Replay past runs.

<img width="950" height="750" alt="image" src="https://github.com/user-attachments/assets/4be65cb5-452f-4baa-a807-2605935a8eeb" />

### Parallel Execution
Agents without dependencies run simultaneously. Both show loading states and stream output independently.

<img width="3332" height="1814" alt="image" src="https://github.com/user-attachments/assets/f59a66ab-d5ed-4e2b-a8c5-150404135bd6" />

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Frontend                          │
│  Next.js 16 + React 19 + Tailwind v4 + shadcn/ui        │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  Canvas   │  │  Chat    │  │  Bucket  │  │  Env    │ │
│  │  (React   │  │  Panel   │  │  Panel   │  │  Switch │ │
│  │   Flow)   │  │          │  │          │  │         │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│       │              │              │             │       │
│  useOrchestrate  useReplay    useBucket   useEnvironments │
└───────┬──────────────┬──────────────┬────────────┬───────┘
        │              │              │            │
   SSE Stream      Fetch Events   CRUD API    CRUD API
        │              │              │            │
┌───────┴──────────────┴──────────────┴────────────┴───────┐
│                      API Routes                           │
│                                                           │
│  POST /api/orchestrate     ← design | edit | execute      │
│  GET  /api/environments    ← list / create / delete       │
│  GET  /api/environments/[id]/configs  ← save / load       │
│  GET  /api/environments/[id]/bucket   ← scoped resources  │
│  GET  /api/configs/[id]/runs          ← run history       │
│  GET  /api/runs/[id]/events           ← replay            │
│  POST /api/bucket/generate            ← AI creation       │
│  POST /api/bucket/search              ← cross-env search  │
└───────┬───────────────────────────────────────────────────┘
        │
┌───────┴───────────────────────────────────────────────────┐
│                     Orchestrator                           │
│                                                            │
│  designTeam()    ← Claude + get_available_resources tool   │
│  editSpec()      ← Claude edits existing spec              │
│  executeAgents() ← Parallel levels, real tools, skills     │
│                                                            │
│  ┌─────────────────────────────────────────────┐           │
│  │  Claude API (Sonnet 4)                      │           │
│  │  - Extended thinking (streaming)            │           │
│  │  - Tool use (get_available_resources)       │           │
│  │  - Server tools (web_search, code_exec)     │           │
│  └─────────────────────────────────────────────┘           │
└───────┬────────────────────────────────────────────────────┘
        │
┌───────┴────────────────────────────────────────────────────┐
│                   Supabase (Local)                          │
│                                                             │
│  environments  ──<  configs  ──<  runs  ──<  events         │
│       │                                                     │
│  bucket_items (scoped to environment)                       │
└─────────────────────────────────────────────────────────────┘
```

## Data Model

```
Environment
├── name
├── Bucket Items (rules, skills, values, tools)
│   └── Skills have full .md content
├── Configs (saved EnvironmentSpecs)
│   ├── name
│   ├── spec (JSON: agents, rules, objective)
│   └── Runs (executions)
│       ├── prompt
│       ├── status (running | complete | stopped)
│       └── Events (SSE stream log)
```

---

## How It Works

### 1. Configure the Environment
Create an environment. Add resources to the bucket:
- **Rules** — constraints agents must follow ("cite sources", "be concise")
- **Skills** — structured .md methodology files injected into agent prompts
- **Values** — principles that guide agent behavior ("accuracy over speed")
- **Tools** — real executable tools (web_search, code_execution auto-seeded)

### 2. Design the Team
Describe your task in the chat. The AI planner calls `get_available_resources` to see your bucket, then designs a team using *only* those resources. A post-processing allowlist filter ensures 100% compliance.

### 3. Edit the Config
Send follow-up messages to modify the team. Add/remove agents, change dependencies, redistribute resources. Or drag bucket items directly onto agent nodes on the canvas.

### 4. Run with a Prompt
Click "Run Agents" with an optional prompt. Agents execute in parallel where possible (dagre layout handles visual positioning). Watch thinking traces stream, tool calls fire, and output render as markdown.

### 5. Save and Replay
Save configs for reuse. Each run is recorded with all events. Replay past runs with batch-processed event playback.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Canvas | React Flow (@xyflow/react) + dagre layout |
| AI | Claude Sonnet 4 via @anthropic-ai/sdk |
| AI Features | Extended thinking, tool use, web search, code execution |
| Database | Supabase (local) -- PostgreSQL |
| Streaming | Server-Sent Events (SSE) |
| Runtime | Bun |
| Theme | next-themes (light/dark) |

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) installed
- [Docker](https://docker.com) running (for Supabase)
- Anthropic API key

### Setup

```bash
# Install dependencies
bun install

# Start Supabase locally
bunx supabase start

# Create .env.local with your keys
# ANTHROPIC_API_KEY=sk-ant-...
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>

# Apply migrations
bunx supabase db reset

# Start dev server
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
app/
  api/
    orchestrate/        ← Design, edit, execute (SSE)
    environments/       ← CRUD for environments
    bucket/             ← CRUD + generate + search
    configs/            ← Run history per config
    runs/               ← Event replay
  page.tsx              ← Main canvas page
  layout.tsx            ← Root layout with providers

components/
  agent-canvas.tsx      ← React Flow canvas with dagre layout
  agent-node.tsx        ← Custom node with resource badges + drop target
  agent-detail.tsx      ← Editable detail panel with 
...[truncated]