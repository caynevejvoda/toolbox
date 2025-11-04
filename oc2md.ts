#!/usr/bin/env -S deno run --allow-read --allow-write

import { parseArgs } from "@std/cli/parse-args";

// Types for OpenCode session JSON structure
interface SessionInfo {
  id: string;
  version: string;
  projectID: string;
  directory: string;
  title: string;
  time: {
    created: number;
    updated: number;
  };
  summary?: {
    diffs: unknown[];
  };
}

interface MessageInfo {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  time: {
    created: number;
    completed?: number;
  };
  system?: string[];
  parentID?: string;
  modelID?: string;
  providerID?: string;
  mode?: string;
  path?: {
    cwd: string;
    root: string;
  };
  cost?: number;
  tokens?: {
    input: number;
    output: number;
    reasoning: number;
    cache?: {
      read: number;
      write: number;
    };
  };
  summary?: {
    title?: string;
    body?: string;
    diffs?: unknown[];
  };
}

interface MessagePart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "text" | "tool" | "step-start" | "step-finish";
  text?: string;
  callID?: string;
  tool?: string;
  state?: {
    status: string;
    input?: Record<string, unknown>;
    output?: string;
    title?: string;
    metadata?: Record<string, unknown>;
    time?: {
      start: number;
      end: number;
    };
  };
  reason?: string;
  cost?: number;
  tokens?: MessageInfo["tokens"];
  time?: {
    start: number;
    end: number;
  };
}

interface Message {
  info: MessageInfo;
  parts: MessagePart[];
}

interface Session {
  info: SessionInfo;
  messages: Message[];
}

// Utility functions
function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  });
}

function formatDuration(ms: number): string {
  const seconds = (ms / 1000).toFixed(3);
  return `${seconds}s`;
}

function extractToolSummary(part: MessagePart): string | null {
  if (part.type !== "tool" || !part.tool || !part.state) {
    return null;
  }

  const lines: string[] = [];
  lines.push(`### Tool: ${part.tool} (${part.state.status})`);
  lines.push("");

  // Show input based on tool type
  if (part.state.input) {
    const input = part.state.input;

    // Handle different tool types
    if (part.tool === "bash" && typeof input.command === "string") {
      lines.push("```bash");
      lines.push(input.command);
      lines.push("```");
    } else if (part.tool === "webfetch" && typeof input.url === "string") {
      lines.push(`<${input.url}>`);
    } else if (part.state.title) {
      lines.push(`\`${part.state.title}\``);
    } else {
      // Generic fallback
      const keys = Object.keys(input);
      if (keys.length > 0 && keys.length <= 2) {
        const values = keys.map((k) => input[k]).filter((v) =>
          typeof v === "string" && v.length < 100
        );
        if (values.length > 0) {
          lines.push(`\`${values.join(", ")}\``);
        }
      }
    }
  }

  return lines.join("\n");
}

function generateMarkdown(session: Session): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${session.info.title}`);
  lines.push("");
  lines.push(`- **Session ID:** ${session.info.id}`);
  lines.push(`- **Version:** ${session.info.version}`);
  lines.push(`- **Directory:** ${session.info.directory}`);
  lines.push(`- **Created:** ${formatTimestamp(session.info.time.created)}`);
  lines.push(`- **Updated:** ${formatTimestamp(session.info.time.updated)}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Process messages
  for (const message of session.messages) {
    const role = message.info.role.charAt(0).toUpperCase() +
      message.info.role.slice(1);

    // Calculate duration for assistant messages
    let header = `## ${role}`;
    if (message.info.role === "assistant" && message.info.time.completed) {
      const duration = message.info.time.completed - message.info.time.created;
      header += ` (${formatDuration(duration)})`;
    }

    lines.push(header);
    lines.push("");

    // Extract text parts
    const textParts = message.parts.filter((p) => p.type === "text" && p.text);
    for (const part of textParts) {
      if (part.text) {
        lines.push(part.text.trim());
        lines.push("");
      }
    }

    // Extract tool parts
    const toolParts = message.parts.filter((p) => p.type === "tool");
    for (const part of toolParts) {
      const summary = extractToolSummary(part);
      if (summary) {
        lines.push(summary);
        lines.push("");
      }
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

// Main function
async function main() {
  const args = parseArgs(Deno.args, {
    string: ["output", "o"],
    alias: { o: "output" },
  });

  const inputPath = args._[0]?.toString();

  if (!inputPath) {
    console.error("Usage: oc2md.ts <input-json> [--output <output-md>]");
    console.error("  Convert OpenCode session JSON to Markdown format");
    console.error("");
    console.error("Options:");
    console.error("  -o, --output <file>  Output file (default: stdout)");
    Deno.exit(1);
  }

  // Read and parse JSON
  let session: Session;
  try {
    const content = await Deno.readTextFile(inputPath);
    session = JSON.parse(content);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error reading or parsing JSON: ${errorMessage}`);
    Deno.exit(1);
  }

  // Validate structure
  if (!session.info || !session.messages || !Array.isArray(session.messages)) {
    console.error("Invalid session JSON structure");
    Deno.exit(1);
  }

  // Generate Markdown
  const markdown = generateMarkdown(session);

  // Output
  const outputPath = args.output || args.o;
  if (outputPath) {
    try {
      await Deno.writeTextFile(outputPath, markdown);
      console.log(`Markdown written to ${outputPath}`);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.error(`Error writing output: ${errorMessage}`);
      Deno.exit(1);
    }
  } else {
    console.log(markdown);
  }
}

// Run
if (import.meta.main) {
  main();
}
