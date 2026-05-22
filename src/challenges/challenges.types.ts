export interface TemplateFile {
  path: string; // Ej: 'index.html', 'script.js', 'styles.css'
  content: string; // El código base/inicial que tendrá el archivo
}

export interface Challenge {
  id: string; // Identificador único (ej: 'js-arrays-01')
  title: string; // Título del ejercicio
  description: string; // Enunciado detallado (acepta Markdown o HTML)
  difficulty: 'easy' | 'medium' | 'hard';
  templateFiles: TemplateFile[]; // Los archivos que se le inyectarán al VS Code
}

// Mapeo para saber qué ejercicios están activos por cada Sala de cómputo
export interface RoomChallengesConfig {
  roomId: string;
  challenges: Challenge[];
}
