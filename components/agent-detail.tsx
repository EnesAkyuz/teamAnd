"use client";

import { Brain, FileText, Shield, Zap, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="px-3 pb-2 pt-1">
        <p className="text-xs text-muted-foreground">{spec.personality}</p>
      </div>

      <div className="flex flex-wrap gap-1 border-t border-border/40 px-3 py-2.5">
        {spec.values.map((v) => (
          <Badge key={v} variant="outline" className="gap-1 text-[10px] font-normal">
            <Star className="h-2.5 w-2.5 text-warn" /> {v}
          </Badge>
        ))}
        {spec.skills.map((s) => (
          <Badge key={s} variant="outline" className="gap-1 text-[10px] font-normal">
            <Zap className="h-2.5 w-2.5 text-primary" /> {s}
          </Badge>
        ))}
        {spec.rules.map((r) => (
          <Badge key={r} variant="outline" className="gap-1 text-[10px] font-normal">
            <Shield className="h-2.5 w-2.5 text-destructive" /> {r}
          </Badge>
        ))}
      </div>

      <ScrollArea className="flex-1 border-t border-border/40">
        {thinking && (
          <div className="border-b border-border/40 px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-thinking">
              <Brain className="h-3 w-3" /> Thinking
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
              {thinking}
            </pre>
          </div>
        )}
        {output && (
          <div className="px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-status-done">
              <FileText className="h-3 w-3" /> Output
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground">
              {output}
            </pre>
          </div>
        )}
        {!thinking && !output && (
          <div className="flex h-20 items-center justify-center">
            <p className="text-xs text-muted-foreground">Waiting...</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
