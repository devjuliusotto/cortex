# Browser Pane and Local Automation

Cortex v0.2 introduces a persisted `browser` tab type in the same split-pane layout used by terminals and notes. The current implementation is intentionally conservative: it stores title, URL, pane placement, and exposes an in-pane placeholder with an external-browser action.

## Current status

- Browser tabs are local app state.
- URLs are restored after restart.
- Navigation controls are present as UI groundwork.
- Embedded WebView navigation is not enabled yet.
- Cortex does not import browser profiles, cookies, or tokens.
- Cortex does not inject scripts into websites.
- Cortex does not execute remote automation.

## Future embedded WebView

A future implementation can replace the placeholder with a Tauri WebView pane if the platform API can be integrated cleanly with the existing React split layout. That work should preserve the current `BrowserTab` state contract.

## Future local-only control API

Allowed future commands should be explicit and local-only:

- `navigate(url)`
- `reload()`
- `screenshot()`
- `click(selector)` only after selector scoping and user-visible permission rules exist
- `type(selector, text)` only after safe focus and input rules exist

Unsafe operations are out of scope:

- Executing arbitrary remote scripts
- Reading cookies manually
- Importing browser profiles
- Background automation without a visible local user action
- Remote network control of the browser pane

## Security notes

Any future automation API must be reachable only from local IPC, named pipes, or an equivalent OS-local mechanism. It must never expose an unauthenticated TCP listener.
