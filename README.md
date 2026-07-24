# Terminal Academy

Juego de navegador para practicar comandos de Linux por niveles. Simula una terminal
con un sistema de archivos virtual: cada nivel plantea un objetivo (moverte por
directorios, crear/leer archivos, copiar, buscar con `grep`/`find`, permisos con
`chmod`, tuberías y redirección...) y se completa automáticamente al ejecutar los
comandos correctos.

No requiere instalación ni dependencias: es HTML/CSS/JS sin build.

## Cómo jugarlo

Sirve la carpeta con cualquier servidor estático, por ejemplo:

```bash
python3 -m http.server 8000
```

y abre `http://localhost:8000`.

El progreso se guarda en el `localStorage` del navegador.

## Estructura

- `src/vfs.js` — sistema de archivos virtual (directorios, archivos, permisos).
- `src/shell.js` — intérprete de comandos (pwd, ls, cd, cat, echo, mkdir, rm, cp, mv,
  grep, find, chmod, wc, sort...), con soporte de tuberías (`|`) y redirección (`>`, `>>`).
- `src/levels.js` — definición de los 10 niveles (historia, objetivo, pistas y
  validación).
- `src/game.js` — controlador de la interfaz: terminal, progreso, pistas.
