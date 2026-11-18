import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSessionStore } from '@/shared/session/sessionStore';
import { renderWithRealtime } from '@/test/renderWithRealtime';

import { ResumeHosting } from './ResumeHosting';

const renderIt = () =>
  renderWithRealtime(
    <MemoryRouter>
      <ResumeHosting />
    </MemoryRouter>,
  );

describe('<ResumeHosting />', () => {
  beforeEach(() => useSessionStore.setState({ host: null }));

  it('renders nothing when this tab hosts no game', () => {
    renderIt();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('links back to the game the host left running', () => {
    useSessionStore.setState({
      host: { gameId: 'g1', hostToken: 't', gameName: 'Friday night', code: 'ABCDEF' },
    });
    renderIt();

    expect(screen.getByText('Friday night · code ABCDEF')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to the game' })).toHaveAttribute(
      'href',
      '/host/g1',
    );
  });

  it('still works for a session saved without a name', () => {
    useSessionStore.setState({ host: { gameId: 'g1', hostToken: 't' } });
    renderIt();
    expect(screen.getByRole('link', { name: 'Back to the game' })).toBeVisible();
  });
});
