import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResultsHeaderProps {
  onCopyAll: () => void;
}

export const ResultsHeader = ({ onCopyAll }: ResultsHeaderProps) => {
  return (
    <div className="flex justify-end">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={onCopyAll}
      >
        <Copy className="h-4 w-4" />
        Copiar todo
      </Button>
    </div>
  );
};