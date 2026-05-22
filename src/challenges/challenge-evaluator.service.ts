import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class ChallengeEvaluatorService {
  private readonly tmpDir = path.join(os.tmpdir(), 'codesync_evaluaciones');

  constructor() {
    // Nos aseguramos de que exista la carpeta temporal en el servidor local
    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir, { recursive: true });
    }
  }

  /**
   * Ejecuta las pruebas unitarias nativas sobre el código enviado por el estudiante.
   */
  async evaluarCodigo(
    challengeId: string,
    studentName: string,
    codigoAlumno: string,
  ): Promise<{ exitoso: boolean; reporte: string }> {
    const cleanName = studentName.replace(/\s+/g, '_').toLowerCase();
    const fileTestPath = path.join(this.tmpDir, `test_${cleanName}_${challengeId}.js`);

    // 1. Cargamos el validador oculto que corresponde al ejercicio
    const plantillaPruebas = this.obtenerSuitePruebas(challengeId);

    // 2. Fusionamos el código del alumno con la suite de pruebas oculta al final
    const contenidoFinal = `${codigoAlumno}\n\n${plantillaPruebas}`;

    // 3. Escribimos el archivo físico temporal en el servidor
    fs.writeFileSync(fileTestPath, contenidoFinal, 'utf8');

    // 4. Ejecutamos el archivo usando el Test Runner nativo de Node
    return new Promise((resolve) => {
      exec(`node --test ${fileTestPath}`, (error, stdout, stderr) => {
        // Limpiamos el archivo del disco de inmediato para no acumular basura
        try {
          fs.unlinkSync(fileTestPath);
        } catch (e) {}

        const salidaCompleta = stdout + '\n' + stderr;

        if (error) {
          // Si el proceso da error, significa que algún test falló
          resolve({ exitoso: false, reporte: salidaCompleta });
        } else {
          // Si no hay error, pasó el 100% de los casos
          resolve({ exitoso: true, reporte: salidaCompleta });
        }
      });
    });
  }

  /**
   * Banco oculto de aserciones nativas (Node Test Runner).
   * El estudiante jamás tiene acceso visual a estos casos de prueba.
   */
  private obtenerSuitePruebas(challengeId: string): string {
    if (challengeId === 'ex-01') {
      return `
        const test = require('node:test');
        const assert = require('node:assert');

        test('Caso 1: Array con pares e impares comunes', () => {
          assert.deepStrictEqual(filtrarPares([1, 2, 3, 4, 5, 6]), [2, 4, 6]);
        });

        test('Caso 2: Array compuesto únicamente por números impares', () => {
          assert.deepStrictEqual(filtrarPares([1, 3, 5, 7]), []);
        });

        test('Caso 3: Array con números negativos y el número cero', () => {
          assert.deepStrictEqual(filtrarPares([-2, -1, 0, 1, 2]), [-2, 0, 2]);
        });
      `;
    }

    if (challengeId === 'ex-02') {
      return `
        const test = require('node:test');
        const assert = require('node:assert');

        test('Caso 1: Conteo de letras minúsculas comunes', () => {
          assert.strictEqual(contarLetras("programacion", "o"), 2);
        });

        test('Caso 2: Evaluación case-insensitive (Mayúsculas)', () => {
          assert.strictEqual(contarLetras("CodeSync Online", "o"), 2);
        });

        test('Caso 3: Cadena de texto vacía sin coincidencias', () => {
          assert.strictEqual(contarLetras("", "a"), 0);
        });
      `;
    }

    return `throw new Error("Suite de pruebas no parametrizada para este ID.");`;
  }
}
