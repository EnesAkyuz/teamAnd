import { designTeam, editSpec, executeAgents } from "@/lib/orchestrator";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";

export const maxDuration = 300;

export async function POST(request: Request) {
  const { action, task, spec, bucketItems } = await request.json();

  // Create session for new designs
  let sessionId: string | undefined;
  if (action === "design" || action === "execute") {
    const { data: session } = await supabase
      .from("sessions")
      .insert({ task: task ?? spec?.objective ?? "run" })
      .select("id")
      .single();
    sessionId = session?.id;
  }

  const encoder = new TextEncoder();

  // Pick the right generator based on action
  function getGenerator() {
    switch (action) {
      case "design":
        return designTeam(task, bucketItems ?? []);
      case "edit":
        return editSpec(spec, task, bucketItems ?? []);
      case "execute":
        return executeAgents(spec, bucketItems);
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

          // Fire-and-forget DB writes
          if (sessionId) {
            supabase
              .from("events")
              .insert({
                session_id: sessionId,
                timestamp_ms: event.timestamp,
                event_type: event.type,
                agent_id: "agentId" in event ? event.agentId : null,
                payload: event as unknown as Json,
              })
              .then();

            if (event.type === "env_created") {
              supabase
                .from("sessions")
                .update({ environment_spec: event.spec as unknown as Json })
                .eq("id", sessionId)
                .then();
            }
          }
        }
      } catch (error) {
        const errEvent = `data: ${JSON.stringify({ type: "error", message: String(error), timestamp: Date.now() })}\n\n`;
        controller.enqueue(encoder.encode(errEvent));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
