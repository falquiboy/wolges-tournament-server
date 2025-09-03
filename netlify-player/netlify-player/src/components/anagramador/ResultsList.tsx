
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import SearchResults from "./search/SearchResults";
import ExtendedWordView from "./ExtendedWordView";
import ExtendedResultsView from "./ExtendedResultsView";
import HooksView from "./HooksView";
import { toDisplayFormat } from "@/utils/digraphs";
import { fetchAnagramWordsData, AnagramWordInfo } from "@/utils/anagramWordData";
import { fetchHooksData, HookInfo } from "@/utils/hooksData";
import { useState, useEffect } from "react";
import { Loader } from "lucide-react";

interface ResultsListProps {
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
  isSearchAborted?: boolean;
  showShorter: boolean;
  showExtendedView?: boolean;
  showHooksView?: boolean;
  sortByEquity?: boolean;
}

const ResultsList = ({ 
  isLoading, 
  searchTerm, 
  results, 
  highlightWildcardLetter,
  isSearchAborted,
  showShorter,
  showExtendedView,
  showHooksView,
  sortByEquity
}: ResultsListProps) => {
  const { toast } = useToast();
  const [wordsData, setWordsData] = useState<Map<string, AnagramWordInfo>>(new Map());
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [hooksData, setHooksData] = useState<Map<string, HookInfo>>(new Map());
  const [isLoadingHooks, setIsLoadingHooks] = useState(false);

  // Load word data when extended view is enabled and we have results
  useEffect(() => {
    if (showExtendedView && !showHooksView && results && !isLoading) {
      // Use results as-is - they're already filtered by showShorter in the hook
      const allWordsRaw = [
        ...results.exactMatches,
        ...results.wildcardMatches,
        ...results.additionalWildcardMatches,
        ...results.shorterMatches,
        ...results.patternMatches
      ];
      
      const allWordsForQuery = allWordsRaw.map(word => toDisplayFormat(word).toUpperCase());

      if (allWordsForQuery.length > 0) {
        setIsLoadingData(true);
        fetchAnagramWordsData(allWordsForQuery)
          .then(data => {
            setWordsData(data);
          })
          .catch(error => {
            console.error('Error loading words data:', error);
            toast({ title: 'Error cargando información adicional', variant: 'destructive' });
          })
          .finally(() => {
            setIsLoadingData(false);
          });
      }
    }
  }, [showExtendedView, showHooksView, results, isLoading]);

  // Clear extended data when hooks view becomes active
  useEffect(() => {
    if (showHooksView) {
      setWordsData(new Map());
      setIsLoadingData(false);
    }
  }, [showHooksView]);

  // Load hooks data when hooks view is enabled and we have results
  useEffect(() => {
    if (showHooksView && results && !isLoading) {
      // Use results as-is - they're already filtered by showShorter in the hook
      const allWordsRaw = [
        ...results.exactMatches,
        ...results.wildcardMatches,
        ...results.additionalWildcardMatches,
        ...results.shorterMatches,
        ...results.patternMatches
      ];
      
      const allWordsForQuery = allWordsRaw.map(word => toDisplayFormat(word).toUpperCase());

      if (allWordsForQuery.length > 0) {
        setIsLoadingHooks(true);
        fetchHooksData(allWordsForQuery)
          .then(data => {
            setHooksData(data);
          })
          .catch(error => {
            console.error('Error loading hooks data:', error);
            toast({ title: 'Error cargando información de ganchos', variant: 'destructive' });
          })
          .finally(() => {
            setIsLoadingHooks(false);
          });
      }
    }
  }, [showHooksView, results, isLoading]);

  // Clear hooks data when extended view becomes active
  useEffect(() => {
    if (showExtendedView) {
      setHooksData(new Map());
      setIsLoadingHooks(false);
    }
  }, [showExtendedView]);


  // Check if we have any results to show the toggle
  const hasResults = results && (
    results.exactMatches.length > 0 ||
    results.wildcardMatches.length > 0 ||
    results.additionalWildcardMatches.length > 0 ||
    results.shorterMatches.length > 0 ||
    results.patternMatches.length > 0
  );

  return (
    <ScrollArea className="h-[calc(100vh-12rem)] px-1">
      <div className="space-y-4 pb-4">
        {/* Loading spinner for initial search */}
        {isLoading && searchTerm && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Loader className="animate-spin text-blue-600" size={24} />
            <span className="text-gray-600 text-sm">Buscando...</span>
          </div>
        )}

        {/* Results (only show when not loading) */}
        {!isLoading && (
          <>
            {showHooksView ? (
              <HooksView
                isLoading={isLoading}
                searchTerm={searchTerm}
                results={results}
                highlightWildcardLetter={highlightWildcardLetter}
                showShorter={showShorter}
                hooksData={hooksData}
                isLoadingHooks={isLoadingHooks}
              />
            ) : showExtendedView ? (
              <ExtendedResultsView
                isLoading={isLoading}
                searchTerm={searchTerm}
                results={results}
                highlightWildcardLetter={highlightWildcardLetter}
                showShorter={showShorter}
                wordsData={wordsData}
                isLoadingData={isLoadingData}
              />
            ) : (
              <SearchResults
                isLoading={isLoading}
                searchTerm={searchTerm}
                results={results}
                highlightWildcardLetter={highlightWildcardLetter}
                showShorter={showShorter}
                sortByEquity={sortByEquity}
              />
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
};

export default ResultsList;
