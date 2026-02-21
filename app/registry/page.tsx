"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Search,
  Shield,
  Star,
  Trash2,
  Wrench,
  Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import type { BucketCategory, BucketItem } from "@/lib/types";

interface RegistryItem extends BucketItem {
  environmentName?: string;
}

const CATEGORIES: { key: BucketCategory | "all"; label: string; icon?: typeof Shield; color?: string }[] = [
  { key: "all", label: "All" },
  { key: "rule", label: "Rules", icon: Shield, color: "text-destructive" },
  { key: "skill", label: "Skills", icon: Zap, color: "text-primary" },
  { key: "value", label: "Values", icon: Star, color: "text-warn" },
  { key: "tool", label: "Tools", icon: Wrench, color: "text-muted-foreground" },
];

const PROSE = "prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed [&_pre]:overflow-x-auto [&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:text-xs [&_code]:text-xs [&_p]:my-1.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5";

export default function RegistryPage() {
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<BucketCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [environments, setEnvironments] = useState<{ id: string; name: string }[]>([]);
  const [copyTarget, setCopyTarget] = useState<string | null>(null);

  // Fetch all items
  const fetchItems = useCallback(async () => {
    setLoading(true);
    const url = activeCategory === "all"
      ? "/api/bucket/all"
      : `/api/bucket/all?category=${activeCategory}`;
    const res = await fetch(url);
    const data = await res.json();
    setItems(
      data.map((d: Record<string, unknown>) => ({
        id: d.id as string,
        category: d.category as BucketCategory,
        label: d.label as string,
        content: d.content as string | null,
        createdAt: d.created_at as string,
        environmentName: (d.environments as { name: string } | null)?.name ?? "Unscoped",
      })),
    );
    setLoading(false);
  }, [activeCategory]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Fetch environments for copy dropdown
  useEffect(() => {
    fetch("/api/environments")
      .then((r) => r.json())
      .then((data) =>
        setEnvironments(data.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }))),
      );
  }, []);

  // Search
  const fetchSearch = useCallback(async (q: string) => {
    if (!q.trim()) { fetchItems(); return; }
    setLoading(true);
    const res = await fetch(`/api/bucket/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setItems(
      data.map((d: Record<string, unknown>) => ({
        id: d.id as string,
        category: d.category as BucketCategory,
        label: d.label as string,
        content: d.content as string | null,
        createdAt: d.created_at as string,
        environmentName: (d.environments as { name: string } | null)?.name ?? "Unscoped",
      })),
    );
    setLoading(false);
  }, [fetchItems]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/bucket/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleCopy = async (itemId: string, envId: string) => {
    await fetch("/api/bucket/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, environmentId: envId }),
    });
    setCopyTarget(null);
    // Brief feedback
  };

  const categoryIcon = (cat: BucketCategory) => {
    switch (cat) {
      case "rule": return <Shield className="h-3 w-3 text-destructive" />;
      case "skill": return <Zap className="h-3 w-3 text-primary" />;
      case "value": return <Star className="h-3 w-3 text-warn" />;
      case "tool": return <Wrench className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Canvas
          </Link>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-sm font-semibold">
            Resource Registry
          </h1>
          <div className="flex-1" />
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        {/* Search + Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                fetchSearch(e.target.value);
              }}
              placeholder="Search resources by name or content..."
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="mb-5 flex gap-1 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => { setActiveCategory(cat.key); setSearchQuery(""); }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeCategory === cat.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              {cat.icon && <cat.icon className={`h-3 w-3 ${cat.color}`} />}
              {cat.label}
            </button>
          ))}
        </div>

        {/* Items grid */}
        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Loading...</p>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No resources found.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-card transition-colors hover:border-border/80"
              >
                {/* Item header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {categoryIcon(item.category)}
                  <span className="text-sm font-medium">{item.label}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {item.category}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {item.environmentName}
                  </span>
                  <div className="flex-1" />

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {item.content && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      >
                        {expandedId === item.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </Button>
                    )}

                    {/* Copy to environment */}
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setCopyTarget(copyTarget === item.id ? null : item.id)}
                        title="Copy to environment"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {copyTarget === item.id && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-lg">
                          <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground">Copy to:</p>
                          {environments.map((env) => (
                            <button
                              key={env.id}
                              type="button"
                              onClick={() => handleCopy(item.id, env.id)}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted"
                            >
                              {env.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(item.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Expanded content */}
                {expandedId === item.id && item.content && (
                  <div className="border-t border-border px-4 py-4">
                    <div className={PROSE}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {item.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Inline preview for items without expandable content */}
                {!item.content && item.category !== "tool" && (
                  <div className="border-t border-border/50 px-4 py-2">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
