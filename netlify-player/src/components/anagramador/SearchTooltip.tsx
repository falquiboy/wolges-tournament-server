
import React, { useState } from 'react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { X } from "lucide-react";

interface SearchTooltipProps {
  isPatternMode: boolean;
  children: React.ReactNode;
}

export const SearchTooltip = ({ isPatternMode, children }: SearchTooltipProps) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // If not in pattern mode, just return the children without wrapping in tooltip
  if (!isPatternMode) {
    return <>{children}</>;
  }

  return (
    <div className="relative flex-1">
      {children}
    </div>
  );
};
