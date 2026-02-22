"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Loader2, Maximize2, Minimize2, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface RunSummaryProps {
  prompt: string;
  synthesis: string;
  isSynthesizing: boolean;
  isComplete: boolean;
}

const PROSE = "prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed overflow-x-auto [&_pre]:overflow-x-auto [&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:text-xs [&_code]:text-xs [&_p]:my-1.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5";

export function RunSummary({ prompt, synthesis, isSynthesizing, isComplete }: RunSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);

  if (!synthesis && !isSynthesizing) return null;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-border/60 bg-background/90 shadow-lg backdrop-blur-xl transition-all duration-200 ${
        expanded ? "w-[600px]" : "w-96"
      }`}
      style={{ maxHeight: expanded ? "80vh" : "400px" }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-3 py-2">
        <FileText className="h-3.5 w-3.5 text-status-done" />
        <span className="text-xs font-medium">
          {isComplete ? "Run Summary" : "Synthesizing..."}
        </span>

        {isSynthesizing && (
          <Badge variant="secondary" className="h-4 gap-1 px-1.5 text-[9px]">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> working
          </Badge>
        )}

        {isComplete && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[9px] border-status-done/30 text-status-done">
            complete
          </Badge>
        )}

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground"
        >
          {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
        </Button>
      </div>

      {/* Prompt */}
      <button
        type="button"
        onClick={() => setShowPrompt(!showPrompt)}
        className="flex shrink-0 items-center gap-1.5 border-b border-border/40 px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-muted/30"
      >
        <MessageSquare className="h-3 w-3 text-primary" />
        <span className="font-medium text-muted-foreground">Prompt</span>
        {showPrompt ? <ChevronUp className="h-2.5 w-2.5 text-muted-foreground" /> : <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />}
      </button>
      {showPrompt && (
        <div className="shrink-0 border-b border-border/40 bg-primary/5 px-3 py-2">
          <p className="text-xs text-foreground">{prompt}</p>
        </div>
      )}

      {/* Synthesis output */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        {synthesis ? (
          <div className={PROSE}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{synthesis}</ReactMarkdown>
          </div>
        ) : isSynthesizing ? (
          <div className="flex items-center gap-2 py-2">
            <span className="flex items-center gap-0.5">
              <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
            </span>
            <span className="text-xs text-muted-foreground">Combining agent outputs...</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
