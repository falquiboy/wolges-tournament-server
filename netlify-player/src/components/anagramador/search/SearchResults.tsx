
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader } from "lucide-react";
import { ExactResults } from "../ExactResults";
import { ShorterResults } from "../ShorterResults";
import { PatternResults } from "../PatternResults";

interface SearchResultsProps {
  isLoading: boolean;
  searchTerm: string;
  results: {
    exactMatches: string[];
    wildcardMatches: string[];
    additionalWildcardMatches: string[];
    shorterMatches: string[];
    patternMatches: string[];
  };
  highlightWildcardLetter: (word: string, originalWord: string) => React.ReactNode;
  showShorter: boolean;
  sortByEquity?: boolean;
}

const SearchResults = ({ 
  isLoading, 
  searchTerm, 
  results,
  highlightWildcardLetter,
  showShorter,
  sortByEquity
}: SearchResultsProps) => {
  const wildcardCount = (searchTerm.match(/\?/g) || []).length;
  const isPatternSearch = searchTerm.includes('*') || searchTerm.includes('.') || searchTerm.includes('-');

  const filteredAdditionalMatches = results.additionalWildcardMatches.filter(word => {
    if (wildcardCount === 0) {
      return !results.exactMatches.includes(word);
    } else {
      return !results.wildcardMatches.includes(word);
    }
  });

  const hasExactMatches = wildcardCount === 0 ? results.exactMatches?.length > 0 : results.wildcardMatches?.length > 0;

  if (isLoading) {
    console.log('🔄 SearchResults: Showing loading spinner');
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader className="h-4 w-4 animate-spin" />
        Preparando búsqueda...
      </div>
    );
  }

  if (!searchTerm) {
    return null;
  }

  const hasResults = results.exactMatches?.length > 0 || 
    results.wildcardMatches?.length > 0 || 
    filteredAdditionalMatches.length > 0 ||
    results.shorterMatches?.length > 0 ||
    results.patternMatches?.length > 0;

  // For pattern searches, show the generic message if no results
  if (!hasResults && isPatternSearch) {
    if (searchTerm && !isLoading) {
      return <p className="text-gray-500 text-lg">No se encontraron palabras.</p>;
    }
    return null;
  }

  // For non-pattern searches, always show the specific notifications
  // even if there are no results in any category

  return (
    <>
      {isPatternSearch ? (
        <PatternResults
          matches={results.patternMatches || []}
          searchTerm={searchTerm}
          showLongerWords={showShorter}
        />
      ) : (
        <>
          {!showShorter && (
            <>
              <ExactResults
                matches={wildcardCount === 0 ? results.exactMatches : results.wildcardMatches}
                wildcardCount={wildcardCount}
                highlightWildcardLetter={highlightWildcardLetter}
                searchTerm={searchTerm}
              />
              {filteredAdditionalMatches.length > 0 ? (
                <ShorterResults
                  matches={filteredAdditionalMatches}
                  highlightWildcardLetter={highlightWildcardLetter}
                  searchTerm={searchTerm}
                  title="palabras encontradas usando todas las fichas más una letra adicional"
                  sortByEquity={sortByEquity}
                  unifiedEquityView={false} // Keep grouped view, just sort within groups
                />
              ) : (
                <ShorterResults
                  matches={[]}
                  highlightWildcardLetter={highlightWildcardLetter}
                  searchTerm={searchTerm}
                  title="palabras encontradas usando todas las fichas más una letra adicional"
                  sortByEquity={sortByEquity}
                  unifiedEquityView={false}
                />
              )}
            </>
          )}
          {results.shorterMatches?.length > 0 && (
            <ShorterResults
              matches={results.shorterMatches}
              highlightWildcardLetter={highlightWildcardLetter}
              searchTerm={searchTerm}
              title="palabras más cortas encontradas"
              sortByEquity={sortByEquity}
              unifiedEquityView={false} // Keep grouped view, just sort within groups
            />
          )}
        </>
      )}
    </>
  );
};

export default SearchResults;
