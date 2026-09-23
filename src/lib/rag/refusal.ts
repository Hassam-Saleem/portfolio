// Models differ in how well they follow the [NO_INFO] protocol. Whatever model wins, a refusal must read the same:
// exactly one short line, never "No, he hasn't…". So an answer that *opens* like a refusal is treated as one.
const REFUSAL_START =
  /^(?:(?:no|sorry|unfortunately)[,.!]?\s+)?(?:(?:i|we)\s+(?:don'?t|do not|can'?t|cannot|couldn'?t|have no)\b|there\s+(?:is|are|'s)\s+no\s+(?:information|evidence|record|mention)|(?:his|my|the|hassam'?s)\s+(?:documents?|cv|knowledge base|information)\s+(?:do(?:es)?\s+not|don'?t|doesn'?t)\b)|^no[.!]?$/i;

export const looksLikeRefusal = (text: string): boolean => REFUSAL_START.test(text.trim());
