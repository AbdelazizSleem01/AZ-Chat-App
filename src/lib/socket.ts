import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    const fallbackUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const url = envUrl || fallbackUrl;
    const shouldConnect = Boolean(envUrl);
    socket = io(url, {
      autoConnect: shouldConnect,
      reconnection: shouldConnect,
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
