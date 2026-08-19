import type {AudioAlignment, LessonNarration} from "@quadratics/types";

export interface CaptionWord {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

export interface CaptionGroup {
  words: CaptionWord[];
  startSeconds: number;
  endSeconds: number;
}

export const captionWordSlots = 8;

export function captionGroupsForNarration(narration: LessonNarration | undefined): CaptionGroup[] {
  const words = captionWordsForNarration(narration);
  const groups: CaptionGroup[] = [];
  let current: CaptionWord[] = [];

  for (const word of words) {
    const previous = current[current.length - 1];
    const shouldBreak =
      current.length >= captionWordSlots ||
      Boolean(previous && endsCaptionPhrase(previous.text) && current.length >= 3) ||
      Boolean(previous && word.startSeconds - previous.endSeconds > 0.8);

    if (shouldBreak) {
      groups.push(groupFromWords(current));
      current = [];
    }
    current.push(word);
  }

  if (current.length > 0) {
    groups.push(groupFromWords(current));
  }
  return groups;
}

function captionWordsForNarration(narration: LessonNarration | undefined): CaptionWord[] {
  if (!narration?.segments?.length) {
    return [];
  }

  const words: CaptionWord[] = [];
  let fallbackOffset = 0;
  for (const segment of narration.segments) {
    const alignment = segment.normalizedAlignment ?? segment.alignment;
    const offset = numericMetadata(segment.providerMetadata, "segmentOffsetSeconds") ?? fallbackOffset;
    const segmentWords = alignment ? wordsForAlignment(alignment, offset) : [];
    words.push(...segmentWords);
    fallbackOffset = Math.max(
      fallbackOffset,
      offset + Math.max(segment.durationSeconds ?? 0, lastEndSecond(segmentWords)),
    );
  }
  return words.sort((left, right) => left.startSeconds - right.startSeconds);
}

function wordsForAlignment(alignment: AudioAlignment, offsetSeconds: number): CaptionWord[] {
  const {characters, characterStartTimesSeconds, characterEndTimesSeconds} = alignment;
  if (
    characters.length === 0 ||
    characters.length !== characterStartTimesSeconds.length ||
    characters.length !== characterEndTimesSeconds.length
  ) {
    return [];
  }

  const words: CaptionWord[] = [];
  let startIndex: number | null = null;
  for (let index = 0; index <= characters.length; index += 1) {
    const character = characters[index] ?? " ";
    const inWord = character.trim().length > 0;
    if (inWord && startIndex === null) {
      startIndex = index;
    }
    if ((!inWord || index === characters.length) && startIndex !== null) {
      const endIndex = index - 1;
      const text = characters.slice(startIndex, index).join("").trim();
      if (text.length > 0) {
        words.push({
          text,
          startSeconds: offsetSeconds + characterStartTimesSeconds[startIndex],
          endSeconds: offsetSeconds + characterEndTimesSeconds[endIndex],
        });
      }
      startIndex = null;
    }
  }
  return words;
}

function groupFromWords(words: CaptionWord[]): CaptionGroup {
  return {
    words,
    startSeconds: words[0]?.startSeconds ?? 0,
    endSeconds: words[words.length - 1]?.endSeconds ?? 0,
  };
}

function endsCaptionPhrase(text: string): boolean {
  return /[,.!?;:]$/.test(text);
}

function lastEndSecond(words: CaptionWord[]): number {
  return words[words.length - 1]?.endSeconds ?? 0;
}

function numericMetadata(metadata: Record<string, unknown> | undefined, key: string): number | null {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
