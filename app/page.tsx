"use client";

import { useState, useCallback } from "react";
import { RotateCcw, X } from "lucide-react";
import { AgentCanvas } from "@/components/agent-canvas";
import { AgentDetail } from "@/components/agent-detail";
import { EventLog } from "@/components/event-log";
import { ChatPanel } from "@/components/chat-panel";
import { BucketPanel } from "@/components/bucket-panel";
import { DraggablePanel } from "@/components/draggable-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrchestrate } from "@/hooks/use-orchestrate";
import { useReplay } from "@/hooks/use-replay";
import { useBucket } from "@/hooks/use-bucket";
import type { BucketCategory } from "@/lib/types";

export default function Home() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "replay">("live");
  const [isOptimizing, setIsOptimizing] = useState(false);

  const live = useOrchestrate();
  const replay = useReplay();
  const bucket = useBucket();

  const activeAgents = mode === "live" ? live.agents : replay.agents;
  const activeEvents = mode === "live" ? live.events : replay.events;
  const activeEnvSpec = mode === "live" ? live.envSpec : replay.envSpec;

  const selectedAgent = selectedAgentId
    ? activeAgents.get(selectedAgentId)
    : null;

  const isBusy = live.isDesigning || live.isRunning;
  const hasContent = activeAgents.size > 0 || isBusy;

  const categoryToField = useCallback(
    (cat: BucketCategory): "skills" | "values" | "tools" | "rules" => {
      switch (cat) {
        case "skill": return "skills";
        case "value": return "values";
        case "tool": return "tools";
        case "rule": return "rules";
      }
    },
    [],
  );

  const handleDropBucketItem = useCallback(
    (agentId: string, category: BucketCategory, label: string) => {
      live.updateAgentConfig(agentId, "add", categoryToField(category), label);
    },
    [live.updateAgentConfig, categoryToField],
  );

  const handleOptimize = useCallback(async () => {
    if (!live.envSpec || bucket.items.length === 0) return;
    setIsOptimizing(true);
    try {
      // Use the edit flow to optimize
      await live.edit(
        "Optimize the distribution of skills, tools, values, and rules across agents for maximum effectiveness.",
        bucket.items,
      );
    } finally {
      setIsOptimizing(false);
    }
  }, [live.envSpec, bucket.items, live.edit]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Canvas */}
      <div className="absolute inset-0">
        {hasContent && activeAgents.size > 0 ? (
          <AgentCanvas
            agents={activeAgents}
            selectedAgentId={selectedAgentId}
            onSelectAgent={setSelectedAgentId}
            onDropBucketItem={handleDropBucketItem}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {live.isDesigning ? "" : "Enter a task to design your agent team."}
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

        {/* Bucket dropdown */}
        <div className="pointer-events-auto">
          <BucketPanel
            grouped={bucket.grouped}
            loading={bucket.loading}
            onAdd={bucket.addItem}
            onAddItems={bucket.addItems}
            onDelete={bucket.deleteItem}
            onOptimize={live.envSpec ? handleOptimize : undefined}
            isOptimizing={isOptimizing}
            onSeedTools={async () => {
              await fetch("/api/bucket/seed-tools", { method: "POST" });
              // Refetch all items to sync
              bucket.refetch();
            }}
          />
        </div>

        {activeEnvSpec && (
          <Badge
            variant="secondary"
            className="pointer-events-auto border border-border/60 bg-background/80 text-[11px] text-muted-foreground backdrop-blur-md"
          >
            {activeEnvSpec.name} / {activeEnvSpec.agents.length} agents
          </Badge>
        )}

        {activeEnvSpec && !live.isRunning && !live.isDesigning && !live.isComplete && (
          <Badge
            variant="outline"
            className="pointer-events-auto border-primary/30 text-[11px] text-primary backdrop-blur-md"
          >
            Ready to run
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

      {/* Chat panel */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20">
        <div className="pointer-events-auto">
          <DraggablePanel>
            <ChatPanel
              messages={live.chatMessages}
              plannerThinking={live.plannerThinking}
              plannerOutput={live.plannerOutput}
              isDesigning={live.isDesigning}
              isRunning={live.isRunning}
              hasSpec={!!live.envSpec}
              onDesign={(msg) => live.design(msg, bucket.items)}
              onEdit={(msg) => live.edit(msg, bucket.items)}
              onExecute={(prompt) => live.execute(bucket.items, prompt)}
              onStop={live.stop}
            />
          </DraggablePanel>
        </div>
      </div>

      {/* Agent detail */}
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
                  onUpdateConfig={(action, field, item) =>
                    live.updateAgentConfig(selectedAgentId!, action, field, item)
                  }
                />
              </div>
            </DraggablePanel>
          </div>
        </div>
      )}

      {/* Event log */}
      {hasContent && activeEvents.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-10">
          <div className="pointer-events-auto">
            <DraggablePanel>
              <div
                className="overflow-hidden rounded-xl border border-border/60 bg-background/80 shadow-lg backdrop-blur-xl"
                style={{ width: "min(calc(100vw - 22rem), 600px)", height: "120px" }}
              >
                <EventLog events={activeEvents} />
              </div>
            </DraggablePanel>
          </div>
        </div>
      )}
    </div>
  );
}
