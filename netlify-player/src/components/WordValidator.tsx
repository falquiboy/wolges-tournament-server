
import { useState, useEffect } from "react";
import { HybridTrieService } from "@/services/HybridTrieService";
import Header from "./word-validator/Header";
import WordInput from "./word-validator/WordInput";
import LoadingIndicator from "./word-validator/LoadingIndicator";
import ValidationResult from "./word-validator/ValidationResult";
import { LoadingStage } from "@/hooks/useWordDatabase";
import { Check, Database, Zap } from "lucide-react";

interface WordValidatorProps {
  isDictionaryLoading: boolean;
  progress: number;
  trie: HybridTrieService;
  stage?: LoadingStage;
  wordCount?: number;
}

const WordValidator = ({ 
  isDictionaryLoading, 
  progress, 
  trie, 
  stage = 'processing',
  wordCount = 0
}: WordValidatorProps) => {
  const [word, setWord] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    isValid: boolean;
    checked: boolean;
    words: string[];
  }>({ isValid: false, checked: false, words: [] });
  const [currentProvider, setCurrentProvider] = useState<'trie' | 'sqlite' | 'supabase' | 'none'>('none');

  // Actualizar provider status periódicamente
  useEffect(() => {
    const updateProvider = () => {
      const provider = trie.getCurrentProvider();
      setCurrentProvider(provider);
    };

    // Actualizar inmediatamente
    updateProvider();

    // Actualizar cada 2 segundos hasta que SQLite esté listo
    const interval = setInterval(() => {
      const provider = trie.getCurrentProvider();
      setCurrentProvider(provider);
      
      // Dejar de chequear cuando SQLite esté listo
      if (provider === 'sqlite' || provider === 'trie') {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [trie]);

  const handleValidate = async () => {
    if (!word.trim() || isDictionaryLoading) return;

    setIsLoading(true);
    try {
      // Split into individual words and process each one
      const words = word.trim().split(" ");
      console.log('Validating words:', words);
      
      // Get all words from trie for debugging
      const allWords = trie.getAllWords();
      console.log('Total words in trie:', allWords.length);
      
      const isValid = await Promise.all(words.map(async (w) => {
        // Convert to uppercase without processing digraphs yet
        const upperWord = w.toUpperCase();
        console.log('Validating word:', w, 'uppercase:', upperWord);
        
        // Use async search with fallback to Supabase
        const found = await trie.searchAsync(upperWord);
        console.log('Word found?', found);
        return found;
      })).then(results => results.every(result => result));

      // Store the original words in uppercase for display
      setResult({ 
        isValid, 
        checked: true, 
        words: words.map(w => w.toUpperCase()) 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    if (isLoading) return;
    setWord("");
    setResult({ isValid: false, checked: false, words: [] });
  };

  const handleWordChange = (newWord: string) => {
    setWord(newWord);
    if (newWord !== word) {
      setResult(prev => ({ ...prev, checked: false }));
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 flex flex-col items-center relative">
      <div className="w-full max-w-md space-y-4">
        <Header />
        <div className="space-y-4">
          <WordInput
            word={word}
            isLoading={isDictionaryLoading || isLoading}
            onWordChange={handleWordChange}
            onValidate={result.checked ? handleClear : handleValidate}
            buttonText={result.checked ? "Limpiar" : "Validar"}
            isChecked={result.checked}
          />
          
          {result.checked && (
            <ValidationResult
              word={word}
              result={result}
            />
          )}
          
          {isDictionaryLoading && (
            <LoadingIndicator 
              progress={progress} 
              stage={stage}
            />
          )}
        </div>
      </div>
      
      {/* Fallback method indicator - bottom left */}
      {!isDictionaryLoading && (
        <div className="fixed bottom-4 left-4 bg-white shadow-md rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-gray-600 border border-gray-200">
          {currentProvider === 'trie' ? (
            <>
              <Zap size={14} className="text-yellow-600" />
              <span>Trie</span>
            </>
          ) : currentProvider === 'sqlite' ? (
            <>
              <Database size={14} className="text-blue-600" />
              <span>SQLite</span>
            </>
          ) : currentProvider === 'supabase' ? (
            <>
              <Database size={14} className="text-green-600" />
              <span>Supabase</span>
            </>
          ) : (
            <>
              <Database size={14} className="text-gray-400" />
              <span>Cargando...</span>
            </>
          )}
        </div>
      )}
      
      {/* Permanent dictionary status indicator */}
      {wordCount > 0 && !isDictionaryLoading && (
        <div className="fixed bottom-4 right-4 bg-white shadow-md rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-gray-700 border border-gray-200">
          <Check size={16} className="text-green-600" />
          <span>{wordCount.toLocaleString('en-US')} palabras</span>
        </div>
      )}
    </div>
  );
};

export default WordValidator;
