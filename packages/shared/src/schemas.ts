import { z } from 'zod';

/**
 * Validation of every inbound payload happens at the primary adapter boundary
 * (HTTP routes / socket handlers) with these schemas. Domain invariants are
 * still enforced by the domain itself: these schemas only guarantee the shape.
 */

// ── Game designs (HTTP) ─────────────────────────────────────────────────────

export const roundTypeSchema = z.enum(['classic', 'everyone', 'flash', 'fast-forward']);

export const roundRulesSchema = z.object({
  scoring: z.enum(['first', 'everyone']),
  winnerCount: z.number(),
  rankStep: z.number(),
  songCount: z.number(),
  titlePoints: z.number(),
  artistPoints: z.number(),
  bothBonus: z.number(),
  speedBonus: z.number(),
  answerTimeSec: z.number(),
  excerptSec: z.number(),
  playbackRate: z.number(),
  /** Absent from clients predating team mode. */
  teamMode: z.boolean().default(false),
  /** Absent from clients predating easy mode. */
  easyMode: z.boolean().default(false),
});

export const roundPlanPayloadSchema = z.object({
  /** Optional label; length is checked by the server (INVALID_ROUND_NAME). */
  name: z.string().max(200),
  type: roundTypeSchema,
  /** Deezer playlist id or URL. */
  playlist: z.string().max(500),
  playlistTitle: z.string().max(200).nullable(),
  rules: roundRulesSchema,
});

export const createGameDesignPayloadSchema = z.object({
  name: z.string().max(200),
});
export type CreateGameDesignPayload = z.infer<typeof createGameDesignPayloadSchema>;

export const updateGameDesignPayloadSchema = z.object({
  name: z.string().max(200),
  rounds: z.array(roundPlanPayloadSchema).max(100),
});
export type UpdateGameDesignPayload = z.infer<typeof updateGameDesignPayloadSchema>;
export type RoundPlanPayload = z.infer<typeof roundPlanPayloadSchema>;

export const checkPlaylistQuerySchema = z.object({
  playlist: z.string().trim().min(1).max(500),
});

export const launchGamePayloadSchema = z.object({
  designId: z.string().min(1),
  editToken: z.string().min(1),
});
export type LaunchGamePayload = z.infer<typeof launchGamePayloadSchema>;

// ── Parties (Socket.IO) ─────────────────────────────────────────────────────

export const attachHostPayloadSchema = z.object({
  gameId: z.string().min(1),
  hostToken: z.string().min(1),
});
export type AttachHostPayload = z.infer<typeof attachHostPayloadSchema>;

export const joinGamePayloadSchema = z.object({
  code: z.string().trim().toUpperCase().min(1),
  playerName: z.string(),
});
export type JoinGamePayload = z.infer<typeof joinGamePayloadSchema>;

export const rejoinGamePayloadSchema = z.object({
  gameId: z.string().min(1),
  playerId: z.string().min(1),
});
export type RejoinGamePayload = z.infer<typeof rejoinGamePayloadSchema>;

export const generateTeamsPayloadSchema = z.object({
  /** Range (2–4) and player count are checked by the domain. */
  teamCount: z.number(),
});
export type GenerateTeamsPayload = z.infer<typeof generateTeamsPayloadSchema>;

export const submitAnswerPayloadSchema = z.object({
  text: z.string(),
  /** Client wall-clock time (epoch ms) at submission, kept for diagnostics only. */
  clientSentAt: z.number(),
  /** Id of a suggestion picked in an easy round: the server then ignores `text`. */
  suggestionId: z.string().min(1).optional(),
});
export type SubmitAnswerPayload = z.infer<typeof submitAnswerPayloadSchema>;

export const judgeAnswerPayloadSchema = z.object({
  answerId: z.string().min(1),
  title: z.boolean(),
  artist: z.boolean(),
});
export type JudgeAnswerPayload = z.infer<typeof judgeAnswerPayloadSchema>;
