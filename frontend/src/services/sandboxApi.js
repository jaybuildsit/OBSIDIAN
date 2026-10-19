const apiJson = async (response) => { const body = await response.text(); try { return body ? JSON.parse(body) : {} } catch { return {} } }
export const sandboxHost = (sandboxId) => `http://${sandboxId}.agent.localhost`
export const createSandbox = async () => {
  const response = await fetch('/api/sandbox/create/', { method: 'POST' })
  const payload = await apiJson(response)
  if (!response.ok || !payload.sandboxId || !payload.previewUrl) throw new Error(payload.message || 'Sandbox creation failed.')
  return payload
}
export const listFiles = async (sandboxId) => {
  const response = await fetch(`${sandboxHost(sandboxId)}/list-files`)
  const payload = await apiJson(response)
  if (!response.ok) throw new Error(payload.message || 'Unable to load workspace files.')
  return payload.elements || []
}
export const readFile = async (sandboxId, file) => {
  const response = await fetch(`${sandboxHost(sandboxId)}/read-files?files=${encodeURIComponent(file)}`)
  const payload = await apiJson(response)
  if (!response.ok || !payload.files?.[file]) throw new Error(payload.message || `Unable to read ${file}.`)
  return payload.files[file]
}
export const updateFile = async (sandboxId, file, content) => {
  const response = await fetch(`${sandboxHost(sandboxId)}/update-files`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: [{ file, content }] }) })
  if (!response.ok) throw new Error('Unable to save changes.')
}
