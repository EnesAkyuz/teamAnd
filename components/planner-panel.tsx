"use client";

import { useState } from "react";
import { Brain, ChevronDown, ChevronUp, Maximize2, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface PlannerPanelProps {
  thinking: string;
  output: string;
  isThinking: boolean;
}

export function PlannerPanel({ thinking, output, isThinking }: PlannerPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  const hasContent = thinking || output;
  if (!hasContent && !isThinking) return null;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-border/60 bg-background/90 shadow-lg backdrop-blur-xl transition-all duration-300 ${
        expanded ? "h-[70vh] w-[480px]" : "h-auto max-h-[320px] w-80"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <Brain className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">Planner</span>

        {isThinking && (
          <Badge variant="secondary" className="ml-1 h-4 gap-1 px-1.5 text-[9px]">
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary" />
            thinking
          </Badge>
        )}

        <div className="flex-1" />

        {thinking && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowThinking(!showThinking)}
            className="text-muted-foreground"
          >
            {showThinking ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground"
        >
          {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
        </Button>
      </div>

      {/* Thinking trace (collapsible) */}
      {showThinking && thinking && (
        <div className="border-b border-border/40 bg-thinking-bg/50">
          <ScrollArea className="max-h-32">
            <pre className="whitespace-pre-wrap px-3 py-2 font-mono text-[11px] leading-relaxed text-thinking">
              {thinking}
            </pre>
          </ScrollArea>
        </div>
      )}

      {/* Output — markdown rendered */}
      <ScrollArea className="flex-1">
        <div className="px-3 py-2">
          {output ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-[12px] leading-relaxed [&_pre]:bg-surface-alt [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:text-[11px] [&_code]:text-[11px] [&_p]:my-1 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {output}
              </ReactMarkdown>
            </div>
          ) : isThinking ? (
            <div className="flex items-center gap-2 py-1">
              <ThinkingDots />
              <span className="text-[11px] text-muted-foreground">Designing team structure...</span>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-0.5">
      <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
    </div>
  );
}
