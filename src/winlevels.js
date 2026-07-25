// Niveles de Windows (CMD y PowerShell) para Terminal Academy.
window.TA = window.TA || {};

(function () {
  const { file, dir } = TA.winHelpers;

  function baseWinHome(extra = {}) {
    return dir({
      Users: dir({
        jugador: dir({
          'bienvenida.txt': file('Bienvenido a Terminal Academy - Windows.\nAquí practicas CMD y PowerShell, las dos terminales de Windows.'),
          ...extra,
        }),
      }),
    });
  }

  const usedCmd = (history, name) => history.some((h) => h.cmd === name && !h.error);
  const anyStage = (history, pred) => history.some((h) => pred(h));

  const CMD_LEVELS = [
    {
      id: 'win-cmd-1',
      title: 'CMD 1 · Orientación',
      story: 'Abres el Símbolo del sistema (CMD) en un PC con Windows por primera vez. Antes de nada, ubícate.',
      objective: 'Comprueba tu carpeta actual con "cd" (sin argumentos), y lista su contenido con "dir".',
      commands: ['cd', 'dir'],
      hints: [
        'En CMD, "cd" escrito solo (sin nada detrás) muestra la carpeta en la que estás.',
        '"dir" lista los archivos y carpetas del directorio actual.',
      ],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome(),
      check: (ctx) => usedCmd(ctx.history, 'cd') && usedCmd(ctx.history, 'dir'),
    },
    {
      id: 'win-cmd-2',
      title: 'CMD 2 · Moverse por carpetas',
      story: 'Tu carpeta de usuario tiene subcarpetas. Explóralas con cd.',
      objective: 'Entra en "documentos" y en "fotos" usando cd (puedes volver con cd ..).',
      commands: ['cd'],
      hints: [
        'cd documentos entra en la carpeta; cd .. sube un nivel.',
        'cd \\ te lleva a la raíz de la unidad C:.',
      ],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome({
        documentos: dir({ 'notas.txt': file('Lista de la compra:\n- pan\n- leche') }),
        fotos: dir({ 'familia.png': file('[imagen binaria simulada]') }),
      }),
      check: (ctx) => ctx.visited.has('C:\\Users\\jugador\\documentos') && ctx.visited.has('C:\\Users\\jugador\\fotos'),
    },
    {
      id: 'win-cmd-3',
      title: 'CMD 3 · Leer y crear archivos',
      story: 'Aprende a leer y crear archivos de texto desde CMD.',
      objective: 'Lee "bienvenida.txt" con type, crea "nuevo.txt" con echo texto > nuevo.txt, y crea la carpeta "proyectos" con mkdir.',
      commands: ['type', 'echo', 'mkdir'],
      hints: [
        'type bienvenida.txt muestra el contenido de un archivo.',
        'echo hola > nuevo.txt crea un archivo con ese texto dentro.',
        'mkdir proyectos crea una carpeta nueva.',
      ],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome(),
      check: (ctx) => {
        const nuevo = ctx.vfs.getNode(['Users', 'jugador', 'nuevo.txt']);
        const proyectos = ctx.vfs.getNode(['Users', 'jugador', 'proyectos']);
        return !!nuevo && nuevo.type === 'file' && nuevo.content.trim().length > 0
          && !!proyectos && proyectos.type === 'dir';
      },
    },
    {
      id: 'win-cmd-4',
      title: 'CMD 4 · Copiar y mover',
      story: 'Necesitas duplicar un informe y archivarlo en otra carpeta.',
      objective: 'Copia "informe.txt" a "respaldo.txt" con copy, y mueve "respaldo.txt" a la carpeta "documentos" con move.',
      commands: ['copy', 'move'],
      hints: [
        'copy informe.txt respaldo.txt crea una copia con otro nombre.',
        'move respaldo.txt documentos mueve el archivo a esa carpeta.',
      ],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome({ 'informe.txt': file('datos del trimestre'), documentos: dir({}) }),
      check: (ctx) => {
        const doc = ctx.vfs.getNode(['Users', 'jugador', 'documentos', 'respaldo.txt']);
        return !!doc && doc.type === 'file';
      },
    },
    {
      id: 'win-cmd-5',
      title: 'CMD 5 · Eliminar con cuidado',
      story: 'Hay basura acumulada en tu carpeta: un archivo temporal y una carpeta vacía que ya no sirve.',
      objective: 'Borra "temporal.tmp" con del, y elimina la carpeta vacía "vacia" con rmdir.',
      commands: ['del', 'rmdir'],
      hints: [
        'del temporal.tmp borra el archivo.',
        'rmdir vacia borra la carpeta (solo funciona si está vacía).',
      ],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome({ 'temporal.tmp': file('basura'), vacia: dir({}) }),
      check: (ctx) => !ctx.vfs.getNode(['Users', 'jugador', 'temporal.tmp']) && !ctx.vfs.getNode(['Users', 'jugador', 'vacia']),
    },
    {
      id: 'win-cmd-6',
      title: 'CMD 6 · Buscar texto',
      story: 'El servidor generó un archivo de log enorme. Necesitas encontrar los errores.',
      objective: 'Busca la palabra "ERROR" dentro de "app.log" usando findstr.',
      commands: ['findstr'],
      hints: ['findstr ERROR app.log busca esa palabra dentro del archivo.'],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome({ 'app.log': file('INFO arranque ok\nERROR fallo de conexión\nINFO reintentando\n') }),
      check: (ctx) => anyStage(ctx.history, (h) => h.cmd === 'findstr' && !h.error && h.output.includes('ERROR')),
    },
    {
      id: 'win-cmd-7',
      title: 'CMD 7 · Árbol y atributos',
      story: 'Antes de compartir esta carpeta con el equipo, revisa su estructura y protege un archivo sensible.',
      objective: 'Muestra la estructura de carpetas con tree, y oculta "secreto.txt" con attrib +h.',
      commands: ['tree', 'attrib'],
      hints: [
        'tree muestra las subcarpetas en forma de árbol.',
        'attrib +h secreto.txt le pone el atributo de "oculto".',
      ],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome({
        proyectos: dir({ backend: dir({}), frontend: dir({}) }),
        'secreto.txt': file('clave-maestra'),
      }),
      check: (ctx) => {
        const node = ctx.vfs.getNode(['Users', 'jugador', 'secreto.txt']);
        return usedCmd(ctx.history, 'tree') && !!node && node.attrs.hidden === true;
      },
    },
    {
      id: 'win-cmd-8',
      title: 'CMD 8 · Procesos',
      story: 'El equipo va lento. Un proceso llamado backup.exe se ha quedado colgado.',
      objective: 'Consulta los procesos con tasklist, y termina backup.exe (PID 1200) con taskkill /PID 1200 /F.',
      commands: ['tasklist', 'taskkill'],
      hints: [
        'tasklist lista los procesos en ejecución con su PID.',
        'taskkill /PID 1200 /F fuerza el cierre del proceso con ese PID.',
      ],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome(),
      createProcesses: () => [
        { pid: 900, name: 'explorer.exe' },
        { pid: 1200, name: 'backup.exe' },
      ],
      check: (ctx) => {
        const proc = ctx.processes.find((p) => p.pid === 1200);
        return !!proc && proc.killed === true && usedCmd(ctx.history, 'tasklist');
      },
    },
    {
      id: 'win-cmd-9',
      title: 'CMD 9 · Red',
      story: 'No sabes si tienes conexión con el servidor de la aplicación. Comprueba tu red.',
      objective: 'Consulta tu configuración de red con ipconfig, y comprueba la conectividad con "servidor-app" usando ping.',
      commands: ['ipconfig', 'ping'],
      hints: [
        'ipconfig muestra tu dirección IP y puerta de enlace.',
        'ping servidor-app comprueba si ese equipo responde.',
      ],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome(),
      createNetwork: () => ({ ip: '192.168.1.50', mask: '255.255.255.0', gateway: '192.168.1.1', hosts: { 'servidor-app': true, 'servidor-caido': false } }),
      check: (ctx) => usedCmd(ctx.history, 'ipconfig')
        && anyStage(ctx.history, (h) => h.cmd === 'ping' && !h.error && h.args.includes('servidor-app')),
    },
  ];

  const PS_LEVELS = [
    {
      id: 'win-ps-1',
      title: 'PowerShell 1 · Orientación',
      story: 'PowerShell es la terminal moderna de Windows: sus comandos se llaman "cmdlets" y siguen el patrón Verbo-Sustantivo.',
      objective: 'Comprueba tu ubicación con Get-Location (alias: pwd), y lista el contenido con Get-ChildItem (alias: dir o ls).',
      commands: ['Get-Location', 'Get-ChildItem'],
      hints: [
        'Get-Location (o su alias "pwd") muestra la ruta actual.',
        'Get-ChildItem (o "dir"/"ls") lista archivos y carpetas.',
      ],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome(),
      check: (ctx) => usedCmd(ctx.history, 'get-location') && usedCmd(ctx.history, 'get-childitem'),
    },
    {
      id: 'win-ps-2',
      title: 'PowerShell 2 · Moverse',
      story: 'Explora las subcarpetas de tu perfil.',
      objective: 'Entra en "documentos" y en "fotos" usando Set-Location (alias: cd).',
      commands: ['Set-Location'],
      hints: ['Set-Location documentos (o "cd documentos") entra en la carpeta; "cd .." sube un nivel.'],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome({
        documentos: dir({ 'notas.txt': file('reunión a las 10:00') }),
        fotos: dir({ 'familia.png': file('[imagen binaria simulada]') }),
      }),
      check: (ctx) => ctx.visited.has('C:\\Users\\jugador\\documentos') && ctx.visited.has('C:\\Users\\jugador\\fotos'),
    },
    {
      id: 'win-ps-3',
      title: 'PowerShell 3 · Leer y crear archivos',
      story: 'Aprende a leer y crear archivos con cmdlets.',
      objective: 'Lee "bienvenida.txt" con Get-Content (alias: cat), y crea un archivo "nuevo.txt" con New-Item.',
      commands: ['Get-Content', 'New-Item'],
      hints: [
        'Get-Content bienvenida.txt (o "cat bienvenida.txt") muestra el contenido.',
        'New-Item nuevo.txt crea un archivo vacío.',
      ],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome(),
      check: (ctx) => {
        const node = ctx.vfs.getNode(['Users', 'jugador', 'nuevo.txt']);
        return !!node && node.type === 'file' && usedCmd(ctx.history, 'get-content');
      },
    },
    {
      id: 'win-ps-4',
      title: 'PowerShell 4 · Carpetas y copias',
      story: 'Vas a montar la estructura de un proyecto nuevo.',
      objective: 'Crea la carpeta "proyectos" con mkdir, y copia "bienvenida.txt" dentro de ella con Copy-Item.',
      commands: ['mkdir', 'Copy-Item'],
      hints: [
        'mkdir proyectos crea la carpeta.',
        'Copy-Item bienvenida.txt proyectos copia el archivo dentro.',
      ],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome(),
      check: (ctx) => {
        const node = ctx.vfs.getNode(['Users', 'jugador', 'proyectos', 'bienvenida.txt']);
        return !!node && node.type === 'file';
      },
    },
    {
      id: 'win-ps-5',
      title: 'PowerShell 5 · Renombrar y eliminar',
      story: 'Toca poner en orden algunos archivos.',
      objective: 'Cambia el nombre de "informe.txt" a "informe_final.txt" con Rename-Item, y elimina "temporal.tmp" con Remove-Item.',
      commands: ['Rename-Item', 'Remove-Item'],
      hints: [
        'Rename-Item informe.txt informe_final.txt cambia el nombre.',
        'Remove-Item temporal.tmp borra el archivo.',
      ],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome({ 'temporal.tmp': file('basura'), 'informe.txt': file('datos del trimestre') }),
      check: (ctx) => {
        const renamed = ctx.vfs.getNode(['Users', 'jugador', 'informe_final.txt']);
        return !!renamed && !ctx.vfs.getNode(['Users', 'jugador', 'temporal.tmp']);
      },
    },
    {
      id: 'win-ps-6',
      title: 'PowerShell 6 · Buscar texto',
      story: 'Necesitas encontrar los errores dentro de un log, esta vez con PowerShell.',
      objective: 'Busca la palabra "ERROR" dentro de "app.log" con Select-String (puedes usar una tubería: Get-Content app.log | Select-String ERROR).',
      commands: ['Select-String'],
      hints: ['Get-Content app.log | Select-String ERROR filtra las líneas que contienen esa palabra.'],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome({ 'app.log': file('INFO arranque ok\nERROR fallo de conexión\nINFO reintentando\n') }),
      check: (ctx) => anyStage(ctx.history, (h) => h.cmd === 'select-string' && !h.error && h.output.includes('ERROR')),
    },
    {
      id: 'win-ps-7',
      title: 'PowerShell 7 · Variables de entorno',
      story: 'Un script necesita saber tu nombre a través de una variable de entorno.',
      objective: 'Define la variable de entorno NOMBRE con tu nombre: $env:NOMBRE="Jugador", y muéstrala con Write-Output "Hola $env:NOMBRE".',
      commands: ['$env:', 'Write-Output'],
      hints: [
        '$env:NOMBRE="Jugador" crea o cambia una variable de entorno.',
        'Write-Output "Hola $env:NOMBRE" (o "echo ...") imprime texto sustituyendo la variable.',
      ],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome(),
      check: (ctx) => ctx.env.NOMBRE === 'Jugador' && anyStage(ctx.history, (h) => h.output && h.output.includes('Hola Jugador')),
    },
    {
      id: 'win-ps-8',
      title: 'PowerShell 8 · Procesos',
      story: 'Un proceso llamado indexador.exe está consumiendo demasiada memoria.',
      objective: 'Consulta los procesos con Get-Process, y termina indexador.exe con Stop-Process -Id 2100.',
      commands: ['Get-Process', 'Stop-Process'],
      hints: [
        'Get-Process (alias: ps) lista los procesos con su Id.',
        'Stop-Process -Id 2100 termina el proceso con ese Id.',
      ],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome(),
      createProcesses: () => [
        { pid: 800, name: 'explorer.exe' },
        { pid: 2100, name: 'indexador.exe' },
      ],
      check: (ctx) => {
        const proc = ctx.processes.find((p) => p.pid === 2100);
        return !!proc && proc.killed === true && usedCmd(ctx.history, 'get-process');
      },
    },
    {
      id: 'win-ps-9',
      title: 'PowerShell 9 · Tuberías',
      story: 'PowerShell brilla combinando cmdlets con tuberías. Encuentra qué servidores están activos.',
      objective: 'Combina Get-Content y Select-String con una tubería para encontrar las líneas que contienen "activo": Get-Content servidores.txt | Select-String activo',
      commands: ['Get-Content', '|', 'Select-String'],
      hints: ['Get-Content servidores.txt | Select-String activo pasa la salida de un cmdlet como entrada del siguiente.'],
      startCwd: ['Users', 'jugador'],
      createFs: () => baseWinHome({ 'servidores.txt': file('web01 activo\napi02 caido\ndb03 activo\n') }),
      check: (ctx) => anyStage(ctx.history, (h) => h.cmd === 'select-string' && !h.error
        && h.output.includes('web01') && h.output.includes('db03') && !h.output.includes('api02')),
    },
  ];

  TA.WIN_LEVELS = { cmd: CMD_LEVELS, powershell: PS_LEVELS };
})();
