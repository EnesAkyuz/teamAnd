"use client";

import { useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { AgentCanvas } from "@/components/agent-canvas";
import { AgentDetail } from "@/components/agent-detail";
import { EventLog } from "@/components/event-log";
import { ChatPanel } from "@/components/chat-panel";
import { DraggablePanel } from "@/components/draggable-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrchestrate } from "@/hooks/use-orchestrate";
import { useReplay } from "@/hooks/use-replay";

export default function Home() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "replay">("live");

  const live = useOrchestrate();
  const replay = useReplay();

  const activeAgents = mode === "live" ? live.agents : replay.agents;
  const activeEvents = mode === "live" ? live.events : replay.events;
  const activeEnvSpec = mode === "live" ? live.envSpec : replay.envSpec;

  const selectedAgent = selectedAgentId
    ? activeAgents.get(selectedAgentId)
    : null;

  const isActive = mode === "live" ? live.isRunning : replay.isReplaying;
  const hasContent = activeAgents.size > 0 || isActive;
  const isPlannerPhase = isActive && !activeEnvSpec;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Canvas — full viewport */}
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
              {isPlannerPhase ? "" : "Enter a task to spawn your agent team."}
            </p>
          </div>
        )}
      </div>

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-3 pt-3">
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

      {/* Chat panel — draggable, bottom-left */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20">
        <div className="pointer-events-auto">
          <DraggablePanel>
            <ChatPanel
              messages={live.chatMessages}
              plannerThinking={live.plannerThinking}
              plannerOutput={live.plannerOutput}
              isPlannerActive={isPlannerPhase}
              isRunning={live.isRunning}
              onSend={(msg) => live.start(msg)}
              onStop={live.stop}
            />
          </DraggablePanel>
        </div>
      </div>

      {/* Agent detail — draggable */}
      {selectedAgent && (
        <div className="pointer-events-none absolute right-3 top-14 z-20">
          <div className="pointer-events-auto">
            <DraggablePanel>
              <div
                className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-background/90 shadow-lg backdrop-blur-xl"
                style={{ width: "320px", height: "min(500px, 70vh)" }}
              >
                <div className="flex shrink-0 items-center justify-between px-3 pt-2 pb-0">
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
                      <Badge
                        variant="secondary"
                        className="h-4 gap-1 px-1.5 text-[9px]"
                      >
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
            </DraggablePanel>
          </div>
        </div>
      )}

      {/* Event log — draggable */}
      {hasContent && activeEvents.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-10">
          <div className="pointer-events-auto">
            <DraggablePanel>
              <div
                className="overflow-hidden rounded-xl border border-border/60 bg-background/80 shadow-lg backdrop-blur-xl"
                style={{
                  width: "min(calc(100vw - 22rem), 600px)",
                  height: "120px",
                }}
              >
                <EventLog events={activeEvents} />
              </div>
            </DraggablePanel>
          </div>
        </div>
      )}

      {/* Environment rules — floating top-left under logo if present */}
      {activeEnvSpec?.rules && activeEnvSpec.rules.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-14 z-10">
          <div className="pointer-events-auto max-w-64 overflow-hidden rounded-lg border border-border/60 bg-background/80 p-2.5 shadow-sm backdrop-blur-md">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Rules
            </p>
            <div className="flex flex-wrap gap-1">
              {activeEnvSpec.rules.map((rule, i) => (
                <Badge
                  key={`r-${i}`}
                  variant="outline"
                  className="shrink-0 text-[10px] font-normal"
                >
                  {rule}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
