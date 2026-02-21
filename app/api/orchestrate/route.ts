import { orchestrate } from "@/lib/orchestrator";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";

export const maxDuration = 300;

export async function POST(request: Request) {
  const { task } = await request.json();

  // Create session in Supabase (fire-and-forget for the rest)
  const { data: session } = await supabase
    .from("sessions")
    .insert({ task })
    .select("id")
    .single();

  const sessionId = session?.id;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of orchestrate(task)) {
          // Send SSE immediately — don't block on DB writes
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
                .update({
                  environment_spec: event.spec as unknown as Json,
                })
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
