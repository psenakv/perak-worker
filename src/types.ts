export interface JobRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  ignore_tls_errors?: boolean;
}

export interface JobResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

// Messages from Admin to Worker
export type AdminToWorkerMessage =
  | { type: 'registered'; workerId: string; workerName: string }
  | { type: 'job'; jobId: string; request: JobRequest }
  | { type: 'error'; message: string }
  | { type: 'ping' };

// Messages from Worker to Admin
export type WorkerToAdminMessage =
  | { type: 'register'; token: string }
  | { type: 'job_result'; jobId: string; success: true; response: JobResponse }
  | { type: 'job_result'; jobId: string; success: false; error: string }
  | { type: 'pong' };
