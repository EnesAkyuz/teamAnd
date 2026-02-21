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
      return `${event.agent.role} spawned`;
    case "thinking":
      return null;
    case "output":
      return null;
    case "tool_call":
      return `${event.agentId} using ${event.tool}`;
    case "message":
      return `${event.from} -> ${event.to}`;
    case "agent_complete":
      return `${event.agentId} done`;
    case "environment_complete":
      return "All agents complete";
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
    <div className="flex h-full flex-col overflow-y-auto px-4 py-2 font-mono text-[11px]">
      {displayEvents.length === 0 && (
        <div className="flex h-full items-center text-text-3">
          Waiting for events...
        </div>
      )}
      {displayEvents.map((event, i) => (
        <div key={`${event.timestamp}-${i}`} className="flex gap-3 py-0.5 anim-fade-up">
          <span className="tabular-nums text-text-3">
            {new Date(event.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
          <span
            className={
              event.type === "environment_complete"
                ? "text-status-done"
                : event.type === "agent_spawned"
                  ? "text-brand"
                  : "text-text-2"
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
