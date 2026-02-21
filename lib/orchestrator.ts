import Anthropic from "@anthropic-ai/sdk";
import type { AgentEvent, AgentSpec, BucketItem, EnvironmentSpec } from "./types";

const client = new Anthropic();

// Hard enforcement: strip any items not in the bucket allowlist
function enforceAllowlist(spec: EnvironmentSpec, bucketItems: BucketItem[]): EnvironmentSpec {
  if (bucketItems.length === 0) return spec;

  const allowed = {
    rules: new Set(bucketItems.filter((i) => i.category === "rule").map((i) => i.label)),
    skills: new Set(bucketItems.filter((i) => i.category === "skill").map((i) => i.label)),
    values: new Set(bucketItems.filter((i) => i.category === "value").map((i) => i.label)),
    tools: new Set(bucketItems.filter((i) => i.category === "tool").map((i) => i.label)),
  };

  return {
    ...spec,
    rules: spec.rules.filter((r) => allowed.rules.has(r)),
    agents: spec.agents.map((agent) => ({
      ...agent,
      skills: agent.skills.filter((s) => allowed.skills.has(s)),
      values: agent.values.filter((v) => allowed.values.has(v)),
      tools: agent.tools.filter((t) => allowed.tools.has(t)),
      rules: agent.rules.filter((r) => allowed.rules.has(r)),
    })),
  };
}

function formatBucketForTool(bucketItems: BucketItem[]) {
  return {
    rules: bucketItems.filter((i) => i.category === "rule").map((i) => i.label),
    skills: bucketItems.filter((i) => i.category === "skill").map((i) => i.label),
    values: bucketItems.filter((i) => i.category === "value").map((i) => i.label),
    tools: bucketItems.filter((i) => i.category === "tool").map((i) => i.label),
  };
}

const RESOURCE_TOOL: Anthropic.Tool = {
  name: "get_available_resources",
  description:
    "Fetch the environment's available resources. Returns the exact lists of rules, skills, values, and tools you are allowed to assign to agents. You MUST call this before designing or editing a team. You MUST NOT use any items outside what this tool returns.",
  input_schema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

const SPEC_SCHEMA = `{
  "name": "environment name",
  "objective": "the goal",
  "agents": [
    {
      "id": "unique_snake_case_id",
      "role": "Agent Role Title",
      "personality": "2-3 personality traits",
      "skills": ["from get_available_resources only"],
      "values": ["from get_available_resources only"],
      "tools": ["from get_available_resources only"],
      "rules": ["from get_available_resources only"],
      "memory": [],
      "dependsOn": ["other_agent_id or empty"]
    }
  ],
  "rules": ["from get_available_resources only"]
}`;

const DESIGN_PROMPT = `You are an AI team architect. Given a task, design a team of specialized AI agents.

IMPORTANT RULES:
1. ALWAYS call get_available_resources first to check what's available.
2. You MUST ALWAYS design agents regardless of whether resources are empty or not.
3. If resources are empty, set skills, values, tools, and rules to empty arrays []. The agents still need roles, personalities, and dependsOn.
4. If resources exist, ONLY use items from what the tool returned. Do NOT invent any.
5. Agent roles and personalities are always your own design — be creative and specific to the task.

After calling the tool, return ONLY valid JSON matching this schema:
${SPEC_SCHEMA}

Design 2-4 agents. Make them diverse and specialized. Use dependsOn to create a logical workflow.`;

const EDIT_PROMPT = `You are an AI team architect. The user wants to modify an existing team configuration.

IMPORTANT RULES:
1. ALWAYS call get_available_resources first.
2. If resources exist, ONLY use items returned by the tool. Do NOT invent any.
3. If resources are empty, use empty arrays [] for skills, values, tools, rules.
4. You MUST ALWAYS return a valid updated spec. Never refuse.

Return ONLY the updated valid JSON EnvironmentSpec. Preserve agent IDs when possible.`;

// Tool-use conversation loop: handles the tool call → result → final response cycle
async function* toolUseConversation(
  systemPrompt: string,
  userContent: string,
  bucketItems: BucketItem[],
): AsyncGenerator<AgentEvent> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userContent },
  ];

  // First call — Claude should call get_available_resources
  const firstResponse = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    thinking: { type: "enabled", budget_tokens: 4000 },
    system: systemPrompt,
    tools: [RESOURCE_TOOL],
    messages,
  });

  // Emit any thinking from first response
  for (const block of firstResponse.content) {
    if (block.type === "thinking") {
      yield { type: "planner_thinking", content: block.thinking, timestamp: Date.now() };
    }
  }

  // Check if it called the tool
  const toolUseBlock = firstResponse.content.find(
    (b): b is Anthropic.ContentBlock & { type: "tool_use" } => b.type === "tool_use",
  );

  if (toolUseBlock && toolUseBlock.name === "get_available_resources") {
    // Return bucket items as tool result
    const resources = formatBucketForTool(bucketItems);

    messages.push({ role: "assistant", content: firstResponse.content });
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: JSON.stringify(resources, null, 2),
        },
      ],
    });

    // Second call — Claude generates the spec using tool results, now with streaming
    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      thinking: { type: "enabled", budget_tokens: 4000 },
      system: systemPrompt,
      tools: [RESOURCE_TOOL],
      messages,
    });

    let output = "";
    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "thinking_delta") {
          yield { type: "planner_thinking", content: event.delta.thinking, timestamp: Date.now() };
        } else if (event.delta.type === "text_delta") {
          output += event.delta.text;
          yield { type: "planner_output", content: event.delta.text, timestamp: Date.now() };
        }
      }
    }

    return output;
  }

  // If Claude didn't call the tool, use the text output directly (fallback)
  let output = "";
  for (const block of firstResponse.content) {
    if (block.type === "text") {
      output += block.text;
      yield { type: "planner_output", content: block.text, timestamp: Date.now() };
    }
  }

  return output;
}

// Design-only: creates the EnvironmentSpec without executing agents
export async function* designTeam(
  task: string,
  bucketItems: BucketItem[],
): AsyncGenerator<AgentEvent> {
  let output = "";

  const gen = toolUseConversation(DESIGN_PROMPT, task, bucketItems);
  while (true) {
    const result = await gen.next();
    if (result.done) {
      output = result.value as string;
      break;
    }
    yield result.value;
  }

  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in planner output");
    const rawSpec: EnvironmentSpec = JSON.parse(jsonMatch[0]);
    const spec = enforceAllowlist(rawSpec, bucketItems);
    yield { type: "env_created", spec, timestamp: Date.now() };
  } catch (e) {
    yield { type: "error", message: `Failed to parse spec: ${e}`, timestamp: Date.now() };
  }
}

// Edit existing spec based on user message
export async function* editSpec(
  currentSpec: EnvironmentSpec,
  userMessage: string,
  bucketItems: BucketItem[],
): AsyncGenerator<AgentEvent> {
  const content = `Current config:\n${JSON.stringify(currentSpec, null, 2)}\n\nUser request: ${userMessage}`;

  let output = "";
  const gen = toolUseConversation(EDIT_PROMPT, content, bucketItems);
  while (true) {
    const result = await gen.next();
    if (result.done) {
      output = result.value as string;
      break;
    }
    yield result.value;
  }

  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const rawSpec: EnvironmentSpec = JSON.parse(jsonMatch[0]);
    const spec = enforceAllowlist(rawSpec, bucketItems);
    yield { type: "env_created", spec, timestamp: Date.now() };
  } catch (e) {
    yield { type: "error", message: `Edit parse error: ${e}`, timestamp: Date.now() };
  }
}

// Execute agents from a given spec
export async function* executeAgents(
  spec: EnvironmentSpec,
): AsyncGenerator<AgentEvent> {
  const completed: Record<string, string> = {};
  const agentOrder = topologicalSort(spec.agents);

  for (const agent of agentOrder) {
    yield { type: "agent_spawned", agent, timestamp: Date.now() };

    const upstreamContext = agent.dependsOn
      .filter((id) => completed[id])
      .map((id) => {
        const upstream = spec.agents.find((a) => a.id === id);
        return `[${upstream?.role ?? id}]: ${completed[id]}`;
      })
      .join("\n\n");

    const systemPrompt = buildAgentPrompt(agent, spec.rules, upstreamContext);

    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      thinking: { type: "enabled", budget_tokens: 8000 },
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Task: ${spec.objective}\n\nYour specific role: ${agent.role}\nYour goal: Execute your responsibilities for this task.\n${upstreamContext ? `\nContext from team members:\n${upstreamContext}` : ""}`,
        },
      ],
    });

    let fullOutput = "";

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "thinking_delta") {
          yield { type: "thinking", agentId: agent.id, content: event.delta.thinking, timestamp: Date.now() };
        } else if (event.delta.type === "text_delta") {
          fullOutput += event.delta.text;
          yield { type: "output", agentId: agent.id, content: event.delta.text, timestamp: Date.now() };
        }
      }
    }

    completed[agent.id] = fullOutput;

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

    yield { type: "agent_complete", agentId: agent.id, result: fullOutput, timestamp: Date.now() };
  }

  yield { type: "environment_complete", summary: "All agents completed their tasks.", timestamp: Date.now() };
}

// Optimize via edit
export async function* optimizeAgents(
  currentSpec: EnvironmentSpec,
  bucketItems: BucketItem[],
): AsyncGenerator<AgentEvent> {
  yield* editSpec(currentSpec, "Optimize the distribution of skills, tools, values, and rules across agents for maximum effectiveness.", bucketItems);
}

function buildAgentPrompt(agent: AgentSpec, globalRules: string[], upstreamContext: string): string {
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
