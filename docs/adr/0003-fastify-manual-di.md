# ADR 0003 — Fastify with manual dependency injection

- Status: accepted
- Date: 2026-11-03

## Context

NestJS would bring DI and gateways but couples the code to decorators and its module system.

## Decision

Fastify 5 as a thin HTTP layer; dependencies are wired by hand in `compositionRoot.ts`.

## Consequences

- The core has zero framework imports; wiring is explicit and readable.
- When the graph grows, a lightweight container (e.g. awilix) can be added inside the composition
  root only.
