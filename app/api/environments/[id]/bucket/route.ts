import { supabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data } = await supabase
    .from("bucket_items")
    .select("*")
    .eq("environment_id", id)
    .order("created_at", { ascending: true });
  return Response.json(data ?? []);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { category, label, content } = await request.json();
  const { data, error } = await supabase
    .from("bucket_items")
    .insert({ environment_id: id, category, label, content: content ?? null })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data);
}
