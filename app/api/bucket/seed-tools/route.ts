import { AVAILABLE_TOOLS } from "@/lib/orchestrator";
import { supabase } from "@/lib/supabase";

export async function POST() {
  // Check which tools already exist
  const { data: existing } = await supabase
    .from("bucket_items")
    .select("label")
    .eq("category", "tool");

  const existingLabels = new Set((existing ?? []).map((e) => e.label));

  const toInsert = Object.entries(AVAILABLE_TOOLS)
    .filter(([name]) => !existingLabels.has(name))
    .map(([name, { description }]) => ({
      category: "tool" as const,
      label: name,
      content: description,
    }));

  if (toInsert.length === 0) {
    return Response.json({ added: 0 });
  }

  const { data } = await supabase
    .from("bucket_items")
    .insert(toInsert)
    .select();

  return Response.json({ added: data?.length ?? 0, items: data });
}
