"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Loader2, Check, Circle } from "lucide-react";
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
        className="!h-1.5 !w-1.5 !rounded-full !border !border-line-strong !bg-surface"
      />
      <div
        className={`
          min-w-[220px] max-w-[260px] rounded-lg border bg-surface p-3.5 transition-all duration-200
          ${status === "active" ? "border-status-active/50 shadow-md" : ""}
          ${status === "complete" ? "border-status-done/40" : ""}
          ${status === "pending" ? "border-line opacity-75" : ""}
          ${selected ? "ring-1.5 ring-brand/40 ring-offset-1 ring-offset-background" : "shadow-sm"}
        `}
      >
        <div className="flex items-center gap-2">
          {status === "active" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-status-active" />
          )}
          {status === "complete" && (
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-status-done">
              <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
            </div>
          )}
          {status === "pending" && (
            <Circle className="h-3.5 w-3.5 text-text-3" />
          )}
          <span className="text-[13px] font-medium text-text-1">
            {spec.role}
          </span>
        </div>

        <p className="mt-1 text-[11px] leading-relaxed text-text-3">
          {spec.personality}
        </p>

        {spec.tools.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {spec.tools.map((tool) => (
              <span
                key={tool}
                className="rounded bg-surface-alt px-1.5 py-px text-[10px] text-text-2"
              >
                {tool}
              </span>
            ))}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-1.5 !w-1.5 !rounded-full !border !border-line-strong !bg-surface"
      />
    </>
  );
}
