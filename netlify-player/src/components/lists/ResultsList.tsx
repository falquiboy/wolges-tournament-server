
import React from 'react';
import WordResult from './WordResult';
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ResultsListProps {
  results: string[];
  onWordClick?: (word: string) => void;
}

const ResultsList = ({ results, onWordClick }: ResultsListProps) => {
  if (results.length === 0) return null;

  const handleCopyAll = async () => {
    try {
      // Las palabras ya están en formato de visualización en este componente
      // porque fueron convertidas en el componente Lists.tsx
      await navigator.clipboard.writeText(results.join('\n'));
      toast.success(`${results.length} palabras copiadas al portapapeles`);
    } catch (error) {
      toast.error('Error al copiar las palabras');
    }
  };

  return (
    <ScrollArea className="h-[calc(100vh-16rem)]">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Resultados ({results.length})</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyAll}
            className="flex items-center gap-2 text-sm hover:bg-gray-100"
          >
            <Copy className="h-4 w-4" />
            <span>Copiar todo</span>
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {results.map((word, index) => (
            <WordResult key={index} word={word} onClick={onWordClick} />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
};

export default ResultsList;
