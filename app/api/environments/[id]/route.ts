import { supabase } from "@/lib/supabase";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await supabase.from("environments").delete().eq("id", id);
  return Response.json({ ok: true });
}
