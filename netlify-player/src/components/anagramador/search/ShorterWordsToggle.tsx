
import { Switch } from "@/components/ui/switch";
import TooltipHelp from "./TooltipHelp";

interface ShorterWordsToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  isPatternMode?: boolean;
  isLengthSpecified?: boolean;
}

const ShorterWordsToggle = ({
  checked,
  onCheckedChange,
  isPatternMode = false,
  isLengthSpecified = false
}: ShorterWordsToggleProps) => {
  let label = isPatternMode 
    ? "Mostrar palabras más largas (>8 letras)" 
    : "Mostrar palabras más cortas";
    
  if (isLengthSpecified) {
    label = isPatternMode 
      ? "Filtro de longitud exacta activado" 
      : "Filtro de longitud exacta activado";
  }
  
  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Switch 
          id="toggle-words" 
          checked={checked} 
          onCheckedChange={onCheckedChange} 
          disabled={isLengthSpecified}
        />
        <label 
          htmlFor="toggle-words" 
          className={`text-sm text-gray-600 cursor-pointer ${isLengthSpecified ? 'opacity-70' : ''}`}
        >
          {label}
        </label>
      </div>
      <div className="flex justify-start">
        <TooltipHelp isPatternMode={isPatternMode} />
      </div>
    </div>
  );
};

export default ShorterWordsToggle;
