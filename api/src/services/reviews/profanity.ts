import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';

/**
 * Single matcher instance — obscenity datasets are immutable and the matcher
 * is safe to share. Pre-built at module load to avoid per-request cost.
 *
 * englishDataset already excludes "Scunthorpe", "assistant", etc. via its
 * built-in whitelist. englishRecommendedTransformers handles l33t-speak,
 * collapsing, etc.
 */
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export interface ProfanityResult {
  matched: boolean;
  words: string[];
}

export function containsProfanity(input: string | null | undefined): ProfanityResult {
  if (!input) return { matched: false, words: [] };
  const trimmed = input.trim();
  if (!trimmed) return { matched: false, words: [] };

  const matches = matcher.getAllMatches(trimmed, /* sorted */ true);
  if (matches.length === 0) return { matched: false, words: [] };

  const words = Array.from(
    new Set(
      matches.map((m) => {
        const meta = englishDataset.getPayloadWithPhraseMetadata(m);
        return meta.phraseMetadata?.originalWord ?? trimmed.slice(m.startIndex, m.endIndex);
      }),
    ),
  );
  return { matched: true, words };
}
