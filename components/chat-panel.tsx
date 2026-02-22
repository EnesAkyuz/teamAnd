"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Pencil,
  Play,
  Send,
  Square,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useVoiceInput } from "@/hooks/use-voice-input";

export interface ChatMessage {
  id: string;
  role: "user" | "planner";
  content: string;
  thinking?: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  plannerThinking: string;
  plannerOutput: string;
  isDesigning: boolean;
  isRunning: boolean;
  hasSpec: boolean;
  onDesign: (message: string) => void;
  onEdit: (message: string) => void;
  onExecute: (prompt?: string) => void;
  onStop: () => void;
}

export function ChatPanel({
  messages,
  plannerThinking,
  plannerOutput,
  isDesigning,
  isRunning,
  hasSpec,
  onDesign,
  onEdit,
  onExecute,
  onStop,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, plannerThinking, plannerOutput]);

  const isBusy = isDesigning || isRunning;

  const handleVoiceTranscript = useCallback((text: string) => {
    setInput(text);
  }, []);
  const voice = useVoiceInput(handleVoiceTranscript);

  const handleSubmit = () => {
    if (!input.trim() || isBusy) return;
    const msg = input.trim();
    setInput("");
    if (hasSpec) {
      onEdit(msg);
    } else {
      onDesign(msg);
    }
  };

  const hasHistory = messages.length > 0 || plannerThinking || plannerOutput;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-border/60 bg-background/90 shadow-lg backdrop-blur-xl transition-all duration-200 ${
        expanded ? "w-[520px]" : "w-80"
      }`}
      style={{
        height: expanded
          ? "min(75vh, 600px)"
          : hasHistory
            ? "min(380px, 50vh)"
            : "auto",
      }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Chat</span>

        {isDesigning && (
          <Badge variant="secondary" className="h-4 gap-1 px-1.5 text-[9px]">
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary" />
            designing
          </Badge>
        )}

        {isRunning && (
          <Badge variant="secondary" className="h-4 gap-1 px-1.5 text-[9px]">
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-status-active" />
            running
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

      {/* Messages */}
      {hasHistory && (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border/40 px-3 py-2 space-y-3"
        >
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {(plannerThinking || plannerOutput || isDesigning) && (
            <PlannerBubble
              thinking={plannerThinking}
              output={plannerOutput}
              isActive={isDesigning}
            />
          )}
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-border/40 p-2 space-y-1.5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isBusy
              ? "Working..."
              : hasSpec
                ? "Type a prompt to run agents, or instructions to edit config..."
                : "Describe the task to design a team..."
          }
          rows={expanded ? 3 : 2}
          className="w-full resize-none rounded-lg border border-border/40 bg-background/50 px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) {
              if (hasSpec && input.trim()) {
                // Default ⌘Enter = run with prompt when spec exists
                const prompt = input.trim();
                setInput("");
                onExecute(prompt);
              } else {
                handleSubmit();
              }
            }
          }}
        />

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {voice.isSupported && (
            <Button
              size="sm"
              variant={voice.isListening ? "destructive" : "outline"}
              onClick={voice.toggle}
              className="shrink-0"
            >
              {voice.isListening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
            </Button>
          )}
          {isBusy ? (
            <Button size="sm" variant="destructive" onClick={onStop} className="flex-1">
              <Square className="h-3 w-3" /> Stop
            </Button>
          ) : !hasSpec ? (
            <Button size="sm" onClick={handleSubmit} disabled={!input.trim()} className="flex-1">
              <Send className="h-3 w-3" /> Design Team
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="flex-1"
              >
                <Pencil className="h-3 w-3" /> Edit Config
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const prompt = input.trim();
                  if (prompt) setInput("");
                  onExecute(prompt || undefined);
                }}
                className="flex-1"
              >
                <Play className="h-3 w-3" /> {input.trim() ? "Run" : "Run Agents"}
              </Button>
            </>
          )}
        </div>

        {input.trim() && (
          <p className="text-[10px] text-muted-foreground/50">
            ⌘ Enter to {hasSpec ? "run with prompt" : "design"}
          </p>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary/10 px-3 py-1.5 text-sm text-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <PlannerBubble
      thinking={message.thinking ?? ""}
      output={message.content}
      isActive={false}
    />
  );
}

const PROSE_CLASSES =
  "prose prose-sm dark:prose-invert max-w-none overflow-x-auto text-[12px] leading-relaxed [&_pre]:overflow-x-auto [&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:text-[11px] [&_code]:text-[11px] [&_code]:break-all [&_p]:my-1 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0";

function PlannerBubble({
  thinking,
  output,
  isActive,
}: {
  thinking: string;
  output: string;
  isActive: boolean;
}) {
  const [showThinking, setShowThinking] = useState(false);

  return (
    <div className="space-y-1">
      {thinking && (
        <button
          type="button"
          onClick={() => setShowThinking(!showThinking)}
          className="flex items-center gap-1 text-[11px] text-thinking transition-colors hover:text-thinking/80"
        >
          {showThinking ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Brain className="h-3 w-3" />
          <span className="font-medium">Thinking</span>
          {isActive && !output && <ThinkingDots className="ml-1" />}
        </button>
      )}

      {showThinking && thinking && (
        <div className="overflow-y-auto rounded-md bg-thinking-bg/40 px-2.5 py-1.5" style={{ maxHeight: "100px" }}>
          <pre className="whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-thinking/70">
            {thinking}
          </pre>
        </div>
      )}

      {output ? (
        <div className={PROSE_CLASSES}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
        </div>
      ) : isActive && !thinking ? (
        <div className="flex items-center gap-2 py-1">
          <ThinkingDots />
          <span className="text-[11px] text-muted-foreground">Designing team...</span>
        </div>
      ) : null}
    </div>
  );
}

function ThinkingDots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
    </span>
  );
}
