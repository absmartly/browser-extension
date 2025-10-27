#!/usr/bin/env node

require("dotenv").config({ path: ".env.development.local" });

const Anthropic = require("@anthropic-ai/sdk").default;

async function listModels() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("❌ Error: ANTHROPIC_API_KEY environment variable is not set");
    process.exit(1);
  }

  try {
    console.log("📋 Fetching available models...\n");
    const client = new Anthropic({ apiKey });

    const models = await client.models.list();

    console.log("Available Claude Models:");
    console.log("========================\n");

    models.data.forEach((model) => {
      console.log(`• ${model.id}`);
    });

    // Find the latest Claude 3 model
    const latestModel = models.data
      .filter((m) => m.id.includes("claude-3"))
      .sort()
      .pop();

    console.log("\n✅ Latest Claude 3 model:", latestModel?.id);
    return latestModel?.id;
  } catch (error) {
    console.error("❌ Error fetching models:", error.message);
    process.exit(1);
  }
}

async function testClaudeAPI() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("❌ Error: ANTHROPIC_API_KEY environment variable is not set");
    console.error("Usage: ANTHROPIC_API_KEY=your_key_here npm run test:claude");
    process.exit(1);
  }

  try {
    console.log("🔌 Connecting to Claude API...");
    const client = new Anthropic({ apiKey });

    // Use the latest available Claude model
    const modelId = "claude-sonnet-4-5-20250929";

    console.log(`📝 Using model: ${modelId}`);
    console.log("📝 Sending test message to Claude...");
    const message = await client.messages.create({
      model: modelId,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: "Say 'Hello from Claude!' to confirm you're working",
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    console.log("✅ Claude API is working!");
    console.log("Response:", responseText);
    console.log(
      "\n✨ Success! The Claude API integration is functioning correctly."
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Claude API error:", error.message);
    if (error.message.includes("authentication")) {
      console.error("💡 Tip: Check that your ANTHROPIC_API_KEY is correct");
    }
    process.exit(1);
  }
}

testClaudeAPI();
