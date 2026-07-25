// Intérprete de comandos de Windows (CMD y PowerShell) para Terminal Academy.
window.TA = window.TA || {};

(function () {
  function ok(output, extra) {
    return { ok: true, output, ...(extra || {}) };
  }

  function fail(output, explain) {
    return { ok: false, output, explain };
  }

  // Igual que en el intérprete de Linux: cada token es { parts: [{ text, quote }, ...] },
  // y trozos con y sin comillas pegados sin espacio forman una sola palabra.
  function tokenize(line) {
    const tokens = [];
    let current = null;
    const flush = () => {
      if (current) {
        tokens.push(current);
        current = null;
      }
    };
    let i = 0;
    const n = line.length;
    while (i < n) {
      const c = line[i];
      if (c === ' ' || c === '\t') {
        flush();
        i++;
        continue;
      }
      if (c === '"' || c === "'") {
        const quoteChar = c;
        let j = i + 1;
        let buf = '';
        while (j < n && line[j] !== quoteChar) {
          buf += line[j];
          j++;
        }
        if (!current) current = { parts: [] };
        current.parts.push({ text: buf, quote: quoteChar === "'" ? 'single' : 'double' });
        i = j + 1;
        continue;
      }
      if (c === '|') {
        flush();
        tokens.push({ parts: [{ text: '|', quote: null }] });
        i++;
        continue;
      }
      if (c === '>') {
        flush();
        if (line[i + 1] === '>') {
          tokens.push({ parts: [{ text: '>>', quote: null }] });
          i += 2;
        } else {
          tokens.push({ parts: [{ text: '>', quote: null }] });
          i++;
        }
        continue;
      }
      let j = i;
      let buf = '';
      while (j < n && !' \t|>"\''.includes(line[j])) {
        buf += line[j];
        j++;
      }
      if (!current) current = { parts: [] };
      current.parts.push({ text: buf, quote: null });
      i = j;
    }
    flush();
    return tokens;
  }

  function bareText(tok) {
    return tok.parts.length === 1 && tok.parts[0].quote === null ? tok.parts[0].text : null;
  }

  function expandVars(text, ctx) {
    if (ctx.flavor === 'cmd') {
      return text.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (m, name) => (ctx.env[name] !== undefined ? ctx.env[name] : m));
    }
    return text.replace(/\$env:([A-Za-z_][A-Za-z0-9_]*)/g, (m, name) => (ctx.env[name] !== undefined ? ctx.env[name] : ''));
  }

  function resolveToken(tok, ctx) {
    return tok.parts.map((p) => (p.quote === 'single' ? p.text : expandVars(p.text, ctx))).join('');
  }

  function resolvePathArg(pathArg, ctx) {
    return ctx.vfs.normalize(pathArg, ctx.getCwd());
  }

  function actualKey(parent, name) {
    return TA.winHelpers.findChildCI(parent, name) || name;
  }

  function formatListingCmd(dirNode, showHidden) {
    const names = Object.keys(dirNode.children).sort();
    const rows = [];
    for (const name of names) {
      const child = dirNode.children[name];
      if (child.attrs.hidden && !showHidden) continue;
      if (child.type === 'dir') rows.push(`25/07/2026  10:00    <DIR>          ${name}`);
      else rows.push(`25/07/2026  10:00    ${String(child.content.length).padStart(14)} ${name}`);
    }
    return rows.join('\n');
  }

  function formatListingPs(dirNode, showHidden) {
    const names = Object.keys(dirNode.children).sort();
    const rows = [];
    for (const name of names) {
      const child = dirNode.children[name];
      if (child.attrs.hidden && !showHidden) continue;
      const mode = child.type === 'dir' ? 'd-----' : (child.attrs.readonly ? '-ar---' : '-a----');
      const len = child.type === 'dir' ? '' : String(child.content.length);
      rows.push(`${mode}         25/07/2026     10:00 ${len.padStart(10)} ${name}`);
    }
    return rows.join('\n');
  }

  function writeRedirect(redirect, content, ctx) {
    const pathArr = resolvePathArg(redirect.target, ctx);
    const parent = ctx.vfs.getParent(pathArr);
    if (!parent) return;
    const name = pathArr[pathArr.length - 1];
    const key = actualKey(parent, name);
    const existing = parent.children[key];
    if (redirect.mode === '>>' && existing && existing.type === 'file') {
      existing.content += (existing.content && !existing.content.endsWith('\n') ? '\n' : '') + content;
    } else {
      parent.children[name] = TA.winHelpers.file(content);
    }
  }

  // --- Comandos de CMD (símbolo del sistema) ---

  const CMD_COMMANDS = {
    dir(args, stdin, ctx) {
      const showHidden = args.some((a) => /^\/a$/i.test(a));
      const pathArg = args.find((a) => !a.startsWith('/'));
      const pathArr = pathArg ? resolvePathArg(pathArg, ctx) : ctx.getCwd();
      const node = ctx.vfs.getNode(pathArr);
      if (!node || node.type !== 'dir') {
        return fail('El sistema no puede encontrar la ruta especificada.', `No existe la carpeta "${pathArg}" aquí. Comprueba el nombre con "dir".`);
      }
      const header = ` Directorio de ${ctx.vfs.pathToStr(pathArr)}\n`;
      const listing = formatListingCmd(node, showHidden);
      return ok(header + (listing || '(carpeta vacía)'));
    },

    cd(args, stdin, ctx) {
      if (args.length === 0) return ok(ctx.vfs.pathToStr(ctx.getCwd()));
      const arg = args[0];
      if (arg === '\\') {
        ctx.setCwd([]);
        return ok('');
      }
      if (arg === '..') {
        const cur = ctx.getCwd();
        if (cur.length > 0) ctx.setCwd(cur.slice(0, -1));
        return ok('');
      }
      const pathArr = resolvePathArg(arg, ctx);
      const node = ctx.vfs.getNode(pathArr);
      if (!node) return fail('El sistema no puede encontrar la ruta especificada.', `No existe la carpeta "${arg}" aquí. Usa "dir" para ver qué hay disponible.`);
      if (node.type !== 'dir') return fail('El directorio no es válido.', `"${arg}" es un archivo, no una carpeta; no puedes entrar en él con cd.`);
      ctx.setCwd(pathArr);
      return ok('');
    },

    cls() {
      return ok('', { clear: true });
    },

    copy(args, stdin, ctx) {
      const [src, dest] = args;
      if (!src || !dest) return fail('Falta un archivo.', 'Uso: copy origen destino, por ejemplo: copy notas.txt copia.txt');
      const srcPath = resolvePathArg(src, ctx);
      const srcNode = ctx.vfs.getNode(srcPath);
      if (!srcNode || srcNode.type !== 'file') return fail('No se puede copiar el archivo especificado.', `No existe el archivo "${src}" aquí. Comprueba el nombre con "dir".`);
      const destPath = resolvePathArg(dest, ctx);
      const destParent = ctx.vfs.getParent(destPath);
      if (!destParent) return fail('Ruta de destino no válida.', 'La carpeta de destino no existe.');
      destParent.children[destPath[destPath.length - 1]] = JSON.parse(JSON.stringify(srcNode));
      return ok('        1 archivo(s) copiado(s).');
    },

    del(args, stdin, ctx) {
      const target = args.find((a) => !a.startsWith('/'));
      if (!target) return fail('Falta el nombre de archivo.', 'Uso: del archivo.txt');
      const pathArr = resolvePathArg(target, ctx);
      const node = ctx.vfs.getNode(pathArr);
      if (!node) return fail('No se encuentra el archivo especificado.', `No existe "${target}" aquí.`);
      if (node.type === 'dir') return fail('El acceso es denegado.', 'del solo borra archivos; usa rmdir para carpetas.');
      if (node.attrs.readonly) return fail('Acceso denegado.', `"${target}" es de solo lectura. Quita el atributo con: attrib -r ${target}`);
      const parent = ctx.vfs.getParent(pathArr);
      delete parent.children[actualKey(parent, pathArr[pathArr.length - 1])];
      return ok('');
    },

    ren(args, stdin, ctx) {
      const [src, newName] = args;
      if (!src || !newName) return fail('Sintaxis de comando incorrecta.', 'Uso: ren nombreactual nombrenuevo');
      const pathArr = resolvePathArg(src, ctx);
      const node = ctx.vfs.getNode(pathArr);
      if (!node) return fail('No se encuentra el archivo especificado.', `No existe "${src}" aquí.`);
      const parent = ctx.vfs.getParent(pathArr);
      const key = actualKey(parent, pathArr[pathArr.length - 1]);
      delete parent.children[key];
      parent.children[newName] = node;
      return ok('');
    },

    move(args, stdin, ctx) {
      const [src, dest] = args;
      if (!src || !dest) return fail('Falta un parámetro.', 'Uso: move origen destino');
      const srcPath = resolvePathArg(src, ctx);
      const srcNode = ctx.vfs.getNode(srcPath);
      if (!srcNode) return fail('No se puede encontrar el archivo especificado.', `No existe "${src}" aquí.`);
      let destPath = resolvePathArg(dest, ctx);
      const destNode = ctx.vfs.getNode(destPath);
      if (destNode && destNode.type === 'dir') destPath = [...destPath, srcPath[srcPath.length - 1]];
      const destParent = ctx.vfs.getParent(destPath);
      if (!destParent) return fail('No se puede encontrar la ruta especificada.', 'La carpeta de destino no existe.');
      const srcParent = ctx.vfs.getParent(srcPath);
      delete srcParent.children[actualKey(srcParent, srcPath[srcPath.length - 1])];
      destParent.children[destPath[destPath.length - 1]] = srcNode;
      return ok('        1 archivo(s) movido(s).');
    },

    mkdir(args, stdin, ctx) {
      const target = args[0];
      if (!target) return fail('Falta el nombre de la carpeta.', 'Uso: mkdir nombre');
      const pathArr = resolvePathArg(target, ctx);
      if (ctx.vfs.getNode(pathArr)) return fail('El subdirectorio o archivo ya existe.', `Ya existe algo llamado "${target}" aquí.`);
      const parent = ctx.vfs.getParent(pathArr);
      if (!parent || parent.type !== 'dir') return fail('No se puede encontrar la ruta especificada.', 'La ruta de la carpeta padre no existe.');
      parent.children[pathArr[pathArr.length - 1]] = TA.winHelpers.dir({});
      return ok('');
    },

    rmdir(args, stdin, ctx) {
      const target = args.find((a) => !a.startsWith('/'));
      if (!target) return fail('Falta el nombre de la carpeta.', 'Uso: rmdir nombre');
      const pathArr = resolvePathArg(target, ctx);
      const node = ctx.vfs.getNode(pathArr);
      if (!node || node.type !== 'dir') return fail('No se encuentra el directorio especificado.', `No existe la carpeta "${target}" aquí.`);
      if (Object.keys(node.children).length > 0 && !args.some((a) => /^\/s$/i.test(a))) {
        return fail('El directorio no está vacío.', 'rmdir solo borra carpetas vacías; usa rmdir /s para borrar con contenido.');
      }
      const parent = ctx.vfs.getParent(pathArr);
      delete parent.children[actualKey(parent, pathArr[pathArr.length - 1])];
      return ok('');
    },

    type(args, stdin, ctx) {
      const target = args[0];
      if (!target) return fail('Falta el nombre de archivo.', 'Uso: type archivo.txt');
      const pathArr = resolvePathArg(target, ctx);
      const node = ctx.vfs.getNode(pathArr);
      if (!node || node.type !== 'file') return fail('El sistema no puede encontrar el archivo especificado.', `No existe el archivo "${target}" aquí.`);
      return ok(node.content);
    },

    echo(args) {
      if (args.length === 0) return ok('ECO está activado.');
      return ok(args.join(' '));
    },

    set(args, stdin, ctx) {
      if (args.length === 0) {
        return ok(Object.entries(ctx.env).map(([k, v]) => `${k}=${v}`).join('\n'));
      }
      const spec = args[0];
      const eq = spec.indexOf('=');
      if (eq === -1) {
        const val = ctx.env[spec];
        return val !== undefined ? ok(`${spec}=${val}`) : fail(`El sistema no encontró la variable de entorno "${spec}".`, '');
      }
      ctx.env[spec.slice(0, eq)] = spec.slice(eq + 1);
      return ok('');
    },

    findstr(args, stdin, ctx) {
      const pattern = args.find((a) => !a.startsWith('/'));
      if (!pattern) return fail('Falta la cadena de búsqueda.', 'Uso: findstr texto archivo.txt');
      const fileArg = args[args.indexOf(pattern) + 1];
      let text = stdin;
      if (fileArg) {
        const pathArr = resolvePathArg(fileArg, ctx);
        const node = ctx.vfs.getNode(pathArr);
        if (!node || node.type !== 'file') return fail('No se puede abrir el archivo de entrada.', `No existe "${fileArg}" aquí.`);
        text = node.content;
      }
      const lines = (text || '').split('\n').filter((l) => l.toLowerCase().includes(pattern.toLowerCase()));
      return ok(lines.join('\n'));
    },

    tree(args, stdin, ctx) {
      const pathArr = ctx.getCwd();
      const node = ctx.vfs.getNode(pathArr);
      const lines = [ctx.vfs.pathToStr(pathArr)];
      const walk = (n, prefix) => {
        const names = Object.keys(n.children).filter((k) => n.children[k].type === 'dir').sort();
        names.forEach((name, i) => {
          const last = i === names.length - 1;
          lines.push(`${prefix}${last ? '└───' : '├───'}${name}`);
          walk(n.children[name], prefix + (last ? '    ' : '│   '));
        });
      };
      walk(node, '');
      return ok(lines.join('\n'));
    },

    attrib(args, stdin, ctx) {
      const flagArgs = args.filter((a) => /^[+-][hr]$/i.test(a));
      const target = args.find((a) => !/^[+-][hr]$/i.test(a));
      if (!target) return fail('Uso incorrecto.', 'Uso: attrib +h archivo.txt (oculta) o attrib -h archivo.txt (muestra)');
      const pathArr = resolvePathArg(target, ctx);
      const node = ctx.vfs.getNode(pathArr);
      if (!node) return fail('No se encuentra el archivo especificado.', `No existe "${target}" aquí.`);
      for (const f of flagArgs) {
        const sign = f[0];
        const letter = f[1].toLowerCase();
        node.attrs[letter === 'h' ? 'hidden' : 'readonly'] = sign === '+';
      }
      return ok('');
    },

    tasklist(args, stdin, ctx) {
      const rows = (ctx.processes || []).filter((p) => !p.killed).map((p) => `${p.name.padEnd(28)} ${String(p.pid).padStart(6)} Console`);
      return ok(['Nombre de imagen              PID   Sesión', ...rows].join('\n'));
    },

    taskkill(args, stdin, ctx) {
      const pidIdx = args.findIndex((a) => /^\/pid$/i.test(a));
      const pid = pidIdx !== -1 ? Number(args[pidIdx + 1]) : null;
      if (!pid) return fail('Falta el parámetro /PID.', 'Uso: taskkill /PID 1234 /F');
      const proc = (ctx.processes || []).find((p) => p.pid === pid);
      if (!proc) return fail(`ERROR: no se encontró el proceso "${pid}".`, 'Comprueba el PID con tasklist.');
      proc.killed = true;
      return ok(`Correcto: se terminó el proceso con PID ${pid}.`);
    },

    ipconfig(args, stdin, ctx) {
      const net = ctx.network && ctx.network.ip ? ctx.network : { ip: '192.168.1.50', mask: '255.255.255.0', gateway: '192.168.1.1' };
      return ok([
        'Adaptador de Ethernet Ethernet:',
        `   Dirección IPv4. . . . . . . . . : ${net.ip}`,
        `   Máscara de subred . . . . . . . : ${net.mask}`,
        `   Puerta de enlace predeterminada : ${net.gateway}`,
      ].join('\n'));
    },

    ping(args, stdin, ctx) {
      const host = args.find((a) => !a.startsWith('/'));
      if (!host) return fail('Uso incorrecto.', 'Uso: ping equipo');
      const net = ctx.network || {};
      const reachable = !net.hosts || net.hosts[host] !== false;
      if (!reachable) return fail('Tiempo de espera agotado para esta solicitud.', `"${host}" no responde en esta simulación (host caído).`);
      return ok([
        `Haciendo ping a ${host} con 32 bytes de datos:`,
        'Respuesta desde: bytes=32 tiempo=1ms TTL=64',
        'Respuesta desde: bytes=32 tiempo=1ms TTL=64',
        '',
        `Estadísticas de ping para ${host}: Paquetes: enviados = 2, recibidos = 2, perdidos = 0 (0% perdidos)`,
      ].join('\n'));
    },

    whoami() {
      return ok('academia\\jugador');
    },

    hostname() {
      return ok('ACADEMIA-PC');
    },

    ver() {
      return ok('Microsoft Windows [Versión 10.0.19045]');
    },

    help() {
      return ok('Comandos disponibles:\n' + Object.keys(CMD_COMMANDS).sort().join('  '));
    },
  };

  // --- Comandos de PowerShell (cmdlets + alias reales) ---

  const psImpl = {
    getChildItem(args, stdin, ctx) {
      const showHidden = args.some((a) => /^-Force$/i.test(a));
      const pathArg = args.find((a) => !a.startsWith('-'));
      const pathArr = pathArg ? resolvePathArg(pathArg, ctx) : ctx.getCwd();
      const node = ctx.vfs.getNode(pathArr);
      if (!node || node.type !== 'dir') {
        return fail('No se encuentra el elemento en la ruta especificada.', `No existe la carpeta "${pathArg}" aquí. Comprueba el nombre con Get-ChildItem.`);
      }
      const header = `\n    Directorio: ${ctx.vfs.pathToStr(pathArr)}\n\nMode                 LastWriteTime         Length Name\n----                 -------------         ------ ----\n`;
      const listing = formatListingPs(node, showHidden);
      return ok(header + listing);
    },

    setLocation(args, stdin, ctx) {
      if (args.length === 0) {
        ctx.setCwd(['Users', 'jugador']);
        return ok('');
      }
      const arg = args[0];
      if (arg === '..') {
        const cur = ctx.getCwd();
        if (cur.length > 0) ctx.setCwd(cur.slice(0, -1));
        return ok('');
      }
      const pathArr = resolvePathArg(arg, ctx);
      const node = ctx.vfs.getNode(pathArr);
      if (!node) return fail('No se encuentra la ruta porque no existe.', `No existe la carpeta "${arg}" aquí. Usa Get-ChildItem para ver qué hay disponible.`);
      if (node.type !== 'dir') return fail('No se puede llamar a un método en una expresión con valor NULL.', `"${arg}" es un archivo, no una carpeta.`);
      ctx.setCwd(pathArr);
      return ok('');
    },

    getLocation(args, stdin, ctx) {
      return ok(ctx.vfs.pathToStr(ctx.getCwd()));
    },

    getContent(args, stdin, ctx) {
      const target = args.find((a) => !a.startsWith('-'));
      if (!target) return fail('No se especificó ninguna ruta.', 'Uso: Get-Content archivo.txt');
      const pathArr = resolvePathArg(target, ctx);
      const node = ctx.vfs.getNode(pathArr);
      if (!node || node.type !== 'file') return fail('No se encuentra la ruta especificada.', `No existe el archivo "${target}" aquí.`);
      return ok(node.content);
    },

    copyItem(args, stdin, ctx) {
      const positional = args.filter((a) => !a.startsWith('-'));
      const [src, dest] = positional;
      if (!src || !dest) return fail('No se especificó la ruta de destino.', 'Uso: Copy-Item origen destino');
      const srcPath = resolvePathArg(src, ctx);
      const srcNode = ctx.vfs.getNode(srcPath);
      if (!srcNode) return fail('No se encuentra la ruta de origen.', `No existe "${src}" aquí.`);
      let destPath = resolvePathArg(dest, ctx);
      const destExisting = ctx.vfs.getNode(destPath);
      if (destExisting && destExisting.type === 'dir') destPath = [...destPath, srcPath[srcPath.length - 1]];
      const destParent = ctx.vfs.getParent(destPath);
      if (!destParent) return fail('No se encuentra la ruta de destino.', 'La carpeta de destino no existe.');
      destParent.children[destPath[destPath.length - 1]] = JSON.parse(JSON.stringify(srcNode));
      return ok('');
    },

    moveItem(args, stdin, ctx) {
      const positional = args.filter((a) => !a.startsWith('-'));
      const [src, dest] = positional;
      if (!src || !dest) return fail('No se especificó la ruta de destino.', 'Uso: Move-Item origen destino');
      const srcPath = resolvePathArg(src, ctx);
      const srcNode = ctx.vfs.getNode(srcPath);
      if (!srcNode) return fail('No se encuentra la ruta de origen.', `No existe "${src}" aquí.`);
      let destPath = resolvePathArg(dest, ctx);
      const destExisting = ctx.vfs.getNode(destPath);
      if (destExisting && destExisting.type === 'dir') destPath = [...destPath, srcPath[srcPath.length - 1]];
      const destParent = ctx.vfs.getParent(destPath);
      if (!destParent) return fail('No se encuentra la ruta de destino.', 'La carpeta de destino no existe.');
      const srcParent = ctx.vfs.getParent(srcPath);
      delete srcParent.children[actualKey(srcParent, srcPath[srcPath.length - 1])];
      destParent.children[destPath[destPath.length - 1]] = srcNode;
      return ok('');
    },

    removeItem(args, stdin, ctx) {
      const target = args.find((a) => !a.startsWith('-'));
      if (!target) return fail('No se especificó ninguna ruta.', 'Uso: Remove-Item archivo.txt');
      const pathArr = resolvePathArg(target, ctx);
      const node = ctx.vfs.getNode(pathArr);
      if (!node) return fail('No se encuentra la ruta especificada.', `No existe "${target}" aquí.`);
      if (node.type === 'dir' && Object.keys(node.children).length > 0 && !args.some((a) => /^-Recurse$/i.test(a))) {
        return fail('No se puede quitar el elemento: hay elementos secundarios.', 'La carpeta no está vacía; usa Remove-Item -Recurse para borrarla con contenido.');
      }
      const parent = ctx.vfs.getParent(pathArr);
      delete parent.children[actualKey(parent, pathArr[pathArr.length - 1])];
      return ok('');
    },

    renameItem(args, stdin, ctx) {
      const positional = args.filter((a) => !a.startsWith('-'));
      const [src, newName] = positional;
      if (!src || !newName) return fail('No se especificó el nuevo nombre.', 'Uso: Rename-Item nombreactual nombrenuevo');
      const pathArr = resolvePathArg(src, ctx);
      const node = ctx.vfs.getNode(pathArr);
      if (!node) return fail('No se encuentra la ruta especificada.', `No existe "${src}" aquí.`);
      const parent = ctx.vfs.getParent(pathArr);
      delete parent.children[actualKey(parent, pathArr[pathArr.length - 1])];
      parent.children[newName] = node;
      return ok('');
    },

    newItem(args, stdin, ctx) {
      let itemType = 'file';
      let name = null;
      for (let i = 0; i < args.length; i++) {
        if (/^-ItemType$/i.test(args[i])) {
          itemType = (args[i + 1] || 'file').toLowerCase();
          i++;
        } else if (/^-(Path|Name)$/i.test(args[i])) {
          name = args[i + 1];
          i++;
        } else if (!args[i].startsWith('-') && !name) {
          name = args[i];
        }
      }
      if (!name) return fail('No se especificó ningún nombre.', 'Uso: New-Item -Path nombre -ItemType File');
      const pathArr = resolvePathArg(name, ctx);
      if (ctx.vfs.getNode(pathArr)) return fail('El elemento ya existe en la ruta especificada.', `Ya existe algo llamado "${name}" aquí.`);
      const parent = ctx.vfs.getParent(pathArr);
      if (!parent) return fail('No se encuentra la ruta especificada.', 'La carpeta padre no existe.');
      const leaf = pathArr[pathArr.length - 1];
      parent.children[leaf] = itemType === 'directory' || itemType === 'dir'
        ? TA.winHelpers.dir({})
        : TA.winHelpers.file('');
      return ok('');
    },

    mkdir(args, stdin, ctx) {
      const name = args.find((a) => !a.startsWith('-'));
      if (!name) return fail('Falta el nombre.', 'Uso: mkdir nombre');
      const pathArr = resolvePathArg(name, ctx);
      if (ctx.vfs.getNode(pathArr)) return fail('El elemento ya existe en la ruta especificada.', `Ya existe algo llamado "${name}" aquí.`);
      const parent = ctx.vfs.getParent(pathArr);
      if (!parent) return fail('No se encuentra la ruta especificada.', 'La carpeta padre no existe.');
      parent.children[pathArr[pathArr.length - 1]] = TA.winHelpers.dir({});
      return ok('');
    },

    selectString(args, stdin, ctx) {
      const positional = args.filter((a) => !a.startsWith('-'));
      const patIdx = args.findIndex((a) => /^-Pattern$/i.test(a));
      const pathIdx = args.findIndex((a) => /^-Path$/i.test(a));
      let pattern = patIdx !== -1 ? args[patIdx + 1] : null;
      let fileArg = pathIdx !== -1 ? args[pathIdx + 1] : null;
      if (!pattern) pattern = positional[positional.length - 1];
      if (!fileArg && positional.length > 1) fileArg = positional[0];
      if (!pattern) return fail('No se especificó ningún patrón.', 'Uso: Select-String texto (con una tubería) o Select-String -Path archivo -Pattern texto');
      let text = stdin;
      if (fileArg) {
        const pathArr = resolvePathArg(fileArg, ctx);
        const node = ctx.vfs.getNode(pathArr);
        if (!node || node.type !== 'file') return fail('No se encuentra la ruta especificada.', `No existe "${fileArg}" aquí.`);
        text = node.content;
      }
      const lines = (text || '').split('\n').filter((l) => l.toLowerCase().includes(pattern.toLowerCase()));
      return ok(lines.join('\n'));
    },

    getProcess(args, stdin, ctx) {
      const rows = (ctx.processes || []).filter((p) => !p.killed).map((p) => `    ${String(p.pid).padStart(5)}         ${p.name}`);
      return ok(['Handles      Id ProcessName', '-------      -- -----------', ...rows].join('\n'));
    },

    stopProcess(args, stdin, ctx) {
      const idIdx = args.findIndex((a) => /^-Id$/i.test(a));
      const nameIdx = args.findIndex((a) => /^-Name$/i.test(a));
      const positional = args.filter((a) => !a.startsWith('-'));
      const pid = idIdx !== -1 ? Number(args[idIdx + 1]) : (Number(positional[0]) || null);
      const name = nameIdx !== -1 ? args[nameIdx + 1] : null;
      const proc = (ctx.processes || []).find((p) => (pid && p.pid === pid) || (name && p.name.toLowerCase() === name.toLowerCase()));
      if (!proc) return fail('No se encontró ningún proceso con el nombre o Id especificado.', 'Comprueba el Id o el nombre con Get-Process.');
      proc.killed = true;
      return ok('');
    },

    clearHost() {
      return ok('', { clear: true });
    },

    writeOutput(args) {
      return ok(args.join(' '));
    },

    getHelp() {
      return ok('Cmdlets disponibles:\n' + Object.keys(PS_COMMANDS).sort().join('  '));
    },
  };

  // Nombre canónico del cmdlet para cada alias, usado para registrar el historial
  // de forma consistente aunque el jugador use un alias (pwd, sl, ls...).
  const PS_CANONICAL = {
    'get-childitem': 'get-childitem', dir: 'get-childitem', ls: 'get-childitem', gci: 'get-childitem',
    'set-location': 'set-location', cd: 'set-location', sl: 'set-location',
    'get-location': 'get-location', pwd: 'get-location', gl: 'get-location',
    'get-content': 'get-content', cat: 'get-content', gc: 'get-content', type: 'get-content',
    'copy-item': 'copy-item', cp: 'copy-item', copy: 'copy-item', ci: 'copy-item',
    'move-item': 'move-item', mv: 'move-item', move: 'move-item',
    'remove-item': 'remove-item', rm: 'remove-item', del: 'remove-item', erase: 'remove-item', ri: 'remove-item',
    'rename-item': 'rename-item', ren: 'rename-item', rni: 'rename-item',
    'new-item': 'new-item', ni: 'new-item',
    mkdir: 'mkdir', md: 'mkdir',
    'select-string': 'select-string', sls: 'select-string',
    'get-process': 'get-process', ps: 'get-process', gps: 'get-process',
    'stop-process': 'stop-process', kill: 'stop-process', spps: 'stop-process',
    'clear-host': 'clear-host', cls: 'clear-host', clear: 'clear-host',
    'write-output': 'write-output', echo: 'write-output',
    'get-help': 'get-help', help: 'get-help', man: 'get-help',
  };

  const PS_COMMANDS = {
    'get-childitem': psImpl.getChildItem,
    dir: psImpl.getChildItem,
    ls: psImpl.getChildItem,
    gci: psImpl.getChildItem,
    'set-location': psImpl.setLocation,
    cd: psImpl.setLocation,
    sl: psImpl.setLocation,
    'get-location': psImpl.getLocation,
    pwd: psImpl.getLocation,
    gl: psImpl.getLocation,
    'get-content': psImpl.getContent,
    cat: psImpl.getContent,
    gc: psImpl.getContent,
    type: psImpl.getContent,
    'copy-item': psImpl.copyItem,
    cp: psImpl.copyItem,
    copy: psImpl.copyItem,
    ci: psImpl.copyItem,
    'move-item': psImpl.moveItem,
    mv: psImpl.moveItem,
    move: psImpl.moveItem,
    'remove-item': psImpl.removeItem,
    rm: psImpl.removeItem,
    del: psImpl.removeItem,
    erase: psImpl.removeItem,
    ri: psImpl.removeItem,
    'rename-item': psImpl.renameItem,
    ren: psImpl.renameItem,
    rni: psImpl.renameItem,
    'new-item': psImpl.newItem,
    ni: psImpl.newItem,
    mkdir: psImpl.mkdir,
    md: psImpl.mkdir,
    'select-string': psImpl.selectString,
    sls: psImpl.selectString,
    'get-process': psImpl.getProcess,
    ps: psImpl.getProcess,
    gps: psImpl.getProcess,
    'stop-process': psImpl.stopProcess,
    kill: psImpl.stopProcess,
    spps: psImpl.stopProcess,
    'clear-host': psImpl.clearHost,
    cls: psImpl.clearHost,
    clear: psImpl.clearHost,
    'write-output': psImpl.writeOutput,
    echo: psImpl.writeOutput,
    'get-help': psImpl.getHelp,
    help: psImpl.getHelp,
    man: psImpl.getHelp,
  };

  function runLine(line, ctx) {
    const trimmed = line.trim();
    if (trimmed === '') return { ok: true, output: '', stages: [] };

    if (ctx.flavor === 'powershell') {
      const m = trimmed.match(/^\$env:([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
      if (m) {
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        ctx.env[m[1]] = val;
        return { ok: true, output: '', stages: [{ cmd: '$env', args: [m[1], val], output: '', error: false }] };
      }
    }

    const tokens = tokenize(trimmed);
    const segments = [[]];
    let redirect = null;
    for (let idx = 0; idx < tokens.length; idx++) {
      const raw = bareText(tokens[idx]);
      if (raw === '|') {
        segments.push([]);
        continue;
      }
      if (raw === '>' || raw === '>>') {
        const targetTok = tokens[idx + 1];
        redirect = { mode: raw, target: targetTok ? resolveToken(targetTok, ctx) : '' };
        idx++;
        continue;
      }
      segments[segments.length - 1].push(tokens[idx]);
    }

    const table = ctx.flavor === 'cmd' ? CMD_COMMANDS : PS_COMMANDS;
    let stdin = '';
    const stages = [];
    let lastOutput = '';
    let ok2 = true;
    let explain = '';
    let clearFlag = false;

    for (const seg of segments) {
      if (seg.length === 0) continue;
      const cmdRaw = resolveToken(seg[0], ctx);
      const args = seg.slice(1).map((t) => resolveToken(t, ctx));
      const key = cmdRaw.toLowerCase();
      const fn = table[key];
      let result;
      if (!fn) {
        result = fail(
          ctx.flavor === 'cmd'
            ? `'${cmdRaw}' no se reconoce como un comando interno o externo, programa ejecutable o archivo por lotes.`
            : `${cmdRaw}: no se reconoce el nombre de un cmdlet, función, archivo de script o programa ejecutable.`,
          `"${cmdRaw}" no es un comando disponible en este simulador (o está mal escrito). Escribe "help" para ver la lista.`
        );
      } else {
        result = fn(args, stdin, ctx);
      }
      const historyKey = ctx.flavor === 'powershell' ? (PS_CANONICAL[key] || key) : key;
      stages.push({ cmd: historyKey, args, output: result.output, error: !result.ok });
      if (result.clear) clearFlag = true;
      stdin = result.output;
      lastOutput = result.output;
      if (!result.ok) {
        ok2 = false;
        explain = result.explain;
        break;
      }
    }

    if (ok2 && redirect) {
      writeRedirect(redirect, lastOutput, ctx);
      lastOutput = '';
    }

    return { ok: ok2, output: lastOutput, explain, stages, clear: clearFlag };
  }

  TA.WinShell = { runLine, tokenize, CMD_COMMANDS, PS_COMMANDS };
})();
