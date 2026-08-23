import { supabase, isCloudConfigured } from './supabaseClient.js'

let currentUser = null
const listeners = new Set()

function notify() {
  for (const fn of listeners) fn(currentUser)
}

export function onAuthChange(fn) {
  listeners.add(fn)
  fn(currentUser)
  return () => listeners.delete(fn)
}

export function getUser() {
  return currentUser
}

export async function initAuth() {
  if (!isCloudConfigured) return

  const { data } = await supabase.auth.getSession()
  currentUser = data.session?.user ?? null
  notify()

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null
    notify()
  })
}

export async function sendMagicLink(email) {
  if (!isCloudConfigured) throw new Error('La sincronización en la nube no está configurada.')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signOut() {
  if (!isCloudConfigured) return
  await supabase.auth.signOut()
}
