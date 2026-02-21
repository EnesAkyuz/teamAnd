import Anthropic from "@anthropic-ai/sdk";
import type { AgentEvent, AgentSpec, BucketItem, EnvironmentSpec } from "./types";

const client = new Anthropic();

function buildBucketContext(bucketItems: BucketItem[]): string {
  const rules = bucketItems.filter((i) => i.category === "rule").map((i) => i.label);
  const skills = bucketItems.filter((i) => i.category === "skill").map((i) => i.label);
  const values = bucketItems.filter((i) => i.category === "value").map((i) => i.label);
  const tools = bucketItems.filter((i) => i.category === "tool").map((i) => i.label);
  const parts: string[] = [];
  if (rules.length) parts.push(`Available Rules: ${rules.join(", ")}`);
  if (skills.length) parts.push(`Available Skills: ${skills.join(", ")}`);
  if (values.length) parts.push(`Available Values: ${values.join(", ")}`);
  if (tools.length) parts.push(`Available Tools: ${tools.join(", ")}`);
  return parts.join("\n");
}

const DESIGN_PROMPT = `You are an AI team architect. Given a task, design a team of specialized AI agents to accomplish it.

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

const EDIT_PROMPT = `You are an AI team architect. The user has an existing team configuration and wants to modify it.

Given the current config and the user's request, return ONLY the updated valid JSON EnvironmentSpec. Keep the same schema. You may add, remove, or modify agents, change their skills/values/tools/rules, or update global rules. Preserve agent IDs when the agent still exists.`;

// Design-only: creates the EnvironmentSpec without executing agents
export async function* designTeam(
  task: string,
  bucketItems: BucketItem[],
): AsyncGenerator<AgentEvent> {
  const bucketContext = buildBucketContext(bucketItems);
  let systemPrompt = DESIGN_PROMPT;
  if (bucketContext) {
    systemPrompt += `\n\nThe user has configured these resources. You MUST only use items from this list for agent skills, values, tools, and rules. Do NOT invent new ones.\n${bucketContext}`;
  }

  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    thinking: { type: "enabled", budget_tokens: 4000 },
    system: systemPrompt,
    messages: [{ role: "user", content: task }],
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

  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in planner output");
    const spec: EnvironmentSpec = JSON.parse(jsonMatch[0]);
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
  const bucketContext = buildBucketContext(bucketItems);
  let systemPrompt = EDIT_PROMPT;
  if (bucketContext) {
    systemPrompt += `\n\nAvailable resources (use ONLY these):\n${bucketContext}`;
  }

  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    thinking: { type: "enabled", budget_tokens: 4000 },
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Current config:\n${JSON.stringify(currentSpec, null, 2)}\n\nUser request: ${userMessage}`,
      },
    ],
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

  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const spec: EnvironmentSpec = JSON.parse(jsonMatch[0]);
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

// Keep for optimize
export async function* optimizeAgents(
  currentSpec: EnvironmentSpec,
  bucketItems: BucketItem[],
): AsyncGenerator<AgentEvent> {
  yield* editSpec(currentSpec, "Optimize the distribution of skills, tools, values, and rules across agents for maximum effectiveness. Redistribute resources intelligently.", bucketItems);
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
