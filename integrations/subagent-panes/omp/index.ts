// Oh My Pi extension: each subagent gets its own tiili pane that follows its transcript live, beside the pane omp
// runs in. The subagent itself still runs inside omp as usual (worktrees, budgets and results are untouched); the
// pane only reads its session file.
//
// omp rebinds every extension factory to each subagent session, so `session_start` fires once per subagent with
// `ctx.agent.kind === "sub"`; its `ctx.sessionManager.getSessionFile()` is the transcript omp appends to. The pane
// runs `tiili follow` on it, which stops at omp's `session_exit` entry (or when this omp process is gone) and keeps
// the pane open until a key is pressed.
//
// Outside tiili (no TIILI_SOCKET) it does nothing. Set TIILI_SUBAGENT_PANES=0 to turn it off inside tiili.

import path from "node:path";

import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

export default function tiiliSubagentPanes(pi: ExtensionAPI) {
  if (!process.env.TIILI_SOCKET || process.env.TIILI_SUBAGENT_PANES === "0") return;

  pi.on("session_start", async (_event, ctx) => {
    const agent = ctx.agent;
    // The advisor reviews turns in the background; it is not a subagent anyone asked for.
    if (agent?.kind !== "sub" || agent.id === "advisor") return;
    const file = ctx.sessionManager.getSessionFile();
    if (!file) return;

    const label = path.basename(file, ".jsonl");
    const title = label && label !== agent.name ? `${agent.name} · ${label}` : agent.name;
    const result = await pi.exec("tiili", [
      "open",
      // One pane per subagent: a second session_start for the same agent (revived, resumed) reuses it while it lives.
      "--key",
      `omp-subagent-${agent.id}`,
      "--title",
      title,
      "--cwd",
      ctx.cwd,
      "--",
      "tiili",
      "follow",
      file,
      "--title",
      title,
      "--pid",
      String(process.pid),
    ]);
    if (result.code !== 0) {
      pi.logger.warn("tiili-subagent-panes: tiili open failed", { code: result.code, stderr: result.stderr.trim() });
    }
  });
}
