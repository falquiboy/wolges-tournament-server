
import { Search, X } from "lucide-react";

interface SearchButtonProps {
  onClick: () => void;
  hasActiveSearch: boolean;
  isDisabled: boolean;
}

const SearchButton = ({
  onClick,
  hasActiveSearch,
  isDisabled
}: SearchButtonProps) => {
  return (
    <button 
      onClick={onClick} 
      disabled={isDisabled} 
      className="h-10 w-10 p-0 hover:text-gray-600 px-[2px] mx-0 my-[4px] flex items-center justify-center"
    >
      {hasActiveSearch ? (
        <X className="h-6 w-6" />
      ) : (
        <Search className="h-6 w-6" />
      )}
    </button>
  );
};

export default SearchButton;
