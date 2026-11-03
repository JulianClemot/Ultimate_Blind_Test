# ADR 0001 — Hexagonal architecture on the server

- Status: accepted
- Date: 2026-11-03

## Context

Features will be added one at a time (music sources, scoring, playlists, persistence…). The game
rules must stay testable and stable while the tech around them changes.

## Decision

Ports & adapters with three layers (`domain`, `application`, `infrastructure`) and a single
composition root. Layer rules are checked by dependency-cruiser in CI.

## Consequences

- Domain and use cases are tested in milliseconds with in-memory fakes.
- Swapping storage or transport means writing an adapter, not touching rules.
- A bit more ceremony (ports, mappers) than a framework-centric layout.
