"use client";

import { useState, useCallback, useRef } from "react";
import type {
  AgentEvent,
  AgentSpec,
  AgentStatus,
  EnvironmentSpec,
} from "@/lib/types";

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
  const [synthesis, setSynthesis] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const cancelRef = useRef(false);

  const processEvent = useCallback((event: AgentEvent) => {
    setEvents((prev) => [...prev, event]);

    switch (event.type) {
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
          if (!next.has(event.agent.id)) {
            next.set(event.agent.id, { spec: event.agent, status: "active", thinking: "", output: "" });
          } else {
            const existing = next.get(event.agent.id)!;
            next.set(event.agent.id, { ...existing, status: "active" });
          }
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
        setSynthesis((prev) => prev + event.content);
        break;
      case "environment_complete":
        setIsComplete(true);
        break;
    }
  }, []);

  const replay = useCallback(async (runId: string) => {
    setAgents(new Map());
    setEvents([]);
    setEnvSpec(null);
    setSynthesis("");
    setIsComplete(false);
    setIsReplaying(true);
    cancelRef.current = false;

    const res = await fetch(`/api/runs/${runId}/events`);
    const rawEvents: Array<{ payload: AgentEvent; timestamp_ms: number }> = await res.json();

    if (rawEvents.length === 0) {
      setIsReplaying(false);
      return;
    }

    // Group events into batches:
    // - Structural events (spawned, complete, env_created) get a small pause after
    // - Streaming events (thinking, output) get processed instantly in bulk
    const isStructural = (t: string) =>
      ["env_created", "agent_spawned", "agent_complete", "environment_complete", "message"].includes(t);

    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    let i = 0;
    while (i < rawEvents.length) {
      if (cancelRef.current) break;

      const event = rawEvents[i].payload;

      if (isStructural(event.type)) {
        // Process structural event with a small pause after
        processEvent(event);
        i++;
        await wait(150);
      } else {
        // Batch all consecutive streaming events for the same agent
        const batch: AgentEvent[] = [];
        const batchAgent = "agentId" in event ? event.agentId : null;
        while (
          i < rawEvents.length &&
          !isStructural(rawEvents[i].payload.type)
        ) {
          batch.push(rawEvents[i].payload);
          i++;
          // Batch up to 20 events at a time for visual streaming effect
          if (batch.length >= 20) break;
        }
        for (const e of batch) {
          processEvent(e);
        }
        // Small pause between batches for visual effect
        await wait(30);
      }
    }

    setIsReplaying(false);
  }, [processEvent]);

  const stopReplay = useCallback(() => {
    cancelRef.current = true;
    setIsReplaying(false);
  }, []);

  return { agents, events, envSpec, isReplaying, synthesis, isComplete, replay, stopReplay };
}
