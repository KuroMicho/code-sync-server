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

        test('Caso 1: División exacta común', () => {
          assert.strictEqual(calcularSaltos(9, 3), 3);
        });

        test('Caso 2: División con residuo decimal (Redondeo hacia arriba)', () => {
          assert.strictEqual(calcularSaltos(10, 3), 4);
        });

        test('Caso 3: Control de potencia inválida menor o igual a cero', () => {
          assert.strictEqual(calcularSaltos(15, 0), 0);
          assert.strictEqual(calcularSaltos(10, -2), 0);
        });
      `;
    }

    if (challengeId === 'ex-02') {
      return `
        const test = require('node:test');
        const assert = require('node:assert');

        test('Caso 1: Inventario con una bomba en el medio', () => {
          assert.deepStrictEqual(filtrarPeligro(["cuerda", "bomba", "antorcha"]), ["cuerda", "antorcha"]);
        });

        test('Caso 2: Inventario limpio sin riesgos', () => {
          assert.deepStrictEqual(filtrarPeligro(["mapa", "brújula"]), ["mapa", "brújula"]);
        });

        test('Caso 3: Inventario vacío o compuesto solo por bombas', () => {
          assert.deepStrictEqual(filtrarPeligro(["bomba", "bomba"]), []);
          assert.deepStrictEqual(filtrarPeligro([]), []);
        });
      `;
    }

    if (challengeId === 'ex-03') {
      return `
        const test = require('node:test');
        const assert = require('node:assert');

        // 🔥 SIMULADOR DE DOM EN ENTORNO DE CONSOLA NODE
        const mockAlarmaElement = {
          classList: {
            classes: new Set(),
            add(className) { this.classes.add(className); }
          },
          innerText: ""
        };

        global.document = {
          getElementById: (id) => id === "alarma" ? mockAlarmaElement : null
        };

        test('Caso 1: Ejecución e Inyección de Clases y Textos en el Nodo Alarma', () => {
          activarModoInvasión();
          assert.strictEqual(mockAlarmaElement.innerText, "SISTEMA COMPROMETIDO");
          assert.ok(mockAlarmaElement.classList.classes.has("peligro-rojo"));
        });
      `;
    }

    if (challengeId === 'ex-04') {
      return `
        const test = require('node:test');
        const assert = require('node:assert');

        test('Caso 1: Constructor de Clase e inicialización correcta', () => {
          const heroe = new Guerrero("Thor", 100);
          assert.strictEqual(heroe.nombre, "Thor");
          assert.strictEqual(heroe.vida, 100);
        });

        test('Caso 2: Evaluación del método recibirDaño', () => {
          const heroe = new Guerrero("Arthur", 80);
          heroe.recibirDaño(25);
          assert.strictEqual(heroe.vida, 55);
          heroe.recibirDaño(60);
          assert.strictEqual(heroe.vida, -5);
        });
      `;
    }

    if (challengeId === 'ex-05') {
      return `
        const test = require('node:test');
        const assert = require('node:assert');

        // 🔥 SIMULADOR DE CONTEXTO BODY PARA EL ENTORNO LOCAL
        const mockBody = {
          style: { backgroundColor: "" }
        };
        global.document = { body: mockBody };

        test('Caso 1: Conjurando clima de Fuego', () => {
          invocarClima("fuego");
          assert.strictEqual(mockBody.style.backgroundColor, "crimson");
        });

        test('Caso 2: Conjurando clima de Hielo', () => {
          invocarClima("hielo");
          assert.strictEqual(mockBody.style.backgroundColor, "cyan");
        });

        test('Caso 3: Conjurando condiciones por defecto', () => {
          invocarClima("tormenta");
          assert.strictEqual(mockBody.style.backgroundColor, "black");
        });
      `;
    }

    return `throw new Error("Suite de pruebas no parametrizada para este ID.");`;
  }
}