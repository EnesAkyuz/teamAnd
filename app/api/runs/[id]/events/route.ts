import { supabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data } = await supabase
    .from("events")
    .select("payload, timestamp_ms")
    .eq("run_id", id)
    .order("timestamp_ms", { ascending: true });
  return Response.json(data ?? []);
}
