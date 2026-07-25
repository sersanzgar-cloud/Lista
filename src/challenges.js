// Pool de retos para el Modo Desafío de Terminal Academy.
window.TA = window.TA || {};

(function () {
  const { file, dir } = TA.vfsHelpers;

  const usedCmd = (history, name) => history.some((h) => h.cmd === name && !h.error);
  const anyStage = (history, pred) => history.some((h) => pred(h));

  // tier: 'facil' | 'medio' | 'dificil' — determina tiempo límite y puntos base.
  const TIER_CONFIG = {
    facil: { timeLimit: 35, points: 10, label: 'Fácil' },
    medio: { timeLimit: 28, points: 20, label: 'Medio' },
    dificil: { timeLimit: 22, points: 35, label: 'Difícil' },
  };

  const CHALLENGES = [
    // --- Fáciles ---
    {
      id: 'reto-pwd',
      tier: 'facil',
      objective: 'Averigua la ruta completa de tu ubicación actual.',
      solution: 'pwd',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({}) }) }),
      check: (ctx) => usedCmd(ctx.history, 'pwd'),
    },
    {
      id: 'reto-ls',
      tier: 'facil',
      objective: 'Lista el contenido del directorio actual.',
      solution: 'ls',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({ 'notas.txt': file('recordatorio') }) }) }),
      check: (ctx) => usedCmd(ctx.history, 'ls'),
    },
    {
      id: 'reto-cat',
      tier: 'facil',
      objective: 'Muestra el contenido del archivo "notas.txt".',
      solution: 'cat notas.txt',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({ 'notas.txt': file('reunion a las 10:00') }) }) }),
      check: (ctx) => anyStage(ctx.history, (h) => h.cmd === 'cat' && !h.error && h.args.includes('notas.txt')),
    },
    {
      id: 'reto-mkdir',
      tier: 'facil',
      objective: 'Crea una carpeta llamada "backup".',
      solution: 'mkdir backup',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({}) }) }),
      check: (ctx) => {
        const node = ctx.vfs.getNode(['home', 'jugador', 'backup']);
        return !!node && node.type === 'dir';
      },
    },
    {
      id: 'reto-cp',
      tier: 'facil',
      objective: 'Copia "informe.txt" a "informe_copia.txt".',
      solution: 'cp informe.txt informe_copia.txt',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({ 'informe.txt': file('datos del trimestre') }) }) }),
      check: (ctx) => {
        const node = ctx.vfs.getNode(['home', 'jugador', 'informe_copia.txt']);
        return !!node && node.type === 'file';
      },
    },
    {
      id: 'reto-rm',
      tier: 'facil',
      objective: 'Borra el archivo "temporal.tmp".',
      solution: 'rm temporal.tmp',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({ 'temporal.tmp': file('basura') }) }) }),
      check: (ctx) => !ctx.vfs.getNode(['home', 'jugador', 'temporal.tmp']),
    },
    {
      id: 'reto-echo-redirect',
      tier: 'facil',
      objective: 'Crea "estado.txt" con el texto "listo" dentro, usando echo y ">".',
      solution: 'echo "listo" > estado.txt',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({}) }) }),
      check: (ctx) => {
        const node = ctx.vfs.getNode(['home', 'jugador', 'estado.txt']);
        return !!node && node.type === 'file' && node.content.trim().length > 0;
      },
    },

    // --- Medios ---
    {
      id: 'reto-grep',
      tier: 'medio',
      objective: 'Busca la palabra "ERROR" dentro de "app.log".',
      solution: 'grep ERROR app.log',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({
        'app.log': file('INFO arranque ok\nERROR conexion perdida\nINFO reintentando\n'),
      }) }) }),
      check: (ctx) => anyStage(ctx.history, (h) => h.cmd === 'grep' && !h.error && h.output.includes('ERROR')),
    },
    {
      id: 'reto-chmod',
      tier: 'medio',
      objective: 'Da permisos de solo lectura para el propietario (400) al archivo "clave.pem".',
      solution: 'chmod 400 clave.pem',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({ 'clave.pem': file('-----CLAVE-----', 'rw-r--r--') }) }) }),
      check: (ctx) => {
        const node = ctx.vfs.getNode(['home', 'jugador', 'clave.pem']);
        return !!node && node.perms === 'r--------';
      },
    },
    {
      id: 'reto-find',
      tier: 'medio',
      objective: 'Encuentra todos los archivos ".conf" dentro de "/etc".',
      solution: 'find /etc -name "*.conf"',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({
        home: dir({ jugador: dir({}) }),
        etc: dir({ 'red.conf': file('modo=dhcp'), 'app.conf': file('puerto=8080'), hostname: file('servidor') }),
      }),
      check: (ctx) => anyStage(ctx.history, (h) => h.cmd === 'find' && !h.error && h.output.includes('.conf')),
    },
    {
      id: 'reto-chown',
      tier: 'medio',
      objective: 'Cambia el propietario de "datos.csv" a "marta" (necesitas sudo).',
      solution: 'sudo chown marta datos.csv',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({ 'datos.csv': file('id,valor\n1,10', 'rw-r--r--', 'jugador') }) }) }),
      check: (ctx) => {
        const node = ctx.vfs.getNode(['home', 'jugador', 'datos.csv']);
        return !!node && node.owner === 'marta';
      },
    },
    {
      id: 'reto-ps',
      tier: 'medio',
      objective: 'El servidor va lento: revisa la tabla de procesos activos.',
      solution: 'ps',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({}) }) }),
      createProcesses: () => [
        { pid: 812, user: 'root', cpu: '0.0', mem: '0.1', cmd: 'systemd' },
        { pid: 1102, user: 'jugador', cpu: '88.1', mem: '9.4', cmd: 'indexador.sh' },
      ],
      check: (ctx) => usedCmd(ctx.history, 'ps'),
    },
    {
      id: 'reto-tar',
      tier: 'medio',
      objective: 'Comprime la carpeta "logs" en "logs.tar.gz".',
      solution: 'tar -czf logs.tar.gz logs/',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({ logs: dir({ 'app.log': file('log 1') }) }) }) }),
      check: (ctx) => {
        const node = ctx.vfs.getNode(['home', 'jugador', 'logs.tar.gz']);
        return !!node && node.type === 'file';
      },
    },
    {
      id: 'reto-append',
      tier: 'medio',
      objective: 'Añade la línea "backup ok" al final de "estado.txt" sin borrar lo que ya tiene, usando ">>".',
      solution: 'echo "backup ok" >> estado.txt',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({ 'estado.txt': file('inicio: correcto\n') }) }) }),
      check: (ctx) => {
        const node = ctx.vfs.getNode(['home', 'jugador', 'estado.txt']);
        return !!node && node.content.includes('inicio: correcto') && node.content.includes('backup ok');
      },
    },

    // --- Difíciles ---
    {
      id: 'reto-cut',
      tier: 'dificil',
      objective: 'Extrae solo la primera columna (separada por ":") de "/etc/passwd".',
      solution: 'cut -d: -f1 /etc/passwd',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({
        home: dir({ jugador: dir({}) }),
        etc: dir({ passwd: file('root:x:0:0:root:/root:/bin/bash\njugador:x:1000:1000::/home/jugador:/bin/bash\n') }),
      }),
      check: (ctx) => anyStage(ctx.history, (h) => h.cmd === 'cut' && !h.error && h.output.includes('root') && !h.output.includes(':x:')),
    },
    {
      id: 'reto-sed',
      tier: 'dificil',
      objective: 'Sustituye "dev" por "prod" dentro de "config.yml" (edición en el propio archivo).',
      solution: "sed -i 's/dev/prod/' config.yml",
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({ 'config.yml': file('entorno: dev\n') }) }) }),
      check: (ctx) => {
        const node = ctx.vfs.getNode(['home', 'jugador', 'config.yml']);
        return !!node && node.content.includes('prod') && !node.content.includes('dev');
      },
    },
    {
      id: 'reto-symlink',
      tier: 'dificil',
      objective: 'Crea un enlace simbólico llamado "actual" que apunte a la carpeta "v2".',
      solution: 'ln -s v2 actual',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({ v2: dir({ 'app.bin': file('binario') }) }) }) }),
      check: (ctx) => {
        const node = ctx.vfs.getNodeNoFollow(['home', 'jugador', 'actual']);
        return !!node && node.type === 'symlink' && node.target === 'v2';
      },
    },
    {
      id: 'reto-apt',
      tier: 'dificil',
      objective: 'Instala el paquete "rsync" con privilegios de administrador.',
      solution: 'sudo apt install rsync',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({}) }) }),
      createPackages: () => ({ installed: [], available: [{ name: 'rsync', version: '3.2', description: 'sincronización de archivos' }] }),
      check: (ctx) => ctx.packages.installed.includes('rsync'),
    },
    {
      id: 'reto-awk',
      tier: 'dificil',
      objective: 'Con awk, muestra solo la primera columna de "empleados.csv" (separado por comas).',
      solution: "awk -F, '{print $1}' empleados.csv",
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({
        'empleados.csv': file('nombre,puesto\nana,dev\ncarlos,soporte\n'),
      }) }) }),
      check: (ctx) => anyStage(ctx.history, (h) => h.cmd === 'awk' && !h.error && h.output.includes('ana') && !h.output.includes('dev')),
    },
    {
      id: 'reto-lsof',
      tier: 'dificil',
      objective: 'Comprueba qué proceso tiene abierto el archivo "/var/run/app.sock".',
      solution: 'lsof /var/run/app.sock',
      startCwd: ['home', 'jugador'],
      createFs: () => dir({ home: dir({ jugador: dir({}) }), var: dir({ run: dir({ 'app.sock': file('') }) }) }),
      createOpenFiles: () => [{ path: '/var/run/app.sock', pid: 2210, cmd: 'app-server', user: 'jugador' }],
      check: (ctx) => anyStage(ctx.history, (h) => h.cmd === 'lsof' && !h.error && h.output.includes('app-server')),
    },
  ];

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  TA.CHALLENGES = CHALLENGES;
  TA.CHALLENGE_TIERS = TIER_CONFIG;
  TA.shuffleChallenges = shuffle;
})();
