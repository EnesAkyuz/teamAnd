import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";

export async function GET() {
  const { data } = await supabase
    .from("alignment_messages")
    .select("*")
    .order("created_at", { ascending: true });

  return Response.json(data ?? []);
}

export async function POST(request: Request) {
  const { role, content, thinking, tool_calls } = await request.json();

  const { data, error } = await supabase
    .from("alignment_messages")
    .insert({
      role,
      content,
      thinking: thinking ?? null,
      tool_calls: (tool_calls as unknown as Json) ?? null,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data);
}

export async function DELETE() {
  await supabase.from("alignment_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  return Response.json({ ok: true });
}
