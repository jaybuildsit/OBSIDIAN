import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { io } from 'socket.io-client'
import { sandboxOrigin, sandboxPrefix } from '../services/sandboxApi.js'

export function useTerminal(sandboxId, setStatus) {
  const terminalMount = useRef(null)

  useEffect(() => {
    if (!sandboxId || !terminalMount.current) return undefined
    const mount = terminalMount.current
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'DM Mono, Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.45,
      theme: {
        background: '#1d1916', foreground: '#e8dfd3', cursor: '#dc8a62',
        black: '#1d1916', brightBlack: '#8c8177',
        green: '#b8c791', brightGreen: '#c8d8a3',
        yellow: '#ddbd7b', brightYellow: '#eed093',
        blue: '#91b2ba', brightBlue: '#a7c7cf',
      },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(mount)
    fit.fit()
    term.writeln('\x1b[38;2;220;138;98mOBSIDIAN terminal\x1b[0m  ·  connecting to workspace…')

    // Origin and path are separate on purpose. If the sandbox address contained
    // a path (/agent/<id>), Socket.IO would treat it as a namespace and fail.
    const socket = io(sandboxOrigin(sandboxId), {
      path: `${sandboxPrefix(sandboxId)}/socket.io`,
      transports: ['polling', 'websocket'],
    })

    socket.on('connect', () => {
      setStatus('Connected')
      term.writeln('\x1b[38;2;184;199;145m● Connected\x1b[0m')
      socket.emit('terminal-resize', { cols: term.cols, rows: term.rows })
    })
    socket.on('disconnect', () => setStatus('Disconnected'))
    socket.on('connect_error', (err) => {
      console.error('terminal socket error:', err.message, err)
      setStatus('Connection unavailable')
      term.writeln('\x1b[38;2;224;133;118mConnection unavailable\x1b[0m')
    })

    // The sandbox agent emits "terminal-output" (PTY -> browser) and
    // "terminal-exit" when the shell ends.
    socket.on('terminal-output', (data) => term.write(data))
    socket.on('terminal-exit', () => {
      setStatus('Shell exited')
      term.writeln('\r\n\x1b[38;2;224;133;118m[process exited]\x1b[0m')
    })

    // Send raw keystrokes. The PTY handles echo, line editing and history,
    // so there is no local echo and no line buffering here.
    const input = term.onData((data) => socket.emit('terminal-input', data))
    const resize = term.onResize(({ cols, rows }) =>
      socket.emit('terminal-resize', { cols, rows }),
    )

    // Refit whenever the terminal's own container changes size (panel drag,
    // collapse/expand, window resize), not just when the window resizes.
    const observer = new ResizeObserver(() => {
      if (!mount.offsetWidth || !mount.offsetHeight) return // hidden or collapsed
      try { fit.fit() } catch { /* container not measurable yet */ }
    })
    observer.observe(mount)

    return () => {
      input.dispose()
      resize.dispose()
      observer.disconnect()
      socket.disconnect()
      term.dispose()
    }
  }, [sandboxId, setStatus])

  return terminalMount
}