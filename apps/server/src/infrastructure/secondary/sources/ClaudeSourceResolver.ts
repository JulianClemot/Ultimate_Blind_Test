import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import type { SourceLookup, SourceResolver } from '../../../application';
import {
  extractSourceHint,
  type SourceMedium,
  type Track,
  type TrackSource,
} from '../../../domain';
import { MetadataSourceResolver } from './MetadataSourceResolver';

export type CreateMessage = (
  params: Anthropic.MessageCreateParamsNonStreaming,
) => Promise<Anthropic.Message>;

const SYSTEM_PROMPT = `You tell which film, TV series or video game a song comes from.

You receive the tracks of a playlist as JSON: id, title, artist, album and, when the music catalog spells it out, a hint naming the film, series or game. For every track answer:
- source: the work the song was written for or is best known as the soundtrack of (theme songs, songs of a musical or animated film, original score cues, video game music). Use its original title as commonly known, e.g. "Frozen", "The Lion King", "Game of Thrones", "The Legend of Zelda: Breath of the Wild". Answer an empty string when the track is not from a film, series or game, when you are not confident, or when the song merely appeared in a scene, trailer or ad without being made for it.
- medium: "movie", "series" or "game", or "none" when source is empty.
- aliases: other titles of the same work that players might answer, such as its title in French, English or another language, or a common abbreviation (for "Frozen": "La Reine des Neiges"). Empty when there are none.

Trust a hint unless it is clearly wrong, but still give the aliases. Answer exactly one entry per input track, with the same id.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['tracks'],
  properties: {
    tracks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'source', 'medium', 'aliases'],
        properties: {
          id: { type: 'string' },
          source: { type: 'string' },
          medium: { type: 'string', enum: ['movie', 'series', 'game', 'none'] },
          aliases: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;

const answerSchema = z.object({
  tracks: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      medium: z.enum(['movie', 'series', 'game', 'none']),
      aliases: z.array(z.string()),
    }),
  ),
});

const MAX_NAME_LENGTH = 80;
const MAX_ALIASES = 6;

const tidy = (name: string): string => name.replace(/\s+/g, ' ').trim();

/**
 * Asks a Claude model which film, series or game each track comes from, in batches, with the hints
 * read from Deezer's metadata. When the model is unreachable or refuses, falls back to the hints.
 */
export class ClaudeSourceResolver implements SourceResolver {
  static readonly BATCH_SIZE = 60;
  /** Cap on tracks looked up per playlist, so a huge playlist cannot run up the bill. */
  static readonly MAX_TRACKS = 480;
  static readonly CONCURRENCY = 4;

  private readonly metadata = new MetadataSourceResolver();

  constructor(
    private readonly createMessage: CreateMessage,
    private readonly model: string,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  async resolve(tracks: readonly Track[]): Promise<SourceLookup> {
    const sources = this.metadata.read(tracks);
    const batches: Track[][] = [];
    const lookedUp = tracks.slice(0, ClaudeSourceResolver.MAX_TRACKS);
    for (let i = 0; i < lookedUp.length; i += ClaudeSourceResolver.BATCH_SIZE) {
      batches.push(lookedUp.slice(i, i + ClaudeSourceResolver.BATCH_SIZE));
    }

    let answered = 0;
    const queue = [...batches];
    const worker = async () => {
      for (let batch = queue.shift(); batch; batch = queue.shift()) {
        const found = await this.lookUp(batch);
        if (!found) continue;
        answered += 1;
        for (const [trackId, source] of found) sources.set(trackId, source);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(ClaudeSourceResolver.CONCURRENCY, batches.length) }, worker),
    );
    return { sources, lookup: answered > 0 ? 'ai' : 'metadata' };
  }

  /** Sources found for one batch, or null when the model could not answer. */
  private async lookUp(batch: readonly Track[]): Promise<Map<string, TrackSource> | null> {
    try {
      const response = await this.createMessage({
        model: this.model,
        max_tokens: 16_000,
        system: SYSTEM_PROMPT,
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: JSON.stringify(
              batch.map((track) => ({
                id: track.id,
                title: track.title,
                artist: track.artist,
                album: track.album ?? '',
                hint: extractSourceHint(track)?.name ?? '',
              })),
            ),
          },
        ],
      });
      if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
        throw new Error(`The model stopped with "${response.stop_reason}"`);
      }
      const text = response.content.find((block) => block.type === 'text');
      if (text?.type !== 'text') throw new Error('The model answered without text');
      return this.read(batch, answerSchema.parse(JSON.parse(text.text)));
    } catch (error) {
      this.onError(error);
      return null;
    }
  }

  private read(
    batch: readonly Track[],
    answer: z.infer<typeof answerSchema>,
  ): Map<string, TrackSource> {
    const asked = new Map(batch.map((track) => [track.id, track]));
    const sources = new Map<string, TrackSource>();
    for (const entry of answer.tracks) {
      const track = asked.get(entry.id);
      const name = tidy(entry.source);
      if (!track || name.length === 0 || name.length > MAX_NAME_LENGTH) continue;
      const hinted = extractSourceHint(track);
      const medium: SourceMedium =
        entry.medium === 'none' ? (hinted?.medium ?? 'movie') : entry.medium;
      const aliases = [...new Set(entry.aliases.map(tidy))]
        .filter((alias) => alias.length > 0 && alias.length <= MAX_NAME_LENGTH && alias !== name)
        .slice(0, MAX_ALIASES);
      sources.set(track.id, { name, aliases, medium });
    }
    return sources;
  }
}
