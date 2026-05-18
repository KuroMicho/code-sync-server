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
  maxHttpBufferSize: 3e7, // 30MB para transferencias masivas de snapshots base64
  pingInterval: 10000, // Latido constante cada 10 segundos
  pingTimeout: 20000, // Margen de espera de 20s para mitigar microcortes de Wi-Fi
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // Mapa global para persistir el ciclo de vida de los cronómetros { roomId: { duration, endTime } }
  private activeTimers = new Map<
    string,
    { duration: number; endTime: number }
  >();

  /**
   * Captura la conexión inicial del canal de WebSockets
   */
  handleConnection(client: Socket) {
    console.log(
      `[CONEXIÓN ESTABLECIDA]: ID único asignado de forma remota: ${client.id}`,
    );
  }

  /**
   * Captura la desconexión del socket limpiando recursos y notificando a los paneles docentes
   */
  handleDisconnect(client: Socket) {
    const { name, roomId, role } = client.data;
    if (roomId) {
      console.log(
        `[DESCONEXIÓN DE RED]: ${role?.toUpperCase()} | Nombre: ${name || 'Desconocido'} abandonó de forma física la sala: ${roomId}`,
      );
      // Notifica de forma inmediata a los dashboards y árboles laterales para purgar al alumno
      this.server.to(`${roomId}-teachers`).emit('user-disconnected', client.id);
    }
  }

  /**
   * Autenticación, asignación de roles estratégicos y sincronización atómica de estados residuales
   */
  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; role: 'teacher' | 'student'; name: string },
  ) {
    console.log(
      `[SOLICITUD ACCESO]: Intento de ingreso de ${data.name} como [${data.role.toUpperCase()}] a la Sala: ${data.roomId}`,
    );

    // 1. LIMPIEZA ATÓMICA DE PRE-CONEXIONES (Evita duplicados si cambian de sala sin cerrar VS Code)
    const currentRooms = Array.from(client.rooms).filter(
      (r) => r !== client.id,
    );
    currentRooms.forEach((r) => {
      client.leave(r);
      console.log(
        `[PURGA LOCAL]: ID: ${client.id} removido de sala residual: ${r}`,
      );
    });

    // 2. ASIGNACIÓN DE IDENTIDAD EN MEMORIA VOLÁTIL DEL SOCKET
    client.data.role = data.role;
    client.data.name = data.name;
    client.data.roomId = data.roomId;

    // Inicialización predeterminada de telemetría para alumnos nuevos
    if (data.role === 'student') {
      client.data.isFocused = true;
      client.data.wpm = 0;
      client.data.isAskingHelp = false;
      client.data.alertCopy = false;
      client.data.activeFilePath = '';
    }

    client.join(data.roomId);

    // 3. LOGICA RECOLECTORA SEGÚN EL ROL
    if (data.role === 'teacher') {
      client.join(`${data.roomId}-teachers`);
      client.to(data.roomId).emit('request-sync'); // Fuerza un escaneo inmediato de árboles de archivos en alumnos
      console.log(
        `[AUTORIZACIÓN DOCENTE]: Profesor '${data.name}' tomó control del ecosistema de la sala [${data.roomId}]`,
      );

      // 🧠 SINCRONIZACIÓN DE CACHE DE CLASE (Late-Joiner): Reconstruye el aula si el profe entra tarde o recarga
      const roomSockets = await this.server.in(data.roomId).fetchSockets();
      console.log(
        `[RECONSTRUCCIÓN DE FLUJO]: Compilando telemetría de ${roomSockets.length} nodos activos para el docente.`,
      );

      roomSockets.forEach((s) => {
        if (s.data.role === 'student') {
          // Re-inyecta la existencia al árbol izquierdo del VS Code del profesor
          client.emit('user-joined', {
            id: s.id,
            name: s.data.name,
            role: 'student',
          });

          // Re-inyecta sus analíticas exactas acumuladas al Dashboard central
          client.emit('telemetry-updated', {
            studentId: s.id,
            name: s.data.name,
            isFocused: s.data.isFocused !== false,
            wpm: s.data.wpm || 0,
            isAskingHelp: s.data.isAskingHelp || false,
            isCopyPaste: s.data.alertCopy || false,
            activeFilePath: s.data.activeFilePath || '',
          });
        }
      });
    } else {
      console.log(
        `[MATRÍCULA ALUMNO]: Estudiante '${data.name}' reportado y listo para recibir instrucciones en la sala [${data.roomId}]`,
      );
    }

    // Reportar incorporación al pool de docentes activos de esta sala
    this.server.to(`${data.roomId}-teachers`).emit('user-joined', {
      id: client.id,
      name: data.name,
      role: data.role,
    });

    // 🛡️ RECONEXIÓN CRONOMETRADA ANTI-CAÍDAS DE INTERNET
    const roomTimer = this.activeTimers.get(data.roomId);
    if (roomTimer) {
      const remainingMs = roomTimer.endTime - Date.now();
      if (remainingMs > 0) {
        const remainingMinutes = remainingMs / 60000;
        client.emit('timer-started', {
          minutes: remainingMinutes,
          isSync: true,
        });
        console.log(
          `[SALVAGUARDA CRONÓMETRO]: Sincronizando reloj de ${data.name} a ${remainingMinutes.toFixed(2)} minutos restantes.`,
        );
      }
    }

    return { status: 'ok', session: client.data };
  }

  /**
   * ==========================================
   * SECCIÓN: TELEMETRÍA Y ACCIONES DE ALUMNOS
   * ==========================================
   */

  @SubscribeMessage('refresh-file-tree')
  handleRefreshTree(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { files: string[] },
  ) {
    if (client.data.role !== 'student') return;

    console.log(
      `[MAPPING ÁRBOL]: [Sala ${client.data.roomId}] Alumno '${client.data.name}' indexó un total de: ${data.files?.length || 0} archivos locales.`,
    );

    this.server.to(`${client.data.roomId}-teachers`).emit('student-file-tree', {
      studentId: client.id,
      name: client.data.name,
      files: data.files,
    });
  }

  @SubscribeMessage('code-update')
  handleCodeUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { filePath: string; content: string },
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
    @MessageBody() data: { files: any[] },
  ) {
    if (client.data.role !== 'student') {
      console.warn(
        `[⚠️ INTRUSIÓN DETECTADA]: Intento ilegítimo de snapshot final rechazado para la cuenta: ${client.data.name}`,
      );
      return { status: 'denied' };
    }

    console.log(
      `[RECEPCIÓN ENTREGA]: [Sala ${client.data.roomId}] Paquete de entrega recibido de '${client.data.name}' con [${data.files?.length || 0}] recursos de desarrollo.`,
    );

    this.server
      .to(`${client.data.roomId}-teachers`)
      .emit('final-submission-received', {
        studentId: client.id,
        name: client.data.name,
        files: data.files,
      });
  }

  @SubscribeMessage('student-focus-change')
  handleFocusChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { isFocused: boolean },
  ) {
    if (client.data.role !== 'student') return;

    client.data.isFocused = data.isFocused;
    client.data.lastActivity = Date.now();

    console.log(
      `[CAMBIO ENFOQUE] [Sala ${client.data.roomId}] Estudiante '${client.data.name}' -> Ventana VS Code: ${data.isFocused ? 'DENTRO (Enfoque Activo)' : '⚠️ AFUERA (Posible Distracción)'}`,
    );

    this.server.to(`${client.data.roomId}-teachers`).emit('telemetry-updated', {
      studentId: client.id,
      name: client.data.name,
      isFocused: data.isFocused,
      lastActivity: client.data.lastActivity,
    });
  }

  @SubscribeMessage('student-wpm-update')
  handleWpmUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { wpm: number; isCopyPaste: boolean },
  ) {
    if (client.data.role !== 'student') return;

    client.data.wpm = data.wpm;
    client.data.alertCopy = data.isCopyPaste;

    if (data.isCopyPaste) {
      console.warn(
        `[🚨 ALERTA PLAGIO] [Sala ${client.data.roomId}] Ráfaga ilegal detected en '${client.data.name}' con velocidad de: ${data.wpm} WPM.`,
      );
    } else {
      // console.log(`[TELEMETRÍA LATIDO] [Sala ${client.data.roomId}] Rendimiento de '${client.data.name}': ${data.wpm} WPM.`,);
    }

    this.server.to(`${client.data.roomId}-teachers`).emit('telemetry-updated', {
      studentId: client.id,
      name: client.data.name,
      wpm: data.wpm,
      isCopyPaste: data.isCopyPaste,
      lastActivity: Date.now(),
    });
  }

  @SubscribeMessage('request-help')
  handleRequestHelp(@ConnectedSocket() client: Socket) {
    if (client.data.role !== 'student') return;

    client.data.isAskingHelp = true;
    console.log(
      `[SOLICITUD ATENCIÓN]: [Sala ${client.data.roomId}] Alumno '${client.data.name}' ha levantado la mano virtual ✋.`,
    );

    this.server
      .to(`${client.data.roomId}-teachers`)
      .emit('student-help-requested', {
        studentId: client.id,
      });
  }

  @SubscribeMessage('student-active-file-change')
  handleActiveFileChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { filePath: string },
  ) {
    if (client.data.role !== 'student') return;

    client.data.activeFilePath = data.filePath;
    console.log(
      `[NAVEGACIÓN INTERNA]: [Sala ${client.data.roomId}] Alumno '${client.data.name}' abrió pestaña activa: ${data.filePath}`,
    );

    this.server.to(`${client.data.roomId}-teachers`).emit('telemetry-updated', {
      studentId: client.id,
      activeFilePath: data.filePath,
    });
  }

  /**
   * ==========================================
   * SECCIÓN: MENSAJERÍA COMPARTIDA (CHAT)
   * ==========================================
   */

  @SubscribeMessage('send-chat-message')
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message: string; targetId?: string },
  ) {
    const { roomId, name, role } = client.data;
    if (!roomId) return;

    const payload = {
      senderId: client.id,
      sender: name,
      role: role,
      message: data.message,
      targetId: data.targetId,
      isPrivate: !!data.targetId,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };

    if (role === 'teacher') {
      if (data.targetId) {
        console.log(
          `[CHAT PRIVADO DOCENTE]: Profe '${name}' -> ID Destinatario: ${data.targetId} | Mensaje: ${data.message}`,
        );
        this.server.to(data.targetId).emit('chat-message-received', payload);
        client.emit('chat-message-received', payload); // Eco de retorno para renderizado propio
      } else {
        console.log(
          `[CHAT GENERAL DOCENTE]: Profe '${name}' -> TODA LA SALA [${roomId}] | Mensaje: ${data.message}`,
        );
        this.server.to(roomId).emit('chat-message-received', payload);
      }
    } else {
      console.log(
        `[CHAT CONSULTA ALUMNO]: Estudiante '${name}' -> Canales Docentes | Mensaje: ${data.message}`,
      );
      this.server
        .to(`${roomId}-teachers`)
        .emit('chat-message-received', payload);
      client.emit('chat-message-received', payload); // Eco de retorno para el alumno
    }
  }

  /**
   * ==========================================
   * SECCIÓN: CONTROL PEDAGÓGICO DE DOCENTES
   * ==========================================
   */

  @SubscribeMessage('teacher-create-file')
  handleCreateFile(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      fileName: string;
      initialContent: string;
      isBinary: boolean;
      studentId?: string;
    },
  ) {
    if (client.data.role !== 'teacher') return { status: 'forbidden' };

    const payload = {
      fileName: data.fileName,
      initialContent: data.initialContent,
      isBinary: data.isBinary,
    };

    if (data.studentId) {
      console.log(
        `[DISTRIBUCIÓN PRIVADA]: Profe '${client.data.name}' inyectó archivo [${data.fileName}] -> Únicamente al Alumno ID: ${data.studentId}`,
      );
      this.server.to(data.studentId).emit('create-local-file', payload);
    } else {
      console.log(
        `[DISTRIBUCIÓN MASIVA]: Profe '${client.data.name}' inyectó recurso guía [${data.fileName}] -> A toda la clase de la Sala [${client.data.roomId}]`,
      );
      client.to(client.data.roomId).emit('create-local-file', payload);
    }
  }

  @SubscribeMessage('start-timer')
  handleStartTimer(client: Socket, data: { roomId: string; minutes: number }) {
    if (client.data.role !== 'teacher') return;

    const endTime = Date.now() + data.minutes * 60000;

    this.activeTimers.set(data.roomId, {
      duration: data.minutes,
      endTime: endTime,
    });

    console.log(
      `[CONTROL CRONÓMETRO]: ⏳ Profe '${client.data.name}' inició Desafío Técnico de [${data.minutes}] minutos en la Sala [${data.roomId}]`,
    );

    this.server.to(data.roomId).emit('timer-started', {
      minutes: data.minutes,
      startTime: Date.now(),
    });
  }

  @SubscribeMessage('stop-timer')
  handleStopTimer(client: Socket) {
    if (client.data.role !== 'teacher') return;

    console.log(
      `[CANCELACIÓN CRONÓMETRO]: ⚠️ Profe '${client.data.name}' detuvo de forma manual el conteo en la Sala [${client.data.roomId}]`,
    );

    this.activeTimers.delete(client.data.roomId);
    this.server.to(client.data.roomId).emit('timer-stopped');
  }

  @SubscribeMessage('request-file-content')
  handleRequestFile(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { studentId: string; filePath: string },
  ) {
    if (client.data.role !== 'teacher') return;

    console.log(
      `[INSPECCIÓN P2P SOLICITADA]: Profe '${client.data.name}' ordenó lectura del buffer físico de: ${data.filePath} en ID Alumno: ${data.studentId}`,
    );

    this.server
      .to(data.studentId)
      .emit('get-content', { teacherId: client.id, filePath: data.filePath });
  }

  @SubscribeMessage('send-content')
  handleSendContent(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { teacherId: string; filePath: string; content: string },
  ) {
    console.log(
      `[INSPECCIÓN P2P RESPUESTA]: Transferencia de buffer completada desde Alumno '${client.data.name}' hacia Canal Docente.`,
    );

    this.server.to(data.teacherId).emit('file-content-received', {
      studentId: client.id,
      filePath: data.filePath,
      content: data.content,
    });
  }

  @SubscribeMessage('resolve-help')
  handleResolveHelp(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { studentId: string },
  ) {
    if (client.data.role !== 'teacher') return;

    // Buscar el socket específico del alumno para apagar su bandera de solicitud en la cache interna
    const studentSocket = (this.server.sockets as any).get(data.studentId);
    if (studentSocket) {
      studentSocket.data.isAskingHelp = false;
      console.log(
        `[ASISTENCIA CONCLUIDA]: Profe '${client.data.name}' marcó caso resuelto para: ${studentSocket.data.name || data.studentId}`,
      );
    } else {
      console.log(
        `[ASISTENCIA CONCLUIDA]: Caso resuelto para ID: ${data.studentId} (Usuario no mapeado o desconectado)`,
      );
    }

    // Notificar a todos los paneles docentes del aula para limpiar el indicador de alerta visual
    this.server
      .to(`${client.data.roomId}-teachers`)
      .emit('student-help-resolved', {
        studentId: data.studentId,
      });
  }
}
