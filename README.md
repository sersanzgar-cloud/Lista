# Lista — Audiolibros

Sube un PDF o un TXT y Lista te lo lee en voz alta, frase a frase, guardando
siempre por dónde te has quedado para poder continuar más tarde.

**App en vivo:** https://sersanzgar-cloud.github.io/Lista/ (requiere activar
GitHub Pages una vez, ver [Publicar en GitHub Pages](#publicar-en-github-pages)).

## Funcionalidad

- Subida de libros en **PDF** o **TXT** (el texto se extrae en el propio navegador con `pdf.js`).
- Lectura en voz alta con la **Web Speech API** del navegador: controles de reproducir/pausar/detener, velocidad y selector de voz.
- El texto se resalta frase a frase mientras se lee, y puedes tocar cualquier frase para saltar la narración a ese punto.
- El progreso de lectura (posición exacta) se guarda automáticamente.
- Biblioteca con todos tus libros y el porcentaje escuchado de cada uno.

## Arranque rápido

```bash
npm install
npm run dev
```

Sin más configuración, la app funciona guardando la biblioteca y el
progreso **solo en este navegador** (`localStorage`). Es perfecto para
probarla, pero el progreso no viajará a otro dispositivo ni sobrevivirá a
borrar los datos del navegador.

## Sincronizar en la nube (progreso disponible en cualquier dispositivo)

Lista usa [Supabase](https://supabase.com) (Postgres + Auth + Storage,
plan gratuito) como backend opcional. Cuando está configurado, iniciar
sesión con tu email sincroniza tu biblioteca y tu progreso entre
dispositivos automáticamente.

1. Crea un proyecto gratuito en [supabase.com](https://supabase.com).
2. En el **SQL Editor** del proyecto, ejecuta el contenido de
   [`supabase/schema.sql`](supabase/schema.sql) — crea las tablas de libros
   y progreso con Row Level Security, de forma que cada usuario solo puede
   ver y modificar sus propios datos.
3. En **Project Settings → API**, copia la `Project URL` y la clave
   `anon public`.
4. Copia `.env.example` a `.env` y rellena esos dos valores:

   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica
   ```

5. Reinicia `npm run dev`. La app detectará la configuración y mostrará un
   formulario de inicio de sesión (enlace mágico por email, sin
   contraseña) en la biblioteca.

Estas dos claves son públicas por diseño (se usan desde el navegador); la
seguridad la da la Row Level Security del paso 2, no el secreto de la
clave.

## Publicar en GitHub Pages

El repositorio incluye un workflow (`.github/workflows/deploy-pages.yml`)
que compila la app y la publica en GitHub Pages automáticamente en cada
push a `claude/mobile-game-qixyc3` (la rama por defecto de este
repositorio — no tiene ninguna rama llamada `main`). Solo falta un paso
manual, una única vez:

1. En GitHub, ve a **Settings → Pages** del repositorio.
2. En **Source**, selecciona **GitHub Actions** (en vez de "Deploy from a
   branch").

Con eso, cada push a la rama por defecto compilará y publicará la app en
`https://sersanzgar-cloud.github.io/Lista/`. También puedes lanzar el
despliegue a mano desde la pestaña **Actions → Deploy to GitHub Pages →
Run workflow**.

## Sobre la voz

Por defecto se usa la síntesis de voz integrada del navegador/sistema
operativo (gratis, sin backend, funciona offline). La calidad varía según
el dispositivo: en Chrome/Edge/Safari de escritorio suele sonar razonablemente
natural; en algunos Android/Linux puede sonar más robótica.

El código está organizado para poder sustituir `src/lib/tts.js` por una
integración con una API de voz más realista (ElevenLabs, OpenAI, Google
Cloud TTS, Azure) el día que se quiera dar el salto — esa parte necesitaría
un pequeño backend para no exponer la clave de esa API en el navegador.

## Estructura del proyecto

```
src/
  lib/
    supabaseClient.js   Cliente de Supabase (o null si no está configurado)
    auth.js             Login por enlace mágico / logout / estado de sesión
    store.js            Biblioteca y progreso: localStorage o Supabase según haya sesión
    pdf.js               Extracción de texto de PDF/TXT
    tts.js               Envoltorio sobre la Web Speech API
  views/
    library.js           Pantalla de biblioteca (subir, listar, borrar)
    reader.js             Pantalla de lectura/reproducción
supabase/
  schema.sql              Tablas + políticas de Row Level Security
```

## Limitaciones conocidas (MVP)

- La pausa/reanudación exacta de `speechSynthesis` puede comportarse de
  forma distinta entre navegadores; si falla, "Detener" siempre permite
  reanudar desde la última frase leída.
- Libros muy largos generan muchos elementos de texto en pantalla; es
  suficiente hasta un libro de tamaño normal, pero se podría virtualizar
  la lista de frases si hiciera falta más rendimiento.
