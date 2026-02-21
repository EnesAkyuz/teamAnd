import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabase
    .from("sessions")
    .select("id, task, environment_spec, created_at")
    .order("created_at", { ascending: false });

  return Response.json(data ?? []);
}
