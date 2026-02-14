export type ChunkType = "transcript_chunk" | "recap_summary" | "recap_quiz_seed";

export interface ContentChunk {
  id: string;
  chunkType: ChunkType;
  text: string;
  subject: string;
  focusArea: string;
  tags: string[];
  pageTitle: string;
  episode: string;
  sectionPath: string[];
  sourceDocId: string;
  sourcePage: number | null;
  sourceAnchor: string | null;
}

export interface LearningState {
  chunkId: string;
  userId: string;
  showCount: number;
  correctCount: number;
  confidence: number;
  weightDelta: number;
  lastSeenAt: Date | null;
  masteredUntil: Date | null;
}

export interface DailyPlan {
  userId: string;
  date: string;
  session: "am" | "pm";
  slots: number;
  transcriptCount: number;
  recapCount: number;
}

export interface UserPreference {
  userId: string;
  preferredSubjects: string[];
  dailyTotal: number;
  amCount: number;
  pmCount: number;
}

export interface NotionLine {
  text: string;
  pageId: string;
  subject: string;
  pageTitle: string;
  episode: string;
  sectionPath: string[];
  isRecap: boolean;
  sourceAnchor: string;
}

export interface QuizItem {
  type: "mcq" | "fill_blank" | "true_false";
  prompt: string;
  choices?: string[];
  answer: string;
}
