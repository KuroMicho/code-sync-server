import { Injectable } from '@nestjs/common';
import { RoomTimer } from './rooms.types';

@Injectable()
export class RoomsService {
  private readonly activeTimers = new Map<string, RoomTimer>();

  /**
   * Registra o actualiza el cronómetro de una sala específica.
   * Retorna la estampa de tiempo (Timestamp) exacta de finalización.
   */
  public startTimer(roomId: string, minutes: number): number {
    const endTime = Date.now() + minutes * 60000;
    this.activeTimers.set(roomId, { duration: minutes, endTime });
    return endTime;
  }

  /**
   * Remueve de forma definitiva el cronómetro de una sala (Cancelación/Expiración).
   */
  public stopTimer(roomId: string): boolean {
    return this.activeTimers.delete(roomId);
  }

  /**
   * Obtiene el temporizador activo de la sala y calcula los milisegundos restantes en tiempo real.
   */
  public getRemainingMs(roomId: string): number {
    const timer = this.activeTimers.get(roomId);
    if (!timer) return 0;
    return timer.endTime - Date.now();
  }

  /**
   * Sistema centralizado de Logging Táctico e Historial de Auditoría en Consola.
   * Despacha códigos de escape ANSI de alta visibilidad para separar flujos normales de alertas de plagio/fraude.
   */
  public log(
    tag:
      | 'DOCENTE_AUTENTICADO'
      | 'CONEXIÓN'
      | 'DESCONEXIÓN'
      | 'PURGA_AUTOMÁTICA'
      | 'PURGA_MUTACIÓN'
      | 'MUTACIÓN_IDENTIDAD'
      | 'ACCESO'
      | 'VINCULACIÓN_WEB'
      | 'RECHAZO_WEB'
      | 'CHAT'
      | 'ENTREGAS'
      | 'MESA_AYUDA'
      | 'TELEMETRÍA'
      | 'TIMER'
      | 'ALERTA_SEGURIDAD'
      | 'ERROR'
      | 'DESAFÍO_INICIADO'
      | 'PRE_EVALUACIÓN'
      | 'ERROR_EVALUADOR',
    message: string,
    isWarn = false,
  ) {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const formatted = `[${timestamp}] [${tag}]: ${message}`;

    if (isWarn) {
      console.warn(`\x1b[33m${formatted}\x1b[0m`);
    } else {
      console.log(`\x1b[36m${formatted}\x1b[0m`);
    }
  }
}
