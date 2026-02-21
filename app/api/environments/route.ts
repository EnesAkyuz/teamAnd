import { supabase } from "@/lib/supabase";
import { AVAILABLE_TOOLS } from "@/lib/orchestrator";

export async function GET() {
  const { data } = await supabase
    .from("environments")
    .select("*")
    .order("created_at", { ascending: false });
  return Response.json(data ?? []);
}

export async function POST(request: Request) {
  const { name } = await request.json();
  const { data, error } = await supabase
    .from("environments")
    .insert({ name })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 400 });

  // Auto-seed available tools into the new environment
  const toolItems = Object.entries(AVAILABLE_TOOLS).map(
    ([toolName, { description }]) => ({
      environment_id: data.id,
      category: "tool" as const,
      label: toolName,
      content: description,
    }),
  );
  if (toolItems.length > 0) {
    await supabase.from("bucket_items").insert(toolItems);
  }

  return Response.json(data);
}
