
import { useState, useRef } from "react";
import SearchInput from "../SearchInput";
import { useToast } from "@/hooks/use-toast";

interface SearchContainerProps {
  onSearch: (letters: string, targetLength: number | null) => void;
  onClear: () => void;
}

const SearchContainer = ({ 
  onSearch, 
  onClear
}: SearchContainerProps) => {
  const [letters, setLetters] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleInputChange = (value: string) => {
    let targetLength = null;
    let cleanedValue = value;
    
    // Extract target length if present using colon format
    const lengthMatch = value.match(/\:(\d+)$/);
    if (lengthMatch) {
      targetLength = parseInt(lengthMatch[1], 10);
      console.log('Target length extracted from colon format:', targetLength);
    }


    // Set the cleaned value in state
    setLetters(cleanedValue);
    return targetLength;
  };

  const handleSearch = () => {
    if (letters.trim()) {
      const targetLength = handleInputChange(letters);
      
      
      onSearch(letters, targetLength);
      
      if (!searchHistory.includes(letters)) {
        setSearchHistory([letters, ...searchHistory.slice(0, 9)]);
      }
      setHistoryIndex(-1);
      
      // Hide keyboard on mobile after search
      if (inputRef.current) {
        inputRef.current.blur();
      }
    }
  };

  const handleClear = () => {
    setLetters("");
    setHistoryIndex(-1);
    
    
    onClear();
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < searchHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setLetters(searchHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > -1) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setLetters(newIndex === -1 ? '' : searchHistory[newIndex]);
      }
    }
  };

  return (
    <SearchInput
      letters={letters}
      onInputChange={handleInputChange}
      onSearch={handleSearch}
      onClear={handleClear}
      onKeyPress={handleKeyPress}
      inputRef={inputRef}
    />
  );
};

export default SearchContainer;
