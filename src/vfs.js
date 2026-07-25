// Sistema de archivos virtual (VFS) para Terminal Academy.
window.TA = window.TA || {};

(function () {
  const OCTAL_TO_RWX = {
    0: '---', 1: '--x', 2: '-w-', 3: '-wx',
    4: 'r--', 5: 'r-x', 6: 'rw-', 7: 'rwx',
  };

  function file(content = '', perms = 'rw-r--r--', owner = 'jugador', group = 'jugador') {
    return { type: 'file', perms, content, owner, group };
  }

  function dir(children = {}, perms = 'rwxr-xr-x', owner = 'jugador', group = 'jugador') {
    return { type: 'dir', perms, children, owner, group };
  }

  function symlink(target, owner = 'jugador', group = 'jugador') {
    return { type: 'symlink', target, perms: 'rwxrwxrwx', owner, group };
  }

  function octalToRwx(mode) {
    return String(mode)
      .split('')
      .map((d) => OCTAL_TO_RWX[d] ?? '---')
      .join('');
  }

  const PERM_INDEX = { r: 0, w: 1, x: 2 };

  // ¿Puede `user` (miembro de `userGroups`) hacer `kind` (r/w/x) sobre este nodo?
  function hasPermission(node, kind, user, userGroups) {
    const idx = PERM_INDEX[kind];
    let base;
    if (node.owner === user) base = 0;
    else if (userGroups && userGroups.includes(node.group)) base = 3;
    else base = 6;
    return node.perms[base + idx] !== '-';
  }

  function applyUmask(perms, umask) {
    // umask resta permisos (como en Linux real) a partir de los "default" 666/777.
    const bits = 'rwx';
    const digits = String(umask).padStart(3, '0').split('').map(Number);
    return [0, 1, 2].map((triple) => {
      const maskDigit = digits[triple];
      let out = '';
      for (let i = 0; i < 3; i++) {
        const bit = 1 << (2 - i);
        const allowedBySource = perms[triple * 3 + i] !== '-';
        const blockedByUmask = (maskDigit & bit) !== 0;
        out += (allowedBySource && !blockedByUmask) ? bits[i] : '-';
      }
      return out;
    }).join('');
  }

  class VFS {
    constructor(tree) {
      this.root = tree;
    }

    // Convierte una ruta (relativa, absoluta o con ~) en un array de segmentos absolutos.
    normalize(pathStr, cwdArr) {
      let parts;
      if (!pathStr || pathStr === '.') {
        parts = [...cwdArr];
      } else if (pathStr.startsWith('/')) {
        parts = pathStr.split('/');
      } else if (pathStr === '~') {
        parts = ['home', 'jugador'];
      } else if (pathStr.startsWith('~/')) {
        parts = ['home', 'jugador', ...pathStr.slice(2).split('/')];
      } else {
        parts = [...cwdArr, ...pathStr.split('/')];
      }
      const stack = [];
      for (const p of parts) {
        if (p === '' || p === '.') continue;
        if (p === '..') stack.pop();
        else stack.push(p);
      }
      return stack;
    }

    pathToStr(arr) {
      return '/' + arr.join('/');
    }

    // Resuelve una ruta siguiendo enlaces simbólicos (intermedios y finales), como haría
    // el kernel real. `depth` evita bucles infinitos con enlaces que se apuntan entre sí.
    getNode(pathArr, depth = 0) {
      if (depth > 10) return null;
      let node = this.root;
      let dirPath = [];
      for (let i = 0; i < pathArr.length; i++) {
        const seg = pathArr[i];
        if (!node || node.type !== 'dir' || !node.children[seg]) return null;
        let child = node.children[seg];
        if (child.type === 'symlink') {
          const targetPath = this.normalize(child.target, dirPath);
          const resolved = this.getNode(targetPath, depth + 1);
          if (!resolved) return null;
          if (i === pathArr.length - 1) return resolved;
          if (resolved.type !== 'dir') return null;
          node = resolved;
          dirPath = targetPath;
          continue;
        }
        node = child;
        dirPath = [...dirPath, seg];
      }
      return node;
    }

    // Como getNode, pero sin seguir el enlace si el ÚLTIMO componente es un symlink
    // (para comandos como "ls -l" que deben mostrar el enlace en sí, no su destino).
    getNodeNoFollow(pathArr) {
      if (pathArr.length === 0) return this.getNode(pathArr);
      const { parent } = this.getParent(pathArr);
      if (!parent || parent.type !== 'dir') return null;
      return parent.children[pathArr[pathArr.length - 1]] || null;
    }

    getParent(pathArr) {
      if (pathArr.length === 0) return { parent: null, name: null };
      const parentPath = pathArr.slice(0, -1);
      const name = pathArr[pathArr.length - 1];
      const parent = this.getNode(parentPath);
      return { parent, name };
    }

    exists(pathArr) {
      return this.getNode(pathArr) !== null;
    }
  }

  TA.VFS = VFS;
  TA.vfsHelpers = { file, dir, symlink, octalToRwx, hasPermission, applyUmask };
})();
