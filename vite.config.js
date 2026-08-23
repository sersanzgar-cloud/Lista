import { defineConfig } from 'vite'

// GitHub Pages serves project sites from https://<user>.github.io/<repo>/,
// so assets must be referenced under that subpath in production. Locally
// (`vite`/`vite preview`) this has no effect and the app still serves from "/".
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Lista/' : '/',
})
