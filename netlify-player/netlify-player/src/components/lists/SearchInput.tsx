
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, MicOff, ArrowUp, X } from "lucide-react";

interface SearchInputProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  isLoading: boolean;
}

const SearchInput = ({
  query,
  onQueryChange,
  onSearch,
  isRecording,
  onStartRecording,
  onStopRecording,
  isLoading
}: SearchInputProps) => {
  const [hasActiveSearch, setHasActiveSearch] = useState(false);
  const [previousQuery, setPreviousQuery] = useState('');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // If query changes and we have an active search, it means user is typing new text
    if (hasActiveSearch && query !== previousQuery) {
      setHasActiveSearch(false);
    }
  }, [query, hasActiveSearch, previousQuery]);

  // Add effect to focus textarea when query is cleared
  useEffect(() => {
    if (!query && textAreaRef.current && !isLoading) {
      textAreaRef.current.focus();
    }
  }, [query, isLoading]);

  const handleSearch = () => {
    if (hasActiveSearch) {
      // Clear functionality
      onQueryChange('');
      setHasActiveSearch(false);
      // Focus the textarea after clearing
      textAreaRef.current?.focus();
    } else {
      // Search functionality
      if (query.trim()) {
        onSearch();
        setHasActiveSearch(true);
        setPreviousQuery(query);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && query.trim()) {
        handleSearch();
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          ref={textAreaRef}
          placeholder="Palabra (casa) • Anagramas (acsa) • Patrones (c_sa) • Lenguaje natural (palabras con q sin u)"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyPress}
          className="w-full h-20 px-4 py-4 rounded-lg bg-white border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-zinc-200"
          style={{
            lineHeight: "1.5",
            verticalAlign: "middle"
          }}
          disabled={isLoading}
        />
      </div>
      <div className="flex justify-end gap-2 px-1">
        <Button
          onClick={isRecording ? onStopRecording : onStartRecording}
          variant="ghost"
          size="icon"
          className={`h-10 w-10 rounded-full ${
            isRecording 
              ? 'bg-red-500 text-white hover:bg-red-600' 
              : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
          } transition-colors`}
          disabled={isLoading}
        >
          {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Button
          onClick={handleSearch}
          variant="ghost"
          size="icon"
          className={`h-10 w-10 rounded-full ${
            hasActiveSearch
              ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900'
              : 'bg-zinc-900 hover:bg-zinc-800 text-white'
          }`}
          disabled={isLoading || (!hasActiveSearch && !query.trim())}
        >
          {hasActiveSearch ? (
            <X className="h-5 w-5" />
          ) : (
            <ArrowUp className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
};

export default SearchInput;

