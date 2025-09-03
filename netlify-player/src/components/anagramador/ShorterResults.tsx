
import { BaseResults } from "./results/BaseResults";

interface ShorterResultsProps {
  matches: string[];
  highlightWildcardLetter: (word: string, originalWord: string) => React.ReactNode;
  searchTerm: string;
  title: string;
  sortByEquity?: boolean;
  unifiedEquityView?: boolean;
}

export const ShorterResults = ({ matches, highlightWildcardLetter, searchTerm, title, sortByEquity, unifiedEquityView }: ShorterResultsProps) => {
  const isAdditionalLetterMode = title.includes("adicional");
  
  return (
    <BaseResults
      matches={matches}
      title={title}
      highlightWildcardLetter={highlightWildcardLetter}
      searchTerm={searchTerm}
      isShortMode={!isAdditionalLetterMode}
      sortByEquity={sortByEquity} // Pasar el prop desde el toggle
      unifiedEquityView={unifiedEquityView} // Keep grouped view by default
    />
  );
};
