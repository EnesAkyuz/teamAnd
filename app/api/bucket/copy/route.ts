import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  const { itemId, environmentId } = await request.json();

  // Fetch the source item
  const { data: source } = await supabase
    .from("bucket_items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (!source) return Response.json({ error: "Item not found" }, { status: 404 });

  // Copy into target environment
  const { data, error } = await supabase
    .from("bucket_items")
    .insert({
      environment_id: environmentId,
      category: source.category,
      label: source.label,
      content: source.content,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data);
}
