"use client";

import { useState, useCallback, useRef } from "react";
import type {
  AgentEvent,
  AgentSpec,
  AgentStatus,
  BucketItem,
  EnvironmentSpec,
} from "@/lib/types";
import type { ChatMessage } from "@/components/chat-panel";

interface AgentState {
  spec: AgentSpec;
  status: AgentStatus;
  thinking: string;
  output: string;
}

let msgCounter = 0;

async function streamSSE(
  body: Record<string, unknown>,
  signal: AbortSignal,
  onEvent: (event: AgentEvent) => void,
) {
  const response = await fetch("/api/orchestrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Cancel reader when signal aborts
  signal.addEventListener("abort", () => reader.cancel(), { once: true });

  while (true) {
    if (signal.aborted) break;
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
        onEvent(JSON.parse(json));
      } catch { /* skip */ }
    }
  }
}

export function useOrchestrate() {
  const [agents, setAgents] = useState<Map<string, AgentState>>(new Map());
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [envSpec, setEnvSpec] = useState<EnvironmentSpec | null>(null);
  const [isDesigning, setIsDesigning] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [plannerThinking, setPlannerThinking] = useState("");
  const [plannerOutput, setPlannerOutput] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [synthesis, setSynthesis] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [runPrompt, setRunPrompt] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const processEvent = useCallback((event: AgentEvent) => {
    setEvents((prev) => [...prev, event]);

    switch (event.type) {
      case "planner_thinking":
        setPlannerThinking((prev) => prev + event.content);
        break;
      case "planner_output":
        setPlannerOutput((prev) => prev + event.content);
        break;
      case "env_created":
        setEnvSpec(event.spec);
        setAgents(
          new Map(
            event.spec.agents.map((a) => [
              a.id,
              { spec: a, status: "pending" as AgentStatus, thinking: "", output: "" },
            ]),
          ),
        );
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
      case "synthesis":
        setIsSynthesizing(true);
        setSynthesis((prev) => prev + event.content);
        break;
      case "environment_complete":
        setIsComplete(true);
        setIsSynthesizing(false);
        break;
      case "error":
        console.error("Orchestration error:", event.message);
        break;
    }
  }, []);

  // Design a new team (no execution)
  const design = useCallback(async (task: string, bucketItems: BucketItem[]) => {
    const userMsg: ChatMessage = {
      id: `msg-${++msgCounter}`,
      role: "user",
      content: task,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, userMsg]);

    setAgents(new Map());
    setEvents([]);
    setEnvSpec(null);
    setIsDesigning(true);
    setIsComplete(false);
    setPlannerThinking("");
    setPlannerOutput("");

    const abort = new AbortController();
    abortRef.current = abort;

    let runThinking = "";
    let runOutput = "";

    try {
      await streamSSE(
        { action: "design", task, bucketItems },
        abort.signal,
        (event) => {
          processEvent(event);
          if (event.type === "planner_thinking") runThinking += event.content;
          if (event.type === "planner_output") runOutput += event.content;
        },
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") console.error(err);
    } finally {
      setIsDesigning(false);
      if (runOutput) {
        setChatMessages((prev) => [
          ...prev,
          { id: `msg-${++msgCounter}`, role: "planner", content: runOutput, thinking: runThinking || undefined, timestamp: Date.now() },
        ]);
        setPlannerThinking("");
        setPlannerOutput("");
      }
    }
  }, [processEvent]);

  // Edit existing spec via chat
  const edit = useCallback(async (message: string, bucketItems: BucketItem[]) => {
    const userMsg: ChatMessage = {
      id: `msg-${++msgCounter}`,
      role: "user",
      content: message,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, userMsg]);

    setIsDesigning(true);
    setPlannerThinking("");
    setPlannerOutput("");

    const abort = new AbortController();
    abortRef.current = abort;

    let runThinking = "";
    let runOutput = "";
    const currentSpec = envSpec;

    try {
      await streamSSE(
        { action: "edit", task: message, spec: currentSpec, bucketItems },
        abort.signal,
        (event) => {
          processEvent(event);
          if (event.type === "planner_thinking") runThinking += event.content;
          if (event.type === "planner_output") runOutput += event.content;
        },
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") console.error(err);
    } finally {
      setIsDesigning(false);
      if (runOutput) {
        setChatMessages((prev) => [
          ...prev,
          { id: `msg-${++msgCounter}`, role: "planner", content: runOutput, thinking: runThinking || undefined, timestamp: Date.now() },
        ]);
        setPlannerThinking("");
        setPlannerOutput("");
      }
    }
  }, [envSpec, processEvent]);

  // Execute the current spec (run agents)
  const execute = useCallback(async (bucketItems?: BucketItem[], prompt?: string, configId?: string) => {
    if (!envSpec) return;

    setRunPrompt(prompt ?? envSpec.objective);
    setSynthesis("");
    setIsSynthesizing(false);
    setAgents(
      new Map(
        envSpec.agents.map((a) => [
          a.id,
          { spec: a, status: "pending" as AgentStatus, thinking: "", output: "" },
        ]),
      ),
    );
    setEvents([]);
    setIsRunning(true);
    setIsComplete(false);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      await streamSSE(
        { action: "execute", spec: envSpec, bucketItems, prompt, configId },
        abort.signal,
        processEvent,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") console.error(err);
    } finally {
      setIsRunning(false);
    }
  }, [envSpec, processEvent]);

  const updateAgentConfig = useCallback(
    (agentId: string, action: "add" | "remove", field: "skills" | "values" | "tools" | "rules", item: string) => {
      setAgents((prev) => {
        const next = new Map(prev);
        const agent = next.get(agentId);
        if (!agent) return prev;
        const spec = { ...agent.spec };
        if (action === "add" && !spec[field].includes(item)) {
          spec[field] = [...spec[field], item];
        } else if (action === "remove") {
          spec[field] = spec[field].filter((i) => i !== item);
        }
        next.set(agentId, { ...agent, spec });
        return next;
      });
      // Also update envSpec
      setEnvSpec((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          agents: prev.agents.map((a) => {
            if (a.id !== agentId) return a;
            const updated = { ...a };
            if (action === "add" && !updated[field].includes(item)) {
              updated[field] = [...updated[field], item];
            } else if (action === "remove") {
              updated[field] = updated[field].filter((i) => i !== item);
            }
            return updated;
          }),
        };
      });
    },
    [],
  );

  const loadSpec = useCallback((spec: EnvironmentSpec) => {
    setEnvSpec(spec);
    setAgents(
      new Map(
        spec.agents.map((a) => [
          a.id,
          { spec: a, status: "pending" as AgentStatus, thinking: "", output: "" },
        ]),
      ),
    );
    setEvents([]);
    setIsComplete(false);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setAgents(new Map());
    setEvents([]);
    setEnvSpec(null);
    setIsDesigning(false);
    setIsRunning(false);
    setIsComplete(false);
    setSynthesis("");
    setIsSynthesizing(false);
    setRunPrompt("");
    setPlannerThinking("");
    setPlannerOutput("");
    setChatMessages([]);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsDesigning(false);
    setIsRunning(false);
  }, []);

  return {
    agents,
    events,
    envSpec,
    isDesigning,
    isRunning,
    isComplete,
    synthesis,
    isSynthesizing,
    runPrompt,
    plannerThinking,
    plannerOutput,
    chatMessages,
    design,
    loadSpec,
    reset,
    edit,
    execute,
    stop,
    updateAgentConfig,
  };
}
