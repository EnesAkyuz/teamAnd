"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  FolderOpen,
  Plus,
  Trash2,
  Save,
  GitBranch,
  Clock,
  Share2,
  Check,
  Copy,
  Loader2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Environment, Config, Run } from "@/hooks/use-environments";
import type { EnvironmentSpec } from "@/lib/types";

interface EnvSwitcherProps {
  environments: Environment[];
  activeEnv: Environment | null;
  onSelectEnv: (id: string) => void;
  onCreateEnv: (name: string) => void;
  onDeleteEnv: (id: string) => void;
  // Configs
  configs: Config[];
  activeConfig: Config | null;
  onSelectConfig: (id: string) => void;
  onSaveConfig: (name: string) => void;
  onDeleteConfig: (id: string) => void;
  onLoadConfig: (spec: EnvironmentSpec) => void;
  hasSpec: boolean;
  // Runs
  runs: Run[];
  onReplayRun: (runId: string) => void;
}

export function EnvSwitcher({
  environments,
  activeEnv,
  onSelectEnv,
  onCreateEnv,
  onDeleteEnv,
  configs,
  activeConfig,
  onSelectConfig,
  onSaveConfig,
  onDeleteConfig,
  onLoadConfig,
  hasSpec,
  runs,
  onReplayRun,
}: EnvSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [configName, setConfigName] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleShare = async () => {
    if (!activeEnv) return;
    setSharing(true);
    setShareCode(null);
    try {
      let creatorName = localStorage.getItem("teamand_creator_name");
      if (!creatorName) {
        creatorName = prompt("Your name (for shared packages):") || "Anonymous";
        localStorage.setItem("teamand_creator_name", creatorName);
      }
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environmentId: activeEnv.id, creatorName }),
      });
      const data = await res.json();
      if (data.shareCode) setShareCode(data.shareCode);
    } finally {
      setSharing(false);
    }
  };

  const copyShareCode = () => {
    if (shareCode) {
      navigator.clipboard.writeText(shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleImport = async () => {
    if (!importCode.trim()) return;
    setImportLoading(true);
    setImportError(null);
    try {
      const res = await fetch("/api/share/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareCode: importCode.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setImportError(data.error);
      } else {
        window.location.reload();
      }
    } catch {
      setImportError("Import failed");
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-background/95 hover:text-foreground"
      >
        <FolderOpen className="h-3.5 w-3.5" />
        {activeEnv?.name ?? "No environment"}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border/60 bg-background/95 shadow-xl backdrop-blur-xl">
          {/* Environments */}
          <div className="border-b border-border/40 px-3 py-2">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Environments
            </p>
            <div className="space-y-0.5">
              {environments.map((env) => (
                <div
                  key={env.id}
                  className={`flex items-center justify-between rounded-md px-2 py-1 text-xs cursor-pointer transition-colors ${
                    env.id === activeEnv?.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => { onSelectEnv(env.id); }}
                  >
                    {env.name}
                  </button>
                  {env.id === activeEnv?.id && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleShare(); }}
                      className="text-muted-foreground hover:text-primary p-0.5"
                      title="Share environment"
                    >
                      {sharing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteEnv(env.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            {shareCode && (
              <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-primary/5 border border-primary/20 px-2 py-1.5">
                <code className="flex-1 text-[11px] font-mono text-primary">{shareCode}</code>
                <button
                  type="button"
                  onClick={copyShareCode}
                  className="text-[10px] text-primary hover:text-primary/80"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            )}
            {creating ? (
              <div className="mt-1.5 flex gap-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newName.trim()) {
                      onCreateEnv(newName.trim());
                      setNewName("");
                      setCreating(false);
                    }
                    if (e.key === "Escape") setCreating(false);
                  }}
                  placeholder="Environment name..."
                  className="flex-1 rounded-md border border-border/60 bg-background px-2 py-0.5 text-[11px] focus:outline-none"
                  autoFocus
                />
                <Button size="xs" onClick={() => { if (newName.trim()) { onCreateEnv(newName.trim()); setNewName(""); setCreating(false); } }}>
                  Add
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-1 flex items-center gap-1 text-[11px] text-primary hover:text-primary/80"
              >
                <Plus className="h-3 w-3" /> New environment
              </button>
            )}
          </div>

          {/* Configs */}
          {activeEnv && (
            <div className="border-b border-border/40 px-3 py-2">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                <GitBranch className="mr-1 inline h-3 w-3" />
                Configs
              </p>
              <div className="space-y-0.5">
                {configs.map((cfg) => (
                  <div
                    key={cfg.id}
                    className={`group flex items-center justify-between rounded-md px-2 py-1 text-xs cursor-pointer transition-colors ${
                      cfg.id === activeConfig?.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => { onSelectConfig(cfg.id); onLoadConfig(cfg.spec); }}
                    >
                      {cfg.name}
                      <span className="ml-1 text-muted-foreground text-[9px]">
                        {cfg.spec.agents?.length ?? 0} agents
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteConfig(cfg.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {configs.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50">No saved configs</p>
                )}
              </div>
              {hasSpec && (
                savingConfig ? (
                  <div className="mt-1.5 flex gap-1">
                    <input
                      type="text"
                      value={configName}
                      onChange={(e) => setConfigName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && configName.trim()) {
                          onSaveConfig(configName.trim());
                          setConfigName("");
                          setSavingConfig(false);
                        }
                        if (e.key === "Escape") setSavingConfig(false);
                      }}
                      placeholder="Config name..."
                      className="flex-1 rounded-md border border-border/60 bg-background px-2 py-0.5 text-[11px] focus:outline-none"
                      autoFocus
                    />
                    <Button size="xs" onClick={() => { if (configName.trim()) { onSaveConfig(configName.trim()); setConfigName(""); setSavingConfig(false); } }}>
                      Save
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSavingConfig(true)}
                    className="mt-1 flex items-center gap-1 text-[11px] text-primary hover:text-primary/80"
                  >
                    <Save className="h-3 w-3" /> Save current config
                  </button>
                )
              )}
            </div>
          )}

          {/* Runs */}
          {activeConfig && runs.length > 0 && (
            <div className="border-b border-border/40 px-3 py-2">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                <Clock className="mr-1 inline h-3 w-3" />
                Runs
              </p>
              <div className="max-h-32 space-y-0.5 overflow-y-auto">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => { onReplayRun(run.id); setOpen(false); }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-[11px] transition-colors hover:bg-muted/50"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      run.status === "complete" ? "bg-status-done" :
                      run.status === "running" ? "bg-primary animate-pulse" :
                      "bg-muted-foreground"
                    }`} />
                    <span className="flex-1 truncate text-left text-muted-foreground">
                      {run.prompt || "No prompt"}
                    </span>
                    <span className="text-[9px] text-muted-foreground/50">
                      {new Date(run.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Import */}
          <div className="border-t border-border/40 px-3 py-2">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              <Download className="mr-1 inline h-3 w-3" />
              Import
            </p>
            {importing ? (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={importCode}
                    onChange={(e) => setImportCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && importCode.trim()) handleImport();
                      if (e.key === "Escape") setImporting(false);
                    }}
                    placeholder="Paste share code..."
                    className="flex-1 rounded-md border border-border/60 bg-background px-2 py-0.5 text-[11px] font-mono focus:outline-none"
                    autoFocus
                  />
                  <Button size="xs" onClick={handleImport} disabled={importLoading || !importCode.trim()}>
                    {importLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Import"}
                  </Button>
                </div>
                {importError && <p className="text-[10px] text-destructive">{importError}</p>}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setImporting(true)}
                className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80"
              >
                <Download className="h-3 w-3" /> Import from share code
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
