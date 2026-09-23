// Greetings and pleasantries aren't questions about the corpus, so retrieval finds nothing close and the relevance gate
// would refuse them ("hi" → "I don't have information about that."). Answer them directly instead: no embedding call,
// no LLM call, and it costs none of the free-tier quota.

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const ADDRESS = "( hassam| there| everyone| bro| sir| friend)*";
const rules: { test: RegExp; reply: string }[] = [
  {
    test: new RegExp(`^(assalam[a-z ]*|salam[a-z ]*|aoa)${ADDRESS}$`),
    reply: "Wa alaikum assalam! I'm Hassam. Ask me anything about my experience, projects or skills.",
  },
  {
    test: new RegExp(`^((hi+|hii+|hello+|hey+|heya|hiya|yo|hola|greetings|good (morning|afternoon|evening|day))${ADDRESS})$`),
    reply: "Hi! I'm Hassam. Ask me anything about my experience, projects or skills.",
  },
  {
    test: new RegExp(`^(how are you( doing| today)?|how r u|hows it going|whats up|wassup|sup)${ADDRESS}$`),
    reply: "Doing well, thanks for asking! What would you like to know about my work?",
  },
  {
    test: new RegExp(`^((ok |okay |great |cool |nice )?(thanks|thank you|thankyou|thx|ty)( a lot| so much| very much)?)${ADDRESS}$`),
    reply: "You're welcome! Anything else you'd like to know?",
  },
  {
    test: new RegExp(`^(bye|goodbye|see you|see ya|cya|good night|take care)${ADDRESS}$`),
    reply: "Thanks for stopping by. Take care!",
  },
];

/** A canned reply if the whole message is just a greeting / thanks / goodbye, otherwise null. */
export function smallTalkReply(message: string): string | null {
  const text = normalise(message);
  if (!text || text.split(" ").length > 6) return null;
  return rules.find((r) => r.test.test(text))?.reply ?? null;
}
