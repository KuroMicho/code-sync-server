import { Injectable } from '@nestjs/common';
import { RoomTimer } from './rooms.types';

@Injectable()
export class RoomsService {
  // Mapa global en memoria para persistir el ciclo de vida de los cronómetros { roomId: RoomTimer }
  private activeTimers = new Map<string, RoomTimer>();

  /**
   * Registra o actualiza el cronómetro de una sala
   */
  public startTimer(roomId: string, minutes: number): number {
    const endTime = Date.now() + minutes * 60000;
    this.activeTimers.set(roomId, { duration: minutes, endTime });
    return endTime;
  }

  /**
   * Remueve el cronómetro de una sala
   */
  public stopTimer(roomId: string): boolean {
    return this.activeTimers.delete(roomId);
  }

  /**
   * Obtiene el temporizador activo y calcula los milisegundos restantes
   */
  public getRemainingMs(roomId: string): number {
    const timer = this.activeTimers.get(roomId);
    if (!timer) return 0;
    return timer.endTime - Date.now();
  }

  /**
   * Sistema centralizado de Logging Táctico para el Docente
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
      | 'ERROR',
    message: string,
    isWarn = false,
  ) {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const formatted = `[${timestamp}] [${tag}]: ${message}`;

    if (isWarn) {
      console.warn(`\x1b[33m${formatted}\x1b[0m`); // Amarillo para advertencias/plagio
    } else {
      console.log(`\x1b[36m${formatted}\x1b[0m`); // Cian para eventos generales de red
    }
  }
}
