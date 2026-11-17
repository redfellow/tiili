// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { patchMathResult } from "./heynote-patches.mjs";

// Heynote's MathResult widget from src/editor/block/math.js at the commit scripts/heynote.mjs builds, without its imports.
const WIDGET = `
class MathResult extends WidgetType {
    constructor(displayResult, copyResult) {
        super()
        this.displayResult = displayResult
        this.copyResult = copyResult
    }

    eq(other) { return other.displayResult == this.displayResult }

    toDOM() {
        const wrap = document.createElement("span")
        wrap.className = "heynote-math-result"
        const inner = document.createElement("span")
        inner.className = "inner"
        inner.innerHTML = this.displayResult
        wrap.appendChild(inner)
        inner.addEventListener("click", (e) => {
            e.preventDefault()
            navigator.clipboard.writeText(this.copyResult)
            const copyElement = document.createElement("i")
            copyElement.className = "heynote-math-result-copied"
            copyElement.innerHTML = "Copied!"
            wrap.appendChild(copyElement)
            copyElement.offsetWidth // trigger reflow so that the animation is shown
            copyElement.className = "heynote-math-result-copied fade-out"
            setTimeout(() => {
                copyElement.remove()
            }, 1700)
        })
        return wrap
    }
    ignoreEvent() { return false }
}
`;

/** A DOM element that only records what the widget sets on it: it parses nothing. */
class StubElement {
  className = "";
  innerHTML: string | undefined;
  textContent: string | undefined;
  offsetWidth = 0;
  children: StubElement[] = [];
  listeners: Record<string, (e: { preventDefault(): void }) => void> = {};
  constructor(readonly tagName: string) {}
  appendChild(child: StubElement) {
    this.children.push(child);
  }
  addEventListener(type: string, listener: (e: { preventDefault(): void }) => void) {
    this.listeners[type] = listener;
  }
  remove() {}
}

type Widget = { toDOM(): StubElement };

/** Evaluates widget source against a stub document and returns its MathResult class and the elements it created. */
function load(source: string) {
  const created: StubElement[] = [];
  const document = {
    createElement: (tag: string) => {
      const element = new StubElement(tag);
      created.push(element);
      return element;
    },
  };
  const copied: string[] = [];
  const navigator = { clipboard: { writeText: (text: string) => copied.push(text) } };
  const MathResult = new Function("WidgetType", "document", "navigator", "setTimeout", `${source}\nreturn MathResult;`)(
    class {},
    document,
    navigator,
    () => 0,
  ) as new (display: string, copy: string) => Widget;
  return { MathResult, created, copied };
}

const format = (value: number) => `<img src=x onerror=alert(${value})>`;

describe("patchMathResult", () => {
  it.each([
    { name: "a string result", display: "<img src=x onerror=alert(1)>" },
    { name: "a format() result", display: format(1) },
    { name: "a markup result", display: "<b>hi</b>" },
    { name: "a number", display: "3" },
  ])("HTML-looking math result shown literally: $name lands in textContent, never innerHTML", ({ display }) => {
    const { MathResult, created, copied } = load(patchMathResult(WIDGET));
    const wrap = new MathResult(display, display).toDOM();
    const inner = wrap.children[0];
    expect(inner.textContent).toBe(display);
    expect(inner.innerHTML).toBeUndefined();
    expect(created.map((e) => e.tagName)).toEqual(["span", "span"]);

    inner.listeners.click({ preventDefault() {} });
    const label = wrap.children[1];
    expect(copied).toEqual([display]);
    expect(label.textContent).toBe("Copied!");
    expect(label.innerHTML).toBeUndefined();
  });

  it.each([
    { name: "no innerHTML = this.displayResult", source: WIDGET.replace("inner.innerHTML = this.displayResult", "inner.append(this.displayResult)") },
    { name: "another innerHTML assignment", source: WIDGET.replace('copyElement.innerHTML = "Copied!"', "copyElement.innerHTML = this.copyResult") },
    { name: "an innerHTML append", source: WIDGET.replace("wrap.appendChild(inner)", "wrap.innerHTML += this.copyResult") },
  ])("throws on widget source it does not recognise: $name", ({ source }) => {
    expect(source).not.toBe(WIDGET);
    expect(() => patchMathResult(source)).toThrow(/update scripts\/heynote-patches\.mjs/);
  });
});
