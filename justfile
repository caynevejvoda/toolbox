_default:
  just --list

# Init dependencies
init:
  deno install

# Run formatting, linting and typechecking
check:
  deno fmt
  deno lint
  deno check
