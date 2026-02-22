import { designTeam, editSpec, executeAgents } from "@/lib/orchestrator";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";

export const maxDuration = 300;

export async function POST(request: Request) {
  const { action, task, spec, bucketItems, prompt, configId, environmentId } = await request.json();

  const encoder = new TextEncoder();

  // Create a run record for execute actions
  let runId: string | undefined;
  if (action === "execute" && configId) {
    const { data: run } = await supabase
      .from("runs")
      .insert({ config_id: configId, prompt: prompt ?? null, status: "running" })
      .select("id")
      .single();
    runId = run?.id;
  }

  function getGenerator() {
    switch (action) {
      case "design":
        return designTeam(task, bucketItems ?? []);
      case "edit":
        return editSpec(spec, task, bucketItems ?? []);
      case "execute":
        return executeAgents(spec, bucketItems, prompt, environmentId);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of getGenerator()) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));

          // Write events to run if executing
          if (runId) {
            supabase
              .from("events")
              .insert({
                run_id: runId,
                session_id: null,
                timestamp_ms: event.timestamp,
                event_type: event.type,
                agent_id: "agentId" in event ? event.agentId : null,
                payload: event as unknown as Json,
              })
              .then();
          }
        }

        // Mark run as complete
        if (runId) {
          supabase.from("runs").update({ status: "complete" }).eq("id", runId).then();
        }
      } catch (error) {
        const errEvent = `data: ${JSON.stringify({ type: "error", message: String(error), timestamp: Date.now() })}\n\n`;
        controller.enqueue(encoder.encode(errEvent));
        if (runId) {
          supabase.from("runs").update({ status: "stopped" }).eq("id", runId).then();
        }
      } finally {
        controller.close();
      }
    },
  });

  // Send runId in a custom header so frontend knows
  const headers: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
  if (runId) headers["X-Run-Id"] = runId;

  return new Response(stream, { headers });
}
