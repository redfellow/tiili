import "./styles.css";
import { attachClipboard } from "./clipboard";
import { startTerminal } from "./terminal";

const container = document.getElementById("terminal");
if (container) {
  startTerminal(container)
    .then((term) => attachClipboard(term, container))
    .catch((error: unknown) => {
      container.textContent = `tiili could not start the terminal: ${String(error)}`;
    });
}
