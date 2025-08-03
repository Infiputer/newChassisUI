import { StreamingMessage } from '../types';

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private onMessageCallback: ((message: StreamingMessage) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onCloseCallback: (() => void) | null = null;

  connect(conversationId: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const wsUrl = `${protocol}//${host}:3001?conversationId=${conversationId}&token=${token}`;
      // console.log('[websocket.ts] Connecting to', wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // console.log('[websocket.ts] WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onmessage = (event) => {
        // console.log('[websocket.ts] Message received:', event.data);
        try {
          const message: StreamingMessage = JSON.parse(event.data);
          if (this.onMessageCallback) {
            this.onMessageCallback(message);
          }
        } catch (error) {
          console.error('[websocket.ts] Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[websocket.ts] WebSocket error:', error);
        if (this.onErrorCallback) {
          this.onErrorCallback('WebSocket connection error');
        }
        reject(error);
      };

      this.ws.onclose = () => {
        // console.warn('[websocket.ts] WebSocket closed');
        if (this.onCloseCallback) {
          this.onCloseCallback();
        }
      };
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
  }

  onMessage(callback: (message: StreamingMessage) => void): void {
    this.onMessageCallback = callback;
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  onClose(callback: () => void): void {
    this.onCloseCallback = callback;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const websocketService = new WebSocketService(); 