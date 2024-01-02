export const WORDS_PER_MINUTE = 100;

export const getCaptionDuration = (text: string | null): number => {
  const WORD_MIN = 175;
  const CHAR = 20;
  const PAUSE = 100;
  const MIN_DURATION = 500;

  if (text === null) return 0;

  if (text === "") return PAUSE;
  const words = text.trim().split(/\W/);

  let total = 0;
  let pauses = 0;
  words.forEach((word) => {
    let duration = 0;

    word = word.trim();

    if (word.length === 1 && ".,;:-!".includes(word)) {
      pauses++;
    } else {
      duration = WORD_MIN + word.length * CHAR;
    }

    total += duration;
  });

  return Math.max(MIN_DURATION, total + Math.max(3, pauses) * PAUSE);
};
