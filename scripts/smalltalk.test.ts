import assert from "node:assert/strict";
import test from "node:test";
import { smallTalkReply } from "../src/lib/rag/smalltalk";

test("greetings, thanks and goodbyes get a direct reply", () => {
  for (const msg of ["hi", "Hi!", "hello", "hey there", "Hi Hassam", "good morning", "Assalam o alaikum", "salam", "how are you?", "thanks", "Thank you so much!", "ok thanks", "bye"]) {
    assert.ok(smallTalkReply(msg), `should be small talk: ${msg}`);
  }
});

test("real questions are never treated as small talk", () => {
  for (const msg of [
    "Did you work with WebRTC?",
    "hi, did you work at Google?",
    "How many years of experience do you have?",
    "Where do you work now?",
    "What is the capital of France?",
    "thanks for the info about WebRTC, what about Firebase?",
    "",
  ]) {
    assert.equal(smallTalkReply(msg), null, `should NOT be small talk: ${msg}`);
  }
});

test("replies are in the first person", () => {
  assert.match(smallTalkReply("hi")!, /I'm Hassam/);
});
