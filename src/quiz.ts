import { QuizItem } from "./types.js";

function sentenceParts(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/[.?!]\s+/)
    .map((v) => v.trim())
    .filter((v) => v.length > 24);
}

function buildMcq(sentences: string[]): QuizItem | null {
  if (sentences.length < 2) return null;
  const answer = sentences[0];
  const distractors = sentences.slice(1, 4);
  return {
    type: "mcq",
    prompt: "다음 중 recap 내용과 일치하는 문장을 고르세요.",
    choices: [answer, ...distractors].sort(() => Math.random() - 0.5),
    answer
  };
}

function buildFillBlank(sentences: string[]): QuizItem | null {
  const sentence = sentences.find((v) => v.split(" ").length >= 8);
  if (!sentence) return null;
  const words = sentence.split(" ");
  const idx = Math.floor(words.length * 0.45);
  const answer = words[idx].replace(/[^\w-]/g, "");
  if (!answer || answer.length < 4) return null;
  words[idx] = "_____";
  return {
    type: "fill_blank",
    prompt: `빈칸을 채우세요:\n${words.join(" ")}`,
    answer
  };
}

function buildTrueFalse(sentences: string[]): QuizItem | null {
  const sentence = sentences[0];
  if (!sentence) return null;
  const flipped = sentence.replace(/\bis\b/i, "is not");
  return {
    type: "true_false",
    prompt: `참/거짓: ${flipped}`,
    choices: ["참", "거짓"],
    answer: "거짓"
  };
}

export function buildAdaptiveQuiz(seedText: string): QuizItem[] {
  const sentences = sentenceParts(seedText).slice(0, 5);
  if (!sentences.length) return [];
  const creators = [buildMcq, buildFillBlank, buildTrueFalse];
  const items: QuizItem[] = [];

  for (const create of creators.sort(() => Math.random() - 0.5)) {
    const item = create(sentences);
    if (item) items.push(item);
  }
  return items.slice(0, 3);
}
