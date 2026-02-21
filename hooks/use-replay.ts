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
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const replay = useCallback(async (sessionId: string, speed = 1) => {
    setAgents(new Map());
    setEvents([]);
    setEnvSpec(null);
    setIsReplaying(true);
    for (const t of timeoutsRef.current) clearTimeout(t);
    timeoutsRef.current = [];

    const res = await fetch(`/api/runs/${sessionId}/events`);
    const rawEvents: Array<{ payload: AgentEvent; timestamp_ms: number }> =
      await res.json();

    if (rawEvents.length === 0) {
      setIsReplaying(false);
      return;
    }

    const baseTime = rawEvents[0].timestamp_ms;

    for (const { payload: event, timestamp_ms } of rawEvents) {
      const delay = (timestamp_ms - baseTime) / speed;
      const timeout = setTimeout(() => {
        setEvents((prev) => [...prev, event]);

        switch (event.type) {
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
              if (existing)
                next.set(event.agent.id, { ...existing, status: "active" });
              return next;
            });
            break;
          case "thinking":
            setAgents((prev) => {
              const next = new Map(prev);
              const existing = next.get(event.agentId);
              if (existing)
                next.set(event.agentId, {
                  ...existing,
                  thinking: existing.thinking + event.content,
                });
              return next;
            });
            break;
          case "output":
            setAgents((prev) => {
              const next = new Map(prev);
              const existing = next.get(event.agentId);
              if (existing)
                next.set(event.agentId, {
                  ...existing,
                  output: existing.output + event.content,
                });
              return next;
            });
            break;
          case "agent_complete":
            setAgents((prev) => {
              const next = new Map(prev);
              const existing = next.get(event.agentId);
              if (existing)
                next.set(event.agentId, { ...existing, status: "complete" });
              return next;
            });
            break;
        }
      }, delay);
      timeoutsRef.current.push(timeout);
    }

    // Set isReplaying to false after last event
    const lastDelay =
      (rawEvents[rawEvents.length - 1].timestamp_ms - baseTime) / speed;
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
