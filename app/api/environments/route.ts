import { supabase } from "@/lib/supabase";

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
  return Response.json(data);
}
