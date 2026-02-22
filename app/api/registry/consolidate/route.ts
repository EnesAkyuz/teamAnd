import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";

const client = new Anthropic();

interface ConsolidationGroup {
  newLabel: string;
  newContent: string;
  category: string;
  oldLabels: string[];
}

interface ConsolidationPlan {
  groups: ConsolidationGroup[];
  reasoning: string;
}

export async function POST() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        send({ type: "status", message: "Fetching registry items..." });

        // Fetch all non-tool bucket items
        const { data: allItems } = await supabase
          .from("bucket_items")
          .select("id, environment_id, category, label, content, alignment, alignment_reason")
          .neq("category", "tool");

        if (!allItems || allItems.length < 2) {
          send({ type: "status", message: "Not enough items to consolidate." });
          send({ type: "done", consolidated: 0 });
          controller.close();
          return;
        }

        send({ type: "status", message: `Found ${allItems.length} non-tool items. Analyzing with AI...` });

        // Build a summary for Claude
        const itemSummary = allItems.map((item) => ({
          label: item.label,
          category: item.category,
          content: item.content?.slice(0, 200) ?? "(no content)",
          environmentId: item.environment_id,
        }));

        // Deduplicate labels for analysis
        const uniqueByLabel = new Map<string, typeof itemSummary>();
        for (const item of itemSummary) {
          const key = `${item.category}::${item.label}`;
          if (!uniqueByLabel.has(key)) uniqueByLabel.set(key, []);
          uniqueByLabel.get(key)!.push(item);
        }

        const uniqueItems = [...uniqueByLabel.entries()].map(([key, instances]) => ({
          key,
          label: instances[0].label,
          category: instances[0].category,
          content: instances[0].content,
          count: instances.length,
        }));

        send({ type: "status", message: `${uniqueItems.length} unique labels across ${allItems.length} instances. Asking AI for consolidation plan...` });

        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: `You are a registry consolidator. Analyze these resource items and find groups that should be merged because they are duplicates, near-duplicates, or semantically very similar.

RULES:
- Only group items of the SAME category together
- Only merge items that are truly redundant or nearly identical in purpose
- Do NOT merge items that serve distinct purposes even if they sound similar
- For each group, create ONE consolidated label and merged content that captures the best of all items
- Keep the consolidated label clean, concise, and descriptive
- If an item is unique with no near-duplicates, DO NOT include it

Items to analyze:
${JSON.stringify(uniqueItems, null, 2)}

Respond with ONLY valid JSON matching this schema:
{
  "groups": [
    {
      "newLabel": "consolidated label name",
      "newContent": "merged content combining the best of all items",
      "category": "rule|skill|value",
      "oldLabels": ["old label 1", "old label 2"]
    }
  ],
  "reasoning": "brief explanation of what was consolidated and why"
}

If nothing should be consolidated, return {"groups": [], "reasoning": "explanation"}.`,
            },
          ],
        });

        const text = response.content.find((c) => c.type === "text")?.text ?? "{}";
        // Extract JSON from potential markdown code blocks
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
        let plan: ConsolidationPlan;
        try {
          plan = JSON.parse(jsonMatch[1]!.trim());
        } catch {
          send({ type: "error", message: "AI returned invalid JSON. Try again." });
          send({ type: "done", consolidated: 0 });
          controller.close();
          return;
        }

        if (!plan.groups || plan.groups.length === 0) {
          send({ type: "status", message: `No consolidation needed. ${plan.reasoning}` });
          send({ type: "done", consolidated: 0 });
          controller.close();
          return;
        }

        send({ type: "plan", plan });
        send({ type: "status", message: `Consolidating ${plan.groups.length} groups... ${plan.reasoning}` });

        let totalConsolidated = 0;

        for (const group of plan.groups) {
          send({ type: "status", message: `Consolidating: ${group.oldLabels.join(", ")} → ${group.newLabel}` });

          // Find all environments that have any of the old labels for this category
          const { data: affectedItems } = await supabase
            .from("bucket_items")
            .select("id, environment_id, label, alignment, alignment_reason")
            .eq("category", group.category)
            .in("label", group.oldLabels);

          if (!affectedItems || affectedItems.length === 0) continue;

          // Group by environment
          const envMap = new Map<string, typeof affectedItems>();
          for (const item of affectedItems) {
            if (!item.environment_id) continue;
            if (!envMap.has(item.environment_id)) envMap.set(item.environment_id, []);
            envMap.get(item.environment_id)!.push(item);
          }

          for (const [envId, envItems] of envMap) {
            // Pick the best alignment from existing items
            const bestAlignment = envItems.find((i) => i.alignment === "favorable")
              ?? envItems.find((i) => i.alignment === "neutral")
              ?? envItems.find((i) => i.alignment)
              ?? envItems[0];

            // Check if the new label already exists in this environment
            const { data: existing } = await supabase
              .from("bucket_items")
              .select("id")
              .eq("environment_id", envId)
              .eq("label", group.newLabel)
              .eq("category", group.category);

            if (!existing || existing.length === 0) {
              // Create the consolidated item
              await supabase.from("bucket_items").insert({
                environment_id: envId,
                category: group.category,
                label: group.newLabel,
                content: group.newContent,
                alignment: bestAlignment.alignment,
                alignment_reason: bestAlignment.alignment_reason,
              });
            }

            // Delete old items in this environment
            const oldIds = envItems
              .filter((i) => i.label !== group.newLabel)
              .map((i) => i.id);
            if (oldIds.length > 0) {
              await supabase.from("bucket_items").delete().in("id", oldIds);
            }

            // Update configs in this environment: replace old labels with new label
            const { data: configs } = await supabase
              .from("configs")
              .select("id, spec")
              .eq("environment_id", envId);

            if (configs) {
              for (const config of configs) {
                const spec = config.spec as {
                  rules?: string[];
                  agents?: { skills?: string[]; values?: string[]; rules?: string[] }[];
                };
                let changed = false;

                const replaceLabels = (arr: string[] | undefined): string[] => {
                  if (!arr) return [];
                  const result: string[] = [];
                  const seen = new Set<string>();
                  for (const label of arr) {
                    const newLabel = group.oldLabels.includes(label) ? group.newLabel : label;
                    if (!seen.has(newLabel)) {
                      seen.add(newLabel);
                      result.push(newLabel);
                      if (newLabel !== label) changed = true;
                    } else if (group.oldLabels.includes(label)) {
                      changed = true; // duplicate removed
                    }
                  }
                  return result;
                };

                if (spec.rules) spec.rules = replaceLabels(spec.rules);
                if (spec.agents) {
                  for (const agent of spec.agents) {
                    if (group.category === "skill") agent.skills = replaceLabels(agent.skills);
                    if (group.category === "value") agent.values = replaceLabels(agent.values);
                    if (group.category === "rule") agent.rules = replaceLabels(agent.rules);
                  }
                }

                if (changed) {
                  await supabase
                    .from("configs")
                    .update({ spec: JSON.parse(JSON.stringify(spec)) })
                    .eq("id", config.id);
                  send({ type: "config_updated", configId: config.id, envId });
                }
              }
            }

            totalConsolidated += oldIds.length;
          }

          send({ type: "group_done", group: group.newLabel, removed: affectedItems.length });
        }

        send({ type: "status", message: `Done! Consolidated ${totalConsolidated} items into ${plan.groups.length} groups.` });
        send({ type: "done", consolidated: totalConsolidated, groups: plan.groups.length });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
