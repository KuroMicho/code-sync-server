import { Injectable, NotFoundException } from '@nestjs/common';
import { Challenge } from './challenges.types';

@Injectable()
export class ChallengesService {
  // 🏛️ NUESTRO BANCO DE EJERCICIOS EN MEMORIA (PROVISIONAL)
  private readonly mockChallenges: Challenge[] = [
    {
      id: 'ex-01',
      title: '1. Filtro de Números Pares',
      description:
        'Escribe una función llamada <code>filtrarPares(arr)</code> que reciba un array de números y devuelva un nuevo array únicamente con los números que sean pares. El archivo ya incluye la estructura base.',
      difficulty: 'easy',
      templateFiles: [
        {
          path: 'ejercicio-1.js',
          content: `// CodeSync - Desafío 1: Filtro de Números Pares\n\nfunction filtrarPares(arr) {\n  // Tu código aquí\n  return [];\n}\n\n// Ejemplos de prueba:\n// console.log(filtrarPares([1, 2, 3, 4, 5, 6])); // Debería retornar [2, 4, 6]\n`,
        },
      ],
    },
    {
      id: 'ex-02',
      title: '2. Contador de Caracteres',
      description:
        'Crea una función llamada <code>contarLetras(texto, letra)</code> que cuente cuántas veces aparece una letra específica dentro de una cadena de texto. Recuerda evaluar mayúsculas y minúsculas.',
      difficulty: 'medium',
      templateFiles: [
        {
          path: 'ejercicio-2.js',
          content: `// CodeSync - Desafío 2: Contador de Caracteres\n\nfunction contarLetras(texto, letra) {\n  // Tu código aquí\n  return 0;\n}\n\n// Ejemplos de prueba:\n// console.log(contarLetras("Programando en CodeSync", "o")); // Debería retornar 3\n`,
        },
      ],
    },
  ];

  /**
   * Obtiene todos los desafíos disponibles para una sala.
   * Por ahora, todas las salas comparten el mismo banco de pruebas.
   */
  getChallengesForRoom(roomId: string): Challenge[] {
    // Aquí en el futuro harías un query a Firebase/Postgres: WHERE room_id = roomId
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
