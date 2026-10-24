"use client";

import { Component, type ReactNode } from "react";
import { reportClientError } from "@/lib/observability/report-client-error";

/**
 * Keeps a failure inside the Bug/Wish panel inside the panel.
 *
 * The panel is mounted in the app layout, above every page's own error
 * boundary. Anything it threw while rendering therefore took the whole app
 * down to the bare "Something went wrong" page — sidebar, the page being
 * worked on, unsaved input and all — for a feedback form. This catches it,
 * logs it (`[aecflow-error]`, docs/ERRORS.md) and shows `fallback` in the
 * panel's place; `reset` lets the caller close it and start clean.
 */
export class BetaReportPanelBoundary extends Component<
  { children: ReactNode; fallback: (reset: () => void) => ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportClientError(error, "boundary");
  }

  reset = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}
