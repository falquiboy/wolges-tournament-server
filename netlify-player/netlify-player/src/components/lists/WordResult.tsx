
import React from 'react';

interface WordResultProps {
  word: string;
  onClick?: (word: string) => void;
}

const WordResult = ({ word, onClick }: WordResultProps) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onClick) {
      onClick(word);
    }
  };
  
  return (
    <button
      onClick={handleClick}
      className="bg-gray-50 hover:bg-gray-100 p-2 rounded text-center transition-colors font-semibold w-full"
      aria-label={`Ver información de "${word}"`}
    >
      {word}
    </button>
  );
};

export default WordResult;
