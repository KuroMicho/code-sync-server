import { Socket } from 'socket.io';

export interface RoomTimer {
  duration: number;
  endTime: number;
}

export interface JoinRoomPayload {
  roomId: string;
  role: 'teacher' | 'student' | 'student-web';
  name: string;
  accessKey?: string;
}

export interface ChatMessagePayload {
  message: string;
  targetId?: string;
}

// Extensión de tipos segura para recuperar las variables cacheadas en Runtime
export interface CustomSocket extends Socket {
  data: {
    role?: 'teacher' | 'student' | 'student-web';
    name?: string;
    roomId?: string;
    isFocused?: boolean;
    wpm?: number;
    isAskingHelp?: boolean;
    alertCopy?: boolean;
    activeFilePath?: string;
    lastActivity?: number;
  };
}
