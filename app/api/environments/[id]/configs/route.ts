import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data } = await supabase
    .from("configs")
    .select("*")
    .eq("environment_id", id)
    .order("created_at", { ascending: false });
  return Response.json(data ?? []);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, spec } = await request.json();
  const { data, error } = await supabase
    .from("configs")
    .insert({ environment_id: id, name, spec: spec as unknown as Json })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data);
}
