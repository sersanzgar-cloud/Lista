// Storage abstraction: keeps the rest of the app oblivious to whether a
// book's text and reading progress live in this browser only
// (localStorage) or are synced to Supabase for the signed-in user.

import { supabase, isCloudConfigured } from './supabaseClient.js'
import { getUser } from './auth.js'

const INDEX_KEY = 'lista:books'
const bookKey = (id) => `lista:book:${id}`
const progressKey = (id) => `lista:progress:${id}`

function useCloud() {
  return isCloudConfigured && Boolean(getUser())
}

function readIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY)) ?? []
  } catch {
    return []
  }
}

function writeIndex(list) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list))
}

function uuid() {
  return crypto.randomUUID()
}

export async function listBooks() {
  if (useCloud()) {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, source_type, char_count, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data.map((b) => ({
      id: b.id,
      title: b.title,
      sourceType: b.source_type,
      charCount: b.char_count,
      createdAt: b.created_at,
    }))
  }

  return readIndex().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function addBook({ title, sourceType, content }) {
  if (useCloud()) {
    const { data, error } = await supabase
      .from('books')
      .insert({
        user_id: getUser().id,
        title,
        source_type: sourceType,
        content,
        char_count: content.length,
      })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }

  const id = uuid()
  const meta = { id, title, sourceType, charCount: content.length, createdAt: new Date().toISOString() }
  const index = readIndex()
  index.push(meta)
  writeIndex(index)
  localStorage.setItem(bookKey(id), content)
  return id
}

export async function getBookMeta(id) {
  if (useCloud()) {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, source_type, char_count, created_at')
      .eq('id', id)
      .single()
    if (error) throw error
    return { id: data.id, title: data.title, sourceType: data.source_type, charCount: data.char_count, createdAt: data.created_at }
  }

  return readIndex().find((b) => b.id === id) ?? null
}

export async function getBookContent(id) {
  if (useCloud()) {
    const { data, error } = await supabase.from('books').select('content').eq('id', id).single()
    if (error) throw error
    return data.content
  }

  return localStorage.getItem(bookKey(id)) ?? ''
}

export async function deleteBook(id) {
  if (useCloud()) {
    const { error } = await supabase.from('books').delete().eq('id', id)
    if (error) throw error
    return
  }

  writeIndex(readIndex().filter((b) => b.id !== id))
  localStorage.removeItem(bookKey(id))
  localStorage.removeItem(progressKey(id))
}

export async function getProgress(id) {
  if (useCloud()) {
    const { data, error } = await supabase
      .from('reading_progress')
      .select('position')
      .eq('book_id', id)
      .maybeSingle()
    if (error) throw error
    return data?.position ?? 0
  }

  return Number(localStorage.getItem(progressKey(id))) || 0
}

export async function setProgress(id, position) {
  if (useCloud()) {
    const { error } = await supabase
      .from('reading_progress')
      .upsert(
        { book_id: id, user_id: getUser().id, position, updated_at: new Date().toISOString() },
        { onConflict: 'book_id' },
      )
    if (error) throw error
    return
  }

  localStorage.setItem(progressKey(id), String(position))
}
