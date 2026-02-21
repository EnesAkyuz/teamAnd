# AgentScope Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a live agent topology canvas where the AI designs its own team (with skills, values, rules, memory) and users watch them think and collaborate in real-time.

**Architecture:** Next.js app with three-panel layout. API route calls Claude to generate an environment spec, then executes each agent sequentially (respecting dependencies) streaming SSE events. React Flow renders the topology live. Supabase (local) stores sessions for replay.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, shadcn/ui, React Flow, @anthropic-ai/sdk, Supabase (local), SSE, Bun

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install runtime deps**

Run:
```bash
cd /Users/eakyuz/humansand && bun add @anthropic-ai/sdk @xyflow/react @supabase/supabase-js
```

**Step 2: Verify install**

Run: `cd /Users/eakyuz/humansand && bun run build`
Expected: Build succeeds

---

### Task 2: Define Types and Environment Spec Schema

**Files:**
- Create: `lib/types.ts`

**Step 1: Create the shared types file**

```typescript
// lib/types.ts

export interface AgentSpec {
  id: string;
  role: string;
  personality: string;
  skills: string[];
  values: string[];
  tools: string[];
  rules: string[];
  memory: string[];
  dependsOn: string[];
}

export interface EnvironmentSpec {
  name: string;
  objective: string;
  agents: AgentSpec[];
  rules: string[];
}

export type AgentEvent =
  | { type: "env_created"; spec: EnvironmentSpec; timestamp: number }
  | { type: "agent_spawned"; agent: AgentSpec; timestamp: number }
  | { type: "thinking"; agentId: string; content: string; timestamp: number }
  | { type: "output"; agentId: string; content: string; timestamp: number }
  | { type: "tool_call"; agentId: string; tool: string; input: string; timestamp: number }
  | { type: "message"; from: string; to: string; summary: string; timestamp: number }
  | { type: "agent_complete"; agentId: string; result: string; timestamp: number }
  | { type: "environment_complete"; summary: string; timestamp: number };

export type AgentStatus = "pending" | "active" | "complete";

export interface AgentNode {
  spec: AgentSpec;
  status: AgentStatus;
  thinking: string;
  output: string;
}

export interface Session {
  id: string;
  task: string;
  environmentSpec: EnvironmentSpec | null;
  events: AgentEvent[];
  createdAt: string;
}
```

---

### Task 3: Supabase Local Setup

**Step 1: Initialize Supabase in project**

Run:
```bash
cd /Users/eakyuz/humansand && bunx supabase init
```

**Step 2: Start Supabase locally**

Run:
```bash
cd /Users/eakyuz/humansand && bunx supabase start
```

Note the `API URL` and `anon key` from the output.

**Step 3: Create migration for sessions and events tables**

Create file: `supabase/migrations/001_create_tables.sql`

```sql
create table sessions (
  id uuid primary key default gen_random_uuid(),
  task text not null,
  environment_spec jsonb,
  created_at timestamptz default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  timestamp_ms bigint not null,
  event_type text not null,
  agent_id text,
  payload jsonb not null,
  created_at timestamptz default now()
);

create index idx_events_session on events(session_id, timestamp_ms);
```

**Step 4: Apply migration**

Run:
```bash
cd /Users/eakyuz/humansand && bunx supabase db reset
```

**Step 5: Create env file**

Create: `.env.local`

```
ANTHROPIC_API_KEY=<user's key>
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
```

**Step 6: Create Supabase client**

Create: `lib/supabase.ts`

```typescript
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

---

### Task 4: Claude Orchestration Engine (API Route)

**Files:**
- Create: `app/api/orchestrate/route.ts`
- Create: `lib/orchestrator.ts`

**Step 1: Create the orchestrator logic**

`lib/orchestrator.ts` handles:
1. Calling Claude with the user's task to generate an EnvironmentSpec (JSON)
2. For each agent (in dependency order), calling Claude with the agent's system prompt (built from its personality/skills/values/rules/memory) and streaming thinking + output
3. Passing the output of completed agents to dependent agents as context
4. Emitting AgentEvent objects for each step

Key implementation details:
- Use `@anthropic-ai/sdk` with `stream: true`
- Use extended thinking (`thinking: { type: "enabled", budget_tokens: 5000 }`) for thought traces
- The planner prompt asks Claude to return a JSON EnvironmentSpec
- Each agent's system prompt injects: role, personality, skills, values, tools, rules, memory, plus context from upstream agents

```typescript
// lib/orchestrator.ts
import Anthropic from "@anthropic-ai/sdk";
import type { AgentEvent, AgentSpec, EnvironmentSpec } from "./types";

const client = new Anthropic();

const PLANNER_PROMPT = `You are an AI team architect. Given a task, design a team of specialized AI agents to accomplish it.

Return ONLY valid JSON matching this schema:
{
  "name": "environment name",
  "objective": "the goal",
  "agents": [
    {
      "id": "unique_snake_case_id",
      "role": "Agent Role Title",
      "personality": "2-3 personality traits",
      "skills": ["skill1", "skill2"],
      "values": ["value1", "value2"],
      "tools": ["tool1", "tool2"],
      "rules": ["rule1", "rule2"],
      "memory": [],
      "dependsOn": ["other_agent_id or empty"]
    }
  ],
  "rules": ["global rule 1"]
}

Design 2-4 agents. Make them diverse and specialized. Each agent should have a clear, distinct role. Use dependsOn to create a logical workflow — some agents need output from others. Tools are conceptual (e.g., "web_search", "code_generation", "analysis", "writing").`;

export async function* orchestrate(
  task: string,
): AsyncGenerator<AgentEvent> {
  // Step 1: Generate environment spec
  const planResponse = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: PLANNER_PROMPT,
    messages: [{ role: "user", content: task }],
  });

  const specText = planResponse.content[0].type === "text"
    ? planResponse.content[0].text
    : "";
  const spec: EnvironmentSpec = JSON.parse(specText);

  yield { type: "env_created", spec, timestamp: Date.now() };

  // Step 2: Execute agents in dependency order
  const completed: Record<string, string> = {};
  const agentOrder = topologicalSort(spec.agents);

  for (const agent of agentOrder) {
    yield { type: "agent_spawned", agent, timestamp: Date.now() };

    // Build context from upstream agents
    const upstreamContext = agent.dependsOn
      .filter((id) => completed[id])
      .map((id) => {
        const upstream = spec.agents.find((a) => a.id === id);
        return `[${upstream?.role ?? id}]: ${completed[id]}`;
      })
      .join("\n\n");

    const systemPrompt = buildAgentPrompt(agent, spec.rules, upstreamContext);

    // Stream the agent's response with extended thinking
    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      thinking: { type: "enabled", budget_tokens: 5000 },
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Task: ${spec.objective}\n\nYour specific role: ${agent.role}\nYour goal: Execute your responsibilities for this task.\n${upstreamContext ? `\nContext from team members:\n${upstreamContext}` : ""}`,
        },
      ],
    });

    let fullOutput = "";
    let fullThinking = "";

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "thinking_delta") {
          fullThinking += event.delta.thinking;
          yield {
            type: "thinking",
            agentId: agent.id,
            content: event.delta.thinking,
            timestamp: Date.now(),
          };
        } else if (event.delta.type === "text_delta") {
          fullOutput += event.delta.text;
          yield {
            type: "output",
            agentId: agent.id,
            content: event.delta.text,
            timestamp: Date.now(),
          };
        }
      }
    }

    completed[agent.id] = fullOutput;

    // Emit messages to dependent agents
    for (const other of spec.agents) {
      if (other.dependsOn.includes(agent.id)) {
        yield {
          type: "message",
          from: agent.id,
          to: other.id,
          summary: fullOutput.slice(0, 150) + (fullOutput.length > 150 ? "..." : ""),
          timestamp: Date.now(),
        };
      }
    }

    yield {
      type: "agent_complete",
      agentId: agent.id,
      result: fullOutput,
      timestamp: Date.now(),
    };
  }

  yield {
    type: "environment_complete",
    summary: "All agents completed their tasks.",
    timestamp: Date.now(),
  };
}

function buildAgentPrompt(
  agent: AgentSpec,
  globalRules: string[],
  upstreamContext: string,
): string {
  return `You are ${agent.role}.

Personality: ${agent.personality}
Skills: ${agent.skills.join(", ")}
Values: ${agent.values.join(", ")}
Available Tools: ${agent.tools.join(", ")}

Rules you MUST follow:
${[...agent.rules, ...globalRules].map((r) => `- ${r}`).join("\n")}

${agent.memory.length > 0 ? `Memory/Context:\n${agent.memory.join("\n")}` : ""}

You are part of a team. Stay focused on YOUR role. Be concise but thorough. Output your work directly.`;
}

function topologicalSort(agents: AgentSpec[]): AgentSpec[] {
  const sorted: AgentSpec[] = [];
  const visited = new Set<string>();

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const agent = agents.find((a) => a.id === id);
    if (!agent) return;
    for (const dep of agent.dependsOn) {
      visit(dep);
    }
    sorted.push(agent);
  }

  for (const agent of agents) {
    visit(agent.id);
  }

  return sorted;
}
```

**Step 2: Create the API route with SSE**

`app/api/orchestrate/route.ts`:

```typescript
import { orchestrate } from "@/lib/orchestrator";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { task } = await request.json();

  // Create session in Supabase
  const { data: session } = await supabase
    .from("sessions")
    .insert({ task })
    .select("id")
    .single();

  const sessionId = session?.id;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of orchestrate(task)) {
          // Write to Supabase
          if (sessionId) {
            await supabase.from("events").insert({
              session_id: sessionId,
              timestamp_ms: event.timestamp,
              event_type: event.type,
              agent_id: "agentId" in event ? event.agentId : null,
              payload: event,
            });
          }

          // Update session spec when env is created
          if (event.type === "env_created" && sessionId) {
            await supabase
              .from("sessions")
              .update({ environment_spec: event.spec })
              .eq("id", sessionId);
          }

          // Send SSE
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      } catch (error) {
        const errEvent = `data: ${JSON.stringify({ type: "error", message: String(error) })}\n\n`;
        controller.enqueue(encoder.encode(errEvent));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

---

### Task 5: Replay API Route

**Files:**
- Create: `app/api/sessions/route.ts`
- Create: `app/api/sessions/[id]/events/route.ts`

**Step 1: Sessions list endpoint**

`app/api/sessions/route.ts`:

```typescript
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabase
    .from("sessions")
    .select("id, task, environment_spec, created_at")
    .order("created_at", { ascending: false });

  return Response.json(data ?? []);
}
```

**Step 2: Session events endpoint for replay**

`app/api/sessions/[id]/events/route.ts`:

```typescript
import { supabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { data } = await supabase
    .from("events")
    .select("payload, timestamp_ms")
    .eq("session_id", id)
    .order("timestamp_ms", { ascending: true });

  return Response.json(data ?? []);
}
```

---

### Task 6: React Flow Canvas Component

**Files:**
- Create: `components/agent-canvas.tsx`

This is the core visual component. It renders:
- Agent nodes that appear when `agent_spawned` fires
- Edges between agents based on `dependsOn`
- Node states: pending (dim), active (glowing pulse), complete (checkmark)
- Animated edges when messages flow

Key implementation:
- Use `@xyflow/react` with custom node component
- Custom node shows: role name, status icon, personality snippet, tool badges
- Glow effect via CSS animation on active nodes
- Dagre or manual layout for positioning nodes in a tree

```typescript
// components/agent-canvas.tsx
"use client";

import {
  ReactFlow,
  type Node,
  type Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo } from "react";
import type { AgentSpec, AgentStatus } from "@/lib/types";
import { AgentNodeComponent } from "./agent-node";

interface AgentCanvasProps {
  agents: Map<string, { spec: AgentSpec; status: AgentStatus; thinking: string; output: string }>;
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
}

const nodeTypes = { agent: AgentNodeComponent };

export function AgentCanvas({ agents, selectedAgentId, onSelectAgent }: AgentCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const agentArray = Array.from(agents.entries());
    const SPACING_X = 300;
    const SPACING_Y = 200;

    // Simple layout: group by dependency depth
    const depths: Record<string, number> = {};
    function getDepth(id: string): number {
      if (depths[id] !== undefined) return depths[id];
      const agent = agents.get(id);
      if (!agent || agent.spec.dependsOn.length === 0) {
        depths[id] = 0;
        return 0;
      }
      depths[id] = 1 + Math.max(...agent.spec.dependsOn.map(getDepth));
      return depths[id];
    }
    for (const [id] of agentArray) getDepth(id);

    // Group by depth for column layout
    const byDepth: Record<number, string[]> = {};
    for (const [id] of agentArray) {
      const d = depths[id] ?? 0;
      if (!byDepth[d]) byDepth[d] = [];
      byDepth[d].push(id);
    }

    const newNodes: Node[] = agentArray.map(([id, data]) => {
      const depth = depths[id] ?? 0;
      const col = byDepth[depth] ?? [];
      const idx = col.indexOf(id);
      const colHeight = col.length * SPACING_Y;
      return {
        id,
        type: "agent",
        position: {
          x: depth * SPACING_X + 50,
          y: idx * SPACING_Y - colHeight / 2 + SPACING_Y / 2 + 200,
        },
        data: {
          ...data,
          selected: id === selectedAgentId,
        },
      };
    });

    const newEdges: Edge[] = [];
    for (const [id, data] of agentArray) {
      for (const dep of data.spec.dependsOn) {
        newEdges.push({
          id: `${dep}-${id}`,
          source: dep,
          target: id,
          animated: data.status === "active",
          style: {
            stroke: data.status === "active" ? "#818cf8" : "#334155",
            strokeWidth: 2,
          },
        });
      }
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [agents, selectedAgentId, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectAgent(node.id === selectedAgentId ? null : node.id);
    },
    [selectedAgentId, onSelectAgent],
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={20} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

---

### Task 7: Custom Agent Node Component

**Files:**
- Create: `components/agent-node.tsx`

The custom node that renders inside React Flow. Shows:
- Role name as title
- Status indicator (spinner for active, checkmark for complete, circle for pending)
- Personality as subtitle
- Tool badges
- Glow animation when active

```typescript
// components/agent-node.tsx
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Loader2, CheckCircle2, Circle } from "lucide-react";
import type { AgentSpec, AgentStatus } from "@/lib/types";

interface AgentNodeData {
  spec: AgentSpec;
  status: AgentStatus;
  thinking: string;
  output: string;
  selected: boolean;
  [key: string]: unknown;
}

export function AgentNodeComponent({ data }: NodeProps) {
  const { spec, status, selected } = data as unknown as AgentNodeData;

  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-indigo-400" />
      <div
        className={`
          min-w-[220px] rounded-xl border p-4 backdrop-blur-sm transition-all duration-300
          ${status === "active"
            ? "animate-pulse border-indigo-400/60 bg-indigo-950/80 shadow-[0_0_30px_rgba(99,102,241,0.3)]"
            : status === "complete"
              ? "border-emerald-500/40 bg-emerald-950/60"
              : "border-slate-600/40 bg-slate-900/80"
          }
          ${selected ? "ring-2 ring-indigo-400" : ""}
        `}
      >
        <div className="flex items-center gap-2">
          {status === "active" && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />}
          {status === "complete" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          {status === "pending" && <Circle className="h-4 w-4 text-slate-500" />}
          <span className="text-sm font-semibold text-slate-100">{spec.role}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">{spec.personality}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {spec.tools.map((tool) => (
            <span
              key={tool}
              className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] text-slate-300"
            >
              {tool}
            </span>
          ))}
        </div>
        {spec.skills.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {spec.skills.slice(0, 3).map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-indigo-900/40 px-2 py-0.5 text-[10px] text-indigo-300"
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-indigo-400" />
    </>
  );
}
```

---

### Task 8: Agent Detail Panel (Thought Traces)

**Files:**
- Create: `components/agent-detail.tsx`

Right-side panel that shows the selected agent's:
- Full config (skills, values, rules)
- Streaming thought trace
- Streaming output
- Status

```typescript
// components/agent-detail.tsx
"use client";

import { Brain, MessageSquare, Shield, Sparkles, Star } from "lucide-react";
import type { AgentSpec, AgentStatus } from "@/lib/types";

interface AgentDetailProps {
  spec: AgentSpec;
  status: AgentStatus;
  thinking: string;
  output: string;
}

export function AgentDetail({ spec, status, thinking, output }: AgentDetailProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-700/50 p-4">
        <h2 className="text-lg font-semibold text-slate-100">{spec.role}</h2>
        <p className="text-sm text-slate-400">{spec.personality}</p>
      </div>

      {/* Config badges */}
      <div className="space-y-3 border-b border-slate-700/50 p-4">
        {spec.values.length > 0 && (
          <div className="flex items-start gap-2">
            <Star className="mt-0.5 h-3.5 w-3.5 text-amber-400" />
            <div className="flex flex-wrap gap-1">
              {spec.values.map((v) => (
                <span key={v} className="rounded bg-amber-900/30 px-1.5 py-0.5 text-[10px] text-amber-300">
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}
        {spec.skills.length > 0 && (
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 text-indigo-400" />
            <div className="flex flex-wrap gap-1">
              {spec.skills.map((s) => (
                <span key={s} className="rounded bg-indigo-900/30 px-1.5 py-0.5 text-[10px] text-indigo-300">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {spec.rules.length > 0 && (
          <div className="flex items-start gap-2">
            <Shield className="mt-0.5 h-3.5 w-3.5 text-rose-400" />
            <div className="flex flex-wrap gap-1">
              {spec.rules.map((r) => (
                <span key={r} className="rounded bg-rose-900/30 px-1.5 py-0.5 text-[10px] text-rose-300">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Thought trace */}
      <div className="flex-1 overflow-y-auto">
        {thinking && (
          <div className="border-b border-slate-700/50 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-purple-400">
              <Brain className="h-3.5 w-3.5" />
              Thinking
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-purple-300/80">
              {thinking}
            </pre>
          </div>
        )}

        {output && (
          <div className="p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-400">
              <MessageSquare className="h-3.5 w-3.5" />
              Output
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-300">
              {output}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Task 9: Event Log Component

**Files:**
- Create: `components/event-log.tsx`

Bottom panel showing a scrolling feed of events.

```typescript
// components/event-log.tsx
"use client";

import { useEffect, useRef } from "react";
import type { AgentEvent } from "@/lib/types";

interface EventLogProps {
  events: AgentEvent[];
}

function formatEvent(event: AgentEvent): string | null {
  switch (event.type) {
    case "env_created":
      return `Environment "${event.spec.name}" created with ${event.spec.agents.length} agents`;
    case "agent_spawned":
      return `[${event.agent.role}] Spawned — ${event.agent.personality}`;
    case "thinking":
      return null; // Don't show individual thinking chunks in log
    case "output":
      return null; // Don't show individual output chunks in log
    case "tool_call":
      return `[${event.agentId}] Using tool: ${event.tool}`;
    case "message":
      return `${event.from} → ${event.to}: ${event.summary}`;
    case "agent_complete":
      return `[${event.agentId}] Completed`;
    case "environment_complete":
      return `All agents finished. ${event.summary}`;
    default:
      return null;
  }
}

export function EventLog({ events }: EventLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const displayEvents = events.filter((e) => formatEvent(e) !== null);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-2 font-mono text-xs">
      {displayEvents.map((event, i) => (
        <div key={i} className="flex gap-2 py-0.5">
          <span className="text-slate-600">
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
          <span className={
            event.type === "environment_complete"
              ? "text-emerald-400"
              : event.type === "agent_spawned"
                ? "text-indigo-400"
                : "text-slate-400"
          }>
            {formatEvent(event)}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

---

### Task 10: Main Page — Three Panel Layout + Orchestration Hook

**Files:**
- Modify: `app/page.tsx`
- Create: `hooks/use-orchestrate.ts`

**Step 1: Create the orchestration hook**

`hooks/use-orchestrate.ts` — manages SSE connection, parses events, updates state:

```typescript
// hooks/use-orchestrate.ts
"use client";

import { useState, useCallback, useRef } from "react";
import type { AgentEvent, AgentSpec, AgentStatus, EnvironmentSpec } from "@/lib/types";

interface AgentState {
  spec: AgentSpec;
  status: AgentStatus;
  thinking: string;
  output: string;
}

export function useOrchestrate() {
  const [agents, setAgents] = useState<Map<string, AgentState>>(new Map());
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [envSpec, setEnvSpec] = useState<EnvironmentSpec | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (task: string) => {
    setAgents(new Map());
    setEvents([]);
    setEnvSpec(null);
    setIsRunning(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const response = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
        signal: abort.signal,
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6);
          if (!json) continue;

          try {
            const event: AgentEvent = JSON.parse(json);
            setEvents((prev) => [...prev, event]);

            switch (event.type) {
              case "env_created":
                setEnvSpec(event.spec);
                setAgents(new Map(
                  event.spec.agents.map((a) => [
                    a.id,
                    { spec: a, status: "pending" as AgentStatus, thinking: "", output: "" },
                  ]),
                ));
                break;
              case "agent_spawned":
                setAgents((prev) => {
                  const next = new Map(prev);
                  const existing = next.get(event.agent.id);
                  if (existing) {
                    next.set(event.agent.id, { ...existing, status: "active" });
                  }
                  return next;
                });
                break;
              case "thinking":
                setAgents((prev) => {
                  const next = new Map(prev);
                  const existing = next.get(event.agentId);
                  if (existing) {
                    next.set(event.agentId, {
                      ...existing,
                      thinking: existing.thinking + event.content,
                    });
                  }
                  return next;
                });
                break;
              case "output":
                setAgents((prev) => {
                  const next = new Map(prev);
                  const existing = next.get(event.agentId);
                  if (existing) {
                    next.set(event.agentId, {
                      ...existing,
                      output: existing.output + event.content,
                    });
                  }
                  return next;
                });
                break;
              case "agent_complete":
                setAgents((prev) => {
                  const next = new Map(prev);
                  const existing = next.get(event.agentId);
                  if (existing) {
                    next.set(event.agentId, { ...existing, status: "complete" });
                  }
                  return next;
                });
                break;
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Orchestration error:", err);
      }
    } finally {
      setIsRunning(false);
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  return { agents, events, envSpec, isRunning, start, stop };
}
```

**Step 2: Create the replay hook**

`hooks/use-replay.ts`:

```typescript
// hooks/use-replay.ts
"use client";

import { useState, useCallback, useRef } from "react";
import type { AgentEvent, AgentSpec, AgentStatus, EnvironmentSpec } from "@/lib/types";

interface AgentState {
  spec: AgentSpec;
  status: AgentStatus;
  thinking: string;
  output: string;
}

export function useReplay() {
  const [agents, setAgents] = useState<Map<string, AgentState>>(new Map());
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [envSpec, setEnvSpec] = useState<EnvironmentSpec | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const replay = useCallback(async (sessionId: string, speed = 1) => {
    // Clear previous
    setAgents(new Map());
    setEvents([]);
    setEnvSpec(null);
    setIsReplaying(true);
    for (const t of timeoutsRef.current) clearTimeout(t);
    timeoutsRef.current = [];

    const res = await fetch(`/api/sessions/${sessionId}/events`);
    const rawEvents: Array<{ payload: AgentEvent; timestamp_ms: number }> = await res.json();

    if (rawEvents.length === 0) {
      setIsReplaying(false);
      return;
    }

    const baseTime = rawEvents[0].timestamp_ms;

    for (const { payload: event, timestamp_ms } of rawEvents) {
      const delay = (timestamp_ms - baseTime) / speed;
      const timeout = setTimeout(() => {
        setEvents((prev) => [...prev, event]);

        // Same event processing as useOrchestrate
        switch (event.type) {
          case "env_created":
            setEnvSpec(event.spec);
            setAgents(new Map(
              event.spec.agents.map((a) => [
                a.id,
                { spec: a, status: "pending" as AgentStatus, thinking: "", output: "" },
              ]),
            ));
            break;
          case "agent_spawned":
            setAgents((prev) => {
              const next = new Map(prev);
              const existing = next.get(event.agent.id);
              if (existing) next.set(event.agent.id, { ...existing, status: "active" });
              return next;
            });
            break;
          case "thinking":
            setAgents((prev) => {
              const next = new Map(prev);
              const existing = next.get(event.agentId);
              if (existing) next.set(event.agentId, { ...existing, thinking: existing.thinking + event.content });
              return next;
            });
            break;
          case "output":
            setAgents((prev) => {
              const next = new Map(prev);
              const existing = next.get(event.agentId);
              if (existing) next.set(event.agentId, { ...existing, output: existing.output + event.content });
              return next;
            });
            break;
          case "agent_complete":
            setAgents((prev) => {
              const next = new Map(prev);
              const existing = next.get(event.agentId);
              if (existing) next.set(event.agentId, { ...existing, status: "complete" });
              return next;
            });
            break;
        }
      }, delay);
      timeoutsRef.current.push(timeout);
    }

    // Set isReplaying to false after last event
    const lastDelay = (rawEvents[rawEvents.length - 1].timestamp_ms - baseTime) / speed;
    timeoutsRef.current.push(
      setTimeout(() => setIsReplaying(false), lastDelay + 100),
    );
  }, []);

  const stopReplay = useCallback(() => {
    for (const t of timeoutsRef.current) clearTimeout(t);
    timeoutsRef.current = [];
    setIsReplaying(false);
  }, []);

  return { agents, events, envSpec, isReplaying, replay, stopReplay };
}
```

**Step 3: Build the main page**

Replace `app/page.tsx` with the three-panel layout:

```typescript
// app/page.tsx
"use client";

import { useState } from "react";
import { Send, Play, Square, History } from "lucide-react";
import { AgentCanvas } from "@/components/agent-canvas";
import { AgentDetail } from "@/components/agent-detail";
import { EventLog } from "@/components/event-log";
import { useOrchestrate } from "@/hooks/use-orchestrate";
import { useReplay } from "@/hooks/use-replay";

export default function Home() {
  const [task, setTask] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "replay">("live");

  const live = useOrchestrate();
  const replay = useReplay();
  const active = mode === "live" ? live : replay;

  const handleSubmit = () => {
    if (!task.trim()) return;
    setMode("live");
    setSelectedAgentId(null);
    live.start(task);
  };

  const selectedAgent = selectedAgentId
    ? active.agents.get(selectedAgentId)
    : null;

  const isActive = mode === "live" ? live.isRunning : replay.isReplaying;

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      {/* Top bar */}
      <header className="flex items-center gap-4 border-b border-slate-800 px-6 py-3">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-indigo-400">Agent</span>Scope
        </h1>
        {active.envSpec && (
          <div className="ml-4 rounded-full bg-slate-800/80 px-3 py-1 text-xs text-slate-300">
            {active.envSpec.name} — {active.envSpec.agents.length} agents
          </div>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setMode(mode === "live" ? "replay" : "live")}
          className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
        >
          <History className="h-3.5 w-3.5" />
          {mode === "live" ? "History" : "Back to Live"}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — task input */}
        <div className="flex w-72 flex-col border-r border-slate-800">
          <div className="flex-1 p-4">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500">
              Task
            </label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe what you want the AI team to accomplish..."
              className="h-32 w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) handleSubmit();
              }}
            />
            <button
              onClick={isActive ? live.stop : handleSubmit}
              disabled={!task.trim() && !isActive}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-red-600 text-white hover:bg-red-500"
                  : "bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40"
              }`}
            >
              {isActive ? (
                <>
                  <Square className="h-4 w-4" /> Stop
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Spawn Environment
                </>
              )}
            </button>

            {/* Environment rules */}
            {active.envSpec && (
              <div className="mt-6">
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500">
                  Environment Rules
                </label>
                <div className="space-y-1">
                  {active.envSpec.rules.map((rule, i) => (
                    <div key={i} className="rounded bg-slate-800/60 px-2 py-1 text-xs text-slate-400">
                      {rule}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center + Right panels */}
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 overflow-hidden">
            {/* Canvas */}
            <div className="flex-1">
              <AgentCanvas
                agents={active.agents}
                selectedAgentId={selectedAgentId}
                onSelectAgent={setSelectedAgentId}
              />
            </div>

            {/* Right panel — agent detail */}
            {selectedAgent && (
              <div className="w-80 border-l border-slate-800 overflow-hidden">
                <AgentDetail
                  spec={selectedAgent.spec}
                  status={selectedAgent.status}
                  thinking={selectedAgent.thinking}
                  output={selectedAgent.output}
                />
              </div>
            )}
          </div>

          {/* Bottom — event log */}
          <div className="h-36 border-t border-slate-800">
            <EventLog events={active.events} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 11: Update Layout and Dark Mode

**Files:**
- Modify: `app/layout.tsx`

Add `dark` class to html element so dark mode is always on, update metadata:

```typescript
export const metadata: Metadata = {
  title: "AgentScope",
  description: "Watch AI build and run its own team",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

---

### Task 12: Wire Everything Up and Test

**Step 1: Verify dev server starts**

Run: `cd /Users/eakyuz/humansand && bun dev`
Expected: Server starts on localhost:3000

**Step 2: Test with a sample task**

Open browser, enter: "Build a landing page for a developer tools startup"
Expected: Environment spawns, agents appear on canvas, thinking/output streams

**Step 3: Test replay**

After a run completes, check Supabase has the session, then test the replay endpoints.

---

### Task 13: Visual Polish

**Step 1: Add CSS animations for node glow**

In `globals.css`, add:
```css
@keyframes agent-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.2); }
  50% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.4); }
}
```

**Step 2: Polish spacing, transitions, loading states**

- Add a "Designing team..." loading state while waiting for planner
- Smooth fade-in for nodes appearing
- Ensure the canvas auto-fits when new nodes appear

---

### Execution Order Summary

1. **Task 1**: Install deps (2 min)
2. **Task 2**: Types (3 min)
3. **Task 3**: Supabase setup (10 min)
4. **Task 4**: Orchestrator + API route (15 min)
5. **Task 5**: Replay API (5 min)
6. **Task 6**: React Flow canvas (15 min)
7. **Task 7**: Custom node component (10 min)
8. **Task 8**: Agent detail panel (10 min)
9. **Task 9**: Event log (5 min)
10. **Task 10**: Main page + hooks (20 min)
11. **Task 11**: Layout/dark mode (2 min)
12. **Task 12**: Integration test (15 min)
13. **Task 13**: Visual polish (remaining time)
