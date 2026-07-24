// Interprete de comandos Linux (simplificado) para Terminal Academy.
window.TA = window.TA || {};

(function () {
  const { octalToRwx } = TA.vfsHelpers;

  function ok(output) {
    return { output, error: null };
  }
  function fail(error) {
    return { output: '', error };
  }

  function tokenize(line) {
    const tokens = [];
    let i = 0;
    const n = line.length;
    while (i < n) {
      const c = line[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '"' || c === "'") {
        const quote = c;
        let j = i + 1;
        let buf = '';
        while (j < n && line[j] !== quote) { buf += line[j]; j++; }
        tokens.push(buf);
        i = j + 1;
        continue;
      }
      if (c === '|') { tokens.push('|'); i++; continue; }
      if (c === '>') {
        if (line[i + 1] === '>') { tokens.push('>>'); i += 2; }
        else { tokens.push('>'); i++; }
        continue;
      }
      let j = i;
      let buf = '';
      while (j < n && !' \t|>"\''.includes(line[j])) { buf += line[j]; j++; }
      tokens.push(buf);
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
    return `${typeChar}${node.perms} 1 jugador jugador ${size} ${name}${node.type === 'dir' ? '/' : ''}`;
  }

  function matchesGlob(name, pattern) {
    const re = new RegExp('^' + pattern.split('*').map(escapeRegex).join('.*') + '$');
    return re.test(name);
  }
  function escapeRegex(s) {
    return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
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
      if (!node) return fail(`ls: no se puede acceder a '${targetRaw}': No existe el archivo o directorio`);
      if (node.type === 'file') return ok(targetRaw);
      const names = Object.keys(node.children)
        .filter((n) => showAll || !n.startsWith('.'))
        .sort();
      if (!long) return ok(names.join('  '));
      return ok(names.map((n) => formatLongEntry(n, node.children[n])).join('\n'));
    },

    cd(args, stdin, ctx) {
      const target = args[0] || '~';
      const pathArr = ctx.vfs.normalize(target, ctx.getCwd());
      const node = ctx.vfs.getNode(pathArr);
      if (!node) return fail(`cd: no existe el directorio: ${target}`);
      if (node.type !== 'dir') return fail(`cd: no es un directorio: ${target}`);
      ctx.setCwd(pathArr);
      return ok('');
    },

    cat(args, stdin, ctx) {
      if (args.length === 0) return ok(stdin || '');
      const out = [];
      for (const a of args) {
        const p = ctx.vfs.normalize(a, ctx.getCwd());
        const node = ctx.vfs.getNode(p);
        if (!node) return fail(`cat: ${a}: No existe el archivo o directorio`);
        if (node.type === 'dir') return fail(`cat: ${a}: Es un directorio`);
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
      if (targets.length === 0) return fail('mkdir: falta un operando');
      for (const t of targets) {
        const pathArr = ctx.vfs.normalize(t, ctx.getCwd());
        if (recursive) {
          let node = ctx.vfs.root;
          for (const seg of pathArr) {
            if (!node.children[seg]) node.children[seg] = TA.vfsHelpers.dir();
            if (node.children[seg].type !== 'dir') return fail(`mkdir: '${t}': no es un directorio`);
            node = node.children[seg];
          }
        } else {
          const { parent, name } = ctx.vfs.getParent(pathArr);
          if (!parent || parent.type !== 'dir') return fail(`mkdir: no se puede crear el directorio '${t}': No existe el directorio padre`);
          if (parent.children[name]) return fail(`mkdir: no se puede crear el directorio '${t}': Ya existe`);
          parent.children[name] = TA.vfsHelpers.dir();
        }
      }
      return ok('');
    },

    rmdir(args, stdin, ctx) {
      const targets = args.filter((a) => !a.startsWith('-'));
      for (const t of targets) {
        const pathArr = ctx.vfs.normalize(t, ctx.getCwd());
        const node = ctx.vfs.getNode(pathArr);
        if (!node) return fail(`rmdir: no existe: ${t}`);
        if (node.type !== 'dir') return fail(`rmdir: no es un directorio: ${t}`);
        if (Object.keys(node.children).length > 0) return fail(`rmdir: el directorio no está vacío: ${t}`);
        const { parent, name } = ctx.vfs.getParent(pathArr);
        delete parent.children[name];
      }
      return ok('');
    },

    touch(args, stdin, ctx) {
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return fail('touch: falta un operando');
      for (const t of targets) {
        const pathArr = ctx.vfs.normalize(t, ctx.getCwd());
        const { parent, name } = ctx.vfs.getParent(pathArr);
        if (!parent || parent.type !== 'dir') return fail(`touch: no se puede crear '${t}': No existe el directorio padre`);
        if (!parent.children[name]) parent.children[name] = TA.vfsHelpers.file('');
      }
      return ok('');
    },

    rm(args, stdin, ctx) {
      const recursive = args.includes('-r') || args.includes('-rf') || args.includes('-fr') || args.includes('-R');
      const force = args.includes('-f') || args.includes('-rf') || args.includes('-fr');
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length === 0) return fail('rm: falta un operando');
      for (const t of targets) {
        const pathArr = ctx.vfs.normalize(t, ctx.getCwd());
        const node = ctx.vfs.getNode(pathArr);
        if (!node) {
          if (force) continue;
          return fail(`rm: no se puede eliminar '${t}': No existe el archivo o directorio`);
        }
        if (node.type === 'dir' && !recursive) {
          return fail(`rm: no se puede eliminar '${t}': Es un directorio (usa -r)`);
        }
        const { parent, name } = ctx.vfs.getParent(pathArr);
        delete parent.children[name];
      }
      return ok('');
    },

    cp(args, stdin, ctx) {
      const recursive = args.includes('-r') || args.includes('-R');
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length < 2) return fail('cp: se requieren un origen y un destino');
      const [srcRaw, destRaw] = targets;
      const srcPath = ctx.vfs.normalize(srcRaw, ctx.getCwd());
      const srcNode = ctx.vfs.getNode(srcPath);
      if (!srcNode) return fail(`cp: no se puede acceder a '${srcRaw}': No existe`);
      if (srcNode.type === 'dir' && !recursive) return fail(`cp: -r no especificado; se omite el directorio '${srcRaw}'`);

      let destPath = ctx.vfs.normalize(destRaw, ctx.getCwd());
      let destNode = ctx.vfs.getNode(destPath);
      let finalName = srcPath[srcPath.length - 1];
      if (destNode && destNode.type === 'dir') {
        destPath = [...destPath, finalName];
      } else {
        finalName = destPath[destPath.length - 1];
      }
      const { parent, name } = ctx.vfs.getParent(destPath);
      if (!parent || parent.type !== 'dir') return fail(`cp: no existe el directorio destino`);
      parent.children[name] = JSON.parse(JSON.stringify(srcNode));
      return ok('');
    },

    mv(args, stdin, ctx) {
      const targets = args.filter((a) => !a.startsWith('-'));
      if (targets.length < 2) return fail('mv: se requieren un origen y un destino');
      const [srcRaw, destRaw] = targets;
      const srcPath = ctx.vfs.normalize(srcRaw, ctx.getCwd());
      const srcNode = ctx.vfs.getNode(srcPath);
      if (!srcNode) return fail(`mv: no se puede mover '${srcRaw}': No existe`);

      let destPath = ctx.vfs.normalize(destRaw, ctx.getCwd());
      const destNode = ctx.vfs.getNode(destPath);
      if (destNode && destNode.type === 'dir') {
        destPath = [...destPath, srcPath[srcPath.length - 1]];
      }
      const { parent: destParent, name: destName } = ctx.vfs.getParent(destPath);
      if (!destParent || destParent.type !== 'dir') return fail('mv: no existe el directorio destino');
      const { parent: srcParent, name: srcName } = ctx.vfs.getParent(srcPath);
      destParent.children[destName] = srcNode;
      delete srcParent.children[srcName];
      return ok('');
    },

    grep(args, stdin, ctx) {
      const flags = args.filter((a) => a.startsWith('-')).join('');
      const ignoreCase = flags.includes('i');
      const rest = args.filter((a) => !a.startsWith('-'));
      if (rest.length === 0) return fail('grep: falta el patrón de búsqueda');
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
        const p = ctx.vfs.normalize(f, ctx.getCwd());
        const node = ctx.vfs.getNode(p);
        if (!node) return fail(`grep: ${f}: No existe el archivo o directorio`);
        if (node.type === 'dir') return fail(`grep: ${f}: Es un directorio`);
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
      if (!startNode) return fail(`find: '${startRaw}': No existe el archivo o directorio`);

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
      if (!mode || targets.length === 0) return fail('chmod: uso: chmod <modo> <archivo>');
      for (const t of targets) {
        const pathArr = ctx.vfs.normalize(t, ctx.getCwd());
        const node = ctx.vfs.getNode(pathArr);
        if (!node) return fail(`chmod: no existe: ${t}`);
        if (/^[0-7]{3}$/.test(mode)) {
          node.perms = octalToRwx(mode);
        } else if (/^[ugoa]*[+-][rwx]+$/.test(mode)) {
          node.perms = applySymbolicMode(node.perms, mode);
        } else {
          return fail(`chmod: modo inválido: '${mode}'`);
        }
      }
      return ok('');
    },

    whoami() {
      return ok('jugador');
    },

    wc(args, stdin, ctx) {
      const linesOnly = args.includes('-l');
      let text = stdin || '';
      const fileTargets = args.filter((a) => !a.startsWith('-'));
      if (fileTargets.length > 0) {
        const p = ctx.vfs.normalize(fileTargets[0], ctx.getCwd());
        const node = ctx.vfs.getNode(p);
        if (!node) return fail(`wc: ${fileTargets[0]}: No existe`);
        text = node.content;
      }
      const lines = text.split('\n').filter((l) => l.length > 0).length;
      if (linesOnly) return ok(String(lines));
      const words = text.split(/\s+/).filter(Boolean).length;
      return ok(`${lines} ${words} ${text.length}`);
    },

    sort(args, stdin, ctx) {
      let text = stdin || '';
      const fileTargets = args.filter((a) => !a.startsWith('-'));
      if (fileTargets.length > 0) {
        const p = ctx.vfs.normalize(fileTargets[0], ctx.getCwd());
        const node = ctx.vfs.getNode(p);
        if (!node) return fail(`sort: ${fileTargets[0]}: No existe`);
        text = node.content;
      }
      const lines = text.split('\n').filter((l) => l.length > 0);
      lines.sort();
      return ok(lines.join('\n'));
    },

    help(args) {
      const catalog = {
        pwd: 'Muestra el directorio actual.',
        ls: 'Lista archivos. Flags: -l (detalle), -a (ocultos).',
        cd: 'Cambia de directorio. Usa .. para subir, ~ para ir a casa.',
        cat: 'Muestra el contenido de un archivo.',
        echo: 'Imprime texto. Combínalo con > o >> para guardar en archivos.',
        mkdir: 'Crea directorios. Usa -p para crear rutas anidadas.',
        rmdir: 'Elimina un directorio vacío.',
        touch: 'Crea un archivo vacío.',
        rm: 'Elimina archivos. Usa -r para directorios.',
        cp: 'Copia archivos o directorios (-r).',
        mv: 'Mueve o renombra archivos y directorios.',
        grep: 'Busca texto dentro de archivos o de la entrada. Usa -i para ignorar mayúsculas.',
        find: 'Busca archivos por nombre: find <ruta> -name "patrón".',
        chmod: 'Cambia permisos: modo octal (755) o simbólico (+x).',
        whoami: 'Muestra el usuario actual.',
        wc: 'Cuenta líneas/palabras/caracteres. Usa -l para solo líneas.',
        sort: 'Ordena líneas de texto alfabéticamente.',
        clear: 'Limpia la pantalla de la terminal.',
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
    if (!parent || parent.type !== 'dir') return fail(`No existe el directorio para '${fileRaw}'`);
    const existing = parent.children[name];
    if (append && existing && existing.type === 'file') {
      existing.content = existing.content.length > 0 ? `${existing.content}\n${content}` : content;
    } else {
      parent.children[name] = TA.vfsHelpers.file(content);
    }
    return ok('');
  }

  function runLine(line, ctx) {
    const tokens = tokenize(line.trim());
    if (tokens.length === 0) return { ok: true, output: '', stages: [], raw: line };

    const stageTokenGroups = [[]];
    for (const t of tokens) {
      if (t === '|') stageTokenGroups.push([]);
      else stageTokenGroups[stageTokenGroups.length - 1].push(t);
    }

    let redirect = null;
    const lastIdx = stageTokenGroups.length - 1;
    const lastTokens = stageTokenGroups[lastIdx];
    const redirIdx = lastTokens.findIndex((t) => t === '>' || t === '>>');
    if (redirIdx !== -1) {
      redirect = { append: lastTokens[redirIdx] === '>>', file: lastTokens[redirIdx + 1] };
      stageTokenGroups[lastIdx] = lastTokens.slice(0, redirIdx);
    }

    let stdin = '';
    let lastErr = null;
    const stages = [];
    for (const stageTokens of stageTokenGroups) {
      if (stageTokens.length === 0) { lastErr = 'Error de sintaxis'; break; }
      const [cmd, ...args] = stageTokens;
      const fn = COMMANDS[cmd];
      if (!fn) {
        lastErr = `${cmd}: comando no encontrado`;
        stages.push({ cmd, args, output: '', error: lastErr });
        break;
      }
      const result = fn(args, stdin, ctx);
      stages.push({ cmd, args, output: result.output || '', error: result.error || null });
      if (result.error) { lastErr = result.error; break; }
      stdin = result.output || '';
    }

    if (!lastErr && redirect) {
      const r = writeRedirect(ctx, redirect.file, stdin, redirect.append);
      if (r.error) lastErr = r.error;
      else stdin = '';
    }

    return { ok: !lastErr, output: lastErr || stdin, stages, raw: line };
  }

  TA.Shell = { runLine, tokenize, COMMANDS };
})();
