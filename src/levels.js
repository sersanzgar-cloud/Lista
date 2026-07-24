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
  ];

  TA.LEVELS = LEVELS;
})();
