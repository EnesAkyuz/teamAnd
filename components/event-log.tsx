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
      return `${event.agent.role} spawned — ${event.agent.personality}`;
    case "thinking":
      return null;
    case "output":
      return null;
    case "tool_call":
      return `${event.agentId} using tool: ${event.tool}`;
    case "message":
      return `${event.from} → ${event.to}: ${event.summary}`;
    case "agent_complete":
      return `${event.agentId} completed`;
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
    <div className="flex h-full flex-col overflow-y-auto px-5 py-3 font-mono text-xs">
      {displayEvents.length === 0 && (
        <div className="flex h-full items-center justify-center text-text-tertiary">
          Events will appear here as agents work...
        </div>
      )}
      {displayEvents.map((event, i) => (
        <div
          key={`${event.timestamp}-${i}`}
          className="flex gap-3 py-1 animate-fade-in-up"
        >
          <span className="tabular-nums text-text-tertiary">
            {new Date(event.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
          <span
            className={
              event.type === "environment_complete"
                ? "text-accent-green"
                : event.type === "agent_spawned"
                  ? "text-accent-warm"
                  : "text-text-secondary"
            }
          >
            {formatEvent(event)}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
