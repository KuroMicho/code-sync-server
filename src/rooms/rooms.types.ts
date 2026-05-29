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

/**
 * Payload formal para la retransmisión de mensajes de soporte y comunicados en el clúster.
 */
export interface ChatMessageBroadcastPayload {
  senderId: string;
  sender: string;
  role: 'teacher' | 'student' | 'student-web';
  message: string;
  targetId?: string;
  isPrivate: boolean;
  timestamp: string;
}

/**
 * Extensión de la interfaz nativa de Socket.io.
 * Mapea y tipa de forma estricta los metadatos volátiles almacenados en la memoria RAM de cada socket en Runtime.
 * Previene el uso de mutaciones implícitas de tipo 'any' o baches de tipado durante la compilación.
 */
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
    activeChallengeId?: string;
    ultimoCodigoPicado?: string;
    plagiarismHistory?: any[];
  };
}
