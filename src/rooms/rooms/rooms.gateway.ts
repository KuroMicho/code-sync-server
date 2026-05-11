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
  cors: {
    origin: '*', // En producción, especificar el dominio
  },
  namespace: 'code-sync',
  // Aumentamos a 30MB para soportar el envío masivo de archivos del desafío final
  maxHttpBufferSize: 3e7,
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    console.log(`[SISTEMA]: Conexión establecida -> ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[SISTEMA]: Conexión cerrada -> ${client.id}`);
    // Notificamos globalmente para que los docentes limpien sus listas
    this.server.emit('user-disconnected', client.id);
  }

  /**
   * Une a un usuario a una sala, limpiando cualquier suscripción previa.
   */
  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; role: 'teacher' | 'student'; name: string },
  ) {
    // 1. LIMPIEZA DE SALAS PREVIAS (Evita "agentes dobles")
    const currentRooms = Array.from(client.rooms).filter(
      (r) => r !== client.id,
    );

    currentRooms.forEach((oldRoom) => {
      // Avisar a los profes de la sala anterior que el usuario se va
      this.server
        .to(`${oldRoom}-teachers`)
        .emit('user-disconnected', client.id);
      client.leave(oldRoom);
      client.leave(`${oldRoom}-teachers`);
    });

    // 2. UNIR A NUEVA SALA
    client.join(data.roomId);

    if (data.role === 'teacher') {
      client.join(`${data.roomId}-teachers`);
      // Pedir a los alumnos de la nueva sala que sincronicen sus archivos
      client.to(data.roomId).emit('request-sync');
      console.log(`[DOCENTE]: ${data.name} entró a sala ${data.roomId}`);
    } else {
      console.log(`[ESTUDIANTE]: ${data.name} entró a sala ${data.roomId}`);
    }

    // 3. NOTIFICAR AL EQUIPO DOCENTE DE LA SALA
    this.server.to(`${data.roomId}-teachers`).emit('user-joined', {
      id: client.id,
      name: data.name,
      role: data.role,
    });

    return { status: 'ok' };
  }

  /**
   * Reenvía el árbol de archivos del alumno al canal de docentes.
   */
  @SubscribeMessage('refresh-file-tree')
  handleRefreshTree(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; files: string[]; name: string },
  ) {
    this.server.to(`${data.roomId}-teachers`).emit('student-file-tree', {
      studentId: client.id,
      name: data.name,
      files: data.files,
    });
  }

  /**
   * Sincronización en vivo (mientras el alumno escribe).
   */
  @SubscribeMessage('code-update')
  handleCodeUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; filePath: string; content: string },
  ) {
    this.server.to(`${data.roomId}-teachers`).emit('code-remote-update', {
      studentId: client.id,
      filePath: data.filePath,
      content: data.content,
    });
  }

  /**
   * Petición P2P de contenido (Docente -> Estudiante)
   */
  @SubscribeMessage('request-file-content')
  handleRequestFile(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { studentId: string; filePath: string },
  ) {
    this.server.to(data.studentId).emit('get-content', {
      teacherId: client.id,
      filePath: data.filePath,
    });
  }

  /**
   * Respuesta P2P de contenido (Estudiante -> Docente)
   */
  @SubscribeMessage('send-content')
  handleSendContent(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { teacherId: string; filePath: string; content: string },
  ) {
    this.server.to(data.teacherId).emit('file-content-received', {
      studentId: client.id,
      filePath: data.filePath,
      content: data.content,
    });
  }

  /**
   * El profesor crea archivos en los clientes de los alumnos (individual o broadcast).
   */
  @SubscribeMessage('teacher-create-file')
  handleCreateFile(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      studentId?: string;
      fileName: string;
      initialContent: string;
      isBinary: boolean;
    },
  ) {
    const payload = {
      fileName: data.fileName,
      initialContent: data.initialContent,
      isBinary: data.isBinary,
    };

    if (data.studentId) {
      this.server.to(data.studentId).emit('create-local-file', payload);
    } else {
      client.to(data.roomId).emit('create-local-file', payload);
    }
  }

  /**
   * LÓGICA DE DESAFÍO: Iniciar cronómetro.
   */
  @SubscribeMessage('start-timer')
  handleStartTimer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; minutes: number },
  ) {
    this.server.to(data.roomId).emit('timer-started', {
      minutes: data.minutes,
      startTime: Date.now(),
    });
  }

  /**
   * LÓGICA DE DESAFÍO: Cancelar cronómetro.
   */
  @SubscribeMessage('stop-timer')
  handleStopTimer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    this.server.to(data.roomId).emit('timer-stopped');
  }

  /**
   * ENTREGA FINAL: Recibe el proyecto completo del alumno (Snapshot).
   */
  @SubscribeMessage('student-submit-task')
  handleStudentSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; name: string; files: any[] },
  ) {
    // Reenviamos todo el paquete a los profesores de la sala
    this.server
      .to(`${data.roomId}-teachers`)
      .emit('final-submission-received', {
        studentId: client.id,
        name: data.name,
        files: data.files, // Array de { path, content } en Base64
      });
    console.log(
      `[ENTREGA]: Proyecto recibido de ${data.name} (${data.files.length} archivos)`,
    );
  }
}
