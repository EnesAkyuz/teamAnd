"use client";

import { useState } from "react";
import { Play, Square, RotateCcw } from "lucide-react";
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
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-12 items-center gap-3 border-b border-line px-4">
        <span className="text-sm font-semibold tracking-tight text-text-1">
          agent<span className="text-brand">scope</span>
        </span>

        {active.envSpec && (
          <span className="rounded-full bg-surface-alt px-2.5 py-0.5 text-[11px] text-text-2">
            {active.envSpec.name} / {active.envSpec.agents.length} agents
          </span>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setMode(mode === "live" ? "replay" : "live")}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-text-3 transition-colors hover:bg-surface-alt hover:text-text-1"
        >
          <RotateCcw className="h-3 w-3" />
          {mode === "live" ? "Replay" : "Live"}
        </button>
        <ThemeToggle />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="flex w-64 flex-col border-r border-line bg-surface">
          <div className="flex-1 p-4">
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="What should the team work on?"
              className="h-28 w-full resize-none rounded-md border border-line bg-background px-3 py-2 text-sm text-text-1 placeholder:text-text-3 focus:border-brand/50 focus:outline-none focus:ring-1 focus:ring-brand/20"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) handleSubmit();
              }}
            />
            <button
              type="button"
              onClick={isActive ? live.stop : handleSubmit}
              disabled={!task.trim() && !isActive}
              className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-danger-bg text-danger hover:bg-danger/10"
                  : "bg-brand text-white hover:bg-brand/90 disabled:opacity-30"
              }`}
            >
              {isActive ? (
                <><Square className="h-3 w-3" /> Stop</>
              ) : (
                <><Play className="h-3 w-3" /> Run</>
              )}
            </button>

            {isActive && !active.envSpec && (
              <p className="mt-4 flex items-center gap-1.5 text-[11px] text-text-3">
                <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-brand" />
                Designing team...
              </p>
            )}

            {active.envSpec?.rules && active.envSpec.rules.length > 0 && (
              <div className="mt-5">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-text-3">
                  Rules
                </p>
                {active.envSpec.rules.map((rule, i) => (
                  <p key={`r-${i}`} className="py-0.5 text-[11px] leading-relaxed text-text-2">
                    {rule}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main */}
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1">
              {active.agents.size === 0 && !isActive ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-text-3">
                    Enter a task to get started.
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

            {selectedAgent && (
              <div className="w-72 border-l border-line">
                <AgentDetail
                  spec={selectedAgent.spec}
                  status={selectedAgent.status}
                  thinking={selectedAgent.thinking}
                  output={selectedAgent.output}
                />
              </div>
            )}
          </div>

          <div className="h-32 border-t border-line bg-surface">
            <EventLog events={active.events} />
          </div>
        </div>
      </div>
    </div>
  );
}
