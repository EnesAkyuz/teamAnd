import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";

const client = new Anthropic();

export const maxDuration = 300;

const SYSTEM_PROMPT = `You are a personal alignment agent. Your job is to understand the user's goals, preferences, values, and working style, then evaluate their resource library to mark items as favorable, conflicting, or neutral.

WORKFLOW:
1. First, call get_preferences to see what you already know about the user.
2. Call get_all_resources to see their full resource library.
3. Have a conversation to understand what matters to them — ask about their goals, priorities, what they care about.
4. As you learn about them, use mark_alignment to tag resources with your assessment and reasoning.
5. Use save_preferences to persist what you've learned for next time.

Be conversational and insightful. Explain your reasoning when marking items. Ask good questions. Help them understand which resources serve their goals and which might be counterproductive.

When marking items, always explain to the user what you're doing and why.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_all_resources",
    description: "Fetch all resources in the registry with their labels, categories, and content.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_preferences",
    description: "Get saved user preferences and profile from previous sessions.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "mark_alignment",
    description: "Mark a resource item as favorable, conflicting, or neutral with a reason. The item_id must be a valid UUID from the resources list.",
    input_schema: {
      type: "object" as const,
      properties: {
        item_id: { type: "string", description: "The UUID of the bucket item to mark" },
        alignment: { type: "string", enum: ["favorable", "conflicting", "neutral"], description: "The alignment status" },
        reason: { type: "string", description: "Brief explanation of why this alignment was chosen" },
      },
      required: ["item_id", "alignment", "reason"],
    },
  },
  {
    name: "save_preferences",
    description: "Save learned user preferences for future sessions. Merge with existing preferences.",
    input_schema: {
      type: "object" as const,
      properties: {
        preferences: {
          type: "object",
          description: "Key-value pairs of user preferences, goals, values, working style",
        },
      },
      required: ["preferences"],
    },
  },
];

async function handleToolCall(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "get_all_resources": {
      const { data } = await supabase
        .from("bucket_items")
        .select("id, category, label, content, alignment, alignment_reason, environments(name)")
        .order("created_at");
      return JSON.stringify(data ?? []);
    }
    case "get_preferences": {
      const { data } = await supabase.from("user_profile").select("*").limit(1).single();
      return JSON.stringify(data?.preferences ?? {});
    }
    case "mark_alignment": {
      const { item_id, alignment, reason } = input;
      const { error } = await supabase
        .from("bucket_items")
        .update({
          alignment: alignment as string,
          alignment_reason: reason as string,
        })
        .eq("id", item_id as string);
      if (error) {
        return JSON.stringify({ error: error.message, item_id, alignment });
      }
      return JSON.stringify({ ok: true, item_id, alignment, reason });
    }
    case "save_preferences": {
      const prefs = input.preferences;
      const { data: existing } = await supabase.from("user_profile").select("id, preferences").limit(1).single();
      if (existing) {
        const merged = { ...(existing.preferences as Record<string, unknown>), ...(prefs as Record<string, unknown>) };
        await supabase
          .from("user_profile")
          .update({ preferences: merged as unknown as Json, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("user_profile").insert({ preferences: prefs as unknown as Json });
      }
      return JSON.stringify({ ok: true });
    }
    default:
      return JSON.stringify({ error: "Unknown tool" });
  }
}

// Strip thinking blocks from content — Claude's API doesn't want them passed back
function stripThinking(content: Anthropic.ContentBlock[]): Anthropic.ContentBlockParam[] {
  return content
    .filter((b) => b.type !== "thinking")
    .map((b) => {
      if (b.type === "text") return { type: "text" as const, text: b.text };
      if (b.type === "tool_use") return { type: "tool_use" as const, id: b.id, name: b.name, input: b.input };
      return b as unknown as Anthropic.ContentBlockParam;
    });
}

export async function POST(request: Request) {
  const { messages: clientMessages } = await request.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messages: Anthropic.MessageParam[] = clientMessages.map(
          (m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }),
        );

        let maxTurns = 8;
        while (maxTurns-- > 0) {
          // Signal new turn to client so it can separate thinking blocks
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: "turn_start" })}\n\n`,
          ));

          const response = client.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 8000,
            thinking: { type: "enabled", budget_tokens: 4000 },
            system: SYSTEM_PROMPT,
            tools: TOOLS,
            messages,
          });

          let turnText = "";
          for await (const event of response) {
            if (event.type === "content_block_delta") {
              if (event.delta.type === "thinking_delta") {
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: "thinking", content: event.delta.thinking })}\n\n`,
                ));
              } else if (event.delta.type === "text_delta") {
                turnText += event.delta.text;
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: "text", content: event.delta.text })}\n\n`,
                ));
              }
            }
          }

          const finalMessage = await response.finalMessage();

          const toolCalls = finalMessage.content.filter(
            (b): b is Anthropic.ContentBlock & { type: "tool_use" } => b.type === "tool_use",
          );

          if (toolCalls.length === 0) break;

          // Push assistant content WITHOUT thinking blocks
          messages.push({ role: "assistant", content: stripThinking(finalMessage.content) });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tc of toolCalls) {
            const result = await handleToolCall(tc.name, tc.input as Record<string, unknown>);

            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: "tool_call", tool: tc.name, input: tc.input, result })}\n\n`,
            ));

            toolResults.push({ type: "tool_result", tool_use_id: tc.id, content: result });
          }

          messages.push({ role: "user", content: toolResults });
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
      } catch (error) {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: "error", message: String(error) })}\n\n`,
        ));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
