import assert from "node:assert/strict";
import test from "node:test";
import { looksLikeRefusal } from "../src/lib/rag/refusal";

test("refusal-style openings are recognised, however the model phrases them", () => {
  for (const text of [
    "No, I don't have evidence confirming that.",
    "I don't have information about that.",
    "I do not have any record of that.",
    "Sorry, I can't confirm that.",
    "There is no information about that.",
    "His documents do not mention Kubernetes.",
    "My documents do not mention Kubernetes.",
    "No.",
    "Unfortunately, I don't have that.",
  ]) {
    assert.ok(looksLikeRefusal(text), `should be a refusal: ${text}`);
  }
});

test("real answers are never mistaken for refusals", () => {
  for (const text of [
    "Yes.",
    "Yes. Hassam worked with WebRTC in AI-NTIS.",
    "Hassam has 2+ years of experience.",
    "His CV describes 2+ years of experience in Flutter.",
    "Banner, Interstitial, and Rewarded Ads",
    "Not only Flutter but also MERN.",
    "Node.js is used for backend.",
  ]) {
    assert.ok(!looksLikeRefusal(text), `should be an answer: ${text}`);
  }
});
