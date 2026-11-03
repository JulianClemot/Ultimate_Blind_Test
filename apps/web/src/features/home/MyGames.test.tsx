import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDesignStore } from '@/shared/session/designStore';
import { renderWithRealtime } from '@/test/renderWithRealtime';

import { MyGames } from './MyGames';

const fetchMock = vi.fn();

const reply = (status: number, body?: unknown) =>
  fetchMock.mockResolvedValueOnce(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );

const names = () => useDesignStore.getState().designs.map((d) => d.name);

describe('<MyGames />', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    useDesignStore.setState({
      designs: [
        { designId: 'd1', editToken: 'tok-1', name: 'Friday night' },
        { designId: 'd2', editToken: 'tok-2', name: 'Birthday' },
      ],
    });
    renderWithRealtime(
      <MemoryRouter>
        <MyGames />
      </MemoryRouter>,
    );
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('lists the games with a link to each', () => {
    expect(screen.getByRole('link', { name: 'Friday night' })).toHaveAttribute(
      'href',
      '/designs/d1',
    );
    expect(screen.getByRole('link', { name: 'Birthday' })).toHaveAttribute('href', '/designs/d2');
  });

  it('deletes a game after confirmation, with its edit token', async () => {
    reply(204);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Friday night' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('Delete “Friday night” for good?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));

    await waitFor(() => expect(names()).toEqual(['Birthday']));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/designs/d1');
    expect(init).toMatchObject({ method: 'DELETE', headers: { Authorization: 'Bearer tok-1' } });
    expect(screen.queryByRole('link', { name: 'Friday night' })).not.toBeInTheDocument();
  });

  it('keeps the game when the host cancels', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Delete Birthday' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(names()).toEqual(['Friday night', 'Birthday']);
    expect(screen.getByRole('link', { name: 'Birthday' })).toBeInTheDocument();
  });

  it('keeps the game and shows the error when the server refuses', async () => {
    reply(503, { code: 'INTERNAL_ERROR', message: 'Server unavailable' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete Birthday' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');
    expect(names()).toEqual(['Friday night', 'Birthday']);
  });

  it('drops a game that no longer exists on the server', async () => {
    reply(404, { code: 'DESIGN_NOT_FOUND', message: 'Game design not found' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete Birthday' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));

    await waitFor(() => expect(names()).toEqual(['Friday night']));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
