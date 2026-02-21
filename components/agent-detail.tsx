"use client";

import { Brain, MessageSquare, Shield, Sparkles, Star } from "lucide-react";
import type { AgentSpec, AgentStatus } from "@/lib/types";

interface AgentDetailProps {
  spec: AgentSpec;
  status: AgentStatus;
  thinking: string;
  output: string;
}

export function AgentDetail({
  spec,
  status,
  thinking,
  output,
}: AgentDetailProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      {/* Header */}
      <div className="border-b border-border-subtle p-5">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              status === "active"
                ? "animate-pulse bg-accent-warm"
                : status === "complete"
                  ? "bg-accent-green"
                  : "bg-text-tertiary"
            }`}
          />
          <h2
            className="text-lg text-text-primary"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {spec.role}
          </h2>
        </div>
        <p className="mt-1 text-sm text-text-secondary italic">
          {spec.personality}
        </p>
      </div>

      {/* Config badges */}
      <div className="space-y-3 border-b border-border-subtle p-5">
        {spec.values.length > 0 && (
          <div className="flex items-start gap-2.5">
            <Star className="mt-0.5 h-3.5 w-3.5 text-accent-amber" />
            <div className="flex flex-wrap gap-1.5">
              {spec.values.map((v) => (
                <span
                  key={v}
                  className="rounded-md bg-accent-amber-muted px-2 py-0.5 text-[10px] font-medium text-accent-amber"
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}
        {spec.skills.length > 0 && (
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 text-accent-warm" />
            <div className="flex flex-wrap gap-1.5">
              {spec.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-md bg-accent-warm-muted px-2 py-0.5 text-[10px] font-medium text-accent-warm"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {spec.rules.length > 0 && (
          <div className="flex items-start gap-2.5">
            <Shield className="mt-0.5 h-3.5 w-3.5 text-accent-rose" />
            <div className="flex flex-wrap gap-1.5">
              {spec.rules.map((r) => (
                <span
                  key={r}
                  className="rounded-md bg-accent-rose-muted px-2 py-0.5 text-[10px] font-medium text-accent-rose"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Thought trace + output */}
      <div className="flex-1 overflow-y-auto">
        {thinking && (
          <div className="border-b border-border-subtle p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-accent-purple">
              <Brain className="h-3.5 w-3.5" />
              Thinking
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-text-secondary">
              {thinking}
            </pre>
          </div>
        )}

        {output && (
          <div className="p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-accent-green">
              <MessageSquare className="h-3.5 w-3.5" />
              Output
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-text-primary">
              {output}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
