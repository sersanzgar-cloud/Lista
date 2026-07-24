// Interprete de comandos Linux (simplificado) para Terminal Academy.
window.TA = window.TA || {};

(function () {
  const { octalToRwx, hasPermission, applyUmask } = TA.vfsHelpers;

  function ok(output) {
    return { output, error: null, explain: null };
  }
  function fail(error, explain) {
    return { output: '', error, explain: explain || null };
  }

  // Cada token es { text, quote } donde quote es 'single' | 'double' | null (sin comillas).
  // Las comillas simples, como en bash real, impiden la expansión de variables ($VAR).
  function tokenize(line) {
    const tokens = [];
    let i = 0;
    const n = line.length;
    while (i < n) {
      const c = line[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '"' || c === "'") {
        const quoteChar = c;
        let j = i + 1;
        let buf = '';
        while (j < n && line[j] !== quoteChar) { buf += line[j]; j++; }
        tokens.push({ text: buf, quote: quoteChar === "'" ? 'single' : 'double' });
        i = j + 1;
        continue;
      }
      if (c === '|') { tokens.push({ text: '|', quote: null }); i++; continue; }
      if (c === '>') {
        if (line[i + 1] === '>') { tokens.push({ text: '>>', quote: null }); i += 2; }
        else { tokens.push({ text: '>', quote: null }); i++; }
        continue;
      }
      let j = i;
      let buf = '';
      while (j < n && !' \t|>"\''.includes(line[j])) { buf += line[j]; j++; }
      tokens.push({ text: buf, quote: null });
      i = j;
    }
    return tokens;
  }

  function sizeOf(node) {
    if (node.type === 'file') return node.content.length;
    return 4096;
  }

  function formatLongEntry(name, node) {
    const typeChar = node.type === 'dir' ? 'd' : '-';
    const size = String(sizeOf(node)).padStart(5, ' ');
    return `${typeChar}${node.perms} 1 ${node.owner} ${node.group} ${size} ${name}${node.type === 'dir' ? '/' : ''}`;
  }

  // Soporta tanto "-d:" (valor pegado) como "-d" ":" (valor separado), como el cut/awk reales.
  function extractFlagValue(args, flag) {
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === flag) return args[i + 1] !== undefined ? args[i + 1] : null;
      if (a.startsWith(flag) && a.length > flag.length) return a.slice(flag.length);
    }
    return null;
  }

  function matchesGlob(name, pattern) {
    const re = new RegExp('^' + pattern.split('*').map(escapeRegex).join('.*') + '$');
    return re.test(name);
  }
  function escapeRegex(s) {
    return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }

  // --- Permisos ---

  const PERM_VERB = { r: 'leer', w: 'escribir en', x: 'entrar en / ejecutar' };

  function permissionDenied(cmd, target, kind) {
    return fail(
      `${cmd}: ${target}: Permiso denegado`,
      `No tienes permiso para ${PERM_VERB[kind]} "${target}" con tu usuario actual (${'jugador'}). Comprueba los permisos con "ls -l", o si de verdad hace falta, antepón "sudo": sudo ${cmd} ${target}`
    );
  }

  function checkPerm(node, kind, ctx, cmd, target) {
    if (ctx.sudo) return null;
    if (hasPermission(node, kind, ctx.currentUser, ctx.userGroups)) return null;
    return permissionDenied(cmd, target, kind);
  }

  // --- Variables de entorno ---

  function expandVars(text, ctx) {
    return text.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)|\$([0-9#@?])/g, (m, braced, bare, special) => {
      const name = braced || bare || special;
      if (name === 'HOME') return '/home/jugador';
      if (name === 'USER') return ctx.currentUser;
      if (name === 'PWD') return ctx.vfs.pathToStr(ctx.getCwd());
      if (Object.prototype.hasOwnProperty.call(ctx.env, name)) return ctx.env[name];
      return '';
    });
  }

  // Resuelve un token tokenizado a su valor final de cadena: expande $VAR salvo si
  // estaba entre comillas simples, igual que en bash real.
  function resolveToken(tok, ctx) {
    return tok.quote === 'single' ? tok.text : expandVars(tok.text, ctx);
  }

  // --- Procesos / trabajos en segundo plano ---

  function nextPid(ctx) {
    const all = [...ctx.processes.map((p) => p.pid), ...ctx.jobs.map((j) => j.pid)];
    return (all.length ? Math.max(...all) : 2000) + 1;
  }

  function formatProcessTable(rows) {
    const header = 'USUARIO      PID  %CPU  %MEM  ORDEN';
    const lines = rows.map((r) => `${r.user.padEnd(12)} ${String(r.pid).padStart(4)}  ${r.cpu.padStart(4)}  ${r.mem.padStart(4)}  ${r.cmd}`);
    return [header, ...lines].join('\n');
  }

  function activeProcessRows(ctx) {
    const proc = ctx.processes.filter((p) => !p.killed).map((p) => ({ user: p.user, pid: p.pid, cpu: p.cpu, mem: p.mem, cmd: p.cmd }));
    const jobs = ctx.jobs.filter((j) => j.status === 'Running').map((j) => ({
      user: ctx.currentUser, pid: j.pid, cpu: '0.1', mem: '0.2', cmd: j.nohup ? `${j.cmd} (nohup)` : j.cmd,
    }));
    return [...proc, ...jobs];
  }

  // --- Ejecución de scripts ---

  // --- Bloques de script: for..in..do..done, if..then..else..fi ---

  function parseScriptBlock(lines, start, stopKeywords) {
    const statements = [];
    let i = start;
    while (i < lines.length) {
      const line = lines[i];
      if (stopKeywords && stopKeywords.includes(line)) {
        return { statements, nextIndex: i, stoppedAt: line };
      }
      const forMatch = line.match(/^for\s+(\w+)\s+in\s+(.+?);\s*do$/);
      if (forMatch) {
        const inner = parseScriptBlock(lines, i + 1, ['done']);
        statements.push({ type: 'for', varName: forMatch[1], itemsRaw: forMatch[2], body: inner.statements });
        i = inner.nextIndex + 1;
        continue;
      }
      const ifMatch = line.match(/^if\s+(.+?);\s*then$/);
      if (ifMatch) {
        const thenPart = parseScriptBlock(lines, i + 1, ['fi', 'else']);
        let elseBody = [];
        let nextIndex = thenPart.nextIndex;
        if (thenPart.stoppedAt === 'else') {
          const elsePart = parseScriptBlock(lines, thenPart.nextIndex + 1, ['fi']);
          elseBody = elsePart.statements;
          nextIndex = elsePart.nextIndex;
        }
        statements.push({ type: 'if', condRaw: ifMatch[1], thenBody: thenPart.statements, elseBody });
        i = nextIndex + 1;
        continue;
      }
      statements.push({ type: 'cmd', line });
      i++;
    }
    return { statements, nextIndex: i, stoppedAt: null };
  }

  function evalCondition(raw, ctx) {
    const expanded = expandVars(raw, ctx).replace(/"/g, '');
    const m = expanded.match(/^\[\s*(.+?)\s*\]$/);
    if (!m) return false;
    const parts = m[1].split(/\s+/).filter(Boolean);
    if (parts.length === 2) {
      const [op, val] = parts;
      if (op === '-f') { const n = ctx.vfs.getNode(ctx.vfs.normalize(val, ctx.getCwd())); return !!n && n.type === 'file'; }
      if (op === '-d') { const n = ctx.vfs.getNode(ctx.vfs.normalize(val, ctx.getCwd())); return !!n && n.type === 'dir'; }
      if (op === '-e') { return !!ctx.vfs.getNode(ctx.vfs.normalize(val, ctx.getCwd())); }
      if (op === '-z') return val === '';
      if (op === '-n') return val !== '';
    }
    if (parts.length === 3) {
      const [a, op, b] = parts;
      switch (op) {
        case '=': return a === b;
        case '!=': return a !== b;
        case '-eq': return Number(a) === Number(b);
        case '-ne': return Number(a) !== Number(b);
        case '-gt': return Number(a) > Number(b);
        case '-lt': return Number(a) < Number(b);
        case '-ge': return Number(a) >= Number(b);
        case '-le': return Number(a) <= Number(b);
        default: return false;
      }
    }
    return false;
  }

  function execScriptStatements(statements, ctx) {
    const out = [];
    for (const stmt of statements) {
      if (stmt.type === 'cmd') {
        const r = runLine(stmt.line, ctx);
        if (r.output) out.push(r.output);
        if (!r.ok) return { ok: false, output: out.join('\n'), failedLine: stmt.line, explain: r.explain };
      } else if (stmt.type === 'for') {
        const items = expandVars(stmt.itemsRaw, ctx).replace(/"/g, '').split(/\s+/).filter(Boolean);
        for (const item of items) {
          ctx.env[stmt.varName] = item;
          const r = execScriptStatements(stmt.body, ctx);
          if (r.output) out.push(r.output);
          if (!r.ok) return { ...r, output: out.join('\n') };
        }
      } else if (stmt.type === 'if') {
        const branch = evalCondition(stmt.condRaw, ctx) ? stmt.thenBody : stmt.elseBody;
        const r = execScriptStatements(branch, ctx);
        if (r.output) out.push(r.output);
        if (!r.ok) return { ...r, output: out.join('\n') };
      }
    }
    return { ok: true, output: out.join('\n') };
  }

  function runScriptFile(scriptRaw, scriptArgs, ctx, requireExec) {
    const p = ctx.vfs.normalize(scriptRaw, ctx.getCwd());
    const node = ctx.vfs.getNode(p);
    if (!node) {
      return fail(`bash: ${scriptRaw}: No existe el archivo o directorio`, `No existe ningún archivo llamado "${scriptRaw}" aquí. Comprueba el nombre con "ls".`);
    }
    if (node.type === 'dir') {
      return fail(`bash: ${scriptRaw}: Es un directorio`, `"${scriptRaw}" es una carpeta, no se puede ejecutar como script.`);
    }
    if (requireExec) {
      const denied = checkPerm(node, 'x', ctx, 'bash', scriptRaw);
      if (denied) {
        return fail(
          `bash: ${scriptRaw}: Permiso denegado`,
          `Para ejecutar un script directamente con "./${scriptRaw.replace(/^\.\//, '')}" necesitas permiso de ejecución. Dáselo con: chmod +x ${scriptRaw}`
        );
      }
    } else {
      const denied = checkPerm(node, 'r', ctx, 'bash', scriptRaw);
      if (denied) return denied;
    }
    const lines = node.content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));

    const prevPositional = {};
    const positionalKeys = ['0', '#', '@', ...scriptArgs.map((_, i) => String(i + 1))];
    for (const k of positionalKeys) prevPositional[k] = ctx.env[k];
    ctx.env['0'] = scriptRaw;
    scriptArgs.forEach((a, i) => { ctx.env[String(i + 1)] = a; });
    ctx.env['#'] = String(scriptArgs.length);
    ctx.env['@'] = scriptArgs.join(' ');

    const { statements } = parseScriptBlock(lines, 0, null);
    const result = execScriptStatements(statements, ctx);

    for (const k of positionalKeys) {
      if (prevPositional[k] === undefined) delete ctx.env[k];
      else ctx.env[k] = prevPositional[k];
    }

    if (!result.ok) {
      return fail(result.output, `El script falló en la línea "${result.failedLine}". ${result.explain || ''}`.trim());
    }
    return ok(result.output);
  }

  function readFileArg(ctx, fileRaw, cmdName) {
    const p = ctx.vfs.normalize(fileRaw, ctx.getCwd());
    const node = ctx.vfs.getNode(p);
    if (!node) {
      return { error: fail(`${cmdName}: ${fileRaw}: No existe el archivo o directorio`, `No existe ningún archivo llamado "${fileRaw}" aquí. Comprueba el nombre con "ls".`) };
    }
    if (node.type === 'dir') {
      return { error: fail(`${cmdName}: ${fileRaw}: Es un directorio`, `"${fileRaw}" es una carpeta, no un archivo. Indica un archivo concreto.`) };
    }
    const denied = checkPerm(node, 'r', ctx, cmdName, fileRaw);
    if (denied) return { error: denied };
    return { node };
  }

  // Busca el repositorio git más cercano subiendo desde el directorio actual.
  function findGitRepo(ctx) {
    const cwd = ctx.getCwd();
    for (let i = cwd.length; i >= 0; i--) {
      const node = ctx.vfs.getNode(cwd.slice(0, i));
      if (node && node.gitRepo) return { node, path: cwd.slice(0, i) };
    }
    return null;
  }

  // --- Comandos ---

  const COMMANDS = {
    pwd(args, stdin, ctx) {
      return ok(ctx.vfs.pathToStr(ctx.getCwd()));
    },

    ls(args, stdin, ctx) {
      const flags = args.filter((a) => a.startsWith('-')).join('');
      const showAll = flags.includes('a');
      const long = flags.includes('l');
      const targets = args.filter((a) => !a.startsWith('-'));
      const targetRaw = targets[0] || '.';
      const pathArr = ctx.vfs.normalize(targetRaw, ctx.getCwd());
      const node = ctx.vfs.getNode(pathArr);
      if (!node) {
        return fail(
          `ls: no se puede acceder a '${targetRaw}': No existe el archivo o directorio`,
          `No hay ningún archivo o carpeta llamado "${targetRaw}" aquí. Comprueba el nombre exacto con "ls" (sin argumentos) o revisa en qué carpeta estás con "pwd".`
        );
      }
      if (node.type === 'file') return ok(targetRaw);
      const denied = checkPerm(node, 'r', ctx, 'ls', targetRaw) || checkPerm(node, 'x', ctx, 'ls', targetRaw);
      if (denied) return denied;
      const names = Object.keys(node.children)
        .filter((n) => showAll || !n.startsWith('.'))
        .sort();
      if (!long) {
        return ok(names.map((n) => n + (node.children[n].type === 'dir' ? '/' : '')).join('  '));
      }
      return ok(names.map((n) => formatLongEntry(n, node.children[n])).join('\n'));
    },

    cd(args, stdin, ctx) {
      const target = args[0] || '~';
      const pathArr = ctx.vfs.normalize(target, ctx.getCwd());
      const node = ctx.vfs.getNode(pathArr);
      if (!node) {
        return fail(
          `cd: no existe el directorio: ${target}`,
          `"${target}" no es una carpeta que exista desde tu ubicación actual. Usa "ls" para ver los nombres exactos de las carpetas disponibles aquí, o "pwd" para saber dónde estás.`
        );
      }
      if (node.type !== 'dir') {
        return fail(
          `cd: no es un directorio: ${target}`,
          `"${target}" existe, pero es un archivo, no una carpeta. Con "cd" solo puedes moverte dentro de carpetas; usa "cat ${target}" si quieres ver su contenido.`
        );
      }
      const denied = checkPerm(node, 'x', ctx, 'cd', target);
      if (denied) return denied;
      ctx.setCwd(pathArr);
      return ok('');
    },

    cat(args, stdin, ctx) {
      if (args.length === 0) return ok(stdin || '');
      const out = [];
      for (const a of args) {
        const { node, error } = readFileArg(ctx, a, 'cat');
        if (error) return error;
        out.push(node.content);
      }
      return ok(out.join('\n'));
    },

    echo(args, stdin, ctx) {
      return ok(args.join(' '));
    },

    mkdir(args, stdin, ctx) {
      const recursive = args.includes('-p');
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) {
        return fail('mkdir: falta un operando', 'Debes indicar el nombre de la carpeta que quieres crear, por ejemplo: mkdir carpeta');
      }
      for (const t of targets) {
        const pathArr = ctx.vfs.normalize(t, ctx.getCwd());
        if (recursive) {
          let node = ctx.vfs.root;
          for (const seg of pathArr) {
            if (!node.children[seg]) {
              const denied = checkPerm(node, 'w', ctx, 'mkdir', t);
              if (denied) return denied;
              node.children[seg] = TA.vfsHelpers.dir({}, applyUmask('rwxrwxrwx', ctx.getUmask()));
            }
            if (node.children[seg].type !== 'dir') {
              return fail(
                `mkdir: '${t}': no es un directorio`,
                `Uno de los tramos de la ruta "${t}" ya existe pero es un archivo, no una carpeta, así que no se puede seguir creando la ruta dentro de él.`
              );
            }
            node = node.children[seg];
          }
        } else {
          const { parent, name } = ctx.vfs.getParent(pathArr);
          if (!parent || parent.type !== 'dir') {
            return fail(
              `mkdir: no se puede crear el directorio '${t}': No existe el directorio padre`,
              `Para crear "${t}" primero debe existir la carpeta que lo contiene. Usa "mkdir -p ${t}" para crear todos los niveles necesarios de una vez, o créalos uno a uno en orden.`
            );
          }
          if (parent.children[name]) {
            return fail(
              `mkdir: no se puede crear el directorio '${t}': Ya existe`,
              `Ya existe algo con el nombre "${name}" en esta ubicación, así que mkdir no puede crear otra carpeta igual. Elige otro nombre o revisa con "ls".`
            );
          }
          const denied = checkPerm(parent, 'w', ctx, 'mkdir', t);
          if (denied) return denied;
          parent.children[name] = TA.vfsHelpers.dir({}, applyUmask('rwxrwxrwx', ctx.getUmask()));
        }
      }
      return ok('');
    },

    rmdir(args, stdin, ctx) {
      const targets = args.filter((a) => !a.startsWith('-'));
      for (const t of targets) {
        const pathArr = ctx.vfs.normalize(t, ctx.getCwd());
        const node = ctx.vfs.getNode(pathArr);
        if (!node) {
          return fail(`rmdir: no existe: ${t}`, `No hay ninguna carpeta llamada "${t}" aquí. Comprueba el nombre con "ls".`);
        }
        if (node.type !== 'dir') {
          return fail(`rmdir: no es un directorio: ${t}`, `"${t}" es un archivo, no una carpeta. rmdir solo elimina carpetas; usa "rm ${t}" para borrar un archivo.`);
        }
        if (Object.keys(node.children).length > 0) {
          return fail(
            `rmdir: el directorio no está vacío: ${t}`,
            `rmdir solo elimina carpetas vacías. "${t}" todavía tiene archivos o carpetas dentro. Si quieres borrarla junto con su contenido, usa "rm -r ${t}".`
          );
        }
        const { parent, name } = ctx.vfs.getParent(pathArr);
        const denied = checkPerm(parent, 'w', ctx, 'rmdir', t);
        if (denied) return denied;
        delete parent.children[name];
      }
      return ok('');
    },

    touch(args, stdin, ctx) {
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) {
        return fail('touch: falta un operando', 'Debes indicar el nombre del archivo que quieres crear, por ejemplo: touch archivo.txt');
      }
      for (const t of targets) {
        const pathArr = ctx.vfs.normalize(t, ctx.getCwd());
        const { parent, name } = ctx.vfs.getParent(pathArr);
        if (!parent || parent.type !== 'dir') {
          return fail(
            `touch: no se puede crear '${t}': No existe el directorio padre`,
            `La carpeta que debería contener "${t}" no existe todavía. Créala primero con "mkdir".`
          );
        }
        if (!parent.children[name]) {
          const denied = checkPerm(parent, 'w', ctx, 'touch', t);
          if (denied) return denied;
          parent.children[name] = TA.vfsHelpers.file('', applyUmask('rw-rw-rw-', ctx.getUmask()));
        }
      }
      return ok('');
    },

    rm(args, stdin, ctx) {
      const recursive = args.includes('-r') || args.includes('-rf') || args.includes('-fr') || args.includes('-R');
      const force = args.includes('-f') || args.includes('-rf') || args.includes('-fr');
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) {
        return fail('rm: falta un operando', 'Debes indicar qué archivo o carpeta quieres borrar, por ejemplo: rm archivo.txt');
      }
      for (const t of targets) {
        const pathArr = ctx.vfs.normalize(t, ctx.getCwd());
        const node = ctx.vfs.getNode(pathArr);
        if (!node) {
          if (force) continue;
          return fail(
            `rm: no se puede eliminar '${t}': No existe el archivo o directorio`,
            `No existe ningún archivo o carpeta con el nombre "${t}" aquí. Comprueba el nombre exacto con "ls".`
          );
        }
        if (node.type === 'dir' && !recursive) {
          return fail(
            `rm: no se puede eliminar '${t}': Es un directorio (usa -r)`,
            `"${t}" es una carpeta. Por seguridad, "rm" por sí solo no borra carpetas. Añade la opción -r para borrarla junto con todo su contenido: rm -r ${t}`
          );
        }
        const { parent, name } = ctx.vfs.getParent(pathArr);
        const denied = checkPerm(parent, 'w', ctx, 'rm', t);
        if (denied) return denied;
        delete parent.children[name];
      }
      return ok('');
    },

    cp(args, stdin, ctx) {
      const recursive = args.includes('-r') || args.includes('-R');
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length < 2) {
        return fail('cp: se requieren un origen y un destino', 'Debes indicar qué copiar y a dónde, por ejemplo: cp origen.txt destino/');
      }
      const [srcRaw, destRaw] = targets;
      const srcPath = ctx.vfs.normalize(srcRaw, ctx.getCwd());
      const srcNode = ctx.vfs.getNode(srcPath);
      if (!srcNode) {
        return fail(`cp: no se puede acceder a '${srcRaw}': No existe`, `No existe ningún archivo o carpeta llamado "${srcRaw}" aquí. Comprueba el nombre con "ls".`);
      }
      if (srcNode.type === 'dir' && !recursive) {
        return fail(
          `cp: -r no especificado; se omite el directorio '${srcRaw}'`,
          `"${srcRaw}" es una carpeta. Para copiar carpetas completas (con todo su contenido) necesitas la opción -r: cp -r ${srcRaw} ${destRaw}`
        );
      }
      const srcDenied = checkPerm(srcNode, 'r', ctx, 'cp', srcRaw);
      if (srcDenied) return srcDenied;

      let destPath = ctx.vfs.normalize(destRaw, ctx.getCwd());
      let destNode = ctx.vfs.getNode(destPath);
      let finalName = srcPath[srcPath.length - 1];
      if (destNode && destNode.type === 'dir') {
        destPath = [...destPath, finalName];
      } else {
        finalName = destPath[destPath.length - 1];
      }
      const { parent, name } = ctx.vfs.getParent(destPath);
      if (!parent || parent.type !== 'dir') {
        return fail('cp: no existe el directorio destino', `La carpeta destino de "${destRaw}" no existe. Créala primero con "mkdir" o revisa la ruta.`);
      }
      const destDenied = checkPerm(parent, 'w', ctx, 'cp', destRaw);
      if (destDenied) return destDenied;
      parent.children[name] = JSON.parse(JSON.stringify(srcNode));
      return ok('');
    },

    mv(args, stdin, ctx) {
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length < 2) {
        return fail('mv: se requieren un origen y un destino', 'Debes indicar qué mover y a dónde, por ejemplo: mv origen.txt destino/');
      }
      const [srcRaw, destRaw] = targets;
      const srcPath = ctx.vfs.normalize(srcRaw, ctx.getCwd());
      const srcNode = ctx.vfs.getNode(srcPath);
      if (!srcNode) {
        return fail(`mv: no se puede mover '${srcRaw}': No existe`, `No existe ningún archivo o carpeta llamado "${srcRaw}" aquí. Comprueba el nombre con "ls".`);
      }
      const { parent: srcParent, name: srcName } = ctx.vfs.getParent(srcPath);
      const srcDenied = checkPerm(srcParent, 'w', ctx, 'mv', srcRaw);
      if (srcDenied) return srcDenied;

      let destPath = ctx.vfs.normalize(destRaw, ctx.getCwd());
      const destNode = ctx.vfs.getNode(destPath);
      if (destNode && destNode.type === 'dir') {
        destPath = [...destPath, srcPath[srcPath.length - 1]];
      }
      const { parent: destParent, name: destName } = ctx.vfs.getParent(destPath);
      if (!destParent || destParent.type !== 'dir') {
        return fail('mv: no existe el directorio destino', `La carpeta destino de "${destRaw}" no existe. Créala primero con "mkdir" o revisa la ruta.`);
      }
      const destDenied = checkPerm(destParent, 'w', ctx, 'mv', destRaw);
      if (destDenied) return destDenied;
      destParent.children[destName] = srcNode;
      delete srcParent.children[srcName];
      return ok('');
    },

    grep(args, stdin, ctx) {
      const flags = args.filter((a) => a.startsWith('-')).join('');
      const ignoreCase = flags.includes('i');
      const rest = args.filter((a) => !a.startsWith('-'));
      if (rest.length === 0) {
        return fail('grep: falta el patrón de búsqueda', 'Debes indicar qué texto buscar, por ejemplo: grep "palabra" archivo.txt');
      }
      const [pattern, ...files] = rest;
      const test = (line) => ignoreCase
        ? line.toLowerCase().includes(pattern.toLowerCase())
        : line.includes(pattern);

      if (files.length === 0) {
        const lines = (stdin || '').split('\n').filter((l) => l.length > 0);
        return ok(lines.filter(test).join('\n'));
      }
      const out = [];
      for (const f of files) {
        const { node, error } = readFileArg(ctx, f, 'grep');
        if (error) return error;
        const lines = node.content.split('\n').filter((l) => l.length > 0);
        for (const l of lines) {
          if (test(l)) out.push(files.length > 1 ? `${f}:${l}` : l);
        }
      }
      return ok(out.join('\n'));
    },

    find(args, stdin, ctx) {
      const nameIdx = args.indexOf('-name');
      const pattern = nameIdx !== -1 ? args[nameIdx + 1] : null;
      const startRaw = args.find((a, i) => a !== '-name' && args[i - 1] !== '-name') || '.';
      const startPath = ctx.vfs.normalize(startRaw, ctx.getCwd());
      const startNode = ctx.vfs.getNode(startPath);
      if (!startNode) {
        return fail(`find: '${startRaw}': No existe el archivo o directorio`, `La ruta de búsqueda "${startRaw}" no existe. Comprueba dónde estás con "pwd" o usa una ruta válida.`);
      }

      const results = [];
      const walk = (node, pathArr) => {
        const name = pathArr[pathArr.length - 1] ?? '';
        if (!pattern || matchesGlob(name, pattern)) results.push(ctx.vfs.pathToStr(pathArr));
        if (node.type === 'dir') {
          for (const child of Object.keys(node.children).sort()) {
            walk(node.children[child], [...pathArr, child]);
          }
        }
      };
      walk(startNode, startPath);
      return ok(results.join('\n'));
    },

    chmod(args, stdin, ctx) {
      const [mode, ...targets] = args;
      if (!mode || targets.length === 0) {
        return fail('chmod: uso: chmod <modo> <archivo>', 'Debes indicar el modo de permisos y el archivo, por ejemplo: chmod 600 archivo.txt o chmod +x script.sh');
      }
      for (const t of targets) {
        const pathArr = ctx.vfs.normalize(t, ctx.getCwd());
        const node = ctx.vfs.getNode(pathArr);
        if (!node) {
          return fail(`chmod: no existe: ${t}`, `No existe ningún archivo o carpeta llamado "${t}" aquí. Comprueba el nombre con "ls".`);
        }
        if (node.owner !== ctx.currentUser && !ctx.sudo) {
          return fail(
            `chmod: cambiando los permisos de '${t}': Operación no permitida`,
            `Solo el propietario de "${t}" (${node.owner}) o root pueden cambiar sus permisos. Prueba con: sudo chmod ${mode} ${t}`
          );
        }
        if (/^[0-7]{3}$/.test(mode)) {
          node.perms = octalToRwx(mode);
        } else if (/^[ugoa]*[+-][rwx]+$/.test(mode)) {
          node.perms = applySymbolicMode(node.perms, mode);
        } else {
          return fail(
            `chmod: modo inválido: '${mode}'`,
            `"${mode}" no es un modo de permisos válido. Usa un número de 3 cifras entre 0 y 7 (por ejemplo 644 o 755), o notación simbólica como +x, u+w, g-r.`
          );
        }
      }
      return ok('');
    },

    chown(args, stdin, ctx) {
      const [spec, ...targets] = args;
      if (!spec || targets.length === 0) {
        return fail('chown: falta un operando', 'Indica el propietario y el archivo, por ejemplo: chown ana archivo.txt o chown ana:desarrolladores archivo.txt');
      }
      const [newOwner, newGroup] = spec.split(':');
      for (const t of targets) {
        const pathArr = ctx.vfs.normalize(t, ctx.getCwd());
        const node = ctx.vfs.getNode(pathArr);
        if (!node) {
          return fail(`chown: no existe: ${t}`, `No existe ningún archivo o carpeta llamado "${t}" aquí. Comprueba el nombre con "ls".`);
        }
        if (!ctx.sudo) {
          return fail(
            `chown: cambiando el propietario de '${t}': Operación no permitida`,
            `Solo root puede cambiar el propietario de un archivo. Necesitas privilegios de superusuario: sudo chown ${spec} ${t}`
          );
        }
        if (newOwner) node.owner = newOwner;
        if (newGroup) node.group = newGroup;
      }
      return ok('');
    },

    groups(args, stdin, ctx) {
      return ok(ctx.userGroups.join(' '));
    },

    id(args, stdin, ctx) {
      return ok(`uid=1000(${ctx.currentUser}) gid=1000(${ctx.currentUser}) grupos=1000(${ctx.currentUser}),27(sudo)`);
    },

    tee(args, stdin, ctx) {
      const append = args.includes('-a');
      const targets = args.filter((a) => !a.startsWith('-'));
      const text = stdin || '';
      if (targets.length === 0) {
        return fail('tee: falta el archivo destino', 'Indica dónde guardar la entrada, por ejemplo: echo "hola" | tee archivo.txt');
      }
      for (const t of targets) {
        const pathArr = ctx.vfs.normalize(t, ctx.getCwd());
        const { parent, name } = ctx.vfs.getParent(pathArr);
        if (!parent || parent.type !== 'dir') {
          return fail(`tee: ${t}: No existe el directorio`, `La carpeta donde intentas guardar "${t}" no existe.`);
        }
        const existing = parent.children[name];
        if (existing && existing.type === 'dir') {
          return fail(`tee: ${t}: Es un directorio`, `"${t}" es una carpeta, no se puede escribir en ella con tee.`);
        }
        const denied = existing ? checkPerm(existing, 'w', ctx, 'tee', t) : checkPerm(parent, 'w', ctx, 'tee', t);
        if (denied) return denied;
        if (append && existing) {
          existing.content = existing.content.length > 0 ? `${existing.content}\n${text}` : text;
        } else {
          parent.children[name] = TA.vfsHelpers.file(text, applyUmask('rw-rw-rw-', ctx.getUmask()));
        }
      }
      return ok(text);
    },

    umask(args, stdin, ctx) {
      if (args.length === 0) return ok(ctx.getUmask());
      const val = args[0];
      if (!/^[0-7]{3}$/.test(val)) {
        return fail(`umask: valor inválido: '${val}'`, 'umask espera un número octal de 3 cifras, por ejemplo: umask 027');
      }
      ctx.setUmask(val);
      return ok('');
    },

    whoami(args, stdin, ctx) {
      return ok(ctx.currentUser);
    },

    wc(args, stdin, ctx) {
      const linesOnly = args.includes('-l');
      let text = stdin || '';
      const fileTargets = args.filter((a) => !a.startsWith('-'));
      if (fileTargets.length > 0) {
        const { node, error } = readFileArg(ctx, fileTargets[0], 'wc');
        if (error) return error;
        text = node.content;
      }
      const lines = text.split('\n').filter((l) => l.length > 0).length;
      if (linesOnly) return ok(String(lines));
      const words = text.split(/\s+/).filter(Boolean).length;
      return ok(`${lines} ${words} ${text.length}`);
    },

    sort(args, stdin, ctx) {
      const unique = args.includes('-u');
      let text = stdin || '';
      const fileTargets = args.filter((a) => !a.startsWith('-'));
      if (fileTargets.length > 0) {
        const { node, error } = readFileArg(ctx, fileTargets[0], 'sort');
        if (error) return error;
        text = node.content;
      }
      let lines = text.split('\n').filter((l) => l.length > 0);
      lines.sort();
      if (unique) lines = [...new Set(lines)];
      return ok(lines.join('\n'));
    },

    head(args, stdin, ctx) {
      const nRaw = extractFlagValue(args, '-n');
      const n = nRaw ? (parseInt(nRaw, 10) || 10) : 10;
      const fileTargets = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '-n');
      let text = stdin || '';
      if (fileTargets.length > 0) {
        const { node, error } = readFileArg(ctx, fileTargets[0], 'head');
        if (error) return error;
        text = node.content;
      }
      return ok(text.split('\n').slice(0, n).join('\n'));
    },

    tail(args, stdin, ctx) {
      const nRaw = extractFlagValue(args, '-n');
      const n = nRaw ? (parseInt(nRaw, 10) || 10) : 10;
      const fileTargets = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '-n');
      let text = stdin || '';
      if (fileTargets.length > 0) {
        const { node, error } = readFileArg(ctx, fileTargets[0], 'tail');
        if (error) return error;
        text = node.content;
      }
      const lines = text.split('\n');
      return ok(lines.slice(Math.max(0, lines.length - n)).join('\n'));
    },

    cut(args, stdin, ctx) {
      const delim = extractFlagValue(args, '-d') ?? '\t';
      const fieldsSpec = extractFlagValue(args, '-f');
      if (!fieldsSpec) {
        return fail('cut: se debe especificar una lista de campos', 'Indica qué columnas quieres con -f, por ejemplo: cut -d: -f1 /etc/passwd');
      }
      const fields = fieldsSpec.split(',').map((s) => parseInt(s, 10));
      const fileTargets = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '-d' && args[i - 1] !== '-f');
      let text = stdin || '';
      if (fileTargets.length > 0) {
        const { node, error } = readFileArg(ctx, fileTargets[0], 'cut');
        if (error) return error;
        text = node.content;
      }
      const lines = text.split('\n').filter((l) => l.length > 0);
      const out = lines.map((line) => {
        const cols = line.split(delim);
        return fields.map((f) => cols[f - 1] ?? '').join(delim);
      });
      return ok(out.join('\n'));
    },

    uniq(args, stdin, ctx) {
      const fileTargets = args.filter((a) => !a.startsWith('-'));
      let text = stdin || '';
      if (fileTargets.length > 0) {
        const { node, error } = readFileArg(ctx, fileTargets[0], 'uniq');
        if (error) return error;
        text = node.content;
      }
      const lines = text.split('\n').filter((l) => l.length > 0);
      const out = [];
      for (const l of lines) {
        if (out.length === 0 || out[out.length - 1] !== l) out.push(l);
      }
      return ok(out.join('\n'));
    },

    sed(args, stdin, ctx) {
      const inPlace = args.includes('-i');
      const rest = args.filter((a) => a !== '-i');
      const expr = rest[0];
      const fileArg = rest[1];
      const m = expr && expr.match(/^s\/(.*?)\/(.*?)\/(g)?$/);
      if (!m) {
        return fail(
          'sed: expresión no reconocida',
          'Este simulador solo entiende sustituciones simples: sed \'s/patrón/reemplazo/\' archivo (añade "g" al final para reemplazar todas las coincidencias de cada línea, no solo la primera)'
        );
      }
      const [, pat, rep, global] = m;
      const applyTo = (text) => text.split('\n').map((line) => (global ? line.split(pat).join(rep) : line.replace(pat, rep))).join('\n');

      let text = stdin || '';
      let node = null;
      if (fileArg) {
        const r = readFileArg(ctx, fileArg, 'sed');
        if (r.error) return r.error;
        node = r.node;
        text = node.content;
      }
      const result = applyTo(text);
      if (inPlace) {
        if (!node) {
          return fail('sed: -i requiere un archivo', 'La opción -i modifica el archivo directamente, así que debes indicar un archivo: sed -i \'s/a/b/\' archivo.txt');
        }
        const denied = checkPerm(node, 'w', ctx, 'sed', fileArg);
        if (denied) return denied;
        node.content = result;
        return ok('');
      }
      return ok(result);
    },

    awk(args, stdin, ctx) {
      const delim = extractFlagValue(args, '-F');
      const rest = args.filter((a, i) => !a.startsWith('-F') && args[i - 1] !== '-F');
      const program = rest[0];
      const fileArg = rest[1];
      const m = program && program.match(/^\{\s*print\s+(.+?)\s*\}$/);
      if (!m) {
        return fail(
          'awk: programa no reconocido',
          'Este simulador solo entiende: awk \'{print $1}\' (o varios campos: awk \'{print $1, $3}\'), opcionalmente con -F para el separador de columnas.'
        );
      }
      const fieldExprs = m[1].split(',').map((s) => s.trim());
      let text = stdin || '';
      if (fileArg) {
        const r = readFileArg(ctx, fileArg, 'awk');
        if (r.error) return r.error;
        text = r.node.content;
      }
      const lines = text.split('\n').filter((l) => l.length > 0);
      const out = lines.map((line) => {
        const cols = delim ? line.split(delim) : line.trim().split(/\s+/);
        return fieldExprs.map((expr) => {
          const idx = parseInt(expr.replace('$', ''), 10);
          if (idx === 0) return line;
          return cols[idx - 1] ?? '';
        }).join(' ');
      });
      return ok(out.join('\n'));
    },

    sudo() {
      return fail('sudo: falta el comando a ejecutar', 'sudo debe ir seguido de otro comando, por ejemplo: sudo cat /etc/config.conf');
    },

    export(args, stdin, ctx) {
      if (args.length === 0) {
        return ok(Object.entries(ctx.env).map(([k, v]) => `declare -x ${k}="${v}"`).join('\n'));
      }
      for (const a of args) {
        const eq = a.indexOf('=');
        if (eq === -1) continue;
        ctx.env[a.slice(0, eq)] = a.slice(eq + 1);
      }
      return ok('');
    },

    env(args, stdin, ctx) {
      return ok(Object.entries(ctx.env).map(([k, v]) => `${k}=${v}`).join('\n'));
    },

    bash(args, stdin, ctx) {
      if (!args[0]) return fail('bash: falta el script', 'Indica el archivo de script a ejecutar, por ejemplo: bash instalar.sh');
      return runScriptFile(args[0], args.slice(1), ctx, false);
    },

    ps(args, stdin, ctx) {
      const rows = activeProcessRows(ctx);
      return ok(formatProcessTable(rows));
    },

    top(args, stdin, ctx) {
      const rows = [...activeProcessRows(ctx)].sort((a, b) => parseFloat(b.cpu) - parseFloat(a.cpu));
      return ok(`instantánea única (simulada) — en un terminal real, "top" se actualiza en vivo\n${formatProcessTable(rows)}`);
    },

    kill(args, stdin, ctx) {
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) {
        return fail('kill: falta el PID', 'Debes indicar el PID (número de proceso) a terminar. Usa "ps" para ver los PIDs activos.');
      }
      for (const t of targets) {
        const pid = parseInt(t, 10);
        const proc = ctx.processes.find((p) => p.pid === pid && !p.killed);
        const job = ctx.jobs.find((j) => j.pid === pid && j.status === 'Running');
        if (!proc && !job) {
          return fail(`kill: (${t}): No existe el proceso`, `No hay ningún proceso con el PID ${t} en ejecución. Comprueba los PIDs activos con "ps".`);
        }
        if (proc) {
          if (proc.protected && !ctx.sudo) {
            return fail(
              `kill: (${pid}): Operación no permitida`,
              `El proceso ${pid} (${proc.cmd}) pertenece a "${proc.user}". Necesitas privilegios de superusuario: sudo kill ${pid}`
            );
          }
          proc.killed = true;
        } else {
          job.status = 'Terminated';
        }
      }
      return ok('');
    },

    jobs(args, stdin, ctx) {
      if (ctx.jobs.length === 0) return ok('');
      return ok(ctx.jobs.map((j, i) => `[${i + 1}]  ${j.status.padEnd(11)} ${j.cmd}${j.nohup ? ' (nohup)' : ''}`).join('\n'));
    },

    fg(args, stdin, ctx) {
      const spec = args[0] ? args[0].replace('%', '') : String(ctx.jobs.length);
      const job = ctx.jobs[parseInt(spec, 10) - 1];
      if (!job) {
        return fail(`fg: %${spec}: no existe ese trabajo`, 'Usa "jobs" para ver los trabajos en segundo plano disponibles.');
      }
      job.status = 'Done';
      return ok(job.cmd);
    },

    nohup(args, stdin, ctx) {
      return fail(
        'nohup: se usa junto con &',
        'nohup se combina con un comando en segundo plano para que sobreviva al cierre de la terminal: nohup ./script.sh &'
      );
    },

    ping(args, stdin, ctx) {
      const host = args.find((a) => !a.startsWith('-'));
      if (!host) return fail('ping: falta el host', 'Indica a qué host hacer ping, por ejemplo: ping servidor-web');
      const reachable = !ctx.network.hosts || ctx.network.hosts[host] !== false;
      if (!reachable) {
        return ok(`PING ${host}: 4 paquetes transmitidos, 0 recibidos, 100% de pérdida\nDestino inalcanzable`);
      }
      return ok(`PING ${host}: 4 paquetes transmitidos, 4 recibidos, 0% de pérdida\nround-trip min/avg/max = 8.1/12.4/19.0 ms`);
    },

    curl(args, stdin, ctx) {
      const url = args.find((a) => !a.startsWith('-'));
      if (!url) return fail('curl: falta la URL', 'Indica una URL, por ejemplo: curl http://api.local/estado');
      const body = ctx.network.routes ? ctx.network.routes[url] : undefined;
      if (body === undefined) {
        return fail(`curl: (6) No se pudo resolver el host: ${url}`, `No existe ningún servicio simulado en "${url}". Comprueba la URL exacta indicada en el objetivo del nivel.`);
      }
      return ok(body);
    },

    ss(args, stdin, ctx) {
      const rows = (ctx.network.ports || []).map((p) => `${p.proto.padEnd(6)} LISTEN 0      128    ${p.address}:${p.port}    0.0.0.0:*    users:(("${p.service}",pid=${p.pid},fd=3))`);
      return ok(['Netid  State  Recv-Q Send-Q Local Address:Port', ...rows].join('\n'));
    },

    netstat(args, stdin, ctx) {
      return COMMANDS.ss(args, stdin, ctx);
    },

    df(args, stdin, ctx) {
      return ok([
        'Sist. de ficheros   Tamaño  Usado  Disp.  Uso%  Montado en',
        '/dev/sda1              20G    12G   7.5G   62%  /',
        'tmpfs                 2.0G    45M   1.9G    3%  /tmp',
      ].join('\n'));
    },

    free(args, stdin, ctx) {
      return ok([
        '               total       usado       libre   compartido  caché/búfer  disponible',
        'Mem:            7.8G        2.1G        3.2G        180M         2.5G        5.3G',
        'Swap:           2.0G          0B        2.0G',
      ].join('\n'));
    },

    du(args, stdin, ctx) {
      const human = args.includes('-h');
      const summaryOnly = args.includes('-s');
      const targets = args.filter((a) => !a.startsWith('-'));
      const targetRaw = targets[0] || '.';
      const pathArr = ctx.vfs.normalize(targetRaw, ctx.getCwd());
      const node = ctx.vfs.getNode(pathArr);
      if (!node) {
        return fail(`du: no se puede acceder a '${targetRaw}': No existe el archivo o directorio`, `No existe ningún archivo o carpeta llamado "${targetRaw}" aquí.`);
      }
      const sizeOfNode = (n) => (n.type === 'file' ? n.content.length : Object.values(n.children).reduce((sum, c) => sum + sizeOfNode(c), 0));
      const humanSize = (bytes) => {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
        return `${(bytes / 1024 / 1024).toFixed(1)}M`;
      };
      const fmt = (bytes) => (human ? humanSize(bytes) : String(bytes));
      const total = sizeOfNode(node);
      if (summaryOnly || node.type === 'file') {
        return ok(`${fmt(total)}\t${targetRaw}`);
      }
      const rows = Object.entries(node.children).map(([name, child]) => `${fmt(sizeOfNode(child))}\t${targetRaw === '.' ? './' : targetRaw + '/'}${name}`);
      rows.push(`${fmt(total)}\t${targetRaw}`);
      return ok(rows.join('\n'));
    },

    tar(args, stdin, ctx) {
      if (args.length === 0) {
        return fail('tar: falta el modo de operación', 'Indica qué hacer, por ejemplo: tar -czf archivo.tar.gz carpeta/ (crear) o tar -xzf archivo.tar.gz (extraer)');
      }
      const modeToken = args[0].replace(/^-/, '');
      const create = modeToken.includes('c');
      const extract = modeToken.includes('x');
      const rest = args.slice(1);
      const cIdx = rest.indexOf('-C');
      const destRaw = cIdx !== -1 ? rest[cIdx + 1] : null;
      const positional = rest.filter((a, i) => a !== '-C' && !(cIdx !== -1 && i === cIdx + 1));
      const archiveRaw = positional[0];
      if (!archiveRaw) {
        return fail('tar: falta el nombre del archivo', 'Indica el nombre del .tar.gz, por ejemplo: tar -czf copia.tar.gz carpeta/');
      }

      if (create) {
        const srcRaw = positional[1];
        if (!srcRaw) {
          return fail('tar: falta el origen a comprimir', 'Indica qué carpeta o archivo comprimir, por ejemplo: tar -czf copia.tar.gz carpeta/');
        }
        const srcPath = ctx.vfs.normalize(srcRaw, ctx.getCwd());
        const srcNode = ctx.vfs.getNode(srcPath);
        if (!srcNode) {
          return fail(`tar: ${srcRaw}: No existe el archivo o directorio`, `No existe "${srcRaw}" aquí. Comprueba el nombre con "ls".`);
        }
        const denied = checkPerm(srcNode, 'r', ctx, 'tar', srcRaw);
        if (denied) return denied;
        const archivePath = ctx.vfs.normalize(archiveRaw, ctx.getCwd());
        const { parent, name } = ctx.vfs.getParent(archivePath);
        if (!parent || parent.type !== 'dir') {
          return fail('tar: no existe el directorio destino', `La carpeta donde quieres guardar "${archiveRaw}" no existe.`);
        }
        const entryName = srcPath[srcPath.length - 1] || 'root';
        const archiveNode = TA.vfsHelpers.file(JSON.stringify({ entryName, data: srcNode }));
        archiveNode.isArchive = true;
        parent.children[name] = archiveNode;
        return ok('');
      }

      if (extract) {
        const archivePath = ctx.vfs.normalize(archiveRaw, ctx.getCwd());
        const archiveNode = ctx.vfs.getNode(archivePath);
        if (!archiveNode) {
          return fail(`tar: ${archiveRaw}: No existe el archivo o directorio`, `No existe ningún archivo llamado "${archiveRaw}" aquí.`);
        }
        if (!archiveNode.isArchive) {
          return fail(`tar: ${archiveRaw}: no es un archivo tar reconocible`, `"${archiveRaw}" no parece un archivo .tar.gz creado con "tar -c" en este simulador.`);
        }
        let payload;
        try {
          payload = JSON.parse(archiveNode.content);
        } catch {
          return fail(`tar: ${archiveRaw}: archivo dañado`, 'No se pudo leer el contenido del archivo comprimido.');
        }
        const destArr = destRaw ? ctx.vfs.normalize(destRaw, ctx.getCwd()) : ctx.getCwd();
        const destNode = ctx.vfs.getNode(destArr);
        if (!destNode || destNode.type !== 'dir') {
          return fail('tar: el destino no existe', 'La carpeta destino de la extracción no existe. Créala primero con mkdir, o usa -C con una ruta válida.');
        }
        const denied = checkPerm(destNode, 'w', ctx, 'tar', destRaw || '.');
        if (denied) return denied;
        destNode.children[payload.entryName] = JSON.parse(JSON.stringify(payload.data));
        return ok('');
      }

      return fail('tar: debes indicar -c (crear) o -x (extraer)', 'Usa tar -czf archivo.tar.gz carpeta/ para comprimir, o tar -xzf archivo.tar.gz para extraer.');
    },

    apt(args, stdin, ctx) {
      const sub = args[0];
      if (sub === 'update') return ok('Listas de paquetes actualizadas.');
      if (sub === 'search' || sub === 'list') {
        const term = args[1] || '';
        const matches = ctx.packages.available.filter((p) => !term || p.name.includes(term));
        if (matches.length === 0) return ok('No se han encontrado paquetes.');
        return ok(matches.map((p) => `${p.name}/estable ${p.version} — ${p.description}${ctx.packages.installed.includes(p.name) ? ' [instalado]' : ''}`).join('\n'));
      }
      if (sub === 'install') {
        const name = args[1];
        if (!name) return fail('apt: falta el paquete a instalar', 'Indica qué paquete instalar: sudo apt install <paquete>');
        if (!ctx.sudo) {
          return fail(
            'E: No se pudieron bloquear los directorios de administración (¿eres root?)',
            `Instalar paquetes requiere privilegios de administrador: sudo apt install ${name}`
          );
        }
        const pkg = ctx.packages.available.find((p) => p.name === name);
        if (!pkg) {
          return fail(`E: No se ha encontrado el paquete ${name}`, `No existe ningún paquete llamado "${name}" en el repositorio simulado. Prueba "apt search" para ver los disponibles.`);
        }
        if (!ctx.packages.installed.includes(name)) ctx.packages.installed.push(name);
        return ok(`Configurando ${name} (${pkg.version})...\n${name} instalado correctamente.`);
      }
      if (sub === 'remove') {
        const name = args[1];
        if (!name) return fail('apt: falta el paquete a eliminar', 'Indica qué paquete eliminar: sudo apt remove <paquete>');
        if (!ctx.sudo) {
          return fail(
            'E: No se pudieron bloquear los directorios de administración (¿eres root?)',
            `Eliminar paquetes requiere privilegios de administrador: sudo apt remove ${name}`
          );
        }
        ctx.packages.installed = ctx.packages.installed.filter((n) => n !== name);
        return ok(`Se ha eliminado ${name}.`);
      }
      return fail(`apt: orden '${sub}' no reconocida`, 'Este simulador entiende: apt update, apt search/list, apt install <paquete>, apt remove <paquete>.');
    },

    dnf(args, stdin, ctx) {
      return COMMANDS.apt(args, stdin, ctx);
    },

    systemctl(args, stdin, ctx) {
      const sub = args[0];
      const svcName = args[1];
      const svc = ctx.services.find((s) => s.name === svcName);
      if (sub === 'status') {
        if (!svc) {
          return fail(`Unit ${svcName}.service could not be found.`, `No existe ningún servicio llamado "${svcName}" en este sistema simulado.`);
        }
        return ok(`● ${svc.name}.service\n   Activo: ${svc.status === 'active' ? 'active (running)' : 'inactive (dead)'}\n   Habilitado: ${svc.enabled ? 'enabled' : 'disabled'}`);
      }
      if (['start', 'stop', 'restart', 'enable', 'disable'].includes(sub)) {
        if (!svc) {
          return fail(`Failed to ${sub} ${svcName}.service: Unit not found.`, `No existe ningún servicio llamado "${svcName}" en este sistema simulado.`);
        }
        if (!ctx.sudo) {
          return fail(
            `Failed to ${sub} ${svcName}.service: Access denied`,
            `Gestionar servicios del sistema requiere privilegios de administrador: sudo systemctl ${sub} ${svcName}`
          );
        }
        if (sub === 'start' || sub === 'restart') svc.status = 'active';
        if (sub === 'stop') svc.status = 'inactive';
        if (sub === 'enable') svc.enabled = true;
        if (sub === 'disable') svc.enabled = false;
        return ok('');
      }
      return fail(`systemctl: orden '${sub}' no reconocida`, 'Este simulador entiende: systemctl status/start/stop/restart/enable/disable <servicio>.');
    },

    useradd(args, stdin, ctx) {
      const name = args.find((a) => !a.startsWith('-'));
      if (!name) return fail('useradd: falta el nombre de usuario', 'Indica el nombre: sudo useradd <usuario>');
      if (!ctx.sudo) return fail('useradd: Permission denied.', `Crear usuarios requiere privilegios de administrador: sudo useradd ${name}`);
      if (ctx.users.find((u) => u.username === name)) {
        return fail(`useradd: el usuario '${name}' ya existe`, 'Ese usuario ya está creado. Comprueba con "groups" o revisando el enunciado del nivel.');
      }
      ctx.users.push({ username: name, groups: [name], hasPassword: false });
      return ok('');
    },

    groupadd(args, stdin, ctx) {
      const name = args[0];
      if (!name) return fail('groupadd: falta el nombre del grupo', 'Indica el nombre: sudo groupadd <grupo>');
      if (!ctx.sudo) return fail('groupadd: Permission denied.', `Crear grupos requiere privilegios de administrador: sudo groupadd ${name}`);
      if (!ctx.groups.includes(name)) ctx.groups.push(name);
      return ok('');
    },

    usermod(args, stdin, ctx) {
      const aIdx = args.indexOf('-aG');
      const group = aIdx !== -1 ? args[aIdx + 1] : null;
      const username = args[args.length - 1];
      if (!group || !username || username === group) {
        return fail('usermod: uso: usermod -aG <grupo> <usuario>', 'Añade un usuario a un grupo con: sudo usermod -aG <grupo> <usuario>');
      }
      if (!ctx.sudo) return fail('usermod: Permission denied.', `Modificar usuarios requiere privilegios de administrador: sudo usermod -aG ${group} ${username}`);
      const user = ctx.users.find((u) => u.username === username);
      if (!user) return fail(`usermod: el usuario '${username}' no existe`, 'Primero debes crear el usuario con useradd, o comprueba el nombre.');
      if (!ctx.groups.includes(group)) return fail(`usermod: el grupo '${group}' no existe`, 'Primero crea el grupo con groupadd, o comprueba el nombre.');
      if (!user.groups.includes(group)) user.groups.push(group);
      return ok('');
    },

    passwd(args, stdin, ctx) {
      const username = args[0] || ctx.currentUser;
      if (username !== ctx.currentUser && !ctx.sudo) {
        return fail('passwd: Permission denied.', `Cambiar la contraseña de otro usuario requiere privilegios de administrador: sudo passwd ${username}`);
      }
      const user = ctx.users.find((u) => u.username === username);
      if (username !== ctx.currentUser && !user) {
        return fail(`passwd: el usuario '${username}' no existe`, 'Comprueba el nombre de usuario, o créalo antes con useradd.');
      }
      if (user) user.hasPassword = true;
      return ok('passwd: contraseña actualizada correctamente');
    },

    git(args, stdin, ctx) {
      const sub = args[0];
      const rest = args.slice(1);
      if (sub === 'init') {
        const node = ctx.vfs.getNode(ctx.getCwd());
        if (node.gitRepo) return ok(`Reinicializado repositorio Git existente en ${ctx.vfs.pathToStr(ctx.getCwd())}/.git/`);
        node.gitRepo = { staged: [], commits: [] };
        return ok(`Repositorio Git vacío inicializado en ${ctx.vfs.pathToStr(ctx.getCwd())}/.git/`);
      }
      const repo = findGitRepo(ctx);
      if (!repo) {
        return fail(
          'fatal: no es un repositorio git (ni ninguno de los directorios padres): .git',
          'Primero debes inicializar un repositorio con "git init" en esta carpeta (o en una carpeta superior).'
        );
      }
      const node = repo.node;
      if (sub === 'status') {
        const tracked = new Set(node.gitRepo.commits.flatMap((c) => c.files));
        const staged = new Set(node.gitRepo.staged);
        const names = Object.keys(node.children || {});
        const untracked = names.filter((n) => !tracked.has(n) && !staged.has(n));
        const parts = [];
        if (staged.size > 0) parts.push('Cambios a confirmar:\n  ' + [...staged].map((f) => `nuevo archivo: ${f}`).join('\n  '));
        if (untracked.length > 0) parts.push('Archivos sin seguimiento:\n  ' + untracked.join('\n  '));
        if (parts.length === 0) parts.push('nada que confirmar, el árbol de trabajo está limpio');
        return ok(parts.join('\n\n'));
      }
      if (sub === 'add') {
        const targets = rest[0] === '.' ? Object.keys(node.children || {}) : rest;
        if (targets.length === 0) return fail('git add: falta el archivo', 'Indica qué archivo añadir: git add archivo, o git add . para todos.');
        node.gitRepo.staged = [...new Set([...node.gitRepo.staged, ...targets])];
        return ok('');
      }
      if (sub === 'commit') {
        const mIdx = rest.indexOf('-m');
        const message = mIdx !== -1 ? rest[mIdx + 1] : null;
        if (!message) return fail('git commit: falta el mensaje', 'Todo commit necesita un mensaje: git commit -m "mensaje descriptivo"');
        if (node.gitRepo.staged.length === 0) {
          return fail('git commit: nada que confirmar', 'No has añadido ningún archivo al área de preparación. Usa "git add <archivo>" primero.');
        }
        const hash = Math.random().toString(16).slice(2, 9);
        node.gitRepo.commits.unshift({ message, files: [...node.gitRepo.staged], hash });
        node.gitRepo.staged = [];
        return ok(`[main ${hash}] ${message}`);
      }
      if (sub === 'log') {
        if (node.gitRepo.commits.length === 0) return ok('');
        return ok(node.gitRepo.commits.map((c) => `commit ${c.hash}\n\n    ${c.message}`).join('\n\n'));
      }
      return fail(`git: '${sub}' no es una orden git reconocida por este simulador`, 'Este simulador entiende: git init, git status, git add, git commit -m "...", git log.');
    },

    help(args) {
      const catalog = {
        pwd: 'Muestra el directorio actual.',
        ls: 'Lista archivos. Flags: -l (detalle), -a (ocultos).',
        cd: 'Cambia de directorio. Usa .. para subir, ~ para ir a casa.',
        cat: 'Muestra el contenido de un archivo.',
        echo: 'Imprime texto. Combínalo con > o >> para guardar en archivos.',
        tee: 'Escribe la entrada en un archivo y también la muestra. Útil con sudo: comando | sudo tee -a archivo.',
        mkdir: 'Crea directorios. Usa -p para crear rutas anidadas.',
        rmdir: 'Elimina un directorio vacío.',
        touch: 'Crea un archivo vacío.',
        rm: 'Elimina archivos. Usa -r para directorios.',
        cp: 'Copia archivos o directorios (-r).',
        mv: 'Mueve o renombra archivos y directorios.',
        grep: 'Busca texto dentro de archivos o de la entrada. Usa -i para ignorar mayúsculas.',
        find: 'Busca archivos por nombre: find <ruta> -name "patrón".',
        chmod: 'Cambia permisos: modo octal (755) o simbólico (+x).',
        chown: 'Cambia el propietario/grupo de un archivo (requiere sudo).',
        groups: 'Muestra los grupos del usuario actual.',
        id: 'Muestra el usuario, grupo y grupos del usuario actual.',
        sudo: 'Ejecuta el comando siguiente con privilegios de superusuario.',
        umask: 'Consulta o cambia la máscara de permisos por defecto.',
        whoami: 'Muestra el usuario actual.',
        wc: 'Cuenta líneas/palabras/caracteres. Usa -l para solo líneas.',
        sort: 'Ordena líneas de texto alfabéticamente. Usa -u para eliminar duplicados.',
        head: 'Muestra las primeras líneas de un archivo (-n para elegir cuántas).',
        tail: 'Muestra las últimas líneas de un archivo (-n para elegir cuántas).',
        cut: 'Extrae columnas de texto: cut -d<separador> -f<campos> archivo.',
        uniq: 'Elimina líneas duplicadas consecutivas (combínalo con sort).',
        sed: 'Sustituye texto: sed \'s/patrón/reemplazo/\' archivo.',
        awk: 'Extrae campos: awk \'{print $1}\' archivo (usa -F para el separador).',
        export: 'Define una variable de entorno: export NOMBRE=valor.',
        env: 'Lista las variables de entorno definidas.',
        bash: 'Ejecuta un script línea a línea: bash script.sh.',
        ps: 'Lista los procesos activos.',
        top: 'Instantánea de procesos ordenada por uso de CPU.',
        kill: 'Termina un proceso por su PID.',
        jobs: 'Lista los trabajos en segundo plano de esta sesión.',
        fg: 'Trae un trabajo en segundo plano al primer plano.',
        ping: 'Comprueba si un host responde en la red.',
        curl: 'Hace una petición HTTP a una URL.',
        ss: 'Lista los puertos en escucha (alias: netstat).',
        df: 'Muestra el espacio usado/disponible en los discos.',
        du: 'Muestra el espacio ocupado por archivos/carpetas. Usa -sh para un resumen legible.',
        free: 'Muestra el uso de memoria RAM y swap.',
        tar: 'Comprime/extrae archivos: tar -czf archivo.tar.gz carpeta/ o tar -xzf archivo.tar.gz.',
        clear: 'Limpia la pantalla de la terminal (o pulsa Ctrl+L).',
        apt: 'Gestiona paquetes: apt update, apt search/list, apt install/remove (requiere sudo).',
        dnf: 'Alias de apt para sistemas basados en Red Hat.',
        systemctl: 'Gestiona servicios: systemctl status/start/stop/restart/enable/disable <servicio>.',
        useradd: 'Crea un usuario nuevo (requiere sudo).',
        groupadd: 'Crea un grupo nuevo (requiere sudo).',
        usermod: 'Modifica un usuario: usermod -aG <grupo> <usuario> lo añade a un grupo (requiere sudo).',
        passwd: 'Define o cambia la contraseña de un usuario.',
        git: 'Control de versiones: git init, git status, git add, git commit -m "...", git log.',
      };
      if (args[0] && catalog[args[0]]) return ok(`${args[0]}: ${catalog[args[0]]}`);
      return ok(Object.entries(catalog).map(([k, v]) => `${k.padEnd(8)} ${v}`).join('\n'));
    },
  };

  function applySymbolicMode(rwx9, mode) {
    const m = mode.match(/^([ugoa]*)([+-])([rwx]+)$/);
    if (!m) return rwx9;
    let [, classes, op, perms] = m;
    if (!classes) classes = 'a';
    const expanded = classes.includes('a') ? 'ugo' : classes;
    const chars = rwx9.split('');
    const offsets = { u: 0, g: 3, o: 6 };
    const idx = { r: 0, w: 1, x: 2 };
    for (const cls of expanded) {
      const base = offsets[cls];
      if (base === undefined) continue;
      for (const p of perms) {
        const pos = base + idx[p];
        chars[pos] = op === '+' ? p : '-';
      }
    }
    return chars.join('');
  }

  function writeRedirect(ctx, fileRaw, content, append) {
    const pathArr = ctx.vfs.normalize(fileRaw, ctx.getCwd());
    const { parent, name } = ctx.vfs.getParent(pathArr);
    if (!parent || parent.type !== 'dir') {
      return fail(
        `No existe el directorio para '${fileRaw}'`,
        `La carpeta donde intentas guardar "${fileRaw}" no existe. Comprueba la ruta o créala primero con "mkdir".`
      );
    }
    const existing = parent.children[name];
    if (existing && existing.type === 'dir') {
      return fail(
        `bash: ${fileRaw}: Es un directorio`,
        `"${fileRaw}" ya existe pero es una carpeta, no se puede redirigir texto sobre una carpeta. Elige otro nombre de archivo.`
      );
    }
    if (existing) {
      const denied = checkPerm(existing, 'w', ctx, 'bash', fileRaw);
      if (denied) return denied;
    } else {
      const denied = checkPerm(parent, 'w', ctx, 'bash', fileRaw);
      if (denied) return denied;
    }
    if (append && existing && existing.type === 'file') {
      existing.content = existing.content.length > 0 ? `${existing.content}\n${content}` : content;
    } else {
      parent.children[name] = TA.vfsHelpers.file(content, applyUmask('rw-rw-rw-', ctx.getUmask()));
    }
    return ok('');
  }

  function runLine(line, ctx) {
    let rawTokens = tokenize(line.trim());

    let background = false;
    let nohup = false;
    if (rawTokens[0] && rawTokens[0].quote === null && rawTokens[0].text === 'nohup') {
      nohup = true;
      rawTokens = rawTokens.slice(1);
    }
    const lastRaw = rawTokens[rawTokens.length - 1];
    if (lastRaw && lastRaw.quote === null && lastRaw.text === '&') {
      background = true;
      rawTokens = rawTokens.slice(0, -1);
    }

    if (rawTokens.length === 0) return { ok: true, output: '', explain: null, stages: [], raw: line };
    const displayCmd = rawTokens.map((t) => t.text).join(' ');

    const stageTokenGroups = [[]];
    for (const t of rawTokens) {
      if (t.quote === null && t.text === '|') stageTokenGroups.push([]);
      else stageTokenGroups[stageTokenGroups.length - 1].push(t);
    }

    let redirect = null;
    const lastIdx = stageTokenGroups.length - 1;
    const lastTokens = stageTokenGroups[lastIdx];
    const redirIdx = lastTokens.findIndex((t) => t.quote === null && (t.text === '>' || t.text === '>>'));
    if (redirIdx !== -1) {
      const fileTok = lastTokens[redirIdx + 1];
      redirect = { append: lastTokens[redirIdx].text === '>>', file: fileTok ? resolveToken(fileTok, ctx) : null };
      stageTokenGroups[lastIdx] = lastTokens.slice(0, redirIdx);
    }

    let stdin = '';
    let lastErr = null;
    let lastExplain = null;
    const stages = [];
    for (const stageTokensRaw of stageTokenGroups) {
      if (stageTokensRaw.length === 0) {
        lastErr = 'bash: error de sintaxis cerca del token inesperado';
        lastExplain = 'Falta un comando en algún lado, por ejemplo antes/después de "|" o al final de la línea. Cada tubería necesita un comando a cada lado: ls | grep txt';
        break;
      }
      let stageTokens = stageTokensRaw;
      let stageSudo = false;
      if (stageTokens[0].quote === null && stageTokens[0].text === 'sudo') {
        stageSudo = true;
        stageTokens = stageTokens.slice(1);
      }
      if (stageTokens.length === 0) {
        lastErr = 'bash: sudo: falta el comando a ejecutar';
        lastExplain = 'sudo debe ir seguido de otro comando, por ejemplo: sudo cat /etc/config.conf';
        break;
      }
      const resolved = stageTokens.map((t) => resolveToken(t, ctx));
      const [cmd, ...args] = resolved;
      const fn = COMMANDS[cmd];
      const prevSudo = ctx.sudo;
      if (stageSudo) ctx.sudo = true;

      let result;
      if (!fn) {
        if (cmd.startsWith('./') || cmd.startsWith('/')) {
          result = runScriptFile(cmd, args, ctx, true);
        } else {
          ctx.sudo = prevSudo;
          lastErr = `bash: ${cmd}: orden no encontrada`;
          lastExplain = `"${cmd}" no es un comando reconocido en este simulador (o está mal escrito). Escribe "help" para ver la lista completa de comandos disponibles.`;
          stages.push({ cmd, args, output: '', error: lastErr, explain: lastExplain });
          break;
        }
      } else {
        result = fn(args, stdin, ctx);
      }
      ctx.sudo = prevSudo;

      stages.push({ cmd, args, output: result.output || '', error: result.error || null, explain: result.explain || null });
      if (result.error) { lastErr = result.error; lastExplain = result.explain; break; }
      stdin = result.output || '';
    }

    if (!lastErr && redirect) {
      if (!redirect.file) {
        lastErr = 'bash: error de sintaxis: se esperaba un nombre de archivo tras la redirección';
        lastExplain = 'Después de > o >> hace falta el nombre del archivo donde guardar el resultado, por ejemplo: echo "hola" > archivo.txt';
      } else {
        const r = writeRedirect(ctx, redirect.file, stdin, redirect.append);
        if (r.error) { lastErr = r.error; lastExplain = r.explain; }
        else stdin = '';
      }
    }

    ctx.env['?'] = lastErr ? '1' : '0';

    if (!lastErr && background) {
      const pid = nextPid(ctx);
      ctx.jobs.push({ pid, cmd: displayCmd, status: 'Running', nohup });
      return { ok: true, output: `[${ctx.jobs.length}] ${pid}`, explain: null, stages, raw: line };
    }

    return { ok: !lastErr, output: lastErr || stdin, explain: lastExplain, stages, raw: line };
  }

  TA.Shell = { runLine, tokenize, COMMANDS };
})();
