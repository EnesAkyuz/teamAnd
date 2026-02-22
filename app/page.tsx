"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { BookOpen, X } from "lucide-react";
import { AgentCanvas } from "@/components/agent-canvas";
import { RunSummary } from "@/components/run-summary";
import { AgentDetail } from "@/components/agent-detail";
import { EventLog } from "@/components/event-log";
import { ChatPanel } from "@/components/chat-panel";
import { BucketPanel } from "@/components/bucket-panel";
import { EnvSwitcher } from "@/components/env-switcher";
import { DraggablePanel } from "@/components/draggable-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrchestrate } from "@/hooks/use-orchestrate";
import { useReplay } from "@/hooks/use-replay";
import { useBucket } from "@/hooks/use-bucket";
import { useEnvironments } from "@/hooks/use-environments";
import type { BucketCategory } from "@/lib/types";

export default function Home() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [mode, setMode] = useState<"live" | "replay">("live");
  const [isOptimizing, setIsOptimizing] = useState(false);

  const env = useEnvironments();
  const live = useOrchestrate();
  const replay = useReplay();
  const bucket = useBucket(env.activeEnvId);

  // Reset canvas when environment changes
  useEffect(() => {
    live.reset();
    setSelectedAgentId(null);
    setMode("live");
  }, [env.activeEnvId]);

  // Auto-load the active config's spec onto the canvas
  useEffect(() => {
    if (env.activeConfig?.spec) {
      live.loadSpec(env.activeConfig.spec);
    }
  }, [env.activeConfig]);

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
      await live.edit(
        "Optimize the distribution of skills, tools, values, and rules across agents for maximum effectiveness.",
        bucket.items,
      );
    } finally {
      setIsOptimizing(false);
    }
  }, [live.envSpec, bucket.items, live.edit]);

  const handleReplayRun = useCallback(async (runId: string) => {
    setMode("replay");
    replay.replay(runId);
  }, [replay]);

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
              {live.isDesigning
                ? ""
                : env.activeEnv
                  ? "Enter a task to design your agent team."
                  : "Create an environment to get started."}
            </p>
          </div>
        )}
      </div>

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-3 pt-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur-md">
          <span className="text-sm font-semibold tracking-tight">
            team<span className="text-primary">&</span>
          </span>
        </div>

        {/* Environment + Config + Run switcher */}
        <div className="pointer-events-auto">
          <EnvSwitcher
            environments={env.environments}
            activeEnv={env.activeEnv}
            onSelectEnv={env.setActiveEnvId}
            onCreateEnv={env.createEnvironment}
            onDeleteEnv={env.deleteEnvironment}
            configs={env.configs}
            activeConfig={env.activeConfig}
            onSelectConfig={env.setActiveConfigId}
            onSaveConfig={(name) => {
              if (live.envSpec) {
                env.saveConfig(name, live.envSpec);
              }
            }}
            onDeleteConfig={env.deleteConfig}
            onLoadConfig={(spec) => {
              live.loadSpec(spec);
              setMode("live");
            }}
            hasSpec={!!live.envSpec}
            runs={env.runs}
            onReplayRun={handleReplayRun}
          />
        </div>

        {/* Bucket */}
        {env.activeEnvId && (
          <div className="pointer-events-auto">
            <BucketPanel
              grouped={bucket.grouped}
              loading={bucket.loading}
              onAdd={bucket.addItem}
              onAddItems={bucket.addItems}
              onDelete={bucket.deleteItem}
              onOptimize={live.envSpec ? handleOptimize : undefined}
              isOptimizing={isOptimizing}
            />
          </div>
        )}

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
            className="pointer-events-auto border border-status-done/30 bg-status-done-bg text-[11px] text-status-done backdrop-blur-md"
          >
            Complete
          </Badge>
        )}

        {mode === "replay" && (
          <Badge
            variant="secondary"
            className="pointer-events-auto border border-primary/30 bg-primary/10 text-[11px] text-primary backdrop-blur-md"
          >
            Replaying
          </Badge>
        )}

        <div className="flex-1" />

        {mode === "replay" && (
          <Button
            variant="ghost"
            size="xs"
            className="pointer-events-auto"
            onClick={() => setMode("live")}
          >
            Back to Live
          </Button>
        )}

        <Link
          href="/registry"
          className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border/60 bg-background/80 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-md transition-colors hover:text-foreground"
        >
          <BookOpen className="h-3 w-3" />
          Registry
        </Link>

        <div className="pointer-events-auto">
          <ThemeToggle />
        </div>
      </div>

      {/* Chat panel */}
      {env.activeEnvId && mode === "live" && (
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
                onExecute={(prompt) => {
                  live.execute(bucket.items, prompt, env.activeConfigId ?? undefined);
                  // Refresh runs after a delay
                  setTimeout(() => env.refreshRuns(), 2000);
                }}
                onStop={live.stop}
              />
            </DraggablePanel>
          </div>
        </div>
      )}

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
                  onUpdateConfig={
                    mode === "live"
                      ? (action, field, item) =>
                          live.updateAgentConfig(selectedAgentId!, action, field, item)
                      : undefined
                  }
                />
              </div>
            </DraggablePanel>
          </div>
        </div>
      )}

      {/* Run summary — shows after synthesis starts */}
      {(live.synthesis || live.isSynthesizing) && mode === "live" && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-20">
          <div className="pointer-events-auto">
            <DraggablePanel>
              <RunSummary
                prompt={live.runPrompt}
                synthesis={live.synthesis}
                isSynthesizing={live.isSynthesizing}
                isComplete={live.isComplete}
              />
            </DraggablePanel>
          </div>
        </div>
      )}

      {/* Event log */}
      {hasContent && activeEvents.length > 0 && !(live.synthesis || live.isSynthesizing) && (
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
