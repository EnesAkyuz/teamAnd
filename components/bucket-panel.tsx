"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
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
  onAdd: (category: BucketCategory, label: string) => void;
  onDelete: (id: string) => void;
  onOptimize?: () => void;
  isOptimizing?: boolean;
}

const SECTIONS: {
  key: BucketCategory;
  label: string;
  icon: typeof Shield;
  color: string;
}[] = [
  { key: "rule", label: "Rules", icon: Shield, color: "text-destructive" },
  { key: "skill", label: "Skills", icon: Zap, color: "text-primary" },
  { key: "value", label: "Values", icon: Star, color: "text-warn" },
  { key: "tool", label: "Tools", icon: Wrench, color: "text-muted-foreground" },
];

export function BucketPanel({
  grouped,
  loading,
  onAdd,
  onDelete,
  onOptimize,
  isOptimizing,
}: BucketPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const totalCount =
    grouped.rules.length +
    grouped.skills.length +
    grouped.values.length +
    grouped.tools.length;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-background/95 hover:text-foreground"
      >
        <Package className="h-3.5 w-3.5" />
        Bucket{totalCount > 0 ? ` (${totalCount})` : ""}
      </button>
    );
  }

  return (
    <div className="w-72 rounded-xl border border-border/60 bg-background/90 shadow-lg backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Package className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">Bucket</span>
        <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
          {totalCount}
        </Badge>
        <div className="flex-1" />
        {onOptimize && totalCount > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onOptimize}
            disabled={isOptimizing}
            className="text-[10px]"
          >
            <Sparkles className="h-3 w-3" />
            {isOptimizing ? "Optimizing..." : "Optimize"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setExpanded(false)}
          className="text-muted-foreground"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Sections */}
      <div className="max-h-[50vh] overflow-y-auto border-t border-border/40">
        {loading ? (
          <div className="p-3 text-xs text-muted-foreground">Loading...</div>
        ) : (
          SECTIONS.map((section) => (
            <BucketSection
              key={section.key}
              section={section}
              items={grouped[`${section.key}s` as keyof typeof grouped]}
              onAdd={(label) => onAdd(section.key, label)}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

function BucketSection({
  section,
  items,
  onAdd,
  onDelete,
}: {
  section: (typeof SECTIONS)[number];
  items: BucketItem[];
  onAdd: (label: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const Icon = section.icon;

  const handleAdd = () => {
    if (!input.trim()) return;
    onAdd(input.trim());
    setInput("");
    setAdding(false);
  };

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-muted/50"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        <Icon className={`h-3 w-3 ${section.color}`} />
        {section.label}
        <span className="text-muted-foreground">({items.length})</span>
        <div className="flex-1" />
        <span
          className="rounded p-0.5 text-muted-foreground hover:bg-muted"
          onClick={(e) => {
            e.stopPropagation();
            setAdding(true);
            setOpen(true);
          }}
          onKeyDown={() => {}}
          role="button"
          tabIndex={0}
        >
          <Plus className="h-3 w-3" />
        </span>
      </button>

      {open && (
        <div className="px-3 pb-2">
          <div className="flex flex-wrap gap-1">
            {items.map((item) => (
              <Badge
                key={item.id}
                variant="outline"
                className="group shrink-0 gap-1 text-[10px] font-normal cursor-grab"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/bucket-item",
                    JSON.stringify({
                      category: item.category,
                      label: item.label,
                      id: item.id,
                    }),
                  );
                  e.dataTransfer.effectAllowed = "copy";
                }}
              >
                {item.label}
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-2 w-2" />
                </button>
              </Badge>
            ))}
          </div>

          {adding && (
            <div className="mt-1.5 flex gap-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") setAdding(false);
                }}
                placeholder={`Add ${section.label.toLowerCase().slice(0, -1)}...`}
                className="flex-1 rounded-md border border-border/60 bg-background px-2 py-0.5 text-[11px] focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                autoFocus
              />
              <Button size="xs" onClick={handleAdd} disabled={!input.trim()}>
                Add
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
