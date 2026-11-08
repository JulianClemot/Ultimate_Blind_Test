import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AnswerForm } from './AnswerForm';

const suggestions = [
  { id: 't1', label: 'Daft Punk – One More Time' },
  { id: 't2', label: 'Daft Punk – Around the World' },
  { id: 't3', label: 'Queen – Bohemian Rhapsody' },
];

const setup = (list = suggestions) => {
  const onSubmit = vi.fn();
  render(<AnswerForm suggestions={list} onSubmit={onSubmit} pending={false} />);
  return { onSubmit, input: screen.getByLabelText('Your answer') };
};

const options = () => screen.queryAllByRole('option').map((o) => o.textContent);

describe('<AnswerForm />', () => {
  it('proposes nothing in a round that is not easy', async () => {
    const { input, onSubmit } = setup([]);
    expect(input).not.toHaveAttribute('role', 'combobox');

    await userEvent.type(input, 'daft punk');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Answer!' }));
    expect(onSubmit).toHaveBeenCalledWith({ text: 'daft punk' });
  });

  it('proposes the matching tracks while typing', async () => {
    const { input } = setup();
    expect(input).toHaveAttribute('role', 'combobox');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await userEvent.type(input, 'daft');
    expect(options()).toEqual(['Daft Punk – One More Time', 'Daft Punk – Around the World']);

    await userEvent.type(input, ' one');
    expect(options()).toEqual(['Daft Punk – One More Time']);
  });

  it('fills the field when a suggestion is clicked, and sends it with its id', async () => {
    const { input, onSubmit } = setup();
    await userEvent.type(input, 'queen');
    await userEvent.click(screen.getByRole('option', { name: 'Queen – Bohemian Rhapsody' }));

    expect(input).toHaveValue('Queen – Bohemian Rhapsody');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled(); // one guess only: a mere pick sends nothing
    expect(screen.getByText(/no bonus/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Answer!' }));
    expect(onSubmit).toHaveBeenCalledWith({
      text: 'Queen – Bohemian Rhapsody',
      suggestionId: 't3',
    });
  });

  it('works with the keyboard', async () => {
    const { input, onSubmit } = setup();
    await userEvent.type(input, 'daft');
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(input).toHaveValue('Daft Punk – Around the World');
    await userEvent.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledWith({
      text: 'Daft Punk – Around the World',
      suggestionId: 't2',
    });
  });

  it('is a free answer again once the picked text is edited', async () => {
    const { input, onSubmit } = setup();
    await userEvent.type(input, 'queen');
    await userEvent.click(screen.getByRole('option'));
    await userEvent.type(input, ' live');

    expect(screen.queryByText(/no bonus/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Answer!' }));
    expect(onSubmit).toHaveBeenCalledWith({ text: 'Queen – Bohemian Rhapsody live' });
  });

  it('closes the list with Escape', async () => {
    const { input } = setup();
    await userEvent.type(input, 'daft');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('<AnswerForm /> in a round about films and series', () => {
  const films = [
    { id: 'frozen', label: 'Frozen' },
    { id: 'frozen 2', label: 'Frozen 2' },
    { id: 'tangled', label: 'Tangled' },
  ];

  it('asks for the name of the film or series', () => {
    render(<AnswerForm suggestions={[]} source="screen" onSubmit={vi.fn()} pending={false} />);
    expect(screen.getByLabelText('Your answer')).toHaveAttribute(
      'placeholder',
      'Name of the film or series',
    );
  });

  it('asks for the name of the video game in a video game round', () => {
    render(<AnswerForm suggestions={[]} source="game" onSubmit={vi.fn()} pending={false} />);
    expect(screen.getByLabelText('Your answer')).toHaveAttribute(
      'placeholder',
      'Name of the video game',
    );
  });

  it('proposes the films and sends the one picked', async () => {
    const onSubmit = vi.fn();
    render(<AnswerForm suggestions={films} source="screen" onSubmit={onSubmit} pending={false} />);
    await userEvent.type(screen.getByLabelText('Your answer'), 'froz');
    expect(options()).toEqual(['Frozen', 'Frozen 2']);

    await userEvent.click(screen.getByRole('option', { name: 'Frozen 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Answer!' }));
    expect(onSubmit).toHaveBeenCalledWith({ text: 'Frozen 2', suggestionId: 'frozen 2' });
  });
});

describe('<AnswerForm /> clear button', () => {
  it('only shows while there is something to clear', async () => {
    render(<AnswerForm suggestions={[]} onSubmit={vi.fn()} pending={false} />);
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Your answer'), 'dap');
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('empties the field and keeps the focus there', async () => {
    render(<AnswerForm suggestions={[]} onSubmit={vi.fn()} pending={false} />);
    const input = screen.getByLabelText('Your answer');
    await userEvent.type(input, 'daft punk');
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Answer!' })).toBeDisabled();
  });

  it('forgets a picked suggestion, so the next answer is free text', async () => {
    const onSubmit = vi.fn();
    render(<AnswerForm suggestions={suggestions} onSubmit={onSubmit} pending={false} />);
    const input = screen.getByLabelText('Your answer');
    await userEvent.type(input, 'queen');
    await userEvent.click(screen.getByRole('option'));
    expect(screen.getByText(/no bonus/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByText(/no bonus/i)).not.toBeInTheDocument();
    await userEvent.type(input, 'abba');
    await userEvent.click(screen.getByRole('button', { name: 'Answer!' }));
    expect(onSubmit).toHaveBeenCalledWith({ text: 'abba' });
  });
});
