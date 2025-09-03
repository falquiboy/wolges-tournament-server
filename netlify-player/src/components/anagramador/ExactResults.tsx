
import { BaseResults } from "./results/BaseResults";

interface ExactResultsProps {
  matches: string[];
  wildcardCount: number;
  highlightWildcardLetter: (word: string, originalWord: string) => React.ReactNode;
  searchTerm: string;
  isShortMode?: boolean;
}

export const ExactResults = ({ matches, wildcardCount, highlightWildcardLetter, searchTerm, isShortMode }: ExactResultsProps) => {
  return (
    <BaseResults
      matches={matches}
      title={`${matches.length} ${matches.length === 1 ? "palabra encontrada" : "palabras encontradas"} usando todas las fichas:`}
      highlightWildcardLetter={highlightWildcardLetter}
      searchTerm={searchTerm}
      isShortMode={isShortMode}
    />
  );
};
