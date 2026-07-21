/** Central model routing. Visual presentation never depends on these models. */
export const AI_MODELS = {
  MAIN: 'anthropic/claude-sonnet-4.6',
  WORKHORSE: 'google/gemini-2.5-flash',
  IMAGE: 'google/gemini-2.5-flash-image',
} as const;
