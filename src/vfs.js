// Sistema de archivos virtual (VFS) para Terminal Academy.
window.TA = window.TA || {};

(function () {
  const OCTAL_TO_RWX = {
    0: '---', 1: '--x', 2: '-w-', 3: '-wx',
    4: 'r--', 5: 'r-x', 6: 'rw-', 7: 'rwx',
  };

  function file(content = '', perms = 'rw-r--r--') {
    return { type: 'file', perms, content };
  }

  function dir(children = {}, perms = 'rwxr-xr-x') {
    return { type: 'dir', perms, children };
  }

  function octalToRwx(mode) {
    return String(mode)
      .split('')
      .map((d) => OCTAL_TO_RWX[d] ?? '---')
      .join('');
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

    getNode(pathArr) {
      let node = this.root;
      for (const seg of pathArr) {
        if (!node || node.type !== 'dir' || !node.children[seg]) return null;
        node = node.children[seg];
      }
      return node;
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
  TA.vfsHelpers = { file, dir, octalToRwx };
})();
