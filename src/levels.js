// Definición de los niveles de Terminal Academy.
window.TA = window.TA || {};

(function () {
  const { file, dir } = TA.vfsHelpers;

  function baseHome(extra = {}) {
    return dir({
      home: dir({
        jugador: dir({
          'bienvenida.txt': file(
            'Bienvenido a Terminal Academy.\nAquí aprenderás a moverte por Linux usando la terminal.'
          ),
          ...extra,
        }),
      }),
      etc: dir({
        hostname: file('servidor-academia'),
      }),
      tmp: dir({}),
    });
  }

  // history: array de { cmd, args, output, error, raw }
  const usedCmd = (history, name) => history.some((h) => h.cmd === name && !h.error);
  const anyStage = (history, pred) => history.some((h) => pred(h));

  const LEVELS = [
    {
      id: 'nivel-1',
      title: 'Nivel 1 · Orientación',
      story: 'Acabas de conectarte al servidor de la academia. Antes de tocar nada, ubícate: ¿dónde estás y qué hay a tu alrededor?',
      objective: 'Averigua tu ubicación actual y lista el contenido del directorio.',
      commands: ['pwd', 'ls'],
      hints: [
        'Escribe "pwd" para ver la ruta completa en la que estás.',
        'Escribe "ls" para ver los archivos y carpetas del directorio actual.',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome(),
      check(ctx) {
        return usedCmd(ctx.history, 'pwd') && usedCmd(ctx.history, 'ls');
      },
    },

    {
      id: 'nivel-2',
      title: 'Nivel 2 · Moverse por directorios',
      story: 'Tu carpeta personal tiene subcarpetas. Explóralas con "cd" y regresa a casa cuando termines.',
      objective: 'Entra en "documentos", luego en "fotos", y vuelve al directorio personal (~).',
      commands: ['cd', 'ls', 'pwd'],
      hints: [
        'Usa "cd documentos" para entrar y "cd .." para subir un nivel.',
        'Desde cualquier lugar, "cd ~" o "cd" sin argumentos te lleva a casa.',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome({
        documentos: dir({ 'notas.txt': file('Lista de la compra:\n- pan\n- leche') }),
        fotos: dir({ 'familia.png': file('[imagen binaria simulada]') }),
      }),
      check(ctx) {
        const visitedDocs = ctx.visited.has('/home/jugador/documentos');
        const visitedFotos = ctx.visited.has('/home/jugador/fotos');
        const backHome = ctx.vfs.pathToStr(ctx.cwd) === '/home/jugador';
        return visitedDocs && visitedFotos && backHome;
      },
    },

    {
      id: 'nivel-3',
      title: 'Nivel 3 · Leer y crear archivos',
      story: 'El sistema de archivos es tuyo para escribir. Aprende a crear y consultar archivos de texto.',
      objective: 'Lee "bienvenida.txt", crea "nuevo.txt" con algo de texto usando echo y ">" , y crea un archivo vacío "vacio.txt" con touch.',
      commands: ['cat', 'echo', 'touch'],
      hints: [
        'Usa "cat bienvenida.txt" para leer un archivo.',
        'Usa echo "tu texto" > nuevo.txt para crear un archivo con contenido.',
        'Usa "touch vacio.txt" para crear un archivo vacío.',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome(),
      check(ctx) {
        const nuevo = ctx.vfs.getNode(['home', 'jugador', 'nuevo.txt']);
        const vacio = ctx.vfs.getNode(['home', 'jugador', 'vacio.txt']);
        return !!nuevo && nuevo.type === 'file' && nuevo.content.trim().length > 0
          && !!vacio && vacio.type === 'file';
      },
    },

    {
      id: 'nivel-4',
      title: 'Nivel 4 · Carpetas anidadas',
      story: 'Vas a montar la estructura de un proyecto nuevo desde cero.',
      objective: 'Crea la ruta "proyectos/backend/api" de una sola vez con mkdir -p.',
      commands: ['mkdir'],
      hints: [
        'mkdir normalmente solo crea un nivel. Usa la opción -p para crear varios a la vez.',
        'Prueba: mkdir -p proyectos/backend/api',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome(),
      check(ctx) {
        const node = ctx.vfs.getNode(['home', 'jugador', 'proyectos', 'backend', 'api']);
        return !!node && node.type === 'dir';
      },
    },

    {
      id: 'nivel-5',
      title: 'Nivel 5 · Copiar y mover',
      story: 'Necesitas reorganizar archivos: una copia va a "proyectos" y una foto se muda definitivamente.',
      objective: 'Copia documentos/notas.txt dentro de proyectos/, y mueve fotos/familia.png también dentro de proyectos/.',
      commands: ['cp', 'mv'],
      hints: [
        'cp origen destino copia sin borrar el original: cp documentos/notas.txt proyectos/',
        'mv origen destino mueve (borra el original): mv fotos/familia.png proyectos/',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome({
        proyectos: dir({}),
        documentos: dir({ 'notas.txt': file('Lista de la compra:\n- pan\n- leche') }),
        fotos: dir({ 'familia.png': file('[imagen binaria simulada]') }),
      }),
      check(ctx) {
        const copia = ctx.vfs.getNode(['home', 'jugador', 'proyectos', 'notas.txt']);
        const original = ctx.vfs.getNode(['home', 'jugador', 'documentos', 'notas.txt']);
        const movida = ctx.vfs.getNode(['home', 'jugador', 'proyectos', 'familia.png']);
        const origenFotoBorrado = !ctx.vfs.getNode(['home', 'jugador', 'fotos', 'familia.png']);
        return !!copia && !!original && !!movida && origenFotoBorrado;
      },
    },

    {
      id: 'nivel-6',
      title: 'Nivel 6 · Eliminar con cuidado',
      story: 'Hay que limpiar archivos temporales... con cuidado de no borrar de más.',
      objective: 'Elimina el archivo proyectos/notas.txt y luego elimina por completo la carpeta "basura" (no está vacía).',
      commands: ['rm'],
      hints: [
        'rm archivo elimina un archivo suelto.',
        'Si intentas "rm basura" y falla porque es un directorio, usa rm -r basura',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome({
        proyectos: dir({ 'notas.txt': file('copia temporal') }),
        basura: dir({ 'viejo.log': file('log antiguo'), 'cache.tmp': file('datos de cache') }),
      }),
      check(ctx) {
        const notas = ctx.vfs.getNode(['home', 'jugador', 'proyectos', 'notas.txt']);
        const basura = ctx.vfs.getNode(['home', 'jugador', 'basura']);
        return !notas && !basura;
      },
    },

    {
      id: 'nivel-7',
      title: 'Nivel 7 · Buscar información',
      story: 'El administrador del sistema te pide que localices cosas concretas entre muchos archivos.',
      objective: 'Usa grep para encontrar la línea que contiene "root" en /etc/passwd, y usa find para localizar todos los archivos ".txt" dentro de /home.',
      commands: ['grep', 'find'],
      hints: [
        'grep "patrón" archivo busca texto dentro de un archivo: grep "root" /etc/passwd',
        'find <ruta> -name "*.txt" busca archivos por nombre en toda la ruta.',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => {
        const fs = baseHome({
          documentos: dir({
            'notas.txt': file('cosas por hacer'),
            informes: dir({ 'anual.txt': file('resumen anual') }),
          }),
        });
        fs.children.etc.children.passwd = file(
          'root:x:0:0:root:/root:/bin/bash\njugador:x:1000:1000:Jugador:/home/jugador:/bin/bash'
        );
        return fs;
      },
      check(ctx) {
        const grepOk = anyStage(ctx.history, (h) =>
          h.cmd === 'grep' && h.args.some((a) => a.toLowerCase().includes('root')) && h.output.toLowerCase().includes('root'));
        const findOk = anyStage(ctx.history, (h) =>
          h.cmd === 'find' && h.output.includes('notas.txt') && h.output.includes('anual.txt'));
        return grepOk && findOk;
      },
    },

    {
      id: 'nivel-8',
      title: 'Nivel 8 · Permisos',
      story: 'Hay un archivo con datos sensibles y un script que debería ser ejecutable.',
      objective: 'Cambia los permisos de "secreto.txt" a 600 (solo tú puedes leer/escribir) y añade permiso de ejecución a "script.sh".',
      commands: ['chmod', 'ls -l'],
      hints: [
        'Usa "ls -l" para ver los permisos actuales de cada archivo.',
        'chmod 600 secreto.txt deja el archivo en rw-------',
        'chmod +x script.sh añade el bit de ejecución.',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome({
        'secreto.txt': file('clave: 1234'),
        'script.sh': file('#!/bin/bash\necho hola'),
      }),
      check(ctx) {
        const secreto = ctx.vfs.getNode(['home', 'jugador', 'secreto.txt']);
        const script = ctx.vfs.getNode(['home', 'jugador', 'script.sh']);
        const secretoOk = secreto && secreto.perms === 'rw-------';
        const scriptOk = script && script.perms[2] === 'x';
        return !!secretoOk && !!scriptOk;
      },
    },

    {
      id: 'nivel-9',
      title: 'Nivel 9 · Tuberías y redirección',
      story: 'Vas a combinar comandos: la salida de uno alimenta al siguiente, y puedes guardar resultados en archivos.',
      objective: 'Usa "ls /etc | grep host" para filtrar resultados, y añade dos líneas a "historial.txt" usando ">>" (una por comando).',
      commands: ['|', '>>'],
      hints: [
        'El símbolo | conecta la salida de un comando con la entrada del siguiente: ls /etc | grep host',
        'echo "texto" >> archivo añade una línea al final sin borrar lo anterior. Ejecútalo dos veces con textos distintos.',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome(),
      check(ctx) {
        const pipeOk = anyStage(ctx.history, (h) =>
          h.raw && h.raw.includes('|') && h.raw.includes('grep') && h.output.includes('hostname'));
        const historial = ctx.vfs.getNode(['home', 'jugador', 'historial.txt']);
        const lineas = historial ? historial.content.split('\n').filter((l) => l.length > 0) : [];
        return pipeOk && lineas.length >= 2;
      },
    },

    {
      id: 'nivel-10',
      title: 'Nivel 10 · Reto final',
      story: 'Última prueba: el administrador dejó una pista oculta en tu carpeta personal. Encuéntrala, léela y entrega un resumen.',
      objective: 'Encuentra el archivo oculto con find (los archivos ocultos empiezan por "."), lee la palabra clave que contiene, crea "entregas/final/resumen.txt" con esa palabra dentro, y confírmalo con grep.',
      commands: ['find', 'cat', 'mkdir -p', 'echo', 'grep'],
      hints: [
        'find . -name ".*" encuentra archivos ocultos en el directorio actual.',
        'Crea la carpeta con mkdir -p entregas/final',
        'Guarda el resumen con echo "La palabra clave es LINUX" > entregas/final/resumen.txt',
        'Comprueba con grep "LINUX" entregas/final/resumen.txt',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome({ '.pista.txt': file('La palabra clave es: LINUX') }),
      check(ctx) {
        const findOk = anyStage(ctx.history, (h) => h.cmd === 'find' && h.output.includes('.pista.txt'));
        const resumen = ctx.vfs.getNode(['home', 'jugador', 'entregas', 'final', 'resumen.txt']);
        const resumenOk = resumen && resumen.content.toUpperCase().includes('LINUX');
        const grepOk = anyStage(ctx.history, (h) =>
          h.cmd === 'grep' && h.output.toUpperCase().includes('LINUX'));
        return findOk && !!resumenOk && grepOk;
      },
    },

    // --- Bloque profesional: administración real de sistemas Linux ---

    {
      id: 'nivel-11',
      title: 'Nivel 11 · Ver procesos',
      story: 'El servidor va lento. Antes de tocar nada, examina qué está pasando: qué procesos están en ejecución y cuál consume más recursos.',
      objective: 'Usa ps para ver los procesos activos, y top para una vista ordenada por uso de CPU.',
      commands: ['ps', 'top'],
      hints: [
        'Escribe "ps" para ver la tabla de procesos: PID, usuario, %CPU, %MEM y el comando.',
        'Escribe "top" para ver esa misma tabla ordenada por consumo de CPU, de mayor a menor.',
        'Fíjate en qué proceso tiene un %CPU anormalmente alto: eso es una pista para el próximo nivel.',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome(),
      createProcesses: () => [
        { pid: 812, user: 'root', cpu: '0.0', mem: '0.1', cmd: 'systemd' },
        { pid: 950, user: 'root', cpu: '0.1', mem: '0.3', cmd: 'sshd', protected: true },
        { pid: 1102, user: 'jugador', cpu: '97.4', mem: '12.0', cmd: 'backup.sh' },
        { pid: 1240, user: 'jugador', cpu: '0.3', mem: '1.1', cmd: 'bash' },
      ],
      check(ctx) {
        return usedCmd(ctx.history, 'ps') && usedCmd(ctx.history, 'top');
      },
    },

    {
      id: 'nivel-12',
      title: 'Nivel 12 · Terminar procesos',
      story: 'Confirmado: "backup.sh" (PID 1102) se ha quedado colgado consumiendo el 97% de CPU. Hay que pararlo.',
      objective: 'Usa kill para terminar el proceso con PID 1102, y comprueba con ps que ya no aparece en ejecución.',
      commands: ['kill', 'ps'],
      hints: [
        'La primera columna de "ps" es el PID (identificador del proceso).',
        'kill <PID> envía una señal de terminación al proceso: kill 1102',
        'Vuelve a ejecutar "ps" después para confirmar que el proceso ha desaparecido.',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome(),
      createProcesses: () => [
        { pid: 812, user: 'root', cpu: '0.0', mem: '0.1', cmd: 'systemd' },
        { pid: 950, user: 'root', cpu: '0.1', mem: '0.3', cmd: 'sshd', protected: true },
        { pid: 1102, user: 'jugador', cpu: '97.4', mem: '12.0', cmd: 'backup.sh' },
        { pid: 1240, user: 'jugador', cpu: '0.3', mem: '1.1', cmd: 'bash' },
      ],
      check(ctx) {
        const proc = ctx.processes.find((p) => p.pid === 1102);
        return !!proc && proc.killed === true && usedCmd(ctx.history, 'ps');
      },
    },

    {
      id: 'nivel-13',
      title: 'Nivel 13 · Segundo plano y persistencia',
      story: 'Quieres lanzar un script de mantenimiento largo sin bloquear la terminal, y que sobreviva aunque cierres la sesión.',
      objective: 'Lanza "./mantenimiento.sh" en segundo plano con &, comprueba que aparece con jobs, y vuelve a lanzarlo con nohup para que sobreviva al cierre de sesión: nohup ./mantenimiento.sh &',
      commands: ['&', 'jobs', 'nohup'],
      hints: [
        'Añadir " &" al final de un comando lo ejecuta en segundo plano y te devuelve el control de la terminal: ./mantenimiento.sh &',
        '"jobs" lista los procesos en segundo plano de tu sesión actual.',
        'nohup comando & hace que el proceso ignore la señal de colgado (hangup) al cerrar sesión: nohup ./mantenimiento.sh &',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome({ 'mantenimiento.sh': file('#!/bin/bash\necho "manteniendo..."\n', 'rwxr-xr-x') }),
      check(ctx) {
        const started = ctx.jobs.some((j) => j.cmd.includes('mantenimiento.sh') && !j.nohup);
        const persisted = ctx.jobs.some((j) => j.cmd.includes('mantenimiento.sh') && j.nohup);
        return started && persisted && usedCmd(ctx.history, 'jobs');
      },
    },

    {
      id: 'nivel-14',
      title: 'Nivel 14 · Propietarios de archivos',
      story: 'Un compañero, "ana", necesita hacerse cargo de un informe que creaste tú.',
      objective: 'Cambia el propietario de "informe.csv" a ana con sudo chown, y comprueba el cambio con ls -l.',
      commands: ['sudo', 'chown', 'ls -l'],
      hints: [
        'Cambiar el propietario de un archivo requiere privilegios de superusuario en un sistema real.',
        'Antepón sudo al comando: sudo chown ana informe.csv',
        'Con "ls -l" verás el propietario y el grupo en la tercera y cuarta columna.',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome({ 'informe.csv': file('nombre,ventas\nana,120\nluis,95\n') }),
      check(ctx) {
        const node = ctx.vfs.getNode(['home', 'jugador', 'informe.csv']);
        return !!node && node.owner === 'ana';
      },
    },

    {
      id: 'nivel-15',
      title: 'Nivel 15 · sudo y archivos protegidos',
      story: 'Hay un archivo de configuración que solo puede tocar el administrador del sistema.',
      objective: 'Intenta leer /etc/config.conf (verás que se deniega el acceso), consíguelo con sudo, y añade la línea "modo=produccion" usando el patrón correcto para escribir en un archivo protegido: echo "modo=produccion" | sudo tee -a /etc/config.conf',
      commands: ['sudo', 'cat', 'tee'],
      hints: [
        'Primero prueba "cat /etc/config.conf" tal cual: verás un "Permiso denegado", porque el archivo es de root.',
        'Para leerlo, antepón sudo: sudo cat /etc/config.conf',
        'Para escribir en un archivo protegido no basta con sudo antes de >>. El patrón correcto es: echo "modo=produccion" | sudo tee -a /etc/config.conf',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => {
        const fs = baseHome();
        fs.children.etc.children['config.conf'] = file('modo=mantenimiento\n', 'rw-------', 'root', 'root');
        return fs;
      },
      check(ctx) {
        const node = ctx.vfs.getNode(['etc', 'config.conf']);
        const deniedAttempt = anyStage(ctx.history, (h) => h.cmd === 'cat' && h.error && h.error.includes('Permiso denegado'));
        const readWithSudo = anyStage(ctx.history, (h) => h.cmd === 'cat' && !h.error && h.output.includes('modo'));
        const appended = !!node && node.content.includes('modo=produccion');
        return deniedAttempt && readWithSudo && appended;
      },
    },

    {
      id: 'nivel-16',
      title: 'Nivel 16 · umask y permisos por defecto',
      story: 'El administrador quiere que los archivos nuevos que crees no sean accesibles para otros usuarios del sistema.',
      objective: 'Cambia la umask a 077, crea un archivo llamado "privado.txt", y comprueba con ls -l que queda con permisos rw------- (solo tú tienes acceso).',
      commands: ['umask', 'touch', 'ls -l'],
      hints: [
        'umask <valor> resta permisos a los que se usarían por defecto (666 en archivos, 777 en carpetas).',
        'umask 077 bloquea todos los permisos para grupo y otros: prueba "umask 077"',
        'Después de cambiar la umask, crea el archivo: touch privado.txt — el cambio solo afecta a archivos nuevos, no a los ya existentes.',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome(),
      check(ctx) {
        const node = ctx.vfs.getNode(['home', 'jugador', 'privado.txt']);
        return ctx.umask === '077' && !!node && node.perms === 'rw-------';
      },
    },

    {
      id: 'nivel-17',
      title: 'Nivel 17 · Extraer columnas',
      story: 'El equipo de sistemas te pasa el archivo de usuarios del servidor. Necesitas solo los nombres, no el resto de campos.',
      objective: 'Usa cut para extraer la primera columna (separada por ":") de /etc/passwd, quedándote solo con los nombres de usuario.',
      commands: ['cut'],
      hints: [
        'cut -d: -f1 archivo extrae la primera columna usando ":" como separador.',
        'Prueba: cut -d: -f1 /etc/passwd',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => {
        const fs = baseHome();
        fs.children.etc.children.passwd = file(
          'root:x:0:0:root:/root:/bin/bash\njugador:x:1000:1000:Jugador:/home/jugador:/bin/bash\nana:x:1001:1001:Ana:/home/ana:/bin/bash\n'
        );
        return fs;
      },
      check(ctx) {
        return anyStage(ctx.history, (h) =>
          h.cmd === 'cut' && h.output.includes('root') && h.output.includes('jugador') && h.output.includes('ana') && !h.output.includes(':'));
      },
    },

    {
      id: 'nivel-18',
      title: 'Nivel 18 · Editar texto con sed',
      story: 'Un script de despliegue antiguo apunta al entorno equivocado. Hay que corregirlo sin abrir ningún editor.',
      objective: 'El archivo deploy.conf contiene "entorno=staging". Cámbialo a "entorno=produccion" con sed, modificando el archivo directamente (-i).',
      commands: ['sed'],
      hints: [
        'sed \'s/patrón/reemplazo/\' archivo muestra el resultado por pantalla, sin tocar el archivo.',
        'Añade -i para que el cambio se guarde en el propio archivo.',
        'Prueba: sed -i \'s/staging/produccion/\' deploy.conf',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome({ 'deploy.conf': file('entorno=staging\nversion=3.2\n') }),
      check(ctx) {
        const node = ctx.vfs.getNode(['home', 'jugador', 'deploy.conf']);
        return !!node && node.content.includes('entorno=produccion') && !node.content.includes('staging');
      },
    },

    {
      id: 'nivel-19',
      title: 'Nivel 19 · Extraer campos con awk',
      story: 'Necesitas un informe rápido: solo el nombre y el departamento de cada empleado, sin el resto de columnas.',
      objective: 'El archivo empleados.csv tiene columnas separadas por comas (nombre,departamento,salario). Usa awk para imprimir solo la 1ª y la 2ª columna.',
      commands: ['awk'],
      hints: [
        'awk -F, \'{print $1, $2}\' archivo imprime la 1ª y 2ª columna usando "," como separador.',
        'Prueba: awk -F, \'{print $1, $2}\' empleados.csv',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome({ 'empleados.csv': file('nombre,departamento,salario\nana,ingenieria,52000\nluis,ventas,41000\nmarta,ingenieria,55000\n') }),
      check(ctx) {
        return anyStage(ctx.history, (h) =>
          h.cmd === 'awk' && h.output.includes('ana') && h.output.includes('ingenieria') && !h.output.includes('52000'));
      },
    },

    {
      id: 'nivel-20',
      title: 'Nivel 20 · Variables y scripts',
      story: 'Vas a automatizar una tarea repetitiva: un pequeño script que saluda usando una variable de entorno.',
      objective: 'Define la variable NOMBRE con export (con tu nombre), dale permiso de ejecución al script "saludo.sh" (ya está escrito), y ejecútalo con ./saludo.sh.',
      commands: ['export', 'chmod', './script.sh'],
      hints: [
        'Define la variable con: export NOMBRE=TuNombre',
        'El script no es ejecutable todavía: dale permiso con chmod +x saludo.sh',
        'Ejecútalo con ./saludo.sh (el "./" indica "en esta misma carpeta").',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome({ 'saludo.sh': file('#!/bin/bash\necho "Hola, $NOMBRE"\n') }),
      check(ctx) {
        const exported = ctx.env.NOMBRE !== undefined && ctx.env.NOMBRE !== '';
        const scriptNode = ctx.vfs.getNode(['home', 'jugador', 'saludo.sh']);
        const ranOk = anyStage(ctx.history, (h) => h.cmd === './saludo.sh' && !h.error && h.output.includes('Hola'));
        return exported && !!scriptNode && ranOk;
      },
    },

    {
      id: 'nivel-21',
      title: 'Nivel 21 · Diagnóstico de red',
      story: 'Antes de desplegar, comprueba que el servidor de la aplicación está accesible en la red y que su API responde.',
      objective: 'Haz ping a "servidor-app" para comprobar que responde, usa curl para consultar http://servidor-app/estado, y comprueba que "servidor-caido" NO responde.',
      commands: ['ping', 'curl'],
      hints: [
        'ping <host> comprueba si un equipo responde en la red: ping servidor-app',
        'curl <url> hace una petición HTTP y muestra la respuesta: curl http://servidor-app/estado',
        'Prueba también con un host que no existe para ver cómo se ve un fallo: ping servidor-caido',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome(),
      createNetwork: () => ({
        hosts: { 'servidor-app': true, 'servidor-caido': false },
        routes: { 'http://servidor-app/estado': '{"status":"ok","uptime":"14d"}' },
        ports: [],
      }),
      check(ctx) {
        const pingedOk = anyStage(ctx.history, (h) => h.cmd === 'ping' && h.args.includes('servidor-app') && h.output.includes('0% de pérdida'));
        const curled = anyStage(ctx.history, (h) => h.cmd === 'curl' && h.output.includes('"status":"ok"'));
        const pingedDown = anyStage(ctx.history, (h) => h.cmd === 'ping' && h.args.includes('servidor-caido') && h.output.includes('inalcanzable'));
        return pingedOk && curled && pingedDown;
      },
    },

    {
      id: 'nivel-22',
      title: 'Nivel 22 · Puertos y conexiones',
      story: 'Quieres confirmar en qué puerto está escuchando el servicio web antes de abrirlo en el cortafuegos.',
      objective: 'Usa ss (o netstat) para listar los puertos en escucha, y localiza en qué puerto escucha el servicio "nginx".',
      commands: ['ss', 'netstat'],
      hints: [
        'ss -tulpn (o netstat -tulpn en sistemas más antiguos) lista los puertos en escucha y qué proceso los usa.',
        'Busca en la salida la fila que mencione "nginx".',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome(),
      createNetwork: () => ({
        hosts: {},
        routes: {},
        ports: [
          { proto: 'tcp', address: '0.0.0.0', port: 22, service: 'sshd', pid: 950 },
          { proto: 'tcp', address: '0.0.0.0', port: 80, service: 'nginx', pid: 1310 },
          { proto: 'tcp', address: '127.0.0.1', port: 5432, service: 'postgres', pid: 1420 },
        ],
      }),
      check(ctx) {
        return anyStage(ctx.history, (h) => (h.cmd === 'ss' || h.cmd === 'netstat') && h.output.includes('nginx') && h.output.includes('80'));
      },
    },

    {
      id: 'nivel-23',
      title: 'Nivel 23 · Disco y memoria',
      story: 'El servidor de producción avisa de poco espacio. Diagnostica antes de que sea demasiado tarde.',
      objective: 'Comprueba el espacio en disco con df -h, la memoria con free -h, y el espacio que ocupan tus carpetas con du.',
      commands: ['df', 'free', 'du'],
      hints: [
        'df -h muestra el espacio en disco en formato legible (GB/MB).',
        'free -h muestra el uso de memoria RAM y swap.',
        'du -sh */ muestra el tamaño de cada subcarpeta del directorio actual.',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome({
        logs: dir({ 'app.log': file('x'.repeat(400) + '\n'), 'error.log': file('y'.repeat(120)) }),
        documentos: dir({ 'informe.txt': file('z'.repeat(30)) }),
      }),
      check(ctx) {
        const duUsed = anyStage(ctx.history, (h) => h.cmd === 'du' && h.output.length > 0);
        return usedCmd(ctx.history, 'df') && usedCmd(ctx.history, 'free') && duUsed;
      },
    },

    {
      id: 'nivel-24',
      title: 'Nivel 24 · Reto final: incidente y respaldo',
      story: 'Última prueba profesional: hay un incidente en los logs del servidor. Investígalo y respalda la carpeta de logs antes de tocar nada más.',
      objective: 'Encuentra la línea "ERROR" en logs/app.log, comprime la carpeta logs/ en respaldo.tar.gz con tar, y extráelo dentro de /tmp para verificar que la copia funciona.',
      commands: ['grep', 'tar'],
      hints: [
        'grep "ERROR" logs/app.log busca esa palabra dentro del archivo.',
        'tar -czf respaldo.tar.gz logs/ comprime toda la carpeta en un único archivo.',
        'tar -xzf respaldo.tar.gz -C /tmp extrae la copia dentro de /tmp para comprobar que el respaldo es válido.',
      ],
      startCwd: ['home', 'jugador'],
      createFs: () => baseHome({
        logs: dir({
          'app.log': file(
            '2024-01-01 INFO arranque correcto\n2024-01-01 INFO conexión establecida\n2024-01-01 ERROR fallo al conectar con la base de datos\n2024-01-01 INFO reintentando...\n'
          ),
        }),
      }),
      check(ctx) {
        const foundError = anyStage(ctx.history, (h) => (h.cmd === 'grep' || h.cmd === 'tail') && h.output.includes('ERROR'));
        const archiveNode = ctx.vfs.getNode(['home', 'jugador', 'respaldo.tar.gz']);
        const archived = !!archiveNode && archiveNode.isArchive === true;
        const extracted = !!ctx.vfs.getNode(['tmp', 'logs']);
        return foundError && archived && extracted;
      },
    },
  ];

  TA.LEVELS = LEVELS;
})();
