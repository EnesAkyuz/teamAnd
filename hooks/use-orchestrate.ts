"use client";

import { useState, useCallback, useRef } from "react";
import type {
  AgentEvent,
  AgentSpec,
  AgentStatus,
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

export function useOrchestrate() {
  const [agents, setAgents] = useState<Map<string, AgentState>>(new Map());
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [envSpec, setEnvSpec] = useState<EnvironmentSpec | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [plannerThinking, setPlannerThinking] = useState("");
  const [plannerOutput, setPlannerOutput] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (task: string) => {
    // Add user message to chat
    const userMsg: ChatMessage = {
      id: `msg-${++msgCounter}`,
      role: "user",
      content: task,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, userMsg]);

    // Reset agent/event state for new run but keep chat history
    setAgents(new Map());
    setEvents([]);
    setEnvSpec(null);
    setIsRunning(true);
    setIsComplete(false);
    setPlannerThinking("");
    setPlannerOutput("");

    const abort = new AbortController();
    abortRef.current = abort;

    let runThinking = "";
    let runOutput = "";

    try {
      const response = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
        signal: abort.signal,
      });

      if (!response.ok) {
        console.error("Orchestration HTTP error:", response.status);
        setIsRunning(false);
        return;
      }

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
              case "planner_thinking":
                runThinking += event.content;
                setPlannerThinking(runThinking);
                break;
              case "planner_output":
                runOutput += event.content;
                setPlannerOutput(runOutput);
                break;
              case "env_created":
                setEnvSpec(event.spec);
                setAgents(
                  new Map(
                    event.spec.agents.map((a) => [
                      a.id,
                      {
                        spec: a,
                        status: "pending" as AgentStatus,
                        thinking: "",
                        output: "",
                      },
                    ]),
                  ),
                );
                break;
              case "agent_spawned":
                setAgents((prev) => {
                  const next = new Map(prev);
                  const existing = next.get(event.agent.id);
                  if (existing) {
                    next.set(event.agent.id, {
                      ...existing,
                      status: "active",
                    });
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
                    next.set(event.agentId, {
                      ...existing,
                      status: "complete",
                    });
                  }
                  return next;
                });
                break;
              case "environment_complete":
                setIsComplete(true);
                break;
              case "error":
                console.error("Orchestration error:", event.message);
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

      // Archive planner output into chat history
      if (runOutput) {
        const plannerMsg: ChatMessage = {
          id: `msg-${++msgCounter}`,
          role: "planner",
          content: runOutput,
          thinking: runThinking || undefined,
          timestamp: Date.now(),
        };
        setChatMessages((prev) => [...prev, plannerMsg]);
        // Clear live planner state since it's now in history
        setPlannerThinking("");
        setPlannerOutput("");
      }
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  return {
    agents,
    events,
    envSpec,
    isRunning,
    isComplete,
    plannerThinking,
    plannerOutput,
    chatMessages,
    start,
    stop,
  };
}
