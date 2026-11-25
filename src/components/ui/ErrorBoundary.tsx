import { Component, type ErrorInfo, type ReactNode } from 'react'

// Keeps one broken panel from taking down the whole page: the panel shows a short message and a "Try again" button;
// everything around it keeps working. `resetKey` (e.g. the route) clears the error when it changes.
interface Props {
  /** What this panel is, for the message ("the Day 1 panel"). */
  name: string
  children: ReactNode
  resetKey?: string
}
interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Shown in the browser console for debugging; nothing is sent anywhere.
    console.error(`[${this.props.name}]`, error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="flex flex-col items-start gap-2 rounded-[22px] border border-solid border-vv-red-100 bg-vv-surface p-5 text-[14px] text-vv-body">
        <strong className="text-[15px] text-vv-red">Something went wrong in {this.props.name}.</strong>
        <span>The rest of the page still works. Try again, or reload the page if it keeps happening.</span>
        <button
          type="button"
          className="min-h-9 rounded-full border border-solid border-vv-field-line bg-vv-surface px-4 font-body text-[13px] font-bold text-vv-ink"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </div>
    )
  }
}
