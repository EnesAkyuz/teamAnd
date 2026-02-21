"use client";

import { useState } from "react";
import { Play, Square, RotateCcw, X } from "lucide-react";
import { AgentCanvas } from "@/components/agent-canvas";
import { AgentDetail } from "@/components/agent-detail";
import { EventLog } from "@/components/event-log";
import { PlannerPanel } from "@/components/planner-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useOrchestrate } from "@/hooks/use-orchestrate";
import { useReplay } from "@/hooks/use-replay";

export default function Home() {
  const [task, setTask] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "replay">("live");

  const live = useOrchestrate();
  const replay = useReplay();

  const activeAgents = mode === "live" ? live.agents : replay.agents;
  const activeEvents = mode === "live" ? live.events : replay.events;
  const activeEnvSpec = mode === "live" ? live.envSpec : replay.envSpec;

  const handleSubmit = () => {
    if (!task.trim()) return;
    setMode("live");
    setSelectedAgentId(null);
    live.start(task);
  };

  const selectedAgent = selectedAgentId
    ? activeAgents.get(selectedAgentId)
    : null;

  const isActive = mode === "live" ? live.isRunning : replay.isReplaying;
  const hasContent = activeAgents.size > 0 || isActive;

  // Determine if planner is currently thinking (before env_created)
  const isPlannerPhase = isActive && !activeEnvSpec;
  const hasPlannerContent = live.plannerThinking || live.plannerOutput;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Canvas fills everything */}
      <div className="absolute inset-0">
        {hasContent && activeAgents.size > 0 ? (
          <AgentCanvas
            agents={activeAgents}
            selectedAgentId={selectedAgentId}
            onSelectAgent={setSelectedAgentId}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {isPlannerPhase
                ? ""
                : "Enter a task to spawn your agent team."}
            </p>
          </div>
        )}
      </div>

      {/* Top bar — floating */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3 pt-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur-md">
          <span className="text-sm font-semibold tracking-tight">
            agent<span className="text-primary">scope</span>
          </span>
        </div>

        {activeEnvSpec && (
          <Badge
            variant="secondary"
            className="pointer-events-auto border border-border/60 bg-background/80 text-[11px] text-muted-foreground backdrop-blur-md"
          >
            {activeEnvSpec.name} / {activeEnvSpec.agents.length} agents
          </Badge>
        )}

        {live.isComplete && (
          <Badge
            variant="secondary"
            className="pointer-events-auto border border-status-done/30 bg-status-done-bg/80 text-[11px] text-status-done backdrop-blur-md"
          >
            Complete
          </Badge>
        )}

        <div className="flex-1" />

        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border/60 bg-background/80 p-1 shadow-sm backdrop-blur-md">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setMode(mode === "live" ? "replay" : "live")}
          >
            <RotateCcw className="h-3 w-3" />
            {mode === "live" ? "Replay" : "Live"}
          </Button>
          <ThemeToggle />
        </div>
      </div>

      {/* Task input — floating bottom-left */}
      <div className="pointer-events-none absolute bottom-0 left-0 z-20 w-80 p-3">
        <div className="pointer-events-auto flex flex-col gap-2 rounded-xl border border-border/60 bg-background/80 p-3 shadow-lg backdrop-blur-xl">
          <Textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="What should the team work on?"
            className="min-h-[72px] resize-none border-0 bg-transparent p-0 text-sm shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey) handleSubmit();
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {task.trim() ? "⌘ Enter to run" : ""}
            </span>
            {isActive ? (
              <Button size="sm" variant="destructive" onClick={live.stop}>
                <Square className="h-3 w-3" /> Stop
              </Button>
            ) : (
              <Button size="sm" onClick={handleSubmit} disabled={!task.trim()}>
                <Play className="h-3 w-3" /> Run
              </Button>
            )}
          </div>

          {activeEnvSpec?.rules && activeEnvSpec.rules.length > 0 && (
            <div className="border-t border-border/40 pt-2">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Rules
              </p>
              <div className="flex flex-wrap gap-1">
                {activeEnvSpec.rules.map((rule, i) => (
                  <Badge
                    key={`r-${i}`}
                    variant="outline"
                    className="text-[10px] font-normal"
                  >
                    {rule}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Planner panel — floating above task input, left side */}
      {(isPlannerPhase || hasPlannerContent) && mode === "live" && (
        <div className="pointer-events-none absolute bottom-[calc(theme(spacing.3)+200px)] left-3 z-20">
          <div className="pointer-events-auto">
            <PlannerPanel
              thinking={live.plannerThinking}
              output={live.plannerOutput}
              isThinking={isPlannerPhase && !live.plannerOutput}
            />
          </div>
        </div>
      )}

      {/* Agent detail — floating right panel */}
      {selectedAgent && (
        <div className="absolute right-3 top-14 bottom-3 z-20 w-80">
          <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-background/90 shadow-lg backdrop-blur-xl">
            <div className="flex items-center justify-between px-3 pt-3 pb-0">
              <div className="flex items-center gap-2">
                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    selectedAgent.status === "active"
                      ? "bg-primary animate-pulse"
                      : selectedAgent.status === "complete"
                        ? "bg-status-done"
                        : "bg-muted-foreground"
                  }`}
                />
                <span className="text-sm font-medium">
                  {selectedAgent.spec.role}
                </span>
                {selectedAgent.status === "active" && (
                  <Badge variant="secondary" className="h-4 gap-1 px-1.5 text-[9px]">
                    <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary" />
                    active
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setSelectedAgentId(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <AgentDetail
              spec={selectedAgent.spec}
              status={selectedAgent.status}
              thinking={selectedAgent.thinking}
              output={selectedAgent.output}
            />
          </div>
        </div>
      )}

      {/* Event log — floating bottom */}
      {hasContent && activeEvents.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
          <div className="pointer-events-auto ml-[21rem] mr-3 mb-3 h-28 overflow-hidden rounded-xl border border-border/60 bg-background/80 shadow-lg backdrop-blur-xl">
            <EventLog events={activeEvents} />
          </div>
        </div>
      )}
    </div>
  );
}
