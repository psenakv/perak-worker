import type { JobRequest, JobResponse } from './types';

const FETCH_TIMEOUT_MS = 25_000;

export async function executeRequest(request: JobRequest): Promise<JobResponse> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const fetchOptions: RequestInit = {
      method: request.method,
      headers: request.headers,
      signal: controller.signal,
      redirect: 'follow',
    };

    if (request.body !== null && request.body !== undefined) {
      fetchOptions.body = request.body;
    }

    const response = await fetch(request.url, fetchOptions);

    // Collect headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const body = await response.text();

    return {
      status: response.status,
      headers,
      body,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutHandle);
  }
}
