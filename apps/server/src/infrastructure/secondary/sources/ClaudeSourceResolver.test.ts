import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import type { Track } from '../../../domain';
import { ClaudeSourceResolver, type CreateMessage } from './ClaudeSourceResolver';

const track = (id: string, title = `Song ${id}`, album = ''): Track => ({
  id,
  title,
  artist: 'Someone',
  previewUrl: `https://cdn.test/${id}.mp3`,
  ...(album && { album }),
});

interface Entry {
  id: string;
  source: string;
  medium: 'movie' | 'series' | 'game' | 'none';
  aliases: string[];
}

const reply = (tracks: Entry[], stopReason = 'end_turn') =>
  ({
    stop_reason: stopReason,
    content: [{ type: 'text', text: JSON.stringify({ tracks }) }],
  }) as unknown as Anthropic.Message;

const resolverWith = (create: CreateMessage, onError = vi.fn()) => ({
  resolver: new ClaudeSourceResolver(create, 'claude-test', onError),
  onError,
});

const sentTracks = (create: ReturnType<typeof vi.fn>, call = 0) =>
  JSON.parse(
    (create.mock.calls[call] as [{ messages: { content: string }[] }])[0].messages[0]?.content ??
      '[]',
  ) as { id: string; hint: string; album: string }[];

describe('ClaudeSourceResolver', () => {
  it('asks for structured answers about every track, with the hints of the metadata', async () => {
    const create = vi.fn().mockResolvedValue(reply([]));
    const { resolver } = resolverWith(create);
    await resolver.resolve([track('1', 'Remember Me (From "Coco")'), track('2', 'Roar', 'Prism')]);

    const [params] = create.mock.calls[0] as [Anthropic.MessageCreateParamsNonStreaming];
    expect(params).toMatchObject({
      model: 'claude-test',
      output_config: { format: { type: 'json_schema' } },
    });
    expect(sentTracks(create)).toEqual([
      expect.objectContaining({ id: '1', hint: 'Coco' }),
      expect.objectContaining({ id: '2', hint: '', album: 'Prism' }),
    ]);
  });

  it('returns the film, its aliases and its medium for each track', async () => {
    const { resolver } = resolverWith(() =>
      Promise.resolve(
        reply([
          { id: '1', source: 'Frozen', medium: 'movie', aliases: ['La Reine des Neiges'] },
          { id: '2', source: 'Game of Thrones', medium: 'series', aliases: ['GoT'] },
          { id: '3', source: '', medium: 'none', aliases: [] },
        ]),
      ),
    );
    const { sources, lookup } = await resolver.resolve([track('1'), track('2'), track('3')]);

    expect(lookup).toBe('ai');
    expect(Object.fromEntries(sources)).toEqual({
      '1': { name: 'Frozen', aliases: ['La Reine des Neiges'], medium: 'movie' },
      '2': { name: 'Game of Thrones', aliases: ['GoT'], medium: 'series' },
    });
  });

  it('keeps what the metadata says when the model finds nothing, and ignores unknown ids', async () => {
    const { resolver } = resolverWith(() =>
      Promise.resolve(
        reply([
          { id: '1', source: '', medium: 'none', aliases: [] },
          { id: 'ghost', source: 'Cars', medium: 'movie', aliases: [] },
        ]),
      ),
    );
    const { sources } = await resolver.resolve([track('1', 'Remember Me (From "Coco")')]);
    expect(Object.fromEntries(sources)).toEqual({
      '1': { name: 'Coco', aliases: [], medium: 'movie' },
    });
  });

  it('knows video games', async () => {
    const { resolver } = resolverWith(() =>
      Promise.resolve(
        reply([{ id: '1', source: 'Celeste', medium: 'game', aliases: ['Celeste Mountain'] }]),
      ),
    );
    const { sources } = await resolver.resolve([track('1', 'Resurrections')]);
    expect(sources.get('1')).toEqual({
      name: 'Celeste',
      aliases: ['Celeste Mountain'],
      medium: 'game',
    });
  });

  it('cleans the aliases: no duplicates, no repeat of the name, a handful at most', async () => {
    const aliases = ['frozen2', 'Frozen', ' Frozen  ', 'a', 'b', 'c', 'd', 'e', 'f', 'a'];
    const { resolver } = resolverWith(() =>
      Promise.resolve(reply([{ id: '1', source: 'Frozen', medium: 'movie', aliases }])),
    );
    const { sources } = await resolver.resolve([track('1')]);
    expect(sources.get('1')?.aliases).toEqual(['frozen2', 'a', 'b', 'c', 'd', 'e']);
  });

  it('looks tracks up in batches', async () => {
    const create = vi.fn().mockResolvedValue(reply([]));
    const { resolver } = resolverWith(create);
    const many = Array.from({ length: ClaudeSourceResolver.BATCH_SIZE * 2 + 1 }, (_, i) =>
      track(`${i}`),
    );
    await resolver.resolve(many);
    expect(create).toHaveBeenCalledTimes(3);
    expect(sentTracks(create, 0)).toHaveLength(ClaudeSourceResolver.BATCH_SIZE);
  });

  it('does not look up more tracks than the cap', async () => {
    const create = vi.fn().mockResolvedValue(reply([]));
    const { resolver } = resolverWith(create);
    const huge = Array.from({ length: ClaudeSourceResolver.MAX_TRACKS + 100 }, (_, i) =>
      track(`${i}`),
    );
    await resolver.resolve(huge);
    expect(create).toHaveBeenCalledTimes(ClaudeSourceResolver.MAX_TRACKS / 60);
  });

  it.each([
    ['the request fails', () => Promise.reject(new Error('network down'))],
    ['the model refuses', () => Promise.resolve(reply([], 'refusal'))],
    ['the answer is cut off', () => Promise.resolve(reply([], 'max_tokens'))],
    [
      'the answer is not valid',
      () =>
        Promise.resolve({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'not json' }],
        } as unknown as Anthropic.Message),
    ],
  ])('falls back to the metadata when %s', async (_name, create) => {
    const { resolver, onError } = resolverWith(create);
    const { sources, lookup } = await resolver.resolve([
      track('1', 'Remember Me (From "Coco")'),
      track('2'),
    ]);
    expect(lookup).toBe('metadata');
    expect([...sources.keys()]).toEqual(['1']);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('keeps the batches that worked when another fails', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(reply([{ id: '0', source: 'Frozen', medium: 'movie', aliases: [] }]))
      .mockRejectedValue(new Error('rate limited'));
    const { resolver } = resolverWith(create);
    const many = Array.from({ length: ClaudeSourceResolver.BATCH_SIZE + 1 }, (_, i) =>
      track(`${i}`),
    );
    const { sources, lookup } = await resolver.resolve(many);
    expect(lookup).toBe('ai');
    expect(sources.get('0')?.name).toBe('Frozen');
  });
});
