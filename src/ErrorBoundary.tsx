import { Component, ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { err?: Error }> {
  state: { err?: Error } = {}
  static getDerivedStateFromError(err: Error) { return { err } }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="mx-auto grid max-w-lg gap-3 p-10">
        <h1 className="text-xl font-semibold">Qualcosa è andato storto</h1>
        <pre className="overflow-auto rounded-md border border-line bg-panel p-3 text-xs">{String(this.state.err.stack || this.state.err)}</pre>
        <button className="self-start rounded-md bg-accent px-4 py-2 text-on-accent" onClick={() => location.reload()}>Ricarica</button>
        <p className="text-sm text-muted">Quello che era già stato salvato è al sicuro nella cartella del mondo.</p>
      </div>
    )
  }
}
