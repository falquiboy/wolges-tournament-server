export interface SearchResults {
  exactMatches: string[];
  wildcardMatches: string[];
  additionalWildcardMatches: string[];
  shorterMatches: string[];
  patternMatches: string[];
}

export interface SearchState {
  data: SearchResults;
  isLoading: boolean;
  error: string | null;
}