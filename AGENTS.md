# AGENTS.md

## Overview

This is a monorepo that contains multiple packages. Usually these packages are
contained inside a single file with the tool name as filename. If a tool
requires multiple files, create a new folder for that tool.

Write tools in TypeScript using Deno. Use as few dependencies as possible
besides the standard library and zod.

Make tool scripts executable and add the Deno shebang to them.

Update the `README.md` file with the new tool.

## Setup commands

- Install dependencies: `just init`
- Only add Deno dependencies with `deno add`

## Code style

- TypeScript strict mode
- Single quotes, no semicolons
- Use functional patterns where possible

## Testing

- Run `just check` after every file edit

## Commits

- If you commit changes, use conventional commits.
- Always add a `Co-authored-by: OpenCode` line to your commit message.
