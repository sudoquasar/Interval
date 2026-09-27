import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';

interface Props {
  resetKey: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  resetKey: string;
}

function isStaleChunk(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
    error.message,
  );
}

/** Route-level boundary. Resets when the path changes, so one broken page never traps the user. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const reload = (
      <Button variant="primary" onClick={() => window.location.reload()}>
        Reload the page
      </Button>
    );
    return (
      <div className="px-4 sm:px-8">
        {isStaleChunk(error) ? (
          <Notice title="A newer version of Interval is live." action={reload}>
            Reload to pick it up. Nothing you saved will be lost.
          </Notice>
        ) : (
          <Notice title="This page failed to render." action={reload}>
            Reload to try again. If it keeps happening, go back to the home page and open the title
            from there.
          </Notice>
        )}
      </div>
    );
  }
}
