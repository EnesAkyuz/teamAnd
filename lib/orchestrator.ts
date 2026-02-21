import Anthropic from "@anthropic-ai/sdk";
import type { AgentEvent, AgentSpec, BucketItem, EnvironmentSpec } from "./types";

const client = new Anthropic();

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
    skills: bucketItems.filter((i) => i.category === "skill").map((i) => ({
      name: i.label,
      description: i.content ? i.content.slice(0, 200) + (i.content.length > 200 ? "..." : "") : i.label,
    })),
    values: bucketItems.filter((i) => i.category === "value").map((i) => i.label),
    tools: bucketItems.filter((i) => i.category === "tool").map((i) => i.label),
  };
}

const RESOURCE_TOOL: Anthropic.Tool = {
  name: "get_available_resources",
  description:
    "Fetch the environment's available resources. Returns the exact lists of rules, skills, values, and tools you are allowed to assign. MUST be called before designing or editing. If lists are empty, use empty arrays.",
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
      "skills": [],
      "values": [],
      "tools": [],
      "rules": [],
      "memory": [],
      "dependsOn": ["other_agent_id or empty"]
    }
  ],
  "rules": []
}`;

const DESIGN_PROMPT = `You are an AI team architect. Given a task, design a team of specialized AI agents.

RULES:
1. ALWAYS call get_available_resources first.
2. ALWAYS design the team regardless of whether resources are empty.
3. If resources are empty, use empty arrays [] for skills, values, tools, rules.
4. If resources exist, ONLY use items from the tool result. Never invent any.
5. Agent roles, personalities, and dependsOn are always your creative design.
6. You may create branching workflows where multiple agents run in parallel.

After calling the tool, return ONLY valid JSON matching this schema:
${SPEC_SCHEMA}

Design 2-4 agents. Make them diverse and specialized. Use dependsOn for workflow.`;

const EDIT_PROMPT = `You are an AI team architect modifying an existing team.

RULES:
1. ALWAYS call get_available_resources first.
2. If resources exist, ONLY use items from the tool result.
3. If resources are empty, use empty arrays [].
4. ALWAYS return valid JSON. Never refuse.

Return ONLY the updated valid JSON EnvironmentSpec. Preserve agent IDs when possible.`;

// Multi-turn tool-use conversation that always extracts text output
async function* plannerCall(
  systemPrompt: string,
  userContent: string,
  bucketItems: BucketItem[],
): AsyncGenerator<AgentEvent, string> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userContent },
  ];

  let finalOutput = "";
  const maxTurns = 3; // safety limit

  for (let turn = 0; turn < maxTurns; turn++) {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      thinking: { type: "enabled", budget_tokens: 4000 },
      system: systemPrompt,
      tools: [RESOURCE_TOOL],
      messages,
    });

    const assistantBlocks: Anthropic.ContentBlock[] = [];
    let turnText = "";

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "thinking_delta") {
          yield { type: "planner_thinking", content: event.delta.thinking, timestamp: Date.now() };
        } else if (event.delta.type === "text_delta") {
          turnText += event.delta.text;
          yield { type: "planner_output", content: event.delta.text, timestamp: Date.now() };
        }
      }
    }

    // Get the full response to check for tool use
    const finalMessage = await stream.finalMessage();
    assistantBlocks.push(...finalMessage.content);

    // Check if there's a tool call
    const toolUseBlock = finalMessage.content.find(
      (b): b is Anthropic.ContentBlock & { type: "tool_use" } => b.type === "tool_use",
    );

    if (toolUseBlock && toolUseBlock.name === "get_available_resources") {
      const resources = formatBucketForTool(bucketItems);

      messages.push({ role: "assistant", content: finalMessage.content });
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
      // Continue to next turn — Claude will use tool results
      continue;
    }

    // No tool call — this is the final text response
    finalOutput = turnText;

    // Also collect any text from non-streamed blocks
    if (!finalOutput) {
      for (const block of finalMessage.content) {
        if (block.type === "text") finalOutput += block.text;
      }
    }

    break;
  }

  return finalOutput;
}

export async function* designTeam(
  task: string,
  bucketItems: BucketItem[],
): AsyncGenerator<AgentEvent> {
  let output = "";

  const gen = plannerCall(DESIGN_PROMPT, task, bucketItems);
  while (true) {
    const result = await gen.next();
    if (result.done) {
      output = (result.value as string) ?? "";
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

export async function* editSpec(
  currentSpec: EnvironmentSpec,
  userMessage: string,
  bucketItems: BucketItem[],
): AsyncGenerator<AgentEvent> {
  const content = `Current config:\n${JSON.stringify(currentSpec, null, 2)}\n\nUser request: ${userMessage}`;

  let output = "";
  const gen = plannerCall(EDIT_PROMPT, content, bucketItems);
  while (true) {
    const result = await gen.next();
    if (result.done) {
      output = (result.value as string) ?? "";
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

// Execute agents with parallel support for branching workflows
export async function* executeAgents(
  spec: EnvironmentSpec,
  bucketItems?: BucketItem[],
): AsyncGenerator<AgentEvent> {
  // Build skill content lookup
  const skillContent: Record<string, string> = {};
  if (bucketItems) {
    for (const item of bucketItems) {
      if (item.category === "skill" && item.content) {
        skillContent[item.label] = item.content;
      }
    }
  }

  const completed: Record<string, string> = {};
  const levels = getExecutionLevels(spec.agents);

  for (const level of levels) {
    if (level.length === 1) {
      yield* runAgent(level[0], spec, completed, skillContent);
    } else {
      const agentResults = await Promise.all(
        level.map((agent) => collectAgentRun(agent, spec, completed, skillContent)),
      );

      for (const { agent, events, output } of agentResults) {
        for (const event of events) {
          yield event;
        }
        completed[agent.id] = output;
      }
    }
  }

  yield { type: "environment_complete", summary: "All agents completed their tasks.", timestamp: Date.now() };
}

// Run a single agent, yielding events as they stream
async function* runAgent(
  agent: AgentSpec,
  spec: EnvironmentSpec,
  completed: Record<string, string>,
  skillContent: Record<string, string> = {},
): AsyncGenerator<AgentEvent> {
  yield { type: "agent_spawned", agent, timestamp: Date.now() };

  const upstreamContext = agent.dependsOn
    .filter((id) => completed[id])
    .map((id) => {
      const upstream = spec.agents.find((a) => a.id === id);
      return `[${upstream?.role ?? id}]: ${completed[id]}`;
    })
    .join("\n\n");

  const systemPrompt = buildAgentPrompt(agent, spec.rules, upstreamContext, skillContent);

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

// Run agent and collect all events (for parallel execution)
async function collectAgentRun(
  agent: AgentSpec,
  spec: EnvironmentSpec,
  completed: Record<string, string>,
  skillContent: Record<string, string> = {},
): Promise<{ agent: AgentSpec; events: AgentEvent[]; output: string }> {
  const events: AgentEvent[] = [];
  let output = "";

  events.push({ type: "agent_spawned", agent, timestamp: Date.now() });

  const upstreamContext = agent.dependsOn
    .filter((id) => completed[id])
    .map((id) => {
      const upstream = spec.agents.find((a) => a.id === id);
      return `[${upstream?.role ?? id}]: ${completed[id]}`;
    })
    .join("\n\n");

  const systemPrompt = buildAgentPrompt(agent, spec.rules, upstreamContext, skillContent);

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

  for await (const event of stream) {
    if (event.type === "content_block_delta") {
      if (event.delta.type === "thinking_delta") {
        events.push({ type: "thinking", agentId: agent.id, content: event.delta.thinking, timestamp: Date.now() });
      } else if (event.delta.type === "text_delta") {
        output += event.delta.text;
        events.push({ type: "output", agentId: agent.id, content: event.delta.text, timestamp: Date.now() });
      }
    }
  }

  for (const other of spec.agents) {
    if (other.dependsOn.includes(agent.id)) {
      events.push({
        type: "message",
        from: agent.id,
        to: other.id,
        summary: output.slice(0, 150) + (output.length > 150 ? "..." : ""),
        timestamp: Date.now(),
      });
    }
  }

  events.push({ type: "agent_complete", agentId: agent.id, result: output, timestamp: Date.now() });

  return { agent, events, output };
}

export async function* optimizeAgents(
  currentSpec: EnvironmentSpec,
  bucketItems: BucketItem[],
): AsyncGenerator<AgentEvent> {
  yield* editSpec(currentSpec, "Optimize the distribution of skills, tools, values, and rules across agents for maximum effectiveness.", bucketItems);
}

function buildAgentPrompt(
  agent: AgentSpec,
  globalRules: string[],
  upstreamContext: string,
  skillContent: Record<string, string> = {},
): string {
  const allRules = [...agent.rules, ...globalRules];
  const parts = [`You are ${agent.role}.`, `Personality: ${agent.personality}`];

  if (agent.skills.length > 0) parts.push(`Skills: ${agent.skills.join(", ")}`);
  if (agent.values.length > 0) parts.push(`Values: ${agent.values.join(", ")}`);
  if (agent.tools.length > 0) parts.push(`Available Tools: ${agent.tools.join(", ")}`);
  if (allRules.length > 0) parts.push(`Rules you MUST follow:\n${allRules.map((r) => `- ${r}`).join("\n")}`);
  if (agent.memory.length > 0) parts.push(`Memory/Context:\n${agent.memory.join("\n")}`);

  // Inject full skill definitions for assigned skills
  const injectedSkills = agent.skills
    .filter((s) => skillContent[s])
    .map((s) => `--- SKILL: ${s} ---\n${skillContent[s]}\n--- END SKILL ---`);
  if (injectedSkills.length > 0) {
    parts.push(`Skill Definitions (follow these methodologies):\n\n${injectedSkills.join("\n\n")}`);
  }

  parts.push("You are part of a team. Stay focused on YOUR role. Be concise but thorough. Output your work directly.");

  return parts.join("\n\n");
}

// Group agents into execution levels — agents at the same level can run in parallel
function getExecutionLevels(agents: AgentSpec[]): AgentSpec[][] {
  const depths: Record<string, number> = {};

  function getDepth(id: string): number {
    if (depths[id] !== undefined) return depths[id];
    const agent = agents.find((a) => a.id === id);
    if (!agent || agent.dependsOn.length === 0) {
      depths[id] = 0;
      return 0;
    }
    depths[id] = 1 + Math.max(...agent.dependsOn.map(getDepth));
    return depths[id];
  }

  for (const agent of agents) getDepth(agent.id);

  // Group by depth
  const levelMap: Record<number, AgentSpec[]> = {};
  for (const agent of agents) {
    const d = depths[agent.id] ?? 0;
    if (!levelMap[d]) levelMap[d] = [];
    levelMap[d].push(agent);
  }

  // Return sorted by depth (0 first = roots, then their dependents)
  return Object.keys(levelMap)
    .map(Number)
    .sort((a, b) => a - b)
    .map((d) => levelMap[d]);
}
