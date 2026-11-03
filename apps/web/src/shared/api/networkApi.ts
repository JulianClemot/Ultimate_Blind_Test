import { useQuery } from '@tanstack/react-query';

import { httpClient } from './httpClient';

/** LAN IPv4 addresses of the server machine. */
export const useLanAddresses = () =>
  useQuery({
    queryKey: ['network'],
    queryFn: () => httpClient.get<{ addresses: string[] }>('/api/network'),
    staleTime: Infinity,
    retry: false,
  });
