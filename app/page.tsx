"use client";

import { useState } from "react";
import { Play, Square, History } from "lucide-react";
import { AgentCanvas } from "@/components/agent-canvas";
import { AgentDetail } from "@/components/agent-detail";
import { EventLog } from "@/components/event-log";
import { ThemeToggle } from "@/components/theme-toggle";
import { useOrchestrate } from "@/hooks/use-orchestrate";
import { useReplay } from "@/hooks/use-replay";

export default function Home() {
  const [task, setTask] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "replay">("live");

  const live = useOrchestrate();
  const replay = useReplay();
  const active = mode === "live" ? live : replay;

  const handleSubmit = () => {
    if (!task.trim()) return;
    setMode("live");
    setSelectedAgentId(null);
    live.start(task);
  };

  const selectedAgent = selectedAgentId
    ? active.agents.get(selectedAgentId)
    : null;

  const isActive = mode === "live" ? live.isRunning : replay.isReplaying;

  return (
    <div className="noise-bg relative flex h-screen flex-col bg-background text-text-primary">
      {/* Top bar */}
      <header className="relative z-10 flex items-center gap-4 border-b border-border-subtle px-6 py-3">
        <h1
          className="text-xl tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="text-brand">Agent</span>
          <span className="text-text-primary">Scope</span>
        </h1>
        {active.envSpec && (
          <div className="ml-3 rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs text-text-secondary">
            {active.envSpec.name} — {active.envSpec.agents.length} agents
          </div>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setMode(mode === "live" ? "replay" : "live")}
          className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          <History className="h-3.5 w-3.5" />
          {mode === "live" ? "History" : "Back to Live"}
        </button>
        <ThemeToggle />
      </header>

      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Left panel — task input */}
        <div className="flex w-72 flex-col border-r border-border-subtle bg-surface">
          <div className="flex-1 p-5">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-widest text-text-tertiary">
              Task
            </label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe what you want the AI team to accomplish..."
              className="h-32 w-full resize-none rounded-lg border border-border-subtle bg-background px-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary transition-colors focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) handleSubmit();
              }}
            />
            <button
              type="button"
              onClick={isActive ? live.stop : handleSubmit}
              disabled={!task.trim() && !isActive}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-accent-rose/10 text-accent-rose hover:bg-accent-rose/20"
                  : "bg-brand text-white shadow-sm hover:opacity-90 disabled:opacity-30"
              }`}
            >
              {isActive ? (
                <>
                  <Square className="h-3.5 w-3.5" /> Stop
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> Spawn Environment
                </>
              )}
            </button>

            {/* Waiting state */}
            {isActive && !active.envSpec && (
              <div className="mt-6 flex items-center gap-2 text-xs text-text-tertiary">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                Designing team...
              </div>
            )}

            {/* Environment rules */}
            {active.envSpec && (
              <div className="mt-6">
                <label className="mb-2 block text-[11px] font-medium uppercase tracking-widest text-text-tertiary">
                  Environment Rules
                </label>
                <div className="space-y-1.5">
                  {active.envSpec.rules.map((rule, i) => (
                    <div
                      key={`rule-${i}`}
                      className="rounded-md border border-border-subtle bg-background px-2.5 py-1.5 text-xs leading-relaxed text-text-secondary"
                    >
                      {rule}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center + Right panels */}
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 overflow-hidden">
            {/* Canvas */}
            <div className="flex-1">
              {active.agents.size === 0 && !isActive ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-text-tertiary">
                  <div
                    className="text-3xl opacity-60"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    AgentScope
                  </div>
                  <p className="max-w-xs text-center text-sm">
                    Describe a task and watch AI design and deploy its own team
                    of specialized agents.
                  </p>
                </div>
              ) : (
                <AgentCanvas
                  agents={active.agents}
                  selectedAgentId={selectedAgentId}
                  onSelectAgent={setSelectedAgentId}
                />
              )}
            </div>

            {/* Right panel — agent detail */}
            {selectedAgent && (
              <div className="w-80 overflow-hidden border-l border-border-subtle">
                <AgentDetail
                  spec={selectedAgent.spec}
                  status={selectedAgent.status}
                  thinking={selectedAgent.thinking}
                  output={selectedAgent.output}
                />
              </div>
            )}
          </div>

          {/* Bottom — event log */}
          <div className="h-36 border-t border-border-subtle bg-surface">
            <EventLog events={active.events} />
          </div>
        </div>
      </div>
    </div>
  );
}
