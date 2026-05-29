import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { RoomsService } from './rooms.service';
import type { CustomSocket, JoinRoomPayload, ChatMessagePayload } from './rooms.types';
import { ChallengesService } from '../challenges/challenges.service';
import { ChallengeEvaluatorService } from '../challenges/challenge-evaluator.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'code-sync',
  maxHttpBufferSize: 3e7,
  pingInterval: 10000,
  pingTimeout: 20000,
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly roomsService: RoomsService,
    private readonly challengesService: ChallengesService,
    private readonly evaluatorService: ChallengeEvaluatorService,
  ) {}

  /**
   * Registra el enlace de hardware inicial de un cliente.
   */
  handleConnection(@ConnectedSocket() client: CustomSocket) {
    this.roomsService.log('CONEXIÓN', `Canal de red establecido con éxito para el ID: ${client.id}`);
  }

  /**
   * Gestiona el ciclo de vida de desconexión.
   */
  handleDisconnect(@ConnectedSocket() client: CustomSocket) {
    const { name, roomId, role } = client.data;

    if (roomId) {
      this.roomsService.log(
        'DESCONEXIÓN',
        `${role?.toUpperCase()} | Alumno: ${name || 'Desconocido'} abandonó la sala.`,
      );

      this.server.to(`${roomId}-teachers`).emit('user-disconnected', {
        socketId: client.id,
        studentName: name,
        role: role,
      });

      if (role === 'student' && name) {
        this.server
          .in(roomId)
          .fetchSockets()
          .then((sockets) => {
            const webClientAsociado = sockets.find(
              (s: any) =>
                s.data.role === 'student-web' && s.data.name.trim().toLowerCase() === name.trim().toLowerCase(),
            );

            if (webClientAsociado) {
              this.roomsService.log(
                'PURGA_AUTOMÁTICA',
                `Cerrando canal CodeSync Web para ${name} por abandono de VS Code.`,
              );
              this.server.to(webClientAsociado.id).emit('force-close-web');
            }
          });
      }
    }
  }

  /**
   * Orquestador central de ingreso y asignación contextual de privilegios por Rol.
   */
  @SubscribeMessage('join-room')
  async handleJoinRoom(@ConnectedSocket() client: CustomSocket, @MessageBody() data: JoinRoomPayload) {
    if (data.role === 'teacher') {
      const masterKey = process.env.CODESYNC_TEACHER_KEY;
      if (!data.accessKey || data.accessKey !== masterKey) {
        this.roomsService.log(
          'ALERTA_SEGURIDAD',
          `🚨 INTRUSIÓN DETECTADA: Intento de usurpación docente en Sala: ${data.roomId} desde IP: ${client.handshake.address}`,
          true,
        );
        client.emit('join-rejected', 'La clave de acceso docente proporcionada es incorrecta.');
        client.disconnect();
        return;
      }
      this.roomsService.log('DOCENTE_AUTENTICADO', `Profesor '${data.name}' autenticado de forma segura.`);
    }

    if (data.role === 'student-web') {
      const roomSockets = await this.server.in(data.roomId).fetchSockets();
      const webNameClean = data.name.trim().toLowerCase();

      const vscodeSocketTarget = roomSockets.find(
        (s: any) => s.data.role === 'student' && s.data.name.trim().toLowerCase() === webNameClean,
      );

      if (!vscodeSocketTarget) {
        this.roomsService.log(
          'RECHAZO_WEB',
          `Intento de suplantacion o alias invalido: '${data.name}' en Sala: ${data.roomId}`,
          true,
        );
        client.emit(
          'join-rejected',
          'Tu nombre no coincide con ninguna sesion activa de VS Code. Inicia sesion en tu editor primero.',
        );
        return;
      }

      data.name = vscodeSocketTarget.data.name;
    }

    if (data.role === 'student') {
      const activeSockets = await this.server.in(data.roomId).fetchSockets();
      const nuevoNombreClean = data.name.trim().toLowerCase();

      const nombreAnterior = client.data.name;
      if (nombreAnterior && nombreAnterior.trim().toLowerCase() !== nuevoNombreClean) {
        this.roomsService.log(
          'MUTACIÓN_IDENTIDAD',
          `⚠️ Alumno con ID ${client.id} cambió su identidad de '${nombreAnterior}' a '${data.name}'`,
          true,
        );

        const webVieja = activeSockets.find(
          (s: any) =>
            s.data.role === 'student-web' && s.data.name.trim().toLowerCase() === nombreAnterior.trim().toLowerCase(),
        );

        if (webVieja) {
          this.roomsService.log(
            'PURGA_MUTACIÓN',
            `Clausurando CodeSync Web viejo de '${nombreAnterior}' por cambio de nombre.`,
          );
          this.server.to(webVieja.id).emit('force-close-web');
          webVieja.leave(data.roomId);
          webVieja.disconnect();
        }

        this.server.to(`${data.roomId}-teachers`).emit('user-disconnected', {
          socketId: client.id,
          studentName: nombreAnterior,
          role: 'student',
        });
      }

      const duplicateSocket = activeSockets.find(
        (s: any) =>
          s.id !== client.id && s.data.role === 'student' && s.data.name.trim().toLowerCase() === nuevoNombreClean,
      );
      if (duplicateSocket) {
        duplicateSocket.leave(data.roomId);
        duplicateSocket.disconnect();
      }
    }

    this.roomsService.log(
      'ACCESO',
      `Cuenta '${data.name}' autorizada para rol [${data.role.toUpperCase()}] en Sala: ${data.roomId}`,
    );

    const currentRooms = Array.from(client.rooms).filter((r) => r !== client.id);
    currentRooms.forEach((r) => client.leave(r));

    client.data.role = data.role;
    client.data.name = data.name;
    client.data.roomId = data.roomId;

    if (data.role === 'student') {
      client.data.isFocused = true;
      client.data.wpm = 0;
      client.data.isAskingHelp = false;
      client.data.alertCopy = false;
      client.data.activeFilePath = '';
      client.data.ultimoCodigoPicado = '';
    }

    client.join(data.roomId);

    switch (data.role) {
      case 'student-web': {
        this.roomsService.log('VINCULACIÓN_WEB', `Canal multimedia web activated para: ${data.name}`);
        client.emit('join-success');
        this.server.to(`${data.roomId}-teachers`).emit('telemetry-updated', {
          studentName: data.name,
          screenLinked: true,
        });
        break;
      }

      case 'teacher': {
        client.join(`${data.roomId}-teachers`);

        client.emit('request-teacher-state-recovery', { roomId: data.roomId });

        client.to(data.roomId).emit('request-sync');
        client.emit('join-success', { role: 'teacher', name: data.name, roomId: data.roomId });

        const roomSockets = await this.server.in(data.roomId).fetchSockets();
        roomSockets.forEach((s: any) => {
          if (s.data.role === 'student') {
            client.emit('user-joined', { id: s.id, name: s.data.name, role: 'student' });
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
          if (s.data.role === 'student-web') {
            client.emit('telemetry-updated', { studentName: s.data.name, screenLinked: true });
          }
        });
        break;
      }

      case 'student': {
        client.emit('join-success', { role: 'student', name: data.name, roomId: data.roomId });

        const remainingMs = this.roomsService.getRemainingMs(data.roomId);
        if (remainingMs > 0) {
          client.emit('timer-started', { minutes: remainingMs / 60000, isSync: true });
        }

        this.server.to(`${data.roomId}-teachers`).emit('user-joined', {
          id: client.id,
          name: data.name,
          role: data.role,
        });

        this.server
          .to(`${data.roomId}-teachers`)
          .emit('request-student-refresh', { studentId: client.id, name: data.name });
        break;
      }
    }

    return { status: 'ok', session: client.data };
  }

  /**
   * EVENTO MAESTRO: La extensión del docente responde al servidor inyectando la estampa
   * de tiempo exacta en que debe terminar la clase para re-armar el cronómetro tras una caída.
   */
  @SubscribeMessage('recover-timer-state')
  handleRecoverTimerState(
    @ConnectedSocket() client: CustomSocket,
    @MessageBody() data: { roomId: string; targetEndTimestamp: number },
  ) {
    if (client.data.role !== 'teacher') return;

    const now = Date.now();
    const remainingMs = data.targetEndTimestamp - now;

    if (remainingMs > 0) {
      const minutesRemaining = remainingMs / 60000;

      this.roomsService.startTimer(data.roomId, minutesRemaining);

      this.roomsService.log(
        'RECOVERY_TIMER',
        `Sincronización Maestra: Sala [${data.roomId}] restaurada. Quedan ${minutesRemaining.toFixed(2)} minutos.`,
      );

      this.server.to(data.roomId).emit('timer-started', { minutes: minutesRemaining, isSync: true });
    }
  }

  @SubscribeMessage('request-desktop-screenshot')
  async handleRequestScreenshot(@ConnectedSocket() client: CustomSocket, @MessageBody() data: { studentName: string }) {
    if (client.data.role !== 'teacher') return;

    this.roomsService.log('TELEMETRÍA', `Solicitando captura de monitor en vivo para: ${data.studentName}`);

    const sockets = await this.server.in(client.data.roomId!).fetchSockets();
    const targetWebClient = sockets.find((s: any) => s.data.role === 'student-web' && s.data.name === data.studentName);

    if (targetWebClient) {
      this.server.to(targetWebClient.id).emit('trigger-screenshot', { teacherId: client.id });
    } else {
      this.roomsService.log(
        'ERROR',
        `Monitoreo fallido. No se detecto ninguna pestaña de hardware activa para: ${data.studentName}`,
        true,
      );
    }
  }

  @SubscribeMessage('desktop-screenshot-response')
  handleScreenshotResponse(
    @ConnectedSocket() client: CustomSocket,
    @MessageBody() data: { teacherId: string; image: any },
  ) {
    if (client.data.role !== 'student-web') return;

    this.server.to(data.teacherId).emit('screenshot-received', {
      studentName: client.data.name,
      image: data.image,
    });
  }

  @SubscribeMessage('request-dashboard-sync')
  async handleDashboardSync(@ConnectedSocket() client: CustomSocket) {
    if (client.data.role !== 'teacher') return;

    const roomSockets = await this.server.in(client.data.roomId!).fetchSockets();

    roomSockets.forEach((s: any) => {
      if (s.data.role === 'student') {
        client.emit('telemetry-updated', {
          studentId: s.id,
          name: s.data.name,
          role: s.data.role,
          isFocused: s.data.isFocused !== false,
          wpm: s.data.wpm || 0,
          isAskingHelp: s.data.isAskingHelp || false,
          isCopyPaste: s.data.alertCopy || false,
          activeFilePath: s.data.activeFilePath || '',
        });
      }

      if (s.data.role === 'student-web') {
        client.emit('telemetry-updated', { studentName: s.data.name, role: s.data.role, screenLinked: true });
      }
    });
  }

  @SubscribeMessage('refresh-file-tree')
  handleRefreshTree(@ConnectedSocket() client: CustomSocket, @MessageBody() data: { files: string[] }) {
    if (client.data.role !== 'student') return;
    this.server.to(`${client.data.roomId}-teachers`).emit('student-file-tree', {
      studentId: client.id,
      name: client.data.name,
      files: data.files,
    });
  }

  @SubscribeMessage('code-update')
  handleCodeUpdate(
    @ConnectedSocket() client: CustomSocket,
    @MessageBody() data: { filePath: string; content: string },
  ) {
    if (client.data.role !== 'student') return;

    client.data.ultimoCodigoPicado = data.content;

    this.server.to(`${client.data.roomId}-teachers`).emit('code-remote-update', {
      studentId: client.id,
      filePath: data.filePath,
      content: data.content,
    });
  }

  @SubscribeMessage('student-wpm-update')
  handleWpmUpdate(
    @ConnectedSocket() client: CustomSocket,
    @MessageBody() data: { wpm: number; isCopyPaste: boolean; filePath?: string },
  ) {
    if (client.data.role !== 'student') return;

    client.data.wpm = data.wpm;
    client.data.alertCopy = data.isCopyPaste;

    if (data.isCopyPaste) {
      const archivoAfectado = data.filePath || 'Archivo no especificado';

      this.roomsService.log(
        'TELEMETRÍA',
        `¡ALERTA PLAGIO!: Escritura anomala detectada en '${client.data.name}' (${data.wpm} WPM)`,
        true,
      );

      if (!client.data.plagiarismHistory) {
        client.data.plagiarismHistory = [];
      }

      const yaRegistrado = client.data.plagiarismHistory.some((h: any) => h.file === archivoAfectado);

      if (!yaRegistrado) {
        client.data.plagiarismHistory.push({
          file: archivoAfectado,
          timestamp: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
          wpm: data.wpm,
        });
      }
    }

    this.server.to(`${client.data.roomId}-teachers`).emit('telemetry-updated', {
      studentId: client.id,
      name: client.data.name,
      wpm: data.wpm,
      isCopyPaste: data.isCopyPaste,
      lastActivity: Date.now(),
    });
  }

  @SubscribeMessage('student-focus-change')
  handleFocusChange(@ConnectedSocket() client: CustomSocket, @MessageBody() data: { isFocused: boolean }) {
    if (client.data.role !== 'student') return;

    client.data.isFocused = data.isFocused;
    this.roomsService.log(
      'TELEMETRÍA',
      `Foco de VS Code de '${client.data.name}' cambio a: ${data.isFocused ? 'DENTRO' : '⚠️ EN BACKGROUND'}`,
      !data.isFocused,
    );

    this.server.to(`${client.data.roomId}-teachers`).emit('telemetry-updated', {
      studentId: client.id,
      name: client.data.name,
      isFocused: data.isFocused,
    });
  }

  @SubscribeMessage('student-active-file-change')
  handleActiveFileChange(@ConnectedSocket() client: CustomSocket, @MessageBody() data: { filePath: string }) {
    if (client.data.role !== 'student') return;
    client.data.activeFilePath = data.filePath;

    this.server.to(`${client.data.roomId}-teachers`).emit('telemetry-updated', {
      studentId: client.id,
      activeFilePath: data.filePath,
    });
  }

  @SubscribeMessage('request-help')
  handleRequestHelp(@ConnectedSocket() client: CustomSocket) {
    if (client.data.role !== 'student') return;

    client.data.isAskingHelp = true;
    this.roomsService.log('MESA_AYUDA', `Mano levantada virtualmente por el alumno: ${client.data.name}`);

    this.server.to(`${client.data.roomId}-teachers`).emit('student-help-requested', { studentId: client.id });
  }

  @SubscribeMessage('resolve-help')
  handleResolveHelp(@ConnectedSocket() client: CustomSocket, @MessageBody() data: { studentId: string }) {
    if (client.data.role !== 'teacher') return;

    const studentSocket = (this.server.sockets as any).get(data.studentId);
    if (studentSocket) {
      studentSocket.data.isAskingHelp = false;
      this.roomsService.log('MESA_AYUDA', `Asistencia cerrada presencialmente para: ${studentSocket.data.name}`);
    }

    this.server.to(`${client.data.roomId}-teachers`).emit('student-help-resolved', { studentId: data.studentId });
  }

  @SubscribeMessage('start-timer')
  handleStartTimer(@ConnectedSocket() client: CustomSocket, @MessageBody() data: { roomId: string; minutes: number }) {
    if (client.data.role !== 'teacher') return;

    this.roomsService.startTimer(data.roomId, data.minutes);
    this.roomsService.log(
      'TIMER',
      `⏳ Temporizador general activado para Sala: [${data.roomId}] por ${data.minutes} minutos.`,
    );

    const targetEndTimestamp = Date.now() + data.minutes * 60000;
    client.emit('timer-registered-on-teacher', { targetEndTimestamp });

    this.server.to(data.roomId).emit('timer-started', { minutes: data.minutes, startTime: Date.now() });
  }

  @SubscribeMessage('stop-timer')
  handleStopTimer(@ConnectedSocket() client: CustomSocket) {
    if (client.data.role !== 'teacher') return;

    this.roomsService.stopTimer(client.data.roomId!);
    this.roomsService.log('TIMER', `⚠️ Temporizador cancelado de emergencia en Sala: [${client.data.roomId}]`, true);

    this.server.to(client.data.roomId!).emit('timer-stopped');
  }

  @SubscribeMessage('student-submit-task')
  handleStudentSubmit(@ConnectedSocket() client: CustomSocket, @MessageBody() data: { files: any[] }) {
    if (client.data.role !== 'student') return;

    this.roomsService.log('ENTREGAS', `📥 Snapshot final de evaluacion recibido del alumno: ${client.data.name}`);

    this.server.to(`${client.data.roomId}-teachers`).emit('final-submission-received', {
      studentId: client.id,
      name: client.data.name,
      files: data.files,
      plagiarismHistory: client.data.plagiarismHistory || [],
    });
  }

  @SubscribeMessage('send-chat-message')
  handleChatMessage(@ConnectedSocket() client: CustomSocket, @MessageBody() data: ChatMessagePayload) {
    const { roomId, name, role } = client.data;
    if (!roomId) return;

    const payload = {
      senderId: client.id,
      sender: name,
      role: role,
      message: data.message,
      targetId: data.targetId,
      isPrivate: !!data.targetId,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    if (role === 'teacher') {
      if (data.targetId) {
        this.roomsService.log('CHAT', `Docente manda canal privado a Nodo [${data.targetId}]: ${data.message}`);
        this.server.to(data.targetId).emit('chat-message-received', payload);
        client.emit('chat-message-received', payload);
      } else {
        this.roomsService.log('CHAT', `Docente publica Comunicado General: ${data.message}`);
        this.server.to(roomId).emit('chat-message-received', payload);
      }
    } else {
      this.roomsService.log('CHAT', `Alumno '${name}' escribe a mesa de consulta: ${data.message}`);
      this.server.to(`${roomId}-teachers`).emit('chat-message-received', payload);
      client.emit('chat-message-received', payload);
    }
  }

  @SubscribeMessage('teacher-create-file')
  handleCreateFile(@ConnectedSocket() client: CustomSocket, @MessageBody() data: any) {
    if (client.data.role !== 'teacher') return { status: 'forbidden' };

    const payload = { fileName: data.fileName, initialContent: data.initialContent, isBinary: data.isBinary };
    if (data.studentId) {
      this.server.to(data.studentId).emit('create-local-file', payload);
    } else {
      client.to(client.data.roomId!).emit('create-local-file', payload);
    }
  }

  @SubscribeMessage('request-file-content')
  handleRequestFile(
    @ConnectedSocket() client: CustomSocket,
    @MessageBody() data: { studentId: string; filePath: string },
  ) {
    if (client.data.role !== 'teacher') return;
    this.server.to(data.studentId).emit('get-content', { teacherId: client.id, filePath: data.filePath });
  }

  @SubscribeMessage('send-content')
  handleSendContent(@ConnectedSocket() client: CustomSocket, @MessageBody() data: any) {
    if (client.data.role !== 'student') return;

    this.server.to(data.teacherId).emit('file-content-received', {
      studentId: client.id,
      filePath: data.filePath,
      content: data.content,
    });
  }

  @SubscribeMessage('request-challenges')
  handleRequestChallenges(@ConnectedSocket() client: CustomSocket) {
    const { roomId, role } = client.data;
    if (!roomId || role !== 'student-web') return { status: 'error', message: 'Acceso denegado o sala inválida.' };

    const listado = this.challengesService.getChallengesForRoom(roomId);
    client.emit('challenges-list', listado);
    return { status: 'ok' };
  }

  @SubscribeMessage('student-start-challenge')
  async handleStartChallenge(@ConnectedSocket() client: CustomSocket, @MessageBody() data: { challengeId: string }) {
    const { roomId, name, role } = client.data;
    if (!roomId || !name || role !== 'student-web') return { status: 'forbidden' };

    try {
      const challenge = this.challengesService.getChallengeById(data.challengeId);
      const roomSockets = await this.server.in(roomId).fetchSockets();

      const vscodeSocketTarget = roomSockets.find(
        (s: any) => s.data.role === 'student' && s.data.name.trim().toLowerCase() === name.trim().toLowerCase(),
      );

      if (!vscodeSocketTarget) {
        return { status: 'error', message: 'No se detectó la extensión de VS Code en línea.' };
      }

      client.data.activeChallengeId = data.challengeId;

      challenge.templateFiles.forEach((file) => {
        this.server.to(vscodeSocketTarget.id).emit('create-local-file', {
          fileName: file.path,
          initialContent: Buffer.from(file.content).toString('base64'),
        });
      });

      this.roomsService.log(
        'DESAFÍO_INICIADO',
        `Inyectando plantilla del ejercicio '${challenge.id}' al VS Code de ${name}.`,
      );
      return { status: 'ok' };
    } catch (error) {
      return { status: 'error', message: 'Fallo al procesar la inyección del ejercicio.' };
    }
  }

  @SubscribeMessage('verify-challenge-code')
  async handleVerifyChallenge(@ConnectedSocket() client: CustomSocket, @MessageBody() data: { challengeId: string }) {
    const { roomId, name, role } = client.data;
    if (!roomId || !name || role !== 'student-web') return { status: 'forbidden' };

    const roomSockets = await this.server.in(roomId).fetchSockets();

    const vscodeSocket = roomSockets.find(
      (s: any) => s.data.role === 'student' && s.data.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );

    if (!vscodeSocket) {
      client.emit('verify-result', { exitoso: false, reporte: 'Error: No se detectó tu editor VS Code en línea.' });
      return;
    }

    const codigoAlumno = vscodeSocket.data.ultimoCodigoPicado || '';

    if (!codigoAlumno.trim()) {
      client.emit('verify-result', {
        exitoso: false,
        reporte:
          'Consola: No se ha detectado actividad de escritura en el archivo aún. Digita un carácter en tu editor primero.',
      });
      return;
    }

    this.roomsService.log('PRE_EVALUACIÓN', `Evaluando caché en RAM de forma asíncrona para: ${name}`);

    const targetWebId = client.id;

    process.nextTick(async () => {
      try {
        const resultadoTests = await this.evaluatorService.evaluarCodigo(data.challengeId, name, codigoAlumno);
        this.server.to(targetWebId).emit('verify-result', resultadoTests);
      } catch (err) {
        this.server.to(targetWebId).emit('verify-result', {
          exitoso: false,
          reporte: 'Error interno: El Test Runner nativo colapsó al compilar.',
        });
      }
    });
  }
}
