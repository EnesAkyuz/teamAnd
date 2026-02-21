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

  const specText =
    planResponse.content[0].type === "text"
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
          summary:
            fullOutput.slice(0, 150) +
            (fullOutput.length > 150 ? "..." : ""),
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
