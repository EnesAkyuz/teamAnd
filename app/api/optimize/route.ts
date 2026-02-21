import { optimizeAgents } from "@/lib/orchestrator";

export const maxDuration = 300;

export async function POST(request: Request) {
  const { spec, bucketItems } = await request.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of optimizeAgents(spec, bucketItems)) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
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
