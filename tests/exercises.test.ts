// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { EXERCISES } from "../src/components/world/cssExerciseData";

const render = (html: string, css: string) => {
  document.head.innerHTML = `<style>${css}</style>`;
  document.body.innerHTML = html;
  return document;
};

describe("CSS exercises", () => {
  it("has 10 well-formed exercises with unique titles", () => {
    expect(EXERCISES).toHaveLength(10);
    expect(new Set(EXERCISES.map((e) => e.title)).size).toBe(10);
    for (const e of EXERCISES) {
      expect(e.task.length).toBeGreaterThan(10);
      expect(e.html).toContain("<");
      expect(e.hint.length).toBeGreaterThan(3);
      expect(e.solution).not.toBe(e.starter);
    }
  });

  it.each(EXERCISES.filter((e) => !e.needsBrowser).map((e) => [e.title, e]))("%s: the starter fails and the solution passes", (_, e) => {
    const ex = e as (typeof EXERCISES)[number];
    expect(ex.check(render(ex.html, ex.starter))).toBe(false);
    expect(ex.check(render(ex.html, ex.solution))).toBe(true);
  });
});
