import React from "react";
import { Button } from "@/components/ui/button";
interface ModuleSelectorProps {
  activeModule: 'judge' | 'anagram' | 'lists';
  onModuleChange: (module: 'judge' | 'anagram' | 'lists') => void;
}
const NewModuleSelector = ({
  activeModule,
  onModuleChange
}: ModuleSelectorProps) => {
  return <div className="fixed top-0 left-0 right-0 h-16 bg-white shadow-sm flex items-center justify-center px-2 sm:px-4 z-30">
      <div className="flex gap-2 sm:gap-4">
        <Button 
          variant={activeModule === 'judge' ? 'default' : 'outline'} 
          onClick={() => onModuleChange('judge')} 
          className="w-20 sm:w-24 md:w-28 lg:w-32 text-xs sm:text-sm md:text-base shadow-lg hover:shadow-xl transition-shadow"
        >
          Juez
        </Button>
        <Button 
          variant={activeModule === 'anagram' ? 'default' : 'outline'} 
          onClick={() => onModuleChange('anagram')} 
          className="w-20 sm:w-24 md:w-28 lg:w-32 text-xs sm:text-sm md:text-base shadow-lg hover:shadow-xl transition-shadow"
        >
          Anagramas
        </Button>
        <Button 
          variant={activeModule === 'lists' ? 'default' : 'outline'} 
          onClick={() => onModuleChange('lists')} 
          className="w-20 sm:w-24 md:w-28 lg:w-32 text-xs sm:text-sm md:text-base shadow-lg hover:shadow-xl transition-shadow"
        >
          Listas
        </Button>
      </div>
      {/* Spacer to prevent overlap with hamburger menu */}
      <div className="absolute right-4 w-12 sm:w-16"></div>
    </div>;
};
export default NewModuleSelector;