"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Loader2, CheckCircle2, Circle } from "lucide-react";
import type { AgentSpec, AgentStatus } from "@/lib/types";

interface AgentNodeData {
  spec: AgentSpec;
  status: AgentStatus;
  thinking: string;
  output: string;
  selected: boolean;
  [key: string]: unknown;
}

export function AgentNodeComponent({ data }: NodeProps) {
  const { spec, status, selected } = data as unknown as AgentNodeData;

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !rounded-full !border-2 !border-border-default !bg-surface"
      />
      <div
        className={`
          min-w-[240px] rounded-xl border bg-surface p-4 transition-all duration-300
          ${
            status === "active"
              ? "border-brand/40 shadow-[0_0_24px_var(--brand-muted),0_1px_3px_rgba(0,0,0,0.06)]"
              : status === "complete"
                ? "border-accent-green/30 shadow-sm"
                : "border-border-subtle shadow-sm"
          }
          ${selected ? "ring-2 ring-brand/30 ring-offset-2 ring-offset-background" : ""}
        `}
      >
        <div className="flex items-center gap-2.5">
          {status === "active" && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-warm-muted">
              <Loader2 className="h-3 w-3 animate-spin text-accent-warm" />
            </div>
          )}
          {status === "complete" && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-green-muted">
              <CheckCircle2 className="h-3 w-3 text-accent-green" />
            </div>
          )}
          {status === "pending" && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-raised">
              <Circle className="h-3 w-3 text-text-tertiary" />
            </div>
          )}
          <span className="text-sm font-medium text-text-primary">
            {spec.role}
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-text-tertiary italic">
          {spec.personality}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {spec.tools.map((tool) => (
            <span
              key={tool}
              className="rounded-md border border-border-subtle bg-surface-raised px-2 py-0.5 text-[10px] font-medium tracking-wide text-text-secondary"
            >
              {tool}
            </span>
          ))}
        </div>
        {spec.skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {spec.skills.slice(0, 3).map((skill) => (
              <span
                key={skill}
                className="rounded-md bg-accent-warm-muted px-2 py-0.5 text-[10px] font-medium text-accent-warm"
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !rounded-full !border-2 !border-border-default !bg-surface"
      />
    </>
  );
}
