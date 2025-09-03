import { Button } from "@/components/ui/button";
import { Gavel, Shuffle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ModuleSelectorProps {
  activeModule: 'judge' | 'anagram';
  onModuleChange: (module: 'judge' | 'anagram') => void;
}

const ModuleSelector = ({ activeModule, onModuleChange }: ModuleSelectorProps) => {
  const { toast } = useToast();

  const handleModuleChange = () => {
    const newModule = activeModule === 'judge' ? 'anagram' : 'judge';
    onModuleChange(newModule);
  };

  return (
    <div className="fixed top-4 right-4 flex gap-2 items-center bg-white/80 backdrop-blur-sm p-2 rounded-lg">
      <Button 
        variant="outline" 
        size="default"
        onClick={handleModuleChange}
        className="flex items-center gap-2"
      >
        {activeModule === 'judge' ? (
          <>
            <Shuffle className="h-4 w-4" />
            <span>Anagramador</span>
          </>
        ) : (
          <>
            <Gavel className="h-4 w-4" />
            <span>Juez</span>
          </>
        )}
      </Button>
    </div>
  );
};

export default ModuleSelector;