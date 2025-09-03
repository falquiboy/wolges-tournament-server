import { Switch } from "@/components/ui/switch";

interface SearchModesProps {
  isPatternMode: boolean;
  onPatternModeChange: (checked: boolean) => void;
  isReadOnly?: boolean;
}

export const SearchModes = ({
  isPatternMode,
  onPatternModeChange,
  isReadOnly = false,
}: SearchModesProps) => {
  return (
    <div className="flex items-center space-x-4 mb-2">
      <div className="flex items-center space-x-2">
        <Switch
          id="pattern-mode"
          checked={isPatternMode}
          onCheckedChange={onPatternModeChange}
          disabled={isReadOnly}
        />
        <label
          htmlFor="pattern-mode"
          className={`text-sm ${isReadOnly ? 'text-gray-400' : 'text-gray-600'} cursor-pointer`}
        >
          Modo patrón {isReadOnly && '(auto)'}
        </label>
      </div>
    </div>
  );
};