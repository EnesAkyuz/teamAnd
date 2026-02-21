import { supabase } from "@/lib/supabase";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; configId: string }> },
) {
  const { configId } = await params;
  await supabase.from("configs").delete().eq("id", configId);
  return Response.json({ ok: true });
}
