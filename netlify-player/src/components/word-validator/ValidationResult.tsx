
import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { toDisplayFormat } from "@/utils/digraphs";

interface ValidationResultProps {
  word: string;
  result: {
    isValid: boolean;
    checked: boolean;
    words: string[];
  };
}

const ValidationResult = ({
  word,
  result
}: ValidationResultProps) => {
  if (!result.checked) return null;
  
  return (
    <ScrollArea className={`h-40 rounded-md border border-gray-200 ${result.isValid ? "bg-scrabble-valid" : "bg-scrabble-invalid"} text-white relative`}>
      <div className="p-4 min-h-full flex items-center py-0 my-0">
        <div className="relative w-full">
          <div className="flex flex-wrap gap-3">
            {result.words.map((w, i) => (
              <span key={i} className="text-4xl font-bold">
                {toDisplayFormat(w)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};

export default ValidationResult;
