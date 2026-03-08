import WebSocket from 'ws';
import { executeRequest } from './executor';
import type { AdminToWorkerMessage, WorkerToAdminMessage } from './types';

const MIN_RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 60_000;

export class WorkerConnection {
  private ws: WebSocket | null = null;
  private reconnectDelay = MIN_RECONNECT_DELAY_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private workerId: string | null = null;
  private workerName: string | null = null;

  constructor(
    private readonly adminWsUrl: string,
    private readonly workerToken: string
  ) {}

  start() {
    this.connect();
  }

  stop() {
    this.isShuttingDown = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Shutdown');
    }
  }

  private connect() {
    if (this.isShuttingDown) return;

    console.log(`[connection] Connecting to ${this.adminWsUrl}...`);
    this.ws = new WebSocket(this.adminWsUrl);

    this.ws.on('open', () => {
      console.log('[connection] Connected. Sending register message...');
      this.reconnectDelay = MIN_RECONNECT_DELAY_MS;
      this.send({ type: 'register', token: this.workerToken });
    });

    this.ws.on('message', (data: Buffer) => {
      let message: AdminToWorkerMessage;
      try {
        message = JSON.parse(data.toString()) as AdminToWorkerMessage;
      } catch {
        console.warn('[connection] Received invalid JSON');
        return;
      }

      this.handleMessage(message);
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[connection] Disconnected (code=${code}, reason=${reason.toString()})`);
      this.ws = null;
      this.workerId = null;
      this.workerName = null;
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[connection] WebSocket error:', err.message);
      // close event will fire after error
    });
  }

  private handleMessage(message: AdminToWorkerMessage) {
    switch (message.type) {
      case 'registered':
        this.workerId = message.workerId;
        this.workerName = message.workerName;
        console.log(`[connection] Registered as worker "${message.workerName}" (${message.workerId})`);
        break;

      case 'job':
        console.log(`[connection] Received job ${message.jobId}: ${message.request.method} ${message.request.url}`);
        this.handleJob(message.jobId, message.request);
        break;

      case 'ping':
        this.send({ type: 'pong' });
        break;

      case 'error':
        console.error(`[connection] Received error from admin: ${message.message}`);
        if (message.message.includes('Invalid') || message.message.includes('revoked')) {
          console.error('[connection] Fatal auth error - stopping reconnects');
          this.isShuttingDown = true;
          this.ws?.close();
        }
        break;

      default:
        console.warn('[connection] Unknown message type:', (message as { type: string }).type);
    }
  }

  private async handleJob(jobId: string, request: import('./types').JobRequest) {
    try {
      const response = await executeRequest(request);
      console.log(`[connection] Job ${jobId} completed with status ${response.status}`);
      this.send({
        type: 'job_result',
        jobId,
        success: true,
        response,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[connection] Job ${jobId} failed: ${errorMessage}`);
      this.send({
        type: 'job_result',
        jobId,
        success: false,
        error: errorMessage,
      });
    }
  }

  private send(message: WorkerToAdminMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[connection] Cannot send message - not connected');
    }
  }

  private scheduleReconnect() {
    if (this.isShuttingDown) return;

    console.log(`[connection] Reconnecting in ${this.reconnectDelay / 1000}s...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }
}
