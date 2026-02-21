"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Package,
  Plus,
  Shield,
  Sparkles,
  Star,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BucketCategory, BucketItem } from "@/lib/types";

interface BucketPanelProps {
  grouped: {
    rules: BucketItem[];
    skills: BucketItem[];
    values: BucketItem[];
    tools: BucketItem[];
  };
  loading: boolean;
  onAdd: (category: BucketCategory, label: string, content?: string) => void;
  onAddItems: (items: { category: BucketCategory; label: string; content?: string }[]) => void;
  onDelete: (id: string) => void;
  onOptimize?: () => void;
  isOptimizing?: boolean;
}

const SECTIONS: {
  key: BucketCategory;
  label: string;
  icon: typeof Shield;
  color: string;
  canGenerate: boolean;
}[] = [
  { key: "rule", label: "Rules", icon: Shield, color: "text-destructive", canGenerate: true },
  { key: "skill", label: "Skills", icon: Zap, color: "text-primary", canGenerate: true },
  { key: "value", label: "Values", icon: Star, color: "text-warn", canGenerate: true },
  { key: "tool", label: "Tools", icon: Wrench, color: "text-muted-foreground", canGenerate: false },
];

export function BucketPanel({
  grouped,
  loading,
  onAdd,
  onAddItems,
  onDelete,
  onOptimize,
  isOptimizing,
}: BucketPanelProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const totalCount =
    grouped.rules.length + grouped.skills.length + grouped.values.length + grouped.tools.length;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-background/95 hover:text-foreground"
      >
        <Package className="h-3.5 w-3.5" />
        Bucket{totalCount > 0 ? ` (${totalCount})` : ""}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-xl border border-border/60 bg-background/95 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
            <span className="text-xs font-medium">Environment Bucket</span>
            <div className="flex-1" />
            {onOptimize && totalCount > 0 && (
              <Button variant="ghost" size="xs" onClick={onOptimize} disabled={isOptimizing} className="text-[10px]">
                <Sparkles className="h-3 w-3" />
                {isOptimizing ? "..." : "Optimize"}
              </Button>
            )}
          </div>

          <div className="max-h-[50vh] overflow-y-auto">
            {loading ? (
              <div className="p-3 text-xs text-muted-foreground">Loading...</div>
            ) : (
              SECTIONS.map((section) => (
                <BucketSection
                  key={section.key}
                  section={section}
                  items={grouped[`${section.key}s` as keyof typeof grouped]}
                  onAdd={(label, content) => onAdd(section.key, label, content)}
                  onAddItems={(items) => onAddItems(items.map((i) => ({ ...i, category: section.key })))}
                  onDelete={onDelete}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BucketSection({
  section,
  items,
  onAdd,
  onAddItems,
  onDelete,
}: {
  section: (typeof SECTIONS)[number];
  items: BucketItem[];
  onAdd: (label: string, content?: string) => void;
  onAddItems: (items: { label: string; content?: string }[]) => void;
  onDelete: (id: string) => void;
}) {
  const [sectionOpen, setSectionOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genPrompt, setGenPrompt] = useState("");
  const [input, setInput] = useState("");
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const Icon = section.icon;

  const handleAdd = () => {
    if (!input.trim()) return;
    onAdd(input.trim());
    setInput("");
    setAdding(false);
  };

  const handleGenerate = async () => {
    if (!genPrompt.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/bucket/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: section.key, prompt: genPrompt.trim() }),
      });
      const data = await res.json();
      if (data.items) {
        onAddItems(data.items.map((i: { label: string; content?: string }) => ({
          label: i.label,
          content: i.content,
        })));
      }
      setGenPrompt("");
    } catch (e) {
      console.error("Generate error:", e);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        type="button"
        onClick={() => setSectionOpen(!sectionOpen)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-muted/50"
      >
        {sectionOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <Icon className={`h-3 w-3 ${section.color}`} />
        {section.label}
        <span className="text-muted-foreground">({items.length})</span>
        <div className="flex-1" />
        {section.canGenerate && (
          <span
            className="rounded p-0.5 text-primary hover:bg-primary/10"
            onClick={(e) => { e.stopPropagation(); setAdding(false); setGenPrompt(""); setSectionOpen(true); }}
            role="button"
            tabIndex={0}
            onKeyDown={() => {}}
            title="Generate with AI"
          >
            <Sparkles className="h-3 w-3" />
          </span>
        )}
        <span
          className="rounded p-0.5 text-muted-foreground hover:bg-muted"
          onClick={(e) => { e.stopPropagation(); setAdding(true); setSectionOpen(true); }}
          role="button"
          tabIndex={0}
          onKeyDown={() => {}}
        >
          <Plus className="h-3 w-3" />
        </span>
      </button>

      {sectionOpen && (
        <div className="px-3 pb-2">
          <div className="flex flex-wrap gap-1">
            {items.map((item) => (
              <div key={item.id} className="group relative">
                <Badge
                  variant="outline"
                  className="shrink-0 gap-1 text-[10px] font-normal cursor-grab"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/bucket-item",
                      JSON.stringify({ category: item.category, label: item.label, id: item.id }),
                    );
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  {item.content && (
                    <button
                      type="button"
                      onClick={() => setExpandedSkill(expandedSkill === item.id ? null : item.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <FileText className="h-2.5 w-2.5" />
                    </button>
                  )}
                  {item.label}
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </Badge>
                {expandedSkill === item.id && item.content && (
                  <div className="mt-1 max-h-32 overflow-y-auto rounded-md border border-border/40 bg-muted/30 p-2">
                    <pre className="whitespace-pre-wrap text-[10px] leading-relaxed text-muted-foreground">
                      {item.content}
                    </pre>
                  </div>
                )}
              </div>
            ))}
            {items.length === 0 && !adding && (
              <span className="text-[10px] text-muted-foreground/50">None yet</span>
            )}
          </div>

          {/* Manual add */}
          {adding && (
            <div className="mt-1.5 flex gap-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
                placeholder={`Add ${section.label.toLowerCase().slice(0, -1)}...`}
                className="flex-1 rounded-md border border-border/60 bg-background px-2 py-0.5 text-[11px] focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                autoFocus
              />
              <Button size="xs" onClick={handleAdd} disabled={!input.trim()}>Add</Button>
            </div>
          )}

          {/* AI generate */}
          {section.canGenerate && genPrompt !== undefined && (
            <div className="mt-1.5">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={genPrompt}
                  onChange={(e) => setGenPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); if (e.key === "Escape") setGenPrompt(""); }}
                  placeholder={`Describe ${section.label.toLowerCase()} to generate...`}
                  className="flex-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] placeholder:text-primary/40 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                <Button size="xs" onClick={handleGenerate} disabled={!genPrompt.trim() || generating}>
                  {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
