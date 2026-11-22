// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import {
  type IntegrationChange,
  integrationChanges,
  type IntegrationOutcome,
  type IntegrationRowView,
  integrationRowView,
  type IntegrationStatus,
} from "./integrations";

const status = (id: string, installed: boolean, available = true): IntegrationStatus => ({
  id,
  name: id,
  description: "",
  location: `/somewhere/${id}`,
  installed,
  available,
  reason: available ? null : `${id} is not on PATH. Install ${id}, then reopen Settings.`,
});

describe("integration changes", () => {
  const rows = [
    status("omp", false), status("skill", true), status("gone", false, false), status("left", true, false),
  ];
  const cases: [string, [string, boolean][], IntegrationChange[]][] = [
    ["nothing touched: nothing changes", [], []],
    ["ticked again as installed: nothing changes", [["omp", false], ["skill", true]], []],
    [
      "One fails: ticking both turns omp on, the skill stays",
      [["omp", true], ["skill", true]],
      [{ id: "omp", on: true }],
    ],
    ["unticking the skill turns it off", [["skill", false]], [{ id: "skill", on: false }]],
    ["Tool missing: its box never changes anything", [["gone", true]], []],
    ["an id the app does not list is ignored", [["other", true]], []],
    ["Turn off without the tool: unticking an installed row turns it off", [["left", false]], [{ id: "left", on: false }]],
    ["Turn off without the tool: ticking it back changes nothing", [["left", true]], []],
  ];
  it.each(cases)("%s", (_name, ticked, expected) => {
    expect(integrationChanges(rows, new Map(ticked))).toEqual(expected);
  });
});

describe("integration rows", () => {
  const failed: IntegrationOutcome = { id: "omp", ok: false, error: "link failed", fix: "Run it by hand." };
  const cases: [string, IntegrationStatus, boolean | undefined, IntegrationOutcome | undefined, IntegrationRowView][] = [
    [
      "Installed outside the app: the box is ticked",
      status("skill", true),
      undefined,
      undefined,
      { checked: true, disabled: false, reason: null, error: null, fix: null },
    ],
    [
      "the user's tick is shown",
      status("omp", false),
      true,
      undefined,
      { checked: true, disabled: false, reason: null, error: null, fix: null },
    ],
    [
      "Tool missing: the row says why and its box cannot be changed",
      status("omp", false, false),
      true,
      undefined,
      { checked: false, disabled: true, reason: status("omp", false, false).reason, error: null, fix: null },
    ],
    [
      "Turn off without the tool: an installed row says why and can be unticked",
      status("skill", true, false),
      false,
      undefined,
      { checked: false, disabled: false, reason: status("skill", true, false).reason, error: null, fix: null },
    ],
    [
      "One fails: the row shows the error and a fix",
      status("omp", false),
      undefined,
      failed,
      { checked: false, disabled: false, reason: null, error: "link failed", fix: "Run it by hand." },
    ],
    [
      "a change that worked shows no error",
      status("skill", true),
      undefined,
      { id: "skill", ok: true, error: null, fix: null },
      { checked: true, disabled: false, reason: null, error: null, fix: null },
    ],
  ];
  it.each(cases)("%s", (_name, row, ticked, outcome, expected) => {
    expect(integrationRowView(row, ticked, outcome)).toEqual(expected);
  });
});
