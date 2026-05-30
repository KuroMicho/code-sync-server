import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class ChallengeEvaluatorService {
  private readonly tmpDir = path.join(os.tmpdir(), 'codesync_evaluaciones');

  constructor() {
    // Asegura la existencia del directorio temporal en el servidor local
    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir, { recursive: true });
    }
  }

  /**
   * Ejecuta las pruebas unitarias asíncronas sobre el código enviado por el estudiante.
   */
  async evaluarCodigo(
    challengeId: string,
    studentName: string,
    codigoAlumno: string,
  ): Promise<{ exitoso: boolean; reporte: string }> {
    const cleanName = studentName.replace(/\s+/g, '_').toLowerCase();
    const fileTestPath = path.join(this.tmpDir, `test_${cleanName}_${challengeId}.js`);

    // 1. Carga la suite de aserciones correspondiente al ejercicio
    const plantillaPruebas = this.obtenerSuitePruebas(challengeId);

    // 2. Inyecta el código del alumno antes de las pruebas ocultas
    const contenidoFinal = `${codigoAlumno}\n\n${plantillaPruebas}`;

    // 3. Escribe el buffer físico en el disco temporal del servidor
    fs.writeFileSync(fileTestPath, contenidoFinal, 'utf8');

    // 4. Ejecuta el archivo a través del Test Runner nativo de Node.js
    return new Promise((resolve) => {
      exec(`node --test ${fileTestPath}`, (error, stdout, stderr) => {
        // Limpieza reactiva inmediata del archivo para evitar fugas de almacenamiento
        try {
          fs.unlinkSync(fileTestPath);
        } catch (e) {
          console.error(`[CodeSync Evaluator]: No se pudo eliminar el archivo temporal: ${fileTestPath}`);
        }

        const salidaCompleta = stdout + '\n' + stderr;

        if (error) {
          // Si el proceso retorna código de error, al menos una prueba falló
          resolve({ exitoso: false, reporte: salidaCompleta });
        } else {
          // Éxito absoluto: pasó el 100% de los casos de esquina
          resolve({ exitoso: true, reporte: salidaCompleta });
        }
      });
    });
  }

  /**
   * Banco oculto de aserciones estrictas (Node Test Runner).
   * El estudiante no tiene acceso visual a estas pruebas desde el cliente web.
   */
  private obtenerSuitePruebas(challengeId: string): string {
    if (challengeId === 'ex-01') {
      return `
        const test = require('node:test');
        const assert = require('node:assert');

        test('Caso 1: Descuento regular en balance de checkout', () => {
          assert.strictEqual(aplicarDescuento(10000, 3000), 7000);
          assert.strictEqual(aplicarDescuento(50000, 15000), 35000);
        });

        test('Caso 2: Salvaguarda anti-pérdidas (Tope de cero ante cupones masivos)', () => {
          assert.strictEqual(aplicarDescuento(20000, 50000), 0);
          assert.strictEqual(aplicarDescuento(10000, 10000), 0);
        });
      `;
    }

    if (challengeId === 'ex-02') {
      return `
        const test = require('node:test');
        const assert = require('node:assert');

        test('Caso 1: Catálogo mixto filtrado correctamente', () => {
          const mockDb = [
            { titulo: "Spider-Man", clasificacion: "G" },
            { titulo: "Blade", clasificacion: "R" },
            { titulo: "The Simpsons", clasificacion: "PG" }
          ];
          const esperado = [
            { titulo: "Spider-Man", clasificacion: "G" },
            { titulo: "The Simpsons", clasificacion: "PG" }
          ];
          assert.deepStrictEqual(filtrarCatalogoKids(mockDb), esperado);
        });

        test('Caso 2: Catálogo sin contenidos aptos para perfiles infantiles', () => {
          const mockDb = [
            { titulo: "John Wick", clasificacion: "R" },
            { titulo: "Midsommar", clasificacion: "NC-17" }
          ];
          assert.deepStrictEqual(filtrarCatalogoKids(mockDb), []);
        });

        test('Caso 3: Manejo seguro de colecciones vacías', () => {
          assert.deepStrictEqual(filtrarCatalogoKids([]), []);
        });
      `;
    }

    if (challengeId === 'ex-03') {
      return `
        const test = require('node:test');
        const assert = require('node:assert');

        // 🔥 ENTORNO DE SIMULACIÓN DE CLASES NATIVAS DEL DOM
        const mockClasses = new Set();
        const mockBody = {
          classList: {
            add(c) { mockClasses.add(c); },
            remove(c) { mockClasses.delete(c); },
            toggle(c) { 
              if (mockClasses.has(c)) { mockClasses.delete(c); } 
              else { mockClasses.add(c); }
            }
          }
        };

        global.document = { body: mockBody };

        test('Caso 1: Comportamiento del interruptor Toggle en el Body', () => {
          // Primera ejecución: debe encender el modo oscuro
          alternarModoOscuro();
          assert.ok(mockClasses.has("dark-theme"), "El script debió inyectar la clase 'dark-theme'.");
          
          // Segunda ejecución: debe apagar el modo oscuro
          alternarModoOscuro();
          assert.ok(!mockClasses.has("dark-theme"), "El script debió remover la clase 'dark-theme' al re-invocarse.");
        });
      `;
    }

    if (challengeId === 'ex-04') {
      return `
        const test = require('node:test');
        const assert = require('node:assert');

        test('Caso 1: Construcción del modelo de datos de la instancia', () => {
          const user = new Usuario("kuro_dev");
          assert.strictEqual(user.username, "kuro_dev");
          assert.deepStrictEqual(user.notificaciones, []);
        });

        test('Caso 2: Encolamiento y orden cronológico del historial de alertas', () => {
          const user = new Usuario("tester_mocoa");
          user.recibirAlerta("Error en conexión P2P");
          user.recibirAlerta("Push completado con éxito");
          
          assert.deepStrictEqual(user.notificaciones, [
            "Error en conexión P2P",
            "Push completado con éxito"
          ]);
          assert.strictEqual(user.notificaciones.length, 2);
        });
      `;
    }

    if (challengeId === 'ex-05') {
      return `
        const test = require('node:test');
        const assert = require('node:assert');

        // 🔥 SIMULADOR DE NODOS INTERACTIVOS PARA LA BARRA DE ESTADO DE CONEXIÓN
        const mockStatusBar = {
          innerText: "",
          style: { backgroundColor: "" }
        };

        global.document = {
          getElementById: (id) => id === "status-bar" ? mockStatusBar : null
        };

        test('Caso 1: Comprobación de estado Online estable (Verde)', () => {
          actualizarEstadoRed(true);
          assert.strictEqual(mockStatusBar.innerText, "CONECTADO");
          assert.strictEqual(mockStatusBar.style.backgroundColor, "green");
        });

        test('Caso 2: Comprobación de estado de Caída/Desconexión de Sockets (Rojo)', () => {
          actualizarEstadoRed(false);
          assert.strictEqual(mockStatusBar.innerText, "SIN CONEXIÓN");
          assert.strictEqual(mockStatusBar.style.backgroundColor, "red");
        });
      `;
    }

    return `throw new Error("Suite de pruebas no parametrizada para este ID.");`;
  }
}