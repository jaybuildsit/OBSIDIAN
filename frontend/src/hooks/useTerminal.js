import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { io } from 'socket.io-client'
import { sandboxHost } from '../services/sandboxApi'

export function useTerminal(sandboxId, setStatus) {
  const terminalMount = useRef(null)

  useEffect(() => {
    if (!sandboxId || !terminalMount.current) return undefined
    const term = new Terminal({ cursorBlink: true, fontFamily: 'DM Mono, Consolas, monospace', fontSize: 12, lineHeight: 1.45, theme: { background: '#1d1916', foreground: '#e8dfd3', cursor: '#dc8a62', black: '#1d1916', brightBlack: '#8c8177', green: '#b8c791', brightGreen: '#c8d8a3', yellow: '#ddbd7b', brightYellow: '#eed093', blue: '#91b2ba', brightBlue: '#a7c7cf' } })
    const fit = new FitAddon(); term.loadAddon(fit); term.open(terminalMount.current); fit.fit(); term.writeln('\x1b[38;2;220;138;98mOBSIDIAN terminal\x1b[0m  ·  connecting to workspace…')
    const socket = io(sandboxHost(sandboxId), { transports: ['websocket', 'polling'] })
    socket.on('connect', () => { setStatus('Connected'); term.writeln('\x1b[38;2;184;199;145m● Connected\x1b[0m') })
    socket.on('disconnect', () => setStatus('Disconnected'))
    socket.on('connect_error', () => { setStatus('Connection unavailable'); term.writeln('\x1b[38;2;224;133;118mConnection unavailable\x1b[0m') })
    socket.onAny((event, payload) => { if (event !== 'terminal input' && payload != null) term.write(`\r\n${typeof payload === 'string' ? payload : JSON.stringify(payload)}\r\n`) })
    let command = ''
    const input = term.onData((data) => { if (data === '\r') { term.write('\r\n'); if (command.trim()) socket.emit('terminal input', command); command = '' } else if (data === '\u007f') { if (command.length) { command = command.slice(0, -1); term.write('\b \b') } } else if (data >= ' ') { command += data; term.write(data) } })
    const resize = () => fit.fit(); window.addEventListener('resize', resize)
    return () => { input.dispose(); window.removeEventListener('resize', resize); socket.disconnect(); term.dispose() }
  }, [sandboxId, setStatus])

  return terminalMount
}
