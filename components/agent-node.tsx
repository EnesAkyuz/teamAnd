"use client";

import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Loader2, Check, Circle, Shield, Star, Wrench, Zap } from "lucide-react";
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

  const hasResources =
    spec.skills.length > 0 ||
    spec.values.length > 0 ||
    spec.tools.length > 0 ||
    spec.rules.length > 0;

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
          min-w-[210px] max-w-[270px] rounded-xl border p-3 backdrop-blur-md transition-all duration-300
          ${status === "active" ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10" : ""}
          ${status === "complete" ? "border-status-done bg-status-done-bg shadow-sm" : ""}
          ${status === "pending" ? "border-border/60 bg-background/90 opacity-60 shadow-sm" : ""}
          ${selected ? "ring-2 ring-primary/30 ring-offset-1 ring-offset-background" : ""}
          ${isDropTarget ? "ring-2 ring-primary/50 border-primary/60 scale-[1.02]" : ""}
        `}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          {status === "active" && (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
          )}
          {status === "complete" && (
            <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-status-done">
              <Check className="h-2 w-2 text-white" strokeWidth={3} />
            </div>
          )}
          {status === "pending" && (
            <Circle className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          <span className="text-xs font-medium">{spec.role}</span>
        </div>

        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          {spec.personality}
        </p>

        {/* All assigned resources */}
        {hasResources && (
          <div className="mt-2 space-y-1">
            <ResourceRow icon={Zap} color="text-primary" items={spec.skills} />
            <ResourceRow icon={Star} color="text-warn" items={spec.values} />
            <ResourceRow icon={Shield} color="text-destructive" items={spec.rules} />
            <ResourceRow icon={Wrench} color="text-muted-foreground" items={spec.tools} />
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

function ResourceRow({
  icon: Icon,
  color,
  items,
}: {
  icon: typeof Zap;
  color: string;
  items: string[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex items-start gap-1">
      <Icon className={`mt-0.5 h-2.5 w-2.5 shrink-0 ${color}`} />
      <div className="flex flex-wrap gap-0.5">
        {items.map((item) => (
          <span
            key={item}
            className="rounded bg-muted/60 px-1 py-px text-[8px] leading-tight text-muted-foreground"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
