import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeStreak,
  gradeAttempt,
  isCorrectAnswer,
  percentage,
  shiftDate,
  validateQuestionDraft,
  type KeyEntry,
} from "./score.ts";

const key: Record<string, KeyEntry> = {
  a: { type: "mcq", correct: ["b"], marks: 1, negative: 0, explanationHi: "", explanationEn: "", subjectId: "math" },
  b: { type: "multi", correct: ["a", "c"], marks: 2, negative: 0.5, explanationHi: "", explanationEn: "", subjectId: "sci" },
  c: { type: "fill", correct: ["दिल्ली|delhi|new delhi"], marks: 1, negative: 0.25, explanationHi: "", explanationEn: "", subjectId: "gk" },
  d: { type: "numerical", correct: ["225"], marks: 1, negative: 0, explanationHi: "", explanationEn: "", subjectId: "math" },
  e: { type: "tf", correct: ["true"], marks: 1, negative: 0.25, explanationHi: "", explanationEn: "", subjectId: "sci" },
};

describe("scoring", () => {
  it("scores a simple quiz as correct answers times marks", () => {
    const summary = gradeAttempt(
      ["a", "d"],
      key,
      { a: { choice: ["b"] }, d: { choice: ["225"] } },
      null,
    );
    assert.equal(summary.score, 2);
    assert.equal(summary.maximumScore, 2);
    assert.equal(summary.correct, 2);
    assert.equal(summary.percentage, 100);
  });

  it("applies negative marking and leaves blanks unpenalized", () => {
    const summary = gradeAttempt(
      ["b", "e", "a"],
      key,
      { b: { choice: ["a"] }, e: { choice: ["false"] }, a: { choice: [] } },
      null,
    );
    assert.equal(summary.incorrect, 2);
    assert.equal(summary.unanswered, 1);
    assert.equal(summary.score, -0.75);
    assert.equal(summary.maximumScore, 4);
  });

  it("uses a quiz-level negative override", () => {
    const summary = gradeAttempt(["a"], key, { a: { choice: ["x"] } }, 0.25);
    assert.equal(summary.score, -0.25);
  });

  it("accepts multi-select only when the set matches", () => {
    assert.equal(isCorrectAnswer("multi", ["a", "c"], ["c", "a"]), true);
    assert.equal(isCorrectAnswer("multi", ["a", "c"], ["a"]), false);
    assert.equal(isCorrectAnswer("multi", ["a", "c"], ["a", "c", "b"]), false);
  });

  it("normalizes fill-in answers and numeric commas", () => {
    assert.equal(isCorrectAnswer("fill", ["दिल्ली|Delhi"], ["  delhi "]), true);
    assert.equal(isCorrectAnswer("numerical", ["225"], ["225.0"]), true);
    assert.equal(isCorrectAnswer("numerical", ["225"], ["224"]), false);
  });

  it("returns zero percent for an invalid maximum", () => {
    assert.equal(percentage(3, 0), 0);
    assert.equal(percentage(1, Number.NaN), 0);
    assert.equal(percentage(1, 4), 25);
  });

  it("rejects malformed drafts", () => {
    assert.ok(
      validateQuestionDraft({
        type: "mcq",
        promptHi: "",
        promptEn: "Hi",
        options: [],
        correct: [],
        marks: 1,
        negative: 0,
      }),
    );
    assert.equal(
      validateQuestionDraft({
        type: "numerical",
        promptHi: "वर्ग",
        promptEn: "Square",
        options: [],
        correct: ["nope"],
        marks: 1,
        negative: 0,
      }),
      "Numerical answer must be a number.",
    );
  });
});

describe("streak", () => {
  it("does not inflate from duplicate days and stops at a gap", () => {
    const today = "2026-10-20";
    assert.equal(computeStreak([today, today, shiftDate(today, -1)], today), 2);
    assert.equal(computeStreak([shiftDate(today, -1), shiftDate(today, -2)], today), 2);
    assert.equal(computeStreak([shiftDate(today, -2)], today), 0);
    assert.equal(computeStreak([], today), 0);
  });
});
