import './style.css'
import { initAuth } from './lib/auth.js'
import { renderLibrary } from './views/library.js'
import { renderReader } from './views/reader.js'

const app = document.getElementById('app')

async function router() {
  const match = window.location.hash.match(/^#\/book\/(.+)$/)
  if (match) {
    await renderReader(app, decodeURIComponent(match[1]))
  } else {
    await renderLibrary(app)
  }
}

window.addEventListener('hashchange', router)

initAuth().then(router)
