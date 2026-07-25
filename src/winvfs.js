// Sistema de archivos virtual estilo Windows para Terminal Academy (unidad C:\, rutas con backslash).
window.TA = window.TA || {};

(function () {
  function file(content = '', attrs = {}) {
    return { type: 'file', content, attrs: { hidden: false, readonly: false, ...attrs } };
  }

  function dir(children = {}, attrs = {}) {
    return { type: 'dir', children, attrs: { hidden: false, readonly: false, ...attrs } };
  }

  function findChildCI(node, name) {
    if (!node || node.type !== 'dir') return undefined;
    if (Object.prototype.hasOwnProperty.call(node.children, name)) return name;
    const lower = name.toLowerCase();
    return Object.keys(node.children).find((k) => k.toLowerCase() === lower);
  }

  class WinVFS {
    constructor(root) {
      this.root = root;
    }

    // Acepta rutas absolutas (C:\..., \...) o relativas al cwd actual, con / o \ como separador.
    normalize(input, cwd) {
      const raw = String(input).replace(/\//g, '\\');
      let parts;
      if (/^[a-zA-Z]:\\?/.test(raw)) {
        parts = raw.replace(/^[a-zA-Z]:\\?/, '').split('\\');
      } else if (raw.startsWith('\\')) {
        parts = raw.slice(1).split('\\');
      } else {
        parts = [...cwd, ...raw.split('\\')];
      }
      const out = [];
      for (const p of parts) {
        if (p === '' || p === '.') continue;
        if (p === '..') {
          out.pop();
          continue;
        }
        out.push(p);
      }
      return out;
    }

    getNode(pathArr) {
      let node = this.root;
      for (const seg of pathArr) {
        if (!node || node.type !== 'dir') return null;
        const key = findChildCI(node, seg);
        node = key !== undefined ? node.children[key] : undefined;
      }
      return node || null;
    }

    getParent(pathArr) {
      if (pathArr.length === 0) return null;
      return this.getNode(pathArr.slice(0, -1));
    }

    exists(pathArr) {
      return !!this.getNode(pathArr);
    }

    pathToStr(pathArr) {
      return pathArr.length === 0 ? 'C:\\' : `C:\\${pathArr.join('\\')}`;
    }
  }

  TA.WinVFS = WinVFS;
  TA.winHelpers = { file, dir, findChildCI };
})();
