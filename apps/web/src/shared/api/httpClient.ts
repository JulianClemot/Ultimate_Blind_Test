import type { ErrorDto } from '@ubt/shared';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const baseUrl = import.meta.env.VITE_API_URL ?? '';

interface RequestOptions {
  readonly body?: unknown;
  /** Sent as `Authorization: Bearer …` (design edit tokens). */
  readonly token?: string;
}

const request = async <T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? null : JSON.stringify(options.body),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as Partial<ErrorDto>;
    throw new HttpError(
      response.status,
      error.code ?? 'HTTP_ERROR',
      error.message ?? response.statusText,
    );
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
};

export const httpClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, options?: RequestOptions) => request<T>('POST', path, options),
  put: <T>(path: string, options?: RequestOptions) => request<T>('PUT', path, options),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
};
