"""AIR6 Param Filter — entry point."""

import sys
import os
import signal

sys.path.insert(0, os.path.dirname(__file__))

from ui.app import App


def main():
    app = App()

    # ── Ctrl+C fix ────────────────────────────────────────────────────────
    # tkinter's mainloop() blocks the main thread, so Python never processes
    # SIGINT unless we schedule a periodic no-op via after().  The after()
    # tick wakes the event loop every 200 ms and gives Python a chance to
    # deliver the signal.  The handler then calls destroy() for a clean exit.
    def _poll():
        app.after(200, _poll)

    signal.signal(signal.SIGINT, lambda *_: app.destroy())
    app.after(200, _poll)
    # ─────────────────────────────────────────────────────────────────────

    try:
        app.mainloop()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
