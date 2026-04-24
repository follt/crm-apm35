declare global {
  interface Window {
    api: {
      invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
    };
  }
}

export const ipc = {
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
    if (typeof window === 'undefined' || !window.api) {
      return Promise.reject(new Error('IPC bridge unavailable (app must run inside Electron)'));
    }
    return window.api.invoke<T>(channel, ...args);
  },
};

export {};
