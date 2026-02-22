"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  Search,
  Send,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AlignmentStatus, BucketCategory, BucketItem } from "@/lib/types";

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

const ALIGNMENT_FILTERS: { key: AlignmentStatus | "all" | "unreviewed"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "favorable", label: "Favorable" },
  { key: "conflicting", label: "Conflicting" },
  { key: "neutral", label: "Neutral" },
  { key: "unreviewed", label: "Unreviewed" },
];

const PROSE = "prose prose-sm dark:prose-invert max-w-none text-[13px] leading-relaxed [&_pre]:overflow-x-auto [&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:text-xs [&_code]:text-xs [&_p]:my-1.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5";

function alignmentDot(a: AlignmentStatus | null | undefined) {
  if (a === "favorable") return "bg-status-done";
  if (a === "conflicting") return "bg-destructive";
  if (a === "neutral") return "bg-muted-foreground";
  return "";
}

function categoryIcon(cat: BucketCategory) {
  switch (cat) {
    case "rule": return <Shield className="h-3 w-3 text-destructive" />;
    case "skill": return <Zap className="h-3 w-3 text-primary" />;
    case "value": return <Star className="h-3 w-3 text-warn" />;
    case "tool": return <Wrench className="h-3 w-3 text-muted-foreground" />;
  }
}

export default function RegistryPage() {
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<BucketCategory | "all">("all");
  const [alignmentFilter, setAlignmentFilter] = useState<AlignmentStatus | "all" | "unreviewed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [environments, setEnvironments] = useState<{ id: string; name: string }[]>([]);
  const [copyTarget, setCopyTarget] = useState<string | null>(null);

  // Alignment chat state — persisted in Supabase
  interface ChatMsg { role: "user" | "assistant"; content: string; thinking?: string; toolCalls?: string[] }
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatThinking, setChatThinking] = useState("");
  const [chatStreaming, setChatStreaming] = useState("");
  const [chatToolCalls, setChatToolCalls] = useState<string[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Load chat history from DB
  useEffect(() => {
    fetch("/api/alignment/messages")
      .then((r) => r.json())
      .then((data: { role: string; content: string; thinking: string | null; tool_calls: string[] | null }[]) => {
        setChatMessages(data.map((d) => ({
          role: d.role as "user" | "assistant",
          content: d.content,
          thinking: d.thinking ?? undefined,
          toolCalls: d.tool_calls ?? undefined,
        })));
      });
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const url = activeCategory === "all" ? "/api/bucket/all" : `/api/bucket/all?category=${activeCategory}`;
    const res = await fetch(url);
    const data = await res.json();
    setItems(data.map((d: Record<string, unknown>) => ({
      id: d.id as string,
      category: d.category as BucketCategory,
      label: d.label as string,
      content: d.content as string | null,
      alignment: d.alignment as AlignmentStatus | null,
      alignmentReason: d.alignment_reason as string | null,
      createdAt: d.created_at as string,
      environmentName: (d.environments as { name: string } | null)?.name ?? "Unscoped",
    })));
    setLoading(false);
  }, [activeCategory]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => {
    fetch("/api/environments").then((r) => r.json()).then((data) =>
      setEnvironments(data.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name }))),
    );
  }, []);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages, chatStreaming]);

  const fetchSearch = useCallback(async (q: string) => {
    if (!q.trim()) { fetchItems(); return; }
    setLoading(true);
    const res = await fetch(`/api/bucket/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setItems(data.map((d: Record<string, unknown>) => ({
      id: d.id as string,
      category: d.category as BucketCategory,
      label: d.label as string,
      content: d.content as string | null,
      alignment: d.alignment as AlignmentStatus | null,
      alignmentReason: d.alignment_reason as string | null,
      createdAt: d.created_at as string,
      environmentName: (d.environments as { name: string } | null)?.name ?? "Unscoped",
    })));
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
  };

  // Alignment chat
  const sendChat = async (message: string) => {
    const userMsg: ChatMsg = { role: "user", content: message };
    const apiMessages = [...chatMessages.map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: message }];
    setChatMessages((prev) => [...prev, userMsg]);
    // Persist user message
    fetch("/api/alignment/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user", content: message }),
    });
    setChatInput("");
    setIsChatting(true);
    setChatThinking("");
    setChatStreaming("");
    setChatToolCalls([]);

    let fullText = "";
    let fullThinking = "";
    const tools: string[] = [];

    try {
      const res = await fetch("/api/alignment/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            switch (event.type) {
              case "turn_start":
                // New turn — thinking for this turn is separate from text
                setChatThinking("");
                break;
              case "thinking":
                fullThinking += event.content;
                setChatThinking((prev) => prev + event.content);
                break;
              case "text":
                fullText += event.content;
                setChatStreaming(fullText);
                // Clear thinking display once text starts (it's saved in fullThinking)
                setChatThinking("");
                break;
              case "tool_call": {
                let label = event.tool;
                try {
                  const parsed = JSON.parse(event.result || "{}");
                  if (event.tool === "mark_alignment") {
                    label = parsed.error
                      ? `mark failed: ${parsed.error}`
                      : `Marked ${parsed.alignment}: ${(parsed.reason || "").slice(0, 40)}`;
                  }
                } catch { /* keep raw label */ }
                tools.push(label);
                setChatToolCalls([...tools]);
                if (event.tool === "mark_alignment") {
                  setTimeout(fetchItems, 300);
                }
                break;
              }
              case "error":
                fullText += `\n\n**Error:** ${event.message}`;
                setChatStreaming(fullText);
                break;
              case "done": {
                const assistantMsg: ChatMsg = {
                  role: "assistant",
                  content: fullText,
                  thinking: fullThinking || undefined,
                  toolCalls: tools.length > 0 ? tools : undefined,
                };
                setChatMessages((prev) => [...prev, assistantMsg]);
                setChatStreaming("");
                setChatThinking("");
                setChatToolCalls([]);
                fetch("/api/alignment/messages", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    role: "assistant",
                    content: fullText,
                    thinking: fullThinking || null,
                    tool_calls: tools.length > 0 ? tools : null,
                  }),
                });
                break;
              }
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      console.error("Alignment chat error:", e);
    } finally {
      setIsChatting(false);
    }
  };

  const clearChat = async () => {
    setChatMessages([]);
    await fetch("/api/alignment/messages", { method: "DELETE" });
  };

  // Filter items
  const filtered = items.filter((item) => {
    if (alignmentFilter === "all") return true;
    if (alignmentFilter === "unreviewed") return !item.alignment;
    return item.alignment === alignmentFilter;
  });

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-3 px-6 py-2.5">
          <Link href="/" className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Canvas
          </Link>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-sm font-semibold">Resource Registry</h1>
          <Badge variant="secondary" className="text-[10px]">{items.length} items</Badge>
          <div className="flex-1" />
          <ThemeToggle />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 border-t border-border/50 px-6 py-2">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); fetchSearch(e.target.value); }}
              placeholder="Search by name or content..."
              className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="flex gap-0.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => { setActiveCategory(cat.key); setSearchQuery(""); }}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  activeCategory === cat.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {cat.icon && <cat.icon className={`h-3 w-3 ${cat.color}`} />}
                {cat.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border" />

          <div className="flex gap-0.5">
            {ALIGNMENT_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setAlignmentFilter(f.key)}
                className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                  alignmentFilter === f.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {f.key !== "all" && f.key !== "unreviewed" && (
                  <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${alignmentDot(f.key as AlignmentStatus)}`} />
                )}
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Resource list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No resources found.</p>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((item) => {
                const borderClass =
                  item.alignment === "favorable" ? "border-status-done/40" :
                  item.alignment === "conflicting" ? "border-destructive/40" :
                  item.alignment === "neutral" ? "border-muted-foreground/30" :
                  "border-border/80";
                const bgClass =
                  item.alignment === "favorable" ? "bg-[var(--status-done-bg)]" :
                  item.alignment === "conflicting" ? "bg-[var(--danger-bg)]" :
                  "bg-card";
                const leftAccent =
                  item.alignment === "favorable" ? "bg-status-done" :
                  item.alignment === "conflicting" ? "bg-destructive" :
                  item.alignment === "neutral" ? "bg-muted-foreground" :
                  "";

                return (
                <div key={item.id} className={`group relative overflow-hidden rounded-lg border ${borderClass} ${bgClass} transition-colors hover:border-border`}>
                  {/* Left accent bar */}
                  {leftAccent && (
                    <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${leftAccent}`} />
                  )}

                  <div className="flex items-center gap-2.5 px-3 py-2.5 pl-3.5">
                    {categoryIcon(item.category)}
                    <span className="text-xs font-medium">{item.label}</span>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">{item.category}</Badge>

                    {item.alignment && (
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 h-4 ${
                          item.alignment === "favorable" ? "border-status-done/50 text-status-done" :
                          item.alignment === "conflicting" ? "border-destructive/50 text-destructive" :
                          "border-muted-foreground/50 text-muted-foreground"
                        }`}
                      >
                        {item.alignment === "favorable" ? <Check className="mr-0.5 h-2.5 w-2.5" /> :
                         item.alignment === "conflicting" ? <X className="mr-0.5 h-2.5 w-2.5" /> : null}
                        {item.alignment}
                      </Badge>
                    )}

                    <span className="text-[10px] text-muted-foreground">{item.environmentName}</span>
                    <div className="flex-1" />

                    {item.content && (
                      <Button variant="ghost" size="icon-xs" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                        {expandedId === item.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </Button>
                    )}

                    <div className="relative">
                      <Button variant="ghost" size="icon-xs" onClick={() => setCopyTarget(copyTarget === item.id ? null : item.id)} title="Copy to environment">
                        <Copy className="h-3 w-3" />
                      </Button>
                      {copyTarget === item.id && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-popover p-1 shadow-lg">
                          <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground">Copy to:</p>
                          {environments.map((env) => (
                            <button key={env.id} type="button" onClick={() => handleCopy(item.id, env.id)} className="flex w-full items-center rounded-md px-2 py-1 text-[11px] hover:bg-muted">
                              {env.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Alignment reason inline */}
                  {item.alignmentReason && (
                    <div className="px-3.5 pb-1.5 -mt-1">
                      <p className="text-[10px] italic text-muted-foreground">{item.alignmentReason}</p>
                    </div>
                  )}

                  {/* Content preview */}
                  {item.content && expandedId !== item.id && (
                    <div className="border-t border-border/30 px-3.5 py-1.5">
                      <p className="line-clamp-2 text-[11px] text-muted-foreground">{item.content.slice(0, 150)}</p>
                    </div>
                  )}

                  {expandedId === item.id && item.content && (
                    <div className="border-t border-border px-4 py-3">
                      <div className={PROSE}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Alignment chat */}
        <div className="w-80 shrink-0 flex flex-col border-l border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium">Alignment Agent</span>
            {isChatting && (
              <Badge variant="secondary" className="h-4 gap-1 px-1.5 text-[9px]">
                <span className="h-1 w-1 animate-pulse rounded-full bg-primary" /> working
              </Badge>
            )}
            <div className="flex-1" />
            {chatMessages.length > 0 && (
              <Button variant="ghost" size="icon-xs" onClick={clearChat} title="Clear chat" className="text-muted-foreground">
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Chat messages */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatMessages.length === 0 && !chatStreaming && !chatThinking && (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <Sparkles className="h-5 w-5 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">Tell me about your goals and I'll evaluate your resources.</p>
                <Button size="sm" variant="outline" onClick={() => sendChat("Analyze my resources and help me understand which ones align with my needs. Start by asking me about my goals.")}>
                  <Sparkles className="h-3 w-3" /> Start Analysis
                </Button>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={`msg-${i}`}>
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-lg bg-primary/10 px-3 py-1.5 text-xs">{msg.content}</div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Thinking trace (collapsible) */}
                    {msg.thinking && (
                      <button
                        type="button"
                        onClick={() => setShowThinking(showThinking ? false : true)}
                        className="flex items-center gap-1 text-[10px] text-thinking hover:text-thinking/80"
                      >
                        <Brain className="h-3 w-3" />
                        <ChevronRight className={`h-2.5 w-2.5 transition-transform ${showThinking ? "rotate-90" : ""}`} />
                        Thought process
                      </button>
                    )}
                    {msg.thinking && showThinking && (
                      <div className="max-h-24 overflow-y-auto rounded-md bg-thinking-bg/40 px-2 py-1.5">
                        <pre className="whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-thinking/70">{msg.thinking}</pre>
                      </div>
                    )}
                    {/* Tool calls summary */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {msg.toolCalls.map((tc, j) => (
                          <Badge key={`tc-${j}`} variant="secondary" className="text-[9px] h-4 px-1.5">
                            {tc}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {/* Text content */}
                    <div className="prose prose-sm dark:prose-invert max-w-none text-xs [&_p]:my-0.5 [&_ul]:my-0.5 [&_li]:my-0">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Live thinking */}
            {chatThinking && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-thinking">
                  <Brain className="h-3 w-3" />
                  Thinking
                  <span className="flex items-center gap-0.5">
                    <span className="h-1 w-1 animate-bounce rounded-full bg-thinking [animation-delay:0ms]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-thinking [animation-delay:150ms]" />
                    <span className="h-1 w-1 animate-bounce rounded-full bg-thinking [animation-delay:300ms]" />
                  </span>
                </div>
                <div className="max-h-20 overflow-y-auto rounded-md bg-thinking-bg/40 px-2 py-1.5">
                  <pre className="whitespace-pre-wrap font-mono text-[9px] leading-relaxed text-thinking/70">{chatThinking}</pre>
                </div>
              </div>
            )}

            {/* Live tool calls */}
            {chatToolCalls.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {chatToolCalls.map((tc, j) => (
                  <Badge key={`ltc-${j}`} variant="secondary" className="text-[9px] h-4 px-1.5 animate-pulse">
                    {tc}
                  </Badge>
                ))}
              </div>
            )}

            {/* Streaming text */}
            {chatStreaming && (
              <div className="prose prose-sm dark:prose-invert max-w-none text-xs [&_p]:my-0.5 [&_ul]:my-0.5 [&_li]:my-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{chatStreaming}</ReactMarkdown>
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="shrink-0 border-t border-border p-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && chatInput.trim() && !isChatting) sendChat(chatInput.trim()); }}
                placeholder="Tell me about your goals..."
                className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:border-primary/40 focus:outline-none"
                disabled={isChatting}
              />
              <Button size="icon-sm" onClick={() => chatInput.trim() && sendChat(chatInput.trim())} disabled={!chatInput.trim() || isChatting}>
                {isChatting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
