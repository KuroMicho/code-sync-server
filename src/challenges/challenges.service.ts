import { Injectable, NotFoundException } from '@nestjs/common';
import { Challenge } from './challenges.types';

@Injectable()
export class ChallengesService {
  private readonly mockChallenges: Challenge[] = [
    {
      id: 'ex-01',
      title: '🐸 1. Misión: Salto del Laberinto (Lógica)',
      description:
        '¡Nuestra rana necesita escapar! Crea la función <code>calcularSaltos(distancia, potencia)</code>. Debe retornar cuántos saltos exactos le tomará salir del laberinto si cada salto avanza la potencia indicada. Si la potencia es cero o negativa, la rana no se mueve y debe retornar <code>0</code>.',
      difficulty: 'easy',
      templateFiles: [
        {
          path: 'desafio-1.js',
          content: `// 🐸 Misión Froggy: Salto del Laberinto\n// Retorna el número de saltos necesarios para salir (distancia / potencia)\n\nfunction calcularSaltos(distancia, potencia) {\n  if (potencia <= 0) return 0;\n  return Math.ceil(distancia / potencia);\n}\n\n// Consola de pruebas:\n// console.log(calcularSaltos(10, 3)); // Debería retornar 4 saltos\n`,
        },
      ],
    },
    {
      id: 'ex-02',
      title: '🎒 2. El Inventario del Explorador (Fundamentos)',
      description:
        'Tu personaje tiene un array con ítems de supervivencia. Crea la función <code>filtrarPeligro(inventario)</code> que reciba un array de strings y devuelva un nuevo array **excluyendo** el ítem exacto <code>"bomba"</code> para que el explorador viaje seguro.',
      difficulty: 'easy',
      templateFiles: [
        {
          path: 'desafio-2.js',
          content: `// 🎒 Misión Explorador: Limpiar Inventario de Riesgos\n// Devuelve el array filtrado sin el string "bomba"\n\nfunction filtrarPeligro(inventario) {\n  return inventario.filter(item => item !== "bomba");\n}\n\n// Consola de pruebas:\n// console.log(filtrarPeligro(["cuerda", "bomba", "antorcha"])); // Retorna ["cuerda", "antorcha"]\n`,
        },
      ],
    },
    {
      id: 'ex-03',
      title: '🚨 3. Hackeo al Sistema de Alarma (DOM)',
      description:
        '¡Un intruso cortó la luz! Escribe la función <code>activarModoInvasión()</code> que busque el contenedor con ID <code>"alarma"</code> en el árbol del DOM, le agregue la clase CSS <code>"peligro-rojo"</code> y cambie su texto interno a <code>"SISTEMA COMPROMETIDO"</code>.',
      difficulty: 'easy',
      templateFiles: [
        {
          path: 'desafio-3.js',
          content: `// 🚨 Misión Ciberseguridad: Modificar Entorno DOM\n// Encuentra la alarma, inyecta la clase y muta el texto\n\nfunction activarModoInvasión() {\n  const alarmaNode = document.getElementById("alarma");\n  alarmaNode.classList.add("peligro-rojo");\n  alarmaNode.innerText = "SISTEMA COMPROMETIDO";\n}\n`,
        },
      ],
    },
    {
      id: 'ex-04',
      title: '⚔️ 4. Forja del Héroe Guerrero (POO)',
      description:
        'Instancia un sistema de combate básico. Define una clase llamada <code>Guerrero</code> cuyo constructor reciba un <code>nombre</code> y sus puntos de <code>vida</code>. Debe tener un método llamado <code>recibirDaño(puntos)</code> que reste esa cantidad de sus puntos de vida actuales.',
      difficulty: 'easy',
      templateFiles: [
        {
          path: 'desafio-4.js',
          content: `// ⚔️ Misión POO: Constructor e Instancia de Combate\n// Define la clase Guerrero y su método de reducción de vida\n\nclass Guerrero {\n  constructor(nombre, vida) {\n    this.nombre = nombre;\n    this.vida = vida;\n  }\n  recibirDaño(puntos) {\n    this.vida -= puntos;\n  }\n}\n\n// Consola de pruebas:\n// const heroe = new Guerrero("Thor", 100);\n// heroe.recibirDaño(30);\n// console.log(heroe.vida); // Debería retornar 70\n`,
        },
      ],
    },
    {
      id: 'ex-05',
      title: '🔥 5. Hechicero del Clima (DOM & Lógica)',
      description:
        'Crea la función <code>invocarClima(tipo)</code>. Si el tipo es <code>"fuego"</code>, debe cambiar el color de fondo (<code>style.backgroundColor</code>) del body a <code>"crimson"</code>. Si el tipo es <code>"hielo"</code>, debe cambiarlo a <code>"cyan"</code>. Cualquier otro tipo debe dejarlo en <code>"black"</code>.',
      difficulty: 'easy',
      templateFiles: [
        {
          path: 'desafio-5.js',
          content: `// 🔥 Misión Hechicero: Mutación Cromática Dinámica\n// Cambia el background del body según el string del parámetro\n\nfunction invocarClima(tipo) {\n  const body = document.body;\n  if (tipo === "fuego") body.style.backgroundColor = "crimson";\n  else if (tipo === "hielo") body.style.backgroundColor = "cyan";\n  else body.style.backgroundColor = "black";\n}\n`,
        },
      ],
    },
  ];

  /**
   * Obtiene todos los desafíos disponibles para una sala.
   */
  getChallengesForRoom(roomId: string): Challenge[] {
    return this.mockChallenges;
  }

  /**
   * Busca un ejercicio específico por su ID único.
   */
  getChallengeById(challengeId: string): Challenge {
    const challenge = this.mockChallenges.find((c) => c.id === challengeId);
    if (!challenge) {
      throw new NotFoundException(`El desafío con ID ${challengeId} no existe en el clúster.`);
    }
    return challenge;
  }
}