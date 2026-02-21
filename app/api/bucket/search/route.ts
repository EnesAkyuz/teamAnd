import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (!q.trim()) return Response.json([]);

  const { data } = await supabase
    .from("bucket_items")
    .select("*")
    .ilike("label", `%${q}%`)
    .limit(20);

  return Response.json(data ?? []);
}
