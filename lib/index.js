// Host half — empty; the settings API is called directly from the Client
// through ctx.get("connection").api.settings, so no Host-side RPC is needed.
export function apply() {}