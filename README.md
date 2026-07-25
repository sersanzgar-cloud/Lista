# Terminal Academy

Juego de navegador (instalable como PWA en Android) para practicar comandos de Linux
por niveles, con nivel de profesional de sistemas. Simula una terminal con un sistema
de archivos virtual, permisos reales (lectura/escritura/ejecución, propietarios,
`sudo`), procesos, variables de entorno y red. Cada nivel plantea un objetivo y se
completa automáticamente al ejecutar los comandos correctos.

Tiene tres modos, con pestañas para cambiar entre ellos:
- **📘 Aprender:** los niveles descritos abajo, sin límite de tiempo.
- **⚡ Desafío:** retos de terminal contrarreloj sobre la misma terminal real (no es
  un examen tipo test). Se te da un objetivo y tienes que escribir el comando correcto
  antes de que se acabe el tiempo. Empiezas con 3 vidas; cada vez que se agota el
  tiempo de un reto pierdes una vida, y la partida termina al llegar a 0. Cuanto más
  rápido aciertas, más puntos ganas; la mejor puntuación se guarda en el navegador.
  La puntuación se traduce en un rango (de 🌱 Aprendiz a 👑 Maestro del Terminal), así
  que quien complete los 43 niveles puede entrar al Desafío y descubrir su nivel real.
- **🪟 Windows:** el mismo enfoque por niveles, pero para las dos terminales de
  Windows — **CMD** (símbolo del sistema clásico: `dir`, `cd`, `copy`, `del`, `findstr`,
  `tasklist`...) y **PowerShell** (cmdlets modernos: `Get-ChildItem`, `Set-Location`,
  `Copy-Item`, `Select-String`, `$env:VARIABLE`...). Un selector dentro de la pestaña
  cambia entre ambas, cada una con sus propios 9 niveles, progreso y sistema de
  archivos con rutas al estilo `C:\Users\jugador`.

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
- `src/challenges.js` — pool de retos del Modo Desafío, agrupados por dificultad
  (fácil, medio, difícil) con su tiempo límite y puntuación base.
- `src/winvfs.js` — sistema de archivos virtual estilo Windows (unidad `C:\`, rutas
  con backslash, insensible a mayúsculas, atributos oculto/solo-lectura).
- `src/winshell.js` — intérprete de CMD y PowerShell: tuberías, redirección,
  expansión de variables (`%VAR%` en CMD, `$env:VAR` en PowerShell), y los cmdlets con
  sus alias reales (`dir`/`ls`/`Get-ChildItem`, `cd`/`Set-Location`, etc.).
- `src/winlevels.js` — 9 niveles de CMD y 9 de PowerShell.
- `src/game.js` — controlador de la interfaz: terminal compartida entre los tres modos,
  progreso, pistas, barra táctil, y el estado de cada modo (niveles, temporizador del
  Desafío, y las dos pistas de Windows).
- `manifest.json` / `service-worker.js` / `icons/` — PWA instalable en Android.
