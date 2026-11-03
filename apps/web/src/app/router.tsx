import { createBrowserRouter } from 'react-router';

import { DesignEditorPage } from '@/features/design/DesignEditorPage';
import { HomePage } from '@/features/home/HomePage';
import { HostGamePage } from '@/features/host/HostGamePage';
import { PlayerGamePage } from '@/features/player/PlayerGamePage';

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/designs/:designId', element: <DesignEditorPage /> },
  { path: '/host/:gameId', element: <HostGamePage /> },
  { path: '/play/:gameId', element: <PlayerGamePage /> },
]);
