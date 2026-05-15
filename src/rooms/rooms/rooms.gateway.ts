import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'code-sync',
  maxHttpBufferSize: 3e7, // 30MB para proyectos masivos
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // NUEVO: Mapa para guardar el fin del timer por sala { roomId: endTime }
  private activeTimers = new Map<
    string,
    { duration: number; endTime: number }
  >();

  handleConnection(client: Socket) {
    console.log(`[CONEXIÓN]: ID ${client.id} establecida.`);
  }

  handleDisconnect(client: Socket) {
    const { name, roomId, role } = client.data;
    if (roomId) {
      console.log(
        `[DESCONEXIÓN]: ${role?.toUpperCase()} ${name} salió de ${roomId}.`,
      );
      this.server.to(`${roomId}-teachers`).emit('user-disconnected', client.id);
    }
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; role: 'teacher' | 'student'; name: string },
  ) {
    // 1. LIMPIEZA ATÓMICA
    const currentRooms = Array.from(client.rooms).filter(
      (r) => r !== client.id,
    );
    currentRooms.forEach((r) => client.leave(r));

    // 2. ASIGNACIÓN DE IDENTIDAD INMUTABLE (Persiste en el socket)
    client.data.role = data.role;
    client.data.name = data.name;
    client.data.roomId = data.roomId;

    client.join(data.roomId);

    if (data.role === 'teacher') {
      client.join(`${data.roomId}-teachers`);
      client.to(data.roomId).emit('request-sync'); // Forzar a alumnos a reportarse
      console.log(
        `[DOCENTE]: ${data.name} tomó control de la sala ${data.roomId}`,
      );
    } else {
      console.log(
        `[ESTUDIANTE]: ${data.name} se unió a la sala ${data.roomId}`,
      );
    }

    // Notificar solo a los profes de esta sala específica
    this.server.to(`${data.roomId}-teachers`).emit('user-joined', {
      id: client.id,
      name: data.name,
      role: data.role,
    });

    // 🛡️ RECONEXIÓN DE TIMER:
    // Si el usuario entra y hay un timer activo en esa sala...
    const roomTimer = this.activeTimers.get(data.roomId);
    if (roomTimer) {
      const remainingMs = roomTimer.endTime - Date.now();
      if (remainingMs > 0) {
        // Le enviamos al alumno que se acaba de conectar el tiempo exacto que queda
        const remainingMinutes = remainingMs / 60000;
        client.emit('timer-started', {
          minutes: remainingMinutes,
          isSync: true, // Flag para saber que es una sincronización
        });
      }
    }

    return { status: 'ok', session: client.data };
  }

  /**
   * ACCIONES EXCLUSIVAS DE ESTUDIANTE
   */

  @SubscribeMessage('refresh-file-tree')
  handleRefreshTree(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    // Seguridad: Un profesor no debe enviar su árbol
    if (client.data.role !== 'student') return;

    this.server.to(`${client.data.roomId}-teachers`).emit('student-file-tree', {
      studentId: client.id,
      name: client.data.name,
      files: data.files,
    });
  }

  @SubscribeMessage('code-update')
  handleCodeUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    if (client.data.role !== 'student') return;

    this.server
      .to(`${client.data.roomId}-teachers`)
      .emit('code-remote-update', {
        studentId: client.id,
        filePath: data.filePath,
        content: data.content,
      });
  }

  @SubscribeMessage('student-submit-task')
  handleStudentSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    // Validación de Identidad y Rol
    if (client.data.role !== 'student') {
      console.warn(
        `[⚠️ ALERTA]: Intento de envío ilegal de Snapshot por ${client.data.name}`,
      );
      return { status: 'denied' };
    }

    this.server
      .to(`${client.data.roomId}-teachers`)
      .emit('final-submission-received', {
        studentId: client.id,
        name: client.data.name,
        files: data.files,
      });
    console.log(`[ENTREGA]: Snapshot recibido de ${client.data.name}`);
  }

  /**
   * ACCIONES EXCLUSIVAS DE DOCENTE
   */

  @SubscribeMessage('teacher-create-file')
  handleCreateFile(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    // Bloqueo: Si no es profe, no puede distribuir archivos
    if (client.data.role !== 'teacher') return { status: 'forbidden' };

    const payload = {
      fileName: data.fileName,
      initialContent: data.initialContent,
      isBinary: data.isBinary,
    };

    if (data.studentId) {
      this.server.to(data.studentId).emit('create-local-file', payload);
    } else {
      // Usamos client.data.roomId para asegurar que no envíe a otras salas
      client.to(client.data.roomId).emit('create-local-file', payload);
    }
  }

  @SubscribeMessage('start-timer')
  handleStartTimer(client: Socket, data: { roomId: string; minutes: number }) {
    if (client.data.role !== 'teacher') return;

    const endTime = Date.now() + data.minutes * 60000;

    // Guardamos en la memoria del servidor
    this.activeTimers.set(data.roomId, {
      duration: data.minutes,
      endTime: endTime,
    });

    this.server.to(data.roomId).emit('timer-started', {
      minutes: data.minutes,
      startTime: Date.now(),
    });
  }

  @SubscribeMessage('stop-timer')
  handleStopTimer(client: Socket) {
    if (client.data.role !== 'teacher') return;

    // Limpiamos el timer del servidor
    this.activeTimers.delete(client.data.roomId);
    this.server.to(client.data.roomId).emit('timer-stopped');
  }

  /**
   * COMUNICACIÓN P2P (PROFE <-> ALUMNO)
   */

  @SubscribeMessage('request-file-content')
  handleRequestFile(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { studentId: string; filePath: string },
  ) {
    if (client.data.role !== 'teacher') return;
    this.server
      .to(data.studentId)
      .emit('get-content', { teacherId: client.id, filePath: data.filePath });
  }

  @SubscribeMessage('send-content')
  handleSendContent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    // El alumno le responde al profe que solicitó
    this.server.to(data.teacherId).emit('file-content-received', {
      studentId: client.id,
      filePath: data.filePath,
      content: data.content,
    });
  }

  @SubscribeMessage('request-help')
  handleRequestHelp(@ConnectedSocket() client: Socket) {
    // Solo los alumnos piden ayuda
    if (client.data.role !== 'student') return;

    this.server
      .to(`${client.data.roomId}-teachers`)
      .emit('student-help-requested', {
        studentId: client.id,
      });
    console.log(`[AYUDA]: ${client.data.name} ha solicitado asistencia.`);
  }

  @SubscribeMessage('resolve-help')
  handleResolveHelp(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { studentId: string },
  ) {
    // Solo el profe puede marcar como resuelta
    if (client.data.role !== 'teacher') return;

    this.server
      .to(`${client.data.roomId}-teachers`)
      .emit('student-help-resolved', {
        studentId: data.studentId,
      });
  }

  @SubscribeMessage('send-chat-message')
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message: string; targetId?: string },
  ) {
    const { roomId, name, role } = client.data;
    if (!roomId) return;

    const payload = {
      sender: name,
      role: role,
      message: data.message,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };

    if (role === 'teacher') {
      if (data.targetId) {
        // Mensaje privado del profesor a un alumno específico
        this.server.to(data.targetId).emit('chat-message-received', payload);
      } else {
        // Comunicado general del profesor a toda la sala
        client.to(roomId).emit('chat-message-received', payload);
      }
    } else {
      // El alumno envía un mensaje; solo le llega a los profesores de la sala
      this.server
        .to(`${roomId}-teachers`)
        .emit('chat-message-received', payload);
    }

    console.log(`[CHAT] [${roomId}] ${name} (${role}): ${data.message}`);
  }
}
