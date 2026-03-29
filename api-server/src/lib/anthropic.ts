import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error("ANTHROPIC_API_KEY environment variable is required. Get your key at https://console.anthropic.com");
}

export const anthropic = new Anthropic({ apiKey });
