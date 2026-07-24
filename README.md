# Terminal Academy

Juego de navegador (instalable como PWA en Android) para practicar comandos de Linux
por niveles, con nivel de profesional de sistemas. Simula una terminal con un sistema
de archivos virtual, permisos reales (lectura/escritura/ejecución, propietarios,
`sudo`), procesos, variables de entorno y red. Cada nivel plantea un objetivo y se
completa automáticamente al ejecutar los comandos correctos.

24 niveles en dos bloques:
- **Niveles 1-10 (fundamentos):** moverte por directorios, crear/leer archivos, copiar,
  `grep`/`find`, `chmod`, tuberías y redirección.
- **Niveles 11-24 (profesional):** procesos (`ps`, `top`, `kill`, `jobs`, `nohup`),
  permisos y usuarios avanzados (`chown`, `sudo`, `umask`), procesamiento de texto y
  scripting (`cut`, `sed`, `awk`, variables de entorno, ejecutar scripts), y red/sistema
  (`ping`, `curl`, `ss`, `df`, `du`, `free`, `tar`).

No requiere instalación ni dependencias: es HTML/CSS/JS sin build.

## Cómo jugarlo

Sirve la carpeta con cualquier servidor estático, por ejemplo:

```bash
python3 -m http.server 8000
```

y abre `http://localhost:8000`.

El progreso se guarda en el `localStorage` del navegador.

## Estructura

- `src/vfs.js` — sistema de archivos virtual (directorios, archivos, permisos,
  propietario/grupo, `umask`).
- `src/shell.js` — intérprete de comandos (navegación y archivos, texto y scripting,
  procesos, red/sistema), con soporte de tuberías (`|`), redirección (`>`, `>>`),
  variables de entorno, `sudo` y segundo plano (`&`, `nohup`).
- `src/levels.js` — definición de los 24 niveles (historia, objetivo, pistas y
  validación).
- `src/game.js` — controlador de la interfaz: terminal, progreso, pistas, barra táctil.
- `manifest.json` / `service-worker.js` / `icons/` — PWA instalable en Android.
