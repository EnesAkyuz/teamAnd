import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data } = await supabase
    .from("user_profile")
    .select("*")
    .limit(1)
    .single();
  return Response.json(data ?? { preferences: {} });
}
