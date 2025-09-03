
import { Input } from "@/components/ui/input";
import { RefObject, useState, useEffect, useRef } from "react";
import { SearchTooltip } from "./SearchTooltip";
import { validateAndCleanAnagramInput, validateAndCleanPatternInput } from "@/utils/inputValidation";
import SearchButton from "./search/SearchButton";
// UserActivityContext removed

interface SearchInputProps {
  letters: string;
  onInputChange: (value: string) => void;
  onSearch: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  inputRef: RefObject<HTMLInputElement>;
  onClear?: () => void;
}

const SearchInput = ({ 
  letters, 
  onInputChange, 
  onSearch,
  onKeyPress, 
  inputRef,
  onClear
}: SearchInputProps) => {
  const [isPatternMode, setIsPatternMode] = useState(false);
  const [hasLengthSpecified, setHasLengthSpecified] = useState(false);
  const cursorPositionRef = useRef<number | null>(null);
  
  // User activity tracking removed
  
  // Auto-detect pattern mode and length specification based on input
  useEffect(() => {
    const hasPatternChars = letters.includes('*') || 
                           letters.includes('.') || 
                           letters.includes('^') || 
                           letters.includes('$') || 
                           letters.includes('-');
    setIsPatternMode(hasPatternChars);
    
    // Check if length is specified using colon
    const hasLengthSpec = letters.includes(':') && /\:\d+/.test(letters);
    setHasLengthSpecified(hasLengthSpec);
  }, [letters]);

  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && onClear) {
        e.preventDefault();
        onClear();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [inputRef, onClear]);

  useEffect(() => {
    if (cursorPositionRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(
        cursorPositionRef.current,
        cursorPositionRef.current
      );
      cursorPositionRef.current = null;
    }
  }, [letters]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 🎯 Signal user typing activity for smart Trie upgrade
    // Activity signaling removed
    
    cursorPositionRef.current = e.target.selectionStart;
    let value = e.target.value.toUpperCase();
    
    // Preserve cursor position for colon + number cases
    const hasColon = value.includes(':');
    const cursorPosition = e.target.selectionStart || 0;
    const isAfterColon = hasColon && cursorPosition > value.indexOf(':');
    
    // Automatically determine which validation to use based on input
    const hasPatternChars = value.includes('*') || 
                           value.includes('.') || 
                           value.includes('^') || 
                           value.includes('$') || 
                           value.includes('-');
    
    // Apply the appropriate validation
    const cleanedValue = hasPatternChars ? 
      validateAndCleanPatternInput(value) : 
      validateAndCleanAnagramInput(value);
    
    // Adjust cursor position if we're after a colon and typing numbers
    if (isAfterColon && cleanedValue !== value) {
      // Calculate new cursor position
      const colonPosInCleaned = cleanedValue.indexOf(':');
      if (colonPosInCleaned >= 0) {
        const charsAfterColon = cursorPosition - value.indexOf(':') - 1;
        cursorPositionRef.current = colonPosInCleaned + Math.min(charsAfterColon + 1, cleanedValue.length - colonPosInCleaned);
      }
    }
    
    onInputChange(cleanedValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && onClear) {
      e.preventDefault();
      onClear();
    } else if (e.key === 'Enter') {
      // Hide keyboard on mobile after search
      if (inputRef.current) {
        inputRef.current.blur();
      }
      onKeyPress(e);
    } else {
      onKeyPress(e);
    }
  };

  const handleButtonClick = () => {
    if (letters.trim() && onClear) {
      onClear();
    } else {
      onSearch();
      // Hide keyboard on mobile after search
      if (inputRef.current) {
        inputRef.current.blur();
      }
    }
  };

  return (
    <div className="space-y-2">
      <SearchTooltip isPatternMode={isPatternMode}>
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            type="text"
            placeholder={
              isPatternMode 
                ? "Ej: -AR (termina con AR), CO* (empieza con CO), .R.. (. = una letra, * = cero o más)" 
                : "? es comodín"
            }
            value={letters}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="text-xl h-12 text-left pr-12 border border-gray-200 rounded-md w-full"
            style={{ paddingRight: '3rem' }}
            autoFocus
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            data-form-type="other"
            inputMode="text"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <SearchButton
              onClick={handleButtonClick}
              hasActiveSearch={!!letters.trim()}
              isDisabled={!letters.trim()}
            />
          </div>
        </div>
      </SearchTooltip>
    </div>
  );
};

export default SearchInput;
