import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabase
    .from("bucket_items")
    .select("*")
    .order("created_at", { ascending: true });

  return Response.json(data ?? []);
}

export async function POST(request: Request) {
  const { category, label } = await request.json();

  const { data, error } = await supabase
    .from("bucket_items")
    .insert({ category, label })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data);
}
