import { Injectable, NotFoundException } from '@nestjs/common';
import { Challenge } from './challenges.types';

@Injectable()
export class ChallengesService {
  // 🏛️ BANCO DE EJERCICIOS: CASOS REALES DEL DÍA A DÍA EN SOFTWARE (VOL. 3)
  private readonly mockChallenges: Challenge[] = [
    {
      id: 'ex-01',
      title: '🛒 1. Algoritmo de Checkout: El Cupón Acumulativo (Lógica y Tipado)',
      description:
        '**Caso Real:** En un e-commerce, un bug común permite que un cupón descuente más del total, dejando el saldo en negativo. Completa la función <code>aplicarDescuento(totalCarrito, valorCupón)</code>.<br>' +
        '1. Resta el <code>valorCupón</code> al <code>totalCarrito</code>.<br>' +
        '2. **Control de Pérdidas:** Si el resultado es menor o igual a cero (porque el cupón era mayor que la compra), la función debe retornar estrictamente <code>0</code> para no regalar dinero en la pasarela de pago. De lo contrario, retorna el saldo neto calculado.<br>' +
        '⚠️ *Restricción: Resuélvelo en una línea con un operador ternario o una función matemática nativa de límites.*',
      difficulty: 'easy',
      templateFiles: [
        {
          path: 'desafio-1.js',
          content: `// 🛒 Bug Hunter: Control de Saldos Negativos en Checkout\n\nfunction aplicarDescuento(totalCarrito, valorCupón) {\n  // Paso 1: Calcula la diferencia y asegura que el mínimo retornado sea 0...\n  \n  return 0; // Reemplaza esto\n}\n\n// Consola de pruebas locales:\n// console.log(aplicarDescuento(50000, 20000)); // Debería dar: 30000\n// console.log(aplicarDescuento(15000, 20000)); // Debería dar: 0\n`,
        },
      ],
    },
    {
      id: 'ex-02',
      title: '🎬 2. Netflix Pass: Filtro de Restricción de Edad (Iteración de Arrays)',
      description:
        '**Caso Real:** Al renderizar el catálogo para perfiles infantiles, el backend debe remover películas no aptas. Completa la función <code>filtrarCatalogoKids(peliculas)</code>.<br>' +
        '1. La función recibe un array de objetos, donde cada objeto tiene la estructura <code>{ titulo: "Stanger Things", clasificacion: "PG-13" }</code>.<br>' +
        '2. Filtra el array para conservar **únicamente** las películas cuya clasificación sea estrictamente igual a <code>"G"</code> o <code>"PG"</code>.<br>' +
        '3. Retorna el nuevo catálogo limpio.<br>' +
        '⚠️ *Restricción: Prohibido usar estructuras imperativas como bucles for/while tradicionales.*',
      difficulty: 'easy',
      templateFiles: [
        {
          path: 'desafio-2.js',
          content: `// 🎬 Feature: Filtro de Contenido Seguro para Perfiles Infantiles\n\nfunction filtrarCatalogoKids(peliculas) {\n  // Paso 1: Filtra el catálogo usando métodos iteradores de arrays (.filter)...\n  \n  return []; // Reemplaza esto\n}\n\n// Consola de pruebas locales:\n// const lista = [{titulo: "Toy Story", clasificacion: "G"}, {titulo: "Deadpool", clasificacion: "R"}];\n// console.log(filtrarCatalogoKids(lista)); // Debería retornar solo [{titulo: "Toy Story", clasificacion: "G"}]\n`,
        },
      ],
    },
    {
      id: 'ex-03',
      title: '🌙 3. Botón "Dark Mode" de Interfaz Dinámica (DOM)',
      description:
        '**Caso Real:** En cualquier app web moderna, el usuario espera poder alternar el tema visual sin recargar la página. Completa la función <code>alternarModoOscuro()</code>.<br>' +
        '1. Captura la referencia global del elemento <code>body</code> del documento.<br>' +
        '2. Accede a su lista de clases utilizando la API nativa de JavaScript.<br>' +
        '3. Ejecuta el método que agrega la clase <code>"dark-theme"</code> si no existe, o la remueve si ya está presente (efecto interruptor).<br>' +
        '⚠️ *Restricción: No utilices estructuras condicionales manuales (if/else), usa el método nativo específico para toggles.*',
      difficulty: 'easy',
      templateFiles: [
        {
          path: 'desafio-3.js',
          content: `// 🌙 UI/UX Feature: Interruptor de Modo Oscuro en Caliente\n\nfunction alternarModoOscuro() {\n  // Paso 1: Captura el document.body...\n  \n  // Paso 2: Aplica el método toggle para la clase "dark-theme"...\n}\n`,
        },
      ],
    },
    {
      id: 'ex-04',
      title: '💼 4. Arquitectura de Notificaciones de Usuario (POO)',
      description:
        '**Caso Real:** En aplicaciones escalables, se mapean las sesiones de los usuarios activos usando objetos para disparar alertas personalizadas. Crea la clase <code>Usuario</code>.<br>' +
        '1. El <code>constructor</code> debe mapear las propiedades básicas: <code>username</code> y un array vacío llamado <code>notificaciones</code>.<br>' +
        '2. Agrega el método <code>recibirAlerta(mensaje)</code> que inyecte (guarde) el nuevo mensaje al final de su historial de notificaciones.<br>' +
        '⚠️ *Restricción: El historial debe persistir de forma limpia en la instancia de cada objeto creado.*',
      difficulty: 'easy',
      templateFiles: [
        {
          path: 'desafio-4.js',
          content: `// 💼 Software Architecture: Sistema de Alertas por Instancias de Objetos\n\nclass Usuario {\n  constructor(username) {\n    // Paso 1: Define el username y el array de notificaciones en el contexto local...\n  }\n\n  recibirAlerta(mensaje) {\n    // Paso 2: Inserta el mensaje al final del array de la instancia...\n  }\n}\n\n// Consola de pruebas locales:\n// const user = new Usuario("kuro_dev"); user.recibirAlerta("Tu servidor local se ha iniciado.");\n// console.log(user.notificaciones); // Debería dar: ["Tu servidor local se ha iniciado."]\n`,
        },
      ],
    },
    {
      id: 'ex-05',
      title: '📶 5. Indicador Visual de Pérdida de Conexión (DOM y Lógica)',
      description:
        '**Caso Real:** Si el wifi del laboratorio fluctúa o el cliente pierde internet, la interfaz debe avisar visualmente. Completa la función <code>actualizarEstadoRed(isOnline)</code>.<br>' +
        '1. Busca en el DOM el contenedor de alerta que tiene el ID <code>"status-bar"</code>.<br>' +
        '2. Abre un bloque condicional evaluando el booleano <code>isOnline</code>.<br>' +
        '3. Si es <code>true</code>, cambia su texto interno a <code>"CONECTADO"</code> y su color de fondo a <code>"green"</code>.<br>' +
        '4. Si es <code>false</code>, cambia su texto interno a <code>"SIN CONEXIÓN"</code> y su color de fondo a <code>"red"</code>.',
      difficulty: 'easy',
      templateFiles: [
        {
          path: 'desafio-5.js',
          content: `// 📶 Dev-Ops UI: Alerta Visual de Estado de Sockets/Red\n\nfunction actualizarEstadoRed(isOnline) {\n  // Paso 1: Captura el elemento "status-bar"...\n  \n  // Paso 2: Evalúa con if/else e inyecta los textos y colores correspondientes...\n}\n`,
        },
      ],
    },
  ];

  getChallengesForRoom(roomId: string): Challenge[] {
    return this.mockChallenges;
  }

  getChallengeById(challengeId: string): Challenge {
    const challenge = this.mockChallenges.find((c) => c.id === challengeId);
    if (!challenge) {
      throw new NotFoundException(`El desafío con ID ${challengeId} no existe en el clúster.`);
    }
    return challenge;
  }
}