"use client";

import { useState } from "react";
import {
  Brain,
  FileText,
  Shield,
  Zap,
  Star,
  Wrench,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AgentSpec, AgentStatus } from "@/lib/types";

interface AgentDetailProps {
  spec: AgentSpec;
  status: AgentStatus;
  thinking: string;
  output: string;
  onUpdateConfig?: (
    action: "add" | "remove",
    field: "skills" | "values" | "tools" | "rules",
    item: string,
  ) => void;
}

export function AgentDetail({
  spec,
  status,
  thinking,
  output,
  onUpdateConfig,
}: AgentDetailProps) {
  const [showThinking, setShowThinking] = useState(false);
  const [editing, setEditing] = useState(false);
  const isThinking = status === "active" && !output;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-3 pb-2 pt-1">
        <p className="text-xs text-muted-foreground">{spec.personality}</p>
      </div>

      {/* Badges — editable */}
      <div className="shrink-0 border-t border-border/40 px-3 py-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Config
          </span>
          {onUpdateConfig && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setEditing(!editing)}
              className={editing ? "text-primary" : "text-muted-foreground"}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <div className="flex flex-wrap gap-1">
            <ConfigBadges
              items={spec.values}
              field="values"
              icon={Star}
              color="text-warn"
              editing={editing}
              onRemove={onUpdateConfig ? (item) => onUpdateConfig("remove", "values", item) : undefined}
            />
            <ConfigBadges
              items={spec.skills}
              field="skills"
              icon={Zap}
              color="text-primary"
              editing={editing}
              onRemove={onUpdateConfig ? (item) => onUpdateConfig("remove", "skills", item) : undefined}
            />
            <ConfigBadges
              items={spec.rules}
              field="rules"
              icon={Shield}
              color="text-destructive"
              editing={editing}
              onRemove={onUpdateConfig ? (item) => onUpdateConfig("remove", "rules", item) : undefined}
            />
            <ConfigBadges
              items={spec.tools}
              field="tools"
              icon={Wrench}
              color="text-muted-foreground"
              editing={editing}
              onRemove={onUpdateConfig ? (item) => onUpdateConfig("remove", "tools", item) : undefined}
            />
          </div>
        </div>
        {editing && onUpdateConfig && (
          <AddItemRow onAdd={onUpdateConfig} />
        )}
      </div>

      {/* Main scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border/40">
        {thinking && (
          <div className="border-b border-border/40">
            <button
              type="button"
              onClick={() => setShowThinking(!showThinking)}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-thinking transition-colors hover:bg-thinking-bg/30"
            >
              {showThinking ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Brain className="h-3 w-3" />
              Thinking
              {isThinking && thinking && <ThinkingDots className="ml-1" />}
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

        {status === "active" && !output && !thinking && (
          <div className="flex items-center gap-2 px-3 py-3">
            <ThinkingDots />
            <span className="text-[11px] text-muted-foreground">Working...</span>
          </div>
        )}

        {output && (
          <div className="px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-status-done">
              <FileText className="h-3 w-3" /> Output
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-[12px] leading-relaxed [&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:text-[11px] [&_code]:text-[11px] [&_p]:my-1 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
            </div>
          </div>
        )}

        {status === "pending" && (
          <div className="flex h-20 items-center justify-center">
            <p className="text-xs text-muted-foreground">Waiting for dependencies...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigBadges({
  items,
  field,
  icon: Icon,
  color,
  editing,
  onRemove,
}: {
  items: string[];
  field: string;
  icon: typeof Star;
  color: string;
  editing: boolean;
  onRemove?: (item: string) => void;
}) {
  return (
    <>
      {items.map((item) => (
        <Badge
          key={`${field}-${item}`}
          variant="outline"
          className="group shrink-0 gap-1 text-[10px] font-normal"
        >
          <Icon className={`h-2.5 w-2.5 ${color}`} />
          {item}
          {editing && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="ml-0.5 opacity-60 hover:opacity-100"
            >
              <X className="h-2 w-2" />
            </button>
          )}
        </Badge>
      ))}
    </>
  );
}

function AddItemRow({
  onAdd,
}: {
  onAdd: (action: "add", field: "skills" | "values" | "tools" | "rules", item: string) => void;
}) {
  const [input, setInput] = useState("");
  const [field, setField] = useState<"skills" | "values" | "tools" | "rules">("skills");

  const handleAdd = () => {
    if (!input.trim()) return;
    onAdd("add", field, input.trim());
    setInput("");
  };

  return (
    <div className="mt-2 flex gap-1">
      <select
        value={field}
        onChange={(e) => setField(e.target.value as typeof field)}
        className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[10px] focus:outline-none"
      >
        <option value="skills">Skill</option>
        <option value="values">Value</option>
        <option value="tools">Tool</option>
        <option value="rules">Rule</option>
      </select>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        placeholder="Add item..."
        className="flex-1 rounded-md border border-border/60 bg-background px-2 py-0.5 text-[10px] focus:border-primary/40 focus:outline-none"
      />
      <Button size="xs" onClick={handleAdd} disabled={!input.trim()}>
        <Plus className="h-3 w-3" />
      </Button>
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
