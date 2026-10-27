type MessageCallback = (data: any) => void;

const getWsUrl = (): string => {
  const envWs = import.meta.env.VITE_WS_URL;
  if (envWs && typeof envWs === 'string' && envWs.trim().length > 0) {
    const trimmed = envWs.trim().replace(/\/+$/, '');
    if (trimmed.endsWith('/api/v1/ws')) {
      return trimmed;
    }
    if (trimmed.endsWith('/api/v1')) {
      return `${trimmed}/ws`;
    }
    return `${trimmed}/api/v1/ws`;
  }

  // Derive from VITE_API_URL if provided
  const envApi = import.meta.env.VITE_API_URL;
  if (envApi && typeof envApi === 'string' && envApi.trim().length > 0) {
    const trimmed = envApi.trim().replace(/\/+$/, '');
    const wsScheme = trimmed.startsWith('https://') ? 'wss://' : 'ws://';
    const hostPath = trimmed.replace(/^https?:\/\//, '');
    if (hostPath.endsWith('/api/v1')) {
      return `${wsScheme}${hostPath}/ws`;
    }
    return `${wsScheme}${hostPath}/api/v1/ws`;
  }

  return 'wss://police-attendance.onrender.com/api/v1/ws';
};

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url = getWsUrl();
  private callbacks: Map<string, MessageCallback[]> = new Map();
  private reconnectTimer: any = null;
  public isConnected = false;

  constructor() {
    this.connect();
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        window.dispatchEvent(new CustomEvent('policehq_ws_status', { detail: { connected: true } }));
        // Heartbeat ping
        setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send('ping');
          }
        }, 30000);
      };

      this.ws.onmessage = (event) => {
        if (event.data === 'pong') return;
        try {
          const payload = JSON.parse(event.data);
          const type = payload.type;
          const handlers = this.callbacks.get(type) || [];
          handlers.forEach(cb => cb(payload.data));
          
          // Also dispatch global window event for broad listeners
          window.dispatchEvent(new CustomEvent(`policehq_${type.toLowerCase()}`, { detail: payload.data }));
        } catch (e) {
          console.error("WS Parse Error:", e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        window.dispatchEvent(new CustomEvent('policehq_ws_status', { detail: { connected: false } }));
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnected = false;
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 5000);
  }

  public on(type: string, callback: MessageCallback) {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, []);
    }
    this.callbacks.get(type)!.push(callback);
    return () => {
      const list = this.callbacks.get(type) || [];
      this.callbacks.set(type, list.filter(cb => cb !== callback));
    };
  }
}

export const wsService = new WebSocketClient();
