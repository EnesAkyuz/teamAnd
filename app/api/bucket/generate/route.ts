import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const PROMPTS: Record<string, string> = {
  rule: `You generate rules for AI agent teams. Given a description, generate 3-5 concise, actionable rules.

Return ONLY a JSON array of strings. Each string is one rule.
Example: ["Always cite sources", "Keep responses under 200 words", "Use formal tone"]`,

  value: `You generate values/principles for AI agent teams. Given a description, generate 3-5 core values.

Return ONLY a JSON array of strings. Each string is one value.
Example: ["Accuracy over speed", "Transparency", "User-centric design"]`,

  skill: `You generate structured skill definitions for AI agents. A skill is a detailed methodology or capability an agent can follow.

Given a description, generate 1-2 skills. Each skill has a name and full markdown content with:
- A clear description of what the skill enables
- Step-by-step instructions or methodology
- Key principles to follow
- Common pitfalls to avoid

Return ONLY a JSON array of objects: [{ "name": "Skill Name", "content": "# Skill Name\\n\\nFull markdown content..." }]`,
};

export async function POST(request: Request) {
  const { category, prompt } = await request.json();

  const systemPrompt = PROMPTS[category];
  if (!systemPrompt) {
    return Response.json({ error: "Unsupported category" }, { status: 400 });
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found");

    const parsed = JSON.parse(jsonMatch[0]);

    if (category === "skill") {
      // Skills return { name, content } objects
      const items = parsed.map((s: { name: string; content: string }) => ({
        label: s.name,
        content: s.content,
        category: "skill",
      }));
      return Response.json({ items });
    }

    // Rules and values return string arrays
    const items = parsed.map((label: string) => ({
      label,
      content: null,
      category,
    }));
    return Response.json({ items });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
