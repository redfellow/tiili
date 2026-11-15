# Design reference

Prototype diffs from Design view, made on hv/main at 0783f7ca, in the order they were accepted. A reference, not a patch: later changes build on earlier ones.

## This card's scope: Show a mini pane preview at the cursor while dragging

Dragging a pane by its top strip shows a 200 px miniature of that pane at the cursor.
The miniature is taken from the pane's current contents.
The miniature has an accent border and a shadow, styled in src/styles.css.
The old text drag label is removed.
The source pane still dims while it is being dragged.

Changes: "Earlier card "Smooth panel animations for opening, closing and moving panels"…"

Files: src/layout/view.ts, src/styles.css

The rest of the session below belongs to the other cards: build only this scope, and cover all of it.

## The whole session

### Earlier card "Smooth panel animations for opening, closing and moving panels"… (in this card)

```diff
diff --git a/src/layout/motion.ts b/src/layout/motion.ts
index 26af189..c93fb24 100644
--- a/src/layout/motion.ts
+++ b/src/layout/motion.ts
@@ -9,11 +9,21 @@ export interface Rect {
 }
 
 /** How long a pane takes to reach its new place. */
-export const MOTION_MS = 180;
-/** Ease-out: quick to start, gentle to land. */
-export const MOTION_EASING = "cubic-bezier(.2,.8,.2,1)";
+export const MOTION_MS = 280;
+/** Ease-out-quint: quick to start, a long soft landing. */
+export const MOTION_EASING = "cubic-bezier(.22,1,.36,1)";
+/** A new pane takes a little longer than a move so the eye catches it arriving. */
+export const ENTER_MS = 380;
+/** Ease-out with a slight overshoot: the new pane settles into place with a little spring. */
+export const ENTER_EASING = "cubic-bezier(.34,1.35,.64,1)";
+/** A closing pane leaves quickly; ease-in so it speeds away. */
+export const EXIT_MS = 180;
+export const EXIT_EASING = "cubic-bezier(.4,0,1,1)";
 /** The scale a new pane grows in from and a closing pane shrinks to. */
-const SHRUNK = 0.92;
+const SHRUNK = 0.94;
+/** A new or closing pane lifts off the grid on a soft shadow, so it reads against the dark mortar. */
+const LIFTED = "0 10px 32px rgba(0,0,0,.45)";
+const FLAT = "0 0 0 rgba(0,0,0,0)";
 /** Rect changes smaller than this many pixels count as no change. */
 const EPSILON = 0.5;
 
@@ -22,6 +32,8 @@ export type MotionKind = "move" | "enter" | "exit";
 
 export interface PaneMotion {
   kind: MotionKind;
+  duration: number;
+  easing: string;
   frames: Keyframe[];
 }
 
@@ -46,9 +58,11 @@ export function flipFrames(before: Map<PaneId, Rect>, after: Map<PaneId, Rect>):
     if (!from) {
       motions.set(id, {
         kind: "enter",
+        duration: ENTER_MS,
+        easing: ENTER_EASING,
         frames: [
-          { transformOrigin: "50% 50%", transform: `scale(${SHRUNK})`, opacity: 0 },
-          { transformOrigin: "50% 50%", transform: "none", opacity: 1 },
+          { transformOrigin: "50% 50%", transform: `translateY(10px) scale(${SHRUNK})`, opacity: 0, boxShadow: LIFTED },
+          { transformOrigin: "50% 50%", transform: "none", opacity: 1, boxShadow: FLAT },
         ],
       });
       continue;
@@ -60,6 +74,8 @@ export function flipFrames(before: Map<PaneId, Rect>, after: Map<PaneId, Rect>):
     const sy = from.height / to.height;
     motions.set(id, {
       kind: "move",
+      duration: MOTION_MS,
+      easing: MOTION_EASING,
       frames: [
         { transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
         { transformOrigin: "0 0", transform: "none" },
@@ -70,9 +86,11 @@ export function flipFrames(before: Map<PaneId, Rect>, after: Map<PaneId, Rect>):
     if (after.has(id)) continue;
     motions.set(id, {
       kind: "exit",
+      duration: EXIT_MS,
+      easing: EXIT_EASING,
       frames: [
-        { transformOrigin: "50% 50%", transform: "none", opacity: 1 },
-        { transformOrigin: "50% 50%", transform: `scale(${SHRUNK})`, opacity: 0 },
+        { transformOrigin: "50% 50%", transform: "none", opacity: 1, boxShadow: FLAT },
+        { transformOrigin: "50% 50%", transform: `translateY(6px) scale(${SHRUNK})`, opacity: 0, boxShadow: LIFTED },
       ],
     });
   }
diff --git a/src/layout/view.ts b/src/layout/view.ts
index 0b246b1..a264665 100644
--- a/src/layout/view.ts
+++ b/src/layout/view.ts
@@ -1,5 +1,5 @@
 import { resizeTrack, type Axis, type LayoutState, type PaneId } from "./model";
-import { flipFrames, MOTION_EASING, MOTION_MS, prefersReducedMotion, type Rect } from "./motion";
+import { flipFrames, prefersReducedMotion, type Rect } from "./motion";
 
 /** What the view asks of the panes it lays out. */
 export interface TileHooks {
@@ -15,6 +15,8 @@ export interface TileHooks {
   swap(from: PaneId, to: PaneId): void;
   /** Panes start moving to a new layout: terminals hold their size until `motionEnd`. */
   motionStart(): void;
+  /** The panes are laid out in their new places, about to glide there: terminals take their final font and grid. */
+  motionPlay(): Map<PaneId, number>;
   /** The panes have reached their new places: terminals refit once to their final size. */
   motionEnd(): void;
 }
@@ -22,6 +24,9 @@ export interface TileHooks {
 /** The pane id stored on each pane element. */
 const PANE_ID = "paneId";
 
+/** The width of the miniature that follows the pointer while a pane is dragged. */
+const DRAG_PREVIEW_WIDTH = 200;
+
 function sum(sizes: number[], count: number): number {
   return sizes.slice(0, count).reduce((total, s) => total + s, 0);
 }
@@ -79,13 +84,17 @@ export class TileView {
       this.hooks.motionStart();
     }
     this.layOut(state);
+    const fontRatios = this.hooks.motionPlay();
     const generation = ++this.generation;
     const rootRect = this.root.getBoundingClientRect();
-    const options = { duration: MOTION_MS, easing: MOTION_EASING };
     for (const [id, motion] of flipFrames(before, this.measure())) {
       if (motion.kind !== "exit") {
         const element = this.root.querySelector<HTMLElement>(`.pane[data-pane-id="${id}"]`);
-        if (element) this.running.push(element.animate(motion.frames, options));
+        if (element) {
+          const options = { duration: motion.duration, easing: motion.easing };
+          this.running.push(element.animate(motion.frames, options));
+          if (motion.kind === "move") this.running.push(...this.steadyContent(element, id, before, fontRatios, options));
+        }
         continue;
       }
       const element = elements.get(id);
@@ -100,9 +109,11 @@ export class TileView {
         height: `${rect.height}px`,
         pointerEvents: "none",
       });
-      this.root.prepend(element);
+      // Above the panes that grow into its place, so the fade-out is seen.
+      element.style.zIndex = "1";
+      this.root.append(element);
       this.leaving.push(element);
-      const animation = element.animate(motion.frames, { ...options, fill: "forwards" });
+      const animation = element.animate(motion.frames, { duration: motion.duration, easing: motion.easing, fill: "forwards" });
       animation.finished.then(() => this.unpin(element)).catch(() => undefined);
       this.running.push(animation);
     }
@@ -113,6 +124,42 @@ export class TileView {
       .catch(() => undefined);
   }
 
+  /**
+   * Keeps a gliding pane's content from being stretched by the pane's own scale: the terminal and title scale
+   * evenly instead, the terminal from its old font size to its new one, so the text grows or shrinks gradually.
+   */
+  private steadyContent(
+    element: HTMLElement,
+    id: PaneId,
+    before: Map<PaneId, Rect>,
+    fontRatios: Map<PaneId, number>,
+    options: KeyframeAnimationOptions,
+  ): Animation[] {
+    const from = before.get(id);
+    const to = element.getBoundingClientRect();
+    if (!from || to.width <= 0 || to.height <= 0) return [];
+    const sx = from.width / to.width;
+    const sy = from.height / to.height;
+    const animations: Animation[] = [];
+    for (const [selector, uniform] of [
+      [".pane-terminal", fontRatios.get(id) ?? 1],
+      [".pane-title", 1],
+    ] as const) {
+      const child = element.querySelector<HTMLElement>(`:scope > ${selector}`);
+      if (!child) continue;
+      animations.push(
+        child.animate(
+          [
+            { transformOrigin: "0 0", transform: `scale(${uniform / sx}, ${uniform / sy})` },
+            { transformOrigin: "0 0", transform: "none" },
+          ],
+          options,
+        ),
+      );
+    }
+    return animations;
+  }
+
   /** The pane elements laid out in the grid, without the ones fading out. */
   private panes(): HTMLElement[] {
     return Array.from(this.root.querySelectorAll<HTMLElement>(":scope > .pane-row > .pane"));
@@ -140,7 +187,7 @@ export class TileView {
   private unpin(element: HTMLElement): void {
     this.leaving = this.leaving.filter((e) => e !== element);
     element.remove();
-    for (const property of ["position", "left", "top", "width", "height", "pointer-events"]) {
+    for (const property of ["position", "left", "top", "width", "height", "pointer-events", "z-index"]) {
       element.style.removeProperty(property);
     }
   }
@@ -264,6 +311,32 @@ export class TileView {
    * While a grab strip is dragged, shows a ghost label following the pointer with the source pane dimmed, so the
    * drag is visible from the first pixels; highlights the pane under the pointer and swaps with it on drop.
    */
+  /** A miniature of `pane` as it looks now: a scaled-down copy of its elements, kept from taking part in the page. */
+  private dragPreview(pane: HTMLElement): HTMLElement {
+    const { width, height } = pane.getBoundingClientRect();
+    const scale = Math.min(1, DRAG_PREVIEW_WIDTH / Math.max(width, 1));
+    const ghost = document.createElement("div");
+    ghost.className = "pane-drag-ghost";
+    ghost.style.width = `${width * scale}px`;
+    ghost.style.height = `${height * scale}px`;
+    const copy = pane.cloneNode(true) as HTMLElement;
+    copy.removeAttribute("data-drag-source");
+    copy.removeAttribute("data-drop-target");
+    copy.querySelectorAll("textarea, .pane-grab, .find-bar-frame").forEach((e) => e.remove());
+    Object.assign(copy.style, {
+      position: "absolute",
+      left: "0",
+      top: "0",
+      width: `${width}px`,
+      height: `${height}px`,
+      flex: "none",
+      transformOrigin: "0 0",
+      transform: `scale(${scale})`,
+    });
+    ghost.append(copy);
+    return ghost;
+  }
+
   private dragPane(grab: HTMLElement, source: HTMLElement, down: PointerEvent): void {
     const from = Number(source.dataset[PANE_ID]);
     let target: HTMLElement | undefined;
@@ -278,9 +351,7 @@ export class TileView {
     };
     /** The drag has begun once the pointer has moved a few pixels: until then a click is just a click. */
     const begin = () => {
-      ghost = document.createElement("div");
-      ghost.className = "pane-drag-ghost";
-      ghost.textContent = source.querySelector(".pane-chip")?.textContent?.trim() || "Terminal";
+      ghost = this.dragPreview(source);
       document.body.append(ghost);
       source.toggleAttribute("data-drag-source", true);
       document.documentElement.toggleAttribute("data-pane-dragging", true);
diff --git a/src/panes.ts b/src/panes.ts
index 218b288..8650368 100644
--- a/src/panes.ts
+++ b/src/panes.ts
@@ -124,6 +124,10 @@ export class Panes {
       swap: (from, to) => this.relayout(swap(this.layout, from, to)),
       // Terminals scale with their moving panes and refit once they are in place, so each shell sees one size change.
       motionStart: () => this.panes.forEach((pane) => pane.terminal?.holdSize()),
+      // Terminals take their final font and grid up front, so the glide scales the text gradually instead of
+      // snapping it to a new size at the end.
+      motionPlay: () =>
+        new Map(this.panes.flatMap((pane) => (pane.terminal ? [[pane.id, pane.terminal.refitNow()] as const] : []))),
       motionEnd: () => this.panes.forEach((pane) => pane.terminal?.releaseSize(true)),
     });
     this.layout = emptyLayout(settings().tiling.layout);
@@ -513,6 +517,8 @@ export class Panes {
       await this.backend.closeWindow();
     }
     const terminal = await pane.ready;
+    // The terminal stays on screen while its pane fades out.
+    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) await new Promise((r) => setTimeout(r, 200));
     await terminal?.dispose();
   }
 
diff --git a/src/styles.css b/src/styles.css
index 9727f75..6045ef3 100644
--- a/src/styles.css
+++ b/src/styles.css
@@ -558,19 +558,22 @@ html[data-pane-dragging] * {
   top: 0;
   left: 0;
   z-index: 1000;
-  max-width: 220px;
-  padding: 0 var(--space-3);
   overflow: hidden;
   border-radius: var(--radius-brick);
-  background: var(--accent);
-  box-shadow: 0 6px 18px color-mix(in srgb, #000 40%, transparent);
-  color: var(--on-accent);
-  font: 500 12px/24px var(--font-sans);
-  text-overflow: ellipsis;
-  white-space: nowrap;
+  background: var(--term-bg);
+  box-shadow: 0 12px 32px color-mix(in srgb, #000 50%, transparent);
+  opacity: 0.92;
   pointer-events: none;
 }
 
+.pane-drag-ghost::after {
+  content: "";
+  position: absolute;
+  inset: 0;
+  border: 2px solid var(--accent);
+  border-radius: inherit;
+}
+
 /* Dividers are the mortar gaps between tracks; dragging one resizes the tracks on both sides. */
 .pane-divider {
   position: absolute;
diff --git a/src/terminal.ts b/src/terminal.ts
index 89bbafa..dd1a3c5 100644
--- a/src/terminal.ts
+++ b/src/terminal.ts
@@ -32,6 +32,11 @@ export interface PaneTerminal {
    */
   holdSize(): void;
   releaseSize(refit: boolean): void;
+  /**
+   * Takes the font and grid that fit the pane's current size now, without telling the shell (`releaseSize` does).
+   * Returns the old font size divided by the new one.
+   */
+  refitNow(): number;
   /** The size of one character cell in CSS pixels, once the terminal has been laid out. */
   cellSize(): { width: number; height: number } | undefined;
   /** The terminal's scrollback and screen as text with escape codes, once everything written to it has landed. */
@@ -324,6 +329,13 @@ export async function openTerminal(
       held = true;
       reporter.cancel();
     },
+    refitNow: () => {
+      const old = term.options.fontSize ?? 0;
+      applySize(term, settings(), zoom());
+      fit.fit();
+      const now = term.options.fontSize ?? 0;
+      return old > 0 && now > 0 ? old / now : 1;
+    },
     releaseSize: (refit) => {
       held = false;
       if (refit) reporter.schedule();
```