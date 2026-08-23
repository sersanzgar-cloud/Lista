import { isCloudConfigured } from '../lib/supabaseClient.js'
import { getUser, onAuthChange, sendMagicLink, signOut } from '../lib/auth.js'
import { listBooks, addBook, deleteBook, getProgress } from '../lib/store.js'
import { extractTextFromPdf, extractTextFromTxt } from '../lib/pdf.js'

export async function renderLibrary(root) {
  root.innerHTML = `
    <div class="page">
      <header class="topbar">
        <h1>📖 Lista</h1>
        <div id="auth-widget" class="auth-widget"></div>
      </header>

      <div id="sync-banner" class="banner"></div>

      <section class="upload-box">
        <label class="upload-label">
          <input id="file-input" type="file" accept=".pdf,.txt,application/pdf,text/plain" hidden />
          <span id="upload-text">📤 Subir un PDF o TXT</span>
        </label>
      </section>

      <section id="book-list" class="book-list">
        <p class="muted">Cargando tu biblioteca…</p>
      </section>
    </div>
  `

  renderAuthWidget(root)
  renderSyncBanner(root)

  const unsubscribe = onAuthChange(() => {
    renderAuthWidget(root)
    renderSyncBanner(root)
    loadBooks(root)
  })
  window.addEventListener('hashchange', unsubscribe, { once: true })

  root.querySelector('#file-input').addEventListener('change', (e) => handleUpload(root, e))

  await loadBooks(root)
}

function renderSyncBanner(root) {
  const banner = root.querySelector('#sync-banner')
  if (!banner) return

  if (!isCloudConfigured) {
    banner.innerHTML = `Guardado solo en este navegador. Configura Supabase (ver README) para escuchar tus libros y seguir por donde ibas desde cualquier dispositivo.`
    banner.hidden = false
  } else if (!getUser()) {
    banner.innerHTML = `Inicia sesión abajo para sincronizar tu biblioteca y tu progreso entre dispositivos.`
    banner.hidden = false
  } else {
    banner.hidden = true
  }
}

function renderAuthWidget(root) {
  const el = root.querySelector('#auth-widget')
  if (!el || !isCloudConfigured) {
    if (el) el.innerHTML = ''
    return
  }

  const user = getUser()
  if (user) {
    el.innerHTML = `
      <span class="muted">${user.email}</span>
      <button id="sign-out-btn" class="btn-ghost">Salir</button>
    `
    el.querySelector('#sign-out-btn').addEventListener('click', () => signOut())
  } else {
    el.innerHTML = `
      <form id="login-form" class="login-form">
        <input id="login-email" type="email" placeholder="tu@email.com" required />
        <button type="submit" class="btn-ghost">Entrar</button>
      </form>
    `
    el.querySelector('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = el.querySelector('#login-email').value
      const btn = e.target.querySelector('button')
      btn.disabled = true
      btn.textContent = 'Enviando…'
      try {
        await sendMagicLink(email)
        el.innerHTML = `<span class="muted">Revisa tu correo (${email}) para el enlace de acceso.</span>`
      } catch (err) {
        btn.disabled = false
        btn.textContent = 'Entrar'
        alert(err.message)
      }
    })
  }
}

async function loadBooks(root) {
  const list = root.querySelector('#book-list')
  if (!list) return

  try {
    const books = await listBooks()
    if (books.length === 0) {
      list.innerHTML = `<p class="muted">Todavía no has subido ningún libro.</p>`
      return
    }

    const withProgress = await Promise.all(
      books.map(async (b) => ({ ...b, position: await getProgress(b.id) })),
    )

    list.innerHTML = withProgress
      .map((b) => {
        const percent = b.charCount ? Math.min(100, Math.round((b.position / b.charCount) * 100)) : 0
        return `
          <article class="book-card">
            <a class="book-title" href="#/book/${b.id}">${escapeHtml(b.title)}</a>
            <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
            <div class="book-meta">
              <span class="muted">${percent > 0 ? `${percent}% escuchado` : 'Sin empezar'}</span>
              <button class="btn-icon" data-delete="${b.id}" title="Eliminar" aria-label="Eliminar">🗑️</button>
            </div>
          </article>
        `
      })
      .join('')

    list.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este libro de tu biblioteca?')) return
        await deleteBook(btn.dataset.delete)
        loadBooks(root)
      })
    })
  } catch (err) {
    console.error(err)
    list.innerHTML = `<p class="error">No se pudo cargar tu biblioteca: ${escapeHtml(err.message)}</p>`
  }
}

async function handleUpload(root, event) {
  const file = event.target.files[0]
  if (!file) return

  const label = root.querySelector('#upload-text')
  const original = label.textContent
  label.textContent = '⏳ Procesando…'

  try {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const content = isPdf ? await extractTextFromPdf(file) : await extractTextFromTxt(file)

    if (!content.trim()) {
      throw new Error('No se pudo extraer texto de este archivo.')
    }

    const title = file.name.replace(/\.(pdf|txt)$/i, '')
    const id = await addBook({ title, sourceType: isPdf ? 'pdf' : 'text', content })
    window.location.hash = `#/book/${id}`
  } catch (err) {
    console.error(err)
    alert(`No se pudo subir el archivo: ${err.message}`)
  } finally {
    label.textContent = original
    event.target.value = ''
  }
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
