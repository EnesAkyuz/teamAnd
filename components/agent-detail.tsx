"use client";

import { Brain, FileText, Shield, Zap, Star } from "lucide-react";
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
      <div className="border-b border-line px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div
            className={`h-1.5 w-1.5 rounded-full ${
              status === "active"
                ? "bg-status-active animate-pulse"
                : status === "complete"
                  ? "bg-status-done"
                  : "bg-text-3"
            }`}
          />
          <h2 className="text-sm font-medium text-text-1">{spec.role}</h2>
        </div>
        <p className="mt-0.5 text-xs text-text-3">{spec.personality}</p>
      </div>

      <div className="space-y-2 border-b border-line px-4 py-3">
        {spec.values.length > 0 && (
          <div className="flex items-start gap-2">
            <Star className="mt-px h-3 w-3 text-warn" />
            <div className="flex flex-wrap gap-1">
              {spec.values.map((v) => (
                <span key={v} className="rounded bg-warn-bg px-1.5 py-px text-[10px] text-warn">{v}</span>
              ))}
            </div>
          </div>
        )}
        {spec.skills.length > 0 && (
          <div className="flex items-start gap-2">
            <Zap className="mt-px h-3 w-3 text-status-active" />
            <div className="flex flex-wrap gap-1">
              {spec.skills.map((s) => (
                <span key={s} className="rounded bg-status-active-bg px-1.5 py-px text-[10px] text-status-active">{s}</span>
              ))}
            </div>
          </div>
        )}
        {spec.rules.length > 0 && (
          <div className="flex items-start gap-2">
            <Shield className="mt-px h-3 w-3 text-danger" />
            <div className="flex flex-wrap gap-1">
              {spec.rules.map((r) => (
                <span key={r} className="rounded bg-danger-bg px-1.5 py-px text-[10px] text-danger">{r}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {thinking && (
          <div className="border-b border-line px-4 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-thinking">
              <Brain className="h-3 w-3" />
              Thinking
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-text-2">
              {thinking}
            </pre>
          </div>
        )}
        {output && (
          <div className="px-4 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-status-done">
              <FileText className="h-3 w-3" />
              Output
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-text-1">
              {output}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
