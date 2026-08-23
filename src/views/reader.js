import { getBookMeta, getBookContent, getProgress, setProgress } from '../lib/store.js'
import { createReader, getVoices, onVoicesChanged, isSupported, splitIntoChunks } from '../lib/tts.js'

const RATE_KEY = 'lista:rate'
const VOICE_KEY = 'lista:voice'

// Kept at module scope so navigating away (hash change) can always stop
// any in-flight narration, even if this module is re-entered for a
// different book before the previous view finished tearing down.
let activeReader = null

export async function renderReader(root, bookId) {
  stopActiveReader()

  root.innerHTML = `
    <div class="page reader-page">
      <header class="topbar">
        <a href="#/" class="btn-ghost">← Biblioteca</a>
        <h1 id="book-title">Cargando…</h1>
      </header>
      <div id="reader-body"></div>
    </div>
  `

  if (!isSupported()) {
    root.querySelector('#reader-body').innerHTML = `
      <p class="error">Tu navegador no soporta la síntesis de voz (Web Speech API). Prueba con Chrome, Edge o Safari.</p>
    `
    return
  }

  let meta, content, savedPosition
  try {
    ;[meta, content, savedPosition] = await Promise.all([
      getBookMeta(bookId),
      getBookContent(bookId),
      getProgress(bookId),
    ])
  } catch (err) {
    root.querySelector('#reader-body').innerHTML = `<p class="error">No se pudo cargar el libro: ${err.message}</p>`
    return
  }

  if (!meta || !content) {
    root.querySelector('#reader-body').innerHTML = `<p class="error">Libro no encontrado.</p>`
    return
  }

  root.querySelector('#book-title').textContent = meta.title

  const body = root.querySelector('#reader-body')
  body.innerHTML = `
    <div class="controls">
      <button id="play-btn" class="btn-primary">▶️ Reproducir</button>
      <button id="stop-btn" class="btn-ghost">⏹️ Detener</button>
      <select id="rate-select" title="Velocidad">
        ${[0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => `<option value="${r}">${r}×</option>`).join('')}
      </select>
      <select id="voice-select" title="Voz"></select>
    </div>
    <p id="status-line" class="muted">Sin empezar</p>
    <div id="book-text" class="book-text"></div>
  `

  const chunks = splitIntoChunks(content)
  const textEl = body.querySelector('#book-text')
  const frag = document.createDocumentFragment()
  chunks.forEach((chunk, i) => {
    const span = document.createElement('span')
    span.className = 'chunk'
    span.dataset.index = String(i)
    span.textContent = chunk.text + ' '
    frag.appendChild(span)
  })
  textEl.appendChild(frag)
  const chunkEls = textEl.querySelectorAll('.chunk')

  const playBtn = body.querySelector('#play-btn')
  const stopBtn = body.querySelector('#stop-btn')
  const rateSelect = body.querySelector('#rate-select')
  const voiceSelect = body.querySelector('#voice-select')
  const statusLine = body.querySelector('#status-line')

  const savedRate = Number(localStorage.getItem(RATE_KEY)) || 1
  rateSelect.value = String(savedRate)

  populateVoices(voiceSelect)
  onVoicesChanged(() => populateVoices(voiceSelect))

  let currentPosition = Math.min(savedPosition, content.length)
  let currentChunkEl = null
  let state = 'idle' // idle | playing | paused
  let lastSavedAt = 0

  const reader = createReader(content, {
    rate: savedRate,
    voiceURI: localStorage.getItem(VOICE_KEY) || null,
    onChunkStart(chunk, index) {
      currentPosition = chunk.start
      if (currentChunkEl) currentChunkEl.classList.remove('current')
      currentChunkEl = chunkEls[index]
      currentChunkEl?.classList.add('current')
      currentChunkEl?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      updateStatus()
      saveProgress()
    },
    onEnd() {
      state = 'idle'
      currentPosition = content.length
      playBtn.textContent = '▶️ Reproducir'
      updateStatus()
      saveProgress(true)
    },
  })
  activeReader = reader

  function updateStatus() {
    const percent = content.length ? Math.min(100, Math.round((currentPosition / content.length) * 100)) : 0
    const labels = { idle: 'Sin empezar', playing: 'Reproduciendo', paused: 'En pausa' }
    statusLine.textContent = `${labels[state]} · ${percent}%`
  }

  function saveProgress(force = false) {
    const now = Date.now()
    if (!force && now - lastSavedAt < 4000) return
    lastSavedAt = now
    setProgress(bookId, currentPosition).catch((err) => console.error('No se pudo guardar el progreso', err))
  }

  playBtn.addEventListener('click', () => {
    if (state === 'playing') {
      reader.pause()
      state = 'paused'
      playBtn.textContent = '▶️ Reanudar'
      saveProgress(true)
    } else if (state === 'paused') {
      reader.resume()
      state = 'playing'
      playBtn.textContent = '⏸️ Pausar'
    } else {
      reader.play(currentPosition)
      state = 'playing'
      playBtn.textContent = '⏸️ Pausar'
    }
    updateStatus()
  })

  stopBtn.addEventListener('click', () => {
    reader.stop()
    state = 'idle'
    playBtn.textContent = '▶️ Reproducir'
    updateStatus()
    saveProgress(true)
  })

  rateSelect.addEventListener('change', () => {
    const rate = Number(rateSelect.value)
    reader.setRate(rate)
    localStorage.setItem(RATE_KEY, String(rate))
    if (state === 'playing') reader.play(currentPosition)
  })

  voiceSelect.addEventListener('change', () => {
    reader.setVoice(voiceSelect.value)
    localStorage.setItem(VOICE_KEY, voiceSelect.value)
    if (state === 'playing') reader.play(currentPosition)
  })

  textEl.addEventListener('click', (e) => {
    const span = e.target.closest('.chunk')
    if (!span) return
    const index = Number(span.dataset.index)
    currentPosition = chunks[index].start
    reader.play(currentPosition)
    state = 'playing'
    playBtn.textContent = '⏸️ Pausar'
    updateStatus()
  })

  window.addEventListener('hashchange', () => stopActiveReader(), { once: true })
  window.addEventListener('pagehide', () => saveProgress(true), { once: true })

  updateStatus()
}

function populateVoices(select) {
  const voices = getVoices()
  if (voices.length === 0) return

  const saved = localStorage.getItem(VOICE_KEY)
  const sorted = [...voices].sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))
  select.innerHTML = sorted.map((v) => `<option value="${v.voiceURI}">${v.name} (${v.lang})</option>`).join('')

  const preferred = saved && sorted.some((v) => v.voiceURI === saved) ? saved : sorted[0]?.voiceURI
  if (preferred) select.value = preferred
}

function stopActiveReader() {
  if (activeReader) {
    activeReader.stop()
    activeReader = null
  }
}
