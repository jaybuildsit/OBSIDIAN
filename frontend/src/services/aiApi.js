export const streamAgent = async (message, projectId, onEvent) => {
  const response = await fetch('/api/ai/invoke', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ message, projectId }) })
  if (!response.ok || !response.body) throw new Error('AI agent failed to start.')
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = ''
  while (true) {
    const { value, done } = await reader.read(); if (done) break
    buffer += decoder.decode(value, { stream: true })
    const entries = buffer.split(/\r?\n\r?\n/); buffer = entries.pop() || ''
    entries.forEach((entry) => { const event = entry.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n') || entry.trim(); if (event && event !== '[DONE]') onEvent(event) })
  }
  if (buffer.trim()) onEvent(buffer)
}
