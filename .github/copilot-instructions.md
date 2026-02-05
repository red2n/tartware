# Copilot Instructions

**MANDATORY**: Before making ANY code changes, you MUST read and follow the instructions in `/AGENTS.md`.

This includes:
- Schema-first development (SQL + TypeScript schemas in lockstep)
- Never hardcode enum values in TypeScript when database CHECK constraints enforce them
- Always execute SQL migrations after creation
- Use API routes through gateway (port 8080) for testing
- Follow SOLID principles for TypeScript design

The AGENTS.md file contains project-specific rules that override general coding practices.
