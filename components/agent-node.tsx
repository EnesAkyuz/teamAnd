"use client";

import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Loader2, Check, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AgentSpec, AgentStatus, BucketCategory } from "@/lib/types";

interface AgentNodeData {
  spec: AgentSpec;
  status: AgentStatus;
  thinking: string;
  output: string;
  selected: boolean;
  onDropBucketItem?: (agentId: string, category: BucketCategory, label: string) => void;
  [key: string]: unknown;
}

export function AgentNodeComponent({ data }: NodeProps) {
  const { spec, status, selected, onDropBucketItem } = data as unknown as AgentNodeData;
  const [isDropTarget, setIsDropTarget] = useState(false);

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!h-1.5 !w-1.5 !rounded-full !border !border-border !bg-background"
      />
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/bucket-item")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setIsDropTarget(true);
          }
        }}
        onDragLeave={() => setIsDropTarget(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDropTarget(false);
          const raw = e.dataTransfer.getData("application/bucket-item");
          if (!raw || !onDropBucketItem) return;
          const item = JSON.parse(raw);
          onDropBucketItem(spec.id, item.category, item.label);
        }}
        className={`
          min-w-[200px] max-w-[250px] rounded-xl border bg-background/90 p-3 backdrop-blur-md transition-all duration-200
          ${status === "active" ? "border-primary/40 shadow-md shadow-primary/5" : "border-border/60 shadow-sm"}
          ${status === "complete" ? "border-status-done/30" : ""}
          ${status === "pending" ? "opacity-60" : ""}
          ${selected ? "ring-2 ring-primary/30 ring-offset-1 ring-offset-background" : ""}
          ${isDropTarget ? "ring-2 ring-primary/50 border-primary/60 scale-[1.02]" : ""}
        `}
      >
        <div className="flex items-center gap-2">
          {status === "active" && (
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
          )}
          {status === "complete" && (
            <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-status-done">
              <Check className="h-2 w-2 text-white" strokeWidth={3} />
            </div>
          )}
          {status === "pending" && (
            <Circle className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="text-xs font-medium">{spec.role}</span>
        </div>

        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          {spec.personality}
        </p>

        {spec.tools.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {spec.tools.map((tool) => (
              <Badge
                key={tool}
                variant="secondary"
                className="h-4 px-1.5 text-[9px] font-normal"
              >
                {tool}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-1.5 !w-1.5 !rounded-full !border !border-border !bg-background"
      />
    </>
  );
}
