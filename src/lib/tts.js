// Thin wrapper around the Web Speech API (SpeechSynthesis).
//
// Text is split into sentence-sized chunks so we can (a) know, at all
// times, the character offset the narration is currently at — which is
// what gets saved as "where I left off" — and (b) avoid the truncation
// bugs some browsers have with very long single utterances.

const SENTENCE_RE = /[^.!?\n]+[.!?]*(?:\s+|\n+|$)/g

export function splitIntoChunks(text) {
  const chunks = []
  SENTENCE_RE.lastIndex = 0
  let match
  while ((match = SENTENCE_RE.exec(text))) {
    const trimmed = match[0].trim()
    if (trimmed) {
      chunks.push({ start: match.index, end: match.index + match[0].length, text: trimmed })
    }
  }
  return chunks
}

export function getVoices() {
  return speechSynthesis.getVoices()
}

export function onVoicesChanged(fn) {
  speechSynthesis.addEventListener('voiceschanged', fn)
}

export function isSupported() {
  return 'speechSynthesis' in window
}

export function createReader(text, { rate = 1, voiceURI = null, onChunkStart, onEnd } = {}) {
  const chunks = splitIntoChunks(text)
  let index = 0
  let stopped = true

  function speakFrom(i) {
    if (stopped || i >= chunks.length) {
      stopped = true
      onEnd?.()
      return
    }
    index = i
    const chunk = chunks[i]
    const utterance = new SpeechSynthesisUtterance(chunk.text)
    utterance.rate = rate
    const voice = getVoices().find((v) => v.voiceURI === voiceURI)
    if (voice) utterance.voice = voice

    utterance.onstart = () => onChunkStart?.(chunk, i)
    utterance.onend = () => {
      if (!stopped) speakFrom(i + 1)
    }
    utterance.onerror = (event) => {
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        console.error('Error de síntesis de voz:', event.error)
      }
    }

    speechSynthesis.speak(utterance)
  }

  return {
    chunks,

    play(fromCharIndex = 0) {
      stopped = false
      speechSynthesis.cancel()
      const startIndex = chunks.findIndex((c) => c.end > fromCharIndex)
      speakFrom(startIndex === -1 ? 0 : startIndex)
    },

    pause() {
      speechSynthesis.pause()
    },

    resume() {
      speechSynthesis.resume()
    },

    stop() {
      stopped = true
      speechSynthesis.cancel()
    },

    setRate(value) {
      rate = value
    },

    setVoice(uri) {
      voiceURI = uri
    },

    currentChunk() {
      return chunks[index] ?? null
    },
  }
}
