import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

export interface MemeInterpretation {
  meme_identified_as: string;
  interpretation: string;
  proposed_action: string;
  confidence_level: "high" | "medium" | "low";
}

const SYSTEM_PROMPT = `You are the official meme interpreter for MEMIT — a hackathon where participants can ONLY communicate through memes. No text prompts are allowed.

Your job:
1. Identify the meme format/template (e.g. "Distracted Boyfriend", "This Is Fine", "Drake Yes/No")
2. Interpret what the meme is trying to communicate about the project direction
3. Propose a concrete feature, change, or direction for the software project

Rules:
- NEVER ask for text clarification
- ALWAYS interpret the meme yourself
- Be creative but practical
- Proposed actions should be buildable software features
- If you cannot identify the meme format, describe what you see and still propose a direction

Respond ONLY with valid JSON in this exact format:
{
  "meme_identified_as": "Name of the meme template or description",
  "interpretation": "What this meme communicates in the context of software development",
  "proposed_action": "Concrete feature or change to implement in the project",
  "confidence_level": "high" | "medium" | "low"
}`;

export async function interpretMeme(
  imagePath: string,
  mimeType: string
): Promise<MemeInterpretation> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Return a mock response if no API key configured
    return {
      meme_identified_as: "Unknown (API not configured)",
      interpretation:
        "Claude API key not configured. This is a placeholder interpretation. Configure ANTHROPIC_API_KEY to enable real meme interpretation.",
      proposed_action:
        "Configure the ANTHROPIC_API_KEY environment variable to enable AI-powered meme interpretation.",
      confidence_level: "low",
    };
  }

  const client = new Anthropic({ apiKey });
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  const mediaType = mimeType as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Image,
            },
          },
        ],
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    // Strip potential markdown code blocks
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned) as MemeInterpretation;
    return parsed;
  } catch {
    return {
      meme_identified_as: "Parse error",
      interpretation: text,
      proposed_action:
        "Unable to parse structured response. Review raw interpretation.",
      confidence_level: "low",
    };
  }
}
