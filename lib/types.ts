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
  | { type: "planner_thinking"; content: string; timestamp: number }
  | { type: "planner_output"; content: string; timestamp: number }
  | { type: "agent_spawned"; agent: AgentSpec; timestamp: number }
  | { type: "thinking"; agentId: string; content: string; timestamp: number }
  | { type: "output"; agentId: string; content: string; timestamp: number }
  | {
      type: "tool_call";
      agentId: string;
      tool: string;
      input: string;
      timestamp: number;
    }
  | {
      type: "message";
      from: string;
      to: string;
      summary: string;
      timestamp: number;
    }
  | {
      type: "agent_complete";
      agentId: string;
      result: string;
      timestamp: number;
    }
  | { type: "environment_complete"; summary: string; timestamp: number }
  | { type: "error"; message: string; timestamp: number };

export type AgentStatus = "pending" | "active" | "complete";

export type BucketCategory = "rule" | "skill" | "value" | "tool";

export type AlignmentStatus = "favorable" | "conflicting" | "neutral";

export interface BucketItem {
  id: string;
  category: BucketCategory;
  label: string;
  content?: string | null;
  alignment?: AlignmentStatus | null;
  alignmentReason?: string | null;
  createdAt: string;
}

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
