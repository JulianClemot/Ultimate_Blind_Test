import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { answer } from '@/test/fixtures';

import { AnswerList } from './AnswerList';

describe('<AnswerList />', () => {
  it('shows an empty state', () => {
    render(<AnswerList answers={[]} />);
    expect(screen.getByText('No answer yet.')).toBeInTheDocument();
  });

  it('renders rank, player, answer, verdict and elapsed time', () => {
    render(
      <AnswerList
        answers={[
          answer({
            id: 'a1',
            playerName: 'Alice',
            text: 'Thriller',
            elapsedMs: 1234,
            verdict: { title: true, artist: false, source: false },
          }),
          answer({ id: 'a2', playerName: 'Bob', text: 'Beat It', elapsedMs: 2500 }),
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('1.AliceThriller◐ PartialTitle ✓Artist ✗1.234 s');
    expect(items[1]).toHaveTextContent('2.BobBeat It✗ WrongTitle ✗Artist ✗2.500 s');
  });

  it('summarises each answer as correct, partial or wrong', () => {
    render(
      <AnswerList
        answers={[
          answer({
            id: 'a1',
            playerName: 'Alice',
            verdict: { title: true, artist: true, source: false },
          }),
          answer({
            id: 'a2',
            playerName: 'Bob',
            verdict: { title: true, artist: false, source: false },
          }),
          answer({
            id: 'a3',
            playerName: 'Cleo',
            verdict: { title: false, artist: false, source: false },
          }),
        ]}
      />,
    );
    expect(screen.getByRole('status', { name: 'Alice: correct' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Bob: partial' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Cleo: wrong' })).toBeInTheDocument();
  });

  it('judges only the asked parts', () => {
    render(
      <AnswerList
        answers={[
          answer({ playerName: 'Alice', verdict: { title: true, artist: false, source: false } }),
        ]}
        asks={{ title: true, artist: false, source: false }}
      />,
    );
    expect(screen.getByRole('status', { name: 'Alice: correct' })).toBeInTheDocument();
  });

  it('only shows the parts the round asks for', () => {
    render(
      <AnswerList answers={[answer()]} asks={{ title: true, artist: false, source: false }} />,
    );
    expect(screen.queryByRole('button', { name: /Artist/ })).not.toBeInTheDocument();
  });

  it('lets the host flip a verdict', async () => {
    const onJudge = vi.fn();
    const sent = answer({ verdict: { title: false, artist: true, source: false } });
    render(<AnswerList answers={[sent]} onJudge={onJudge} />);
    await userEvent.click(screen.getByRole('button', { name: 'Title wrong' }));
    expect(onJudge).toHaveBeenCalledWith(sent, { title: true, artist: true, source: false });
  });
});

describe('<AnswerList /> in a round about films and series', () => {
  const asks = { title: false, artist: false, source: true };

  it('shows the film verdict and lets the host flip it', async () => {
    const onJudge = vi.fn();
    const sent = answer({
      playerName: 'Alice',
      verdict: { title: false, artist: false, source: true },
    });
    render(<AnswerList answers={[sent]} asks={asks} onJudge={onJudge} />);

    expect(screen.getByRole('status', { name: 'Alice: correct' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Title|Artist/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Film or series correct' }));
    expect(onJudge).toHaveBeenCalledWith(sent, { title: false, artist: false, source: false });
  });

  it('names the part after the kind of round', () => {
    render(
      <AnswerList
        answers={[answer({ verdict: { title: false, artist: false, source: true } })]}
        asks={asks}
        sourceLabel="Video game"
      />,
    );
    expect(screen.getByRole('button', { name: 'Video game correct' })).toBeInTheDocument();
  });

  it('judges only the film, whatever the other parts say', () => {
    render(
      <AnswerList
        answers={[
          answer({ playerName: 'Bob', verdict: { title: true, artist: true, source: false } }),
        ]}
        asks={asks}
      />,
    );
    expect(screen.getByRole('status', { name: 'Bob: wrong' })).toBeInTheDocument();
  });
});
