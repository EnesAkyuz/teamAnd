"use client";

import { useState } from "react";
import {
  Brain,
  FileText,
  Shield,
  Zap,
  Star,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
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
  const [showThinking, setShowThinking] = useState(false);
  const isThinking = status === "active" && !output;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Personality */}
      <div className="shrink-0 px-3 pb-2 pt-1">
        <p className="text-xs text-muted-foreground">{spec.personality}</p>
      </div>

      {/* Badges — scrollable row if overflowing */}
      <div className="shrink-0 overflow-x-auto border-t border-border/40 px-3 py-2">
        <div className="flex gap-1">
          {spec.values.map((v) => (
            <Badge
              key={v}
              variant="outline"
              className="shrink-0 gap-1 text-[10px] font-normal"
            >
              <Star className="h-2.5 w-2.5 text-warn" /> {v}
            </Badge>
          ))}
          {spec.skills.map((s) => (
            <Badge
              key={s}
              variant="outline"
              className="shrink-0 gap-1 text-[10px] font-normal"
            >
              <Zap className="h-2.5 w-2.5 text-primary" /> {s}
            </Badge>
          ))}
          {spec.rules.map((r) => (
            <Badge
              key={r}
              variant="outline"
              className="shrink-0 gap-1 text-[10px] font-normal"
            >
              <Shield className="h-2.5 w-2.5 text-destructive" /> {r}
            </Badge>
          ))}
        </div>
      </div>

      {/* Main scrollable content area */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border/40">
        {/* Thinking section */}
        {thinking && (
          <div className="border-b border-border/40">
            <button
              type="button"
              onClick={() => setShowThinking(!showThinking)}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-thinking transition-colors hover:bg-thinking-bg/30"
            >
              {showThinking ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <Brain className="h-3 w-3" />
              Thinking
              {isThinking && thinking && <ThinkingDots className="ml-1" color="bg-thinking" />}
            </button>
            {showThinking && (
              <div className="bg-thinking-bg/30 px-3 pb-2.5">
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {thinking}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Active indicator (no thinking or output yet) */}
        {status === "active" && !output && !thinking && (
          <div className="flex items-center gap-2 px-3 py-3">
            <ThinkingDots color="bg-primary" />
            <span className="text-[11px] text-muted-foreground">
              Working...
            </span>
          </div>
        )}

        {/* Output */}
        {output && (
          <div className="px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-status-done">
              <FileText className="h-3 w-3" /> Output
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-[12px] leading-relaxed [&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:text-[11px] [&_code]:text-[11px] [&_p]:my-1 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {output}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Pending */}
        {status === "pending" && (
          <div className="flex h-20 items-center justify-center">
            <p className="text-xs text-muted-foreground">
              Waiting for dependencies...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingDots({
  className = "",
  color = "bg-primary",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      <span className={`h-1 w-1 animate-bounce rounded-full ${color} [animation-delay:0ms]`} />
      <span className={`h-1 w-1 animate-bounce rounded-full ${color} [animation-delay:150ms]`} />
      <span className={`h-1 w-1 animate-bounce rounded-full ${color} [animation-delay:300ms]`} />
    </span>
  );
}
