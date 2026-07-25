# Terminal Academy

Juego de navegador (instalable como PWA en Android) para practicar comandos de Linux
por niveles, con nivel de profesional de sistemas. Simula una terminal con un sistema
de archivos virtual, permisos reales (lectura/escritura/ejecución, propietarios,
`sudo`), procesos, variables de entorno y red. Cada nivel plantea un objetivo y se
completa automáticamente al ejecutar los comandos correctos.

43 niveles (0-42) en seis bloques:
- **Nivel 0 (introducción):** qué es una terminal, qué es Linux, cómo leer el prompt
  — sin dar nada por sabido, para quien nunca ha visto una terminal.
- **Niveles 1-10 (fundamentos):** moverte por directorios, crear/leer archivos, copiar,
  `grep`/`find`, `chmod`, tuberías y redirección.
- **Niveles 11-24 (profesional):** procesos (`ps`, `top`, `kill`, `jobs`, `nohup`),
  permisos y usuarios avanzados (`chown`, `sudo`, `umask`), procesamiento de texto y
  scripting (`cut`, `sed`, `awk`, variables de entorno, ejecutar scripts), y red/sistema
  (`ping`, `curl`, `ss`, `df`, `du`, `free`, `tar`).
- **Niveles 25-32 (avanzado):** bash real con bucles (`for..in..do..done`) y
  condicionales (`if [ ... ]; then..else..fi`), argumentos posicionales (`$1`, `$#`) y
  código de salida (`$?`), gestión de paquetes (`apt`/`dnf`), servicios (`systemctl`),
  usuarios y grupos (`useradd`, `groupadd`, `usermod`, `passwd`), y control de
  versiones con `git` (`init`/`add`/`commit`/`status`/`log`) sobre el propio sistema
  de archivos virtual.
- **Niveles 33-36 (redes avanzadas y SSH):** cortafuegos (`ufw`), DNS (`dig`/`nslookup`),
  rutas (`ip addr`/`ip route`), y autenticación por clave pública (`ssh-keygen`).
- **Niveles 37-42 (herramientas del día a día):** el manual (`man`/`whatis`/`apropos`),
  enlaces simbólicos y duros reales (`ln`), montar dispositivos (`mount`/`umount`),
  sincronización (`rsync`), archivos abiertos (`lsof`), atajos (`alias`), y descarga de
  archivos (`wget`/`which`/`whereis`).

No requiere instalación ni dependencias: es HTML/CSS/JS sin build.

## Cómo jugarlo

Sirve la carpeta con cualquier servidor estático, por ejemplo:

```bash
python3 -m http.server 8000
```

y abre `http://localhost:8000`.

El progreso se guarda en el `localStorage` del navegador.

## Estructura

- `src/vfs.js` — sistema de archivos virtual (directorios, archivos, enlaces simbólicos
  con resolución real, permisos, propietario/grupo, `umask`).
- `src/shell.js` — intérprete de comandos (navegación y archivos, texto y scripting,
  procesos, red/sistema, paquetes/servicios/usuarios/git, montaje/sincronización/enlaces),
  con soporte de tuberías (`|`), redirección (`>`, `>>`), variables de entorno (comillas
  simples vs dobles, parámetros posicionales), `sudo`, alias, segundo plano (`&`, `nohup`),
  y un intérprete real de bloques `for`/`if` para scripts.
- `src/levels.js` — definición de los 43 niveles (historia, objetivo, pistas y
  validación).
- `src/game.js` — controlador de la interfaz: terminal, progreso, pistas, barra táctil.
- `manifest.json` / `service-worker.js` / `icons/` — PWA instalable en Android.
