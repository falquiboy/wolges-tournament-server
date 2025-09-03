
/**
 * Translates hyphen-based patterns into regex-compatible patterns
 * -CON → .*CON$ (ends with CON)
 * CON- → ^CON.* (starts with CON)
 * -CON- → .*CON.* (contains CON anywhere)
 * -PUCH-R → .*PUCH.*R$ (contains PUCH and ends with R)
 */
export const translateHyphenPattern = (pattern: string): string => {
  // Clean the pattern first
  const cleanPattern = pattern.trim();
  
  // Handle empty or invalid patterns
  if (!cleanPattern || cleanPattern === '-') {
    return pattern;
  }

  // Handle special cases with multiple hyphens
  const parts = cleanPattern.split('-').filter(Boolean);
  
  // Handle compound patterns like "-PUCH-R" (contains PUCH and ends with R)
  if (cleanPattern.startsWith('-') && parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    
    // Check if this is a pattern like "-PUCH-R" (contains and ends with)
    if (cleanPattern.indexOf('-', 1) > 0 && !cleanPattern.endsWith('-')) {
      // Get the main pattern (everything between first and last hyphen)
      const middleParts = parts.slice(0, -1).join('');
      return `.*${middleParts}.*${lastPart}$`;
    }
  }
  
  // Original logic for standard patterns
  if (cleanPattern.startsWith('-') && cleanPattern.endsWith('-')) {
    // -CON- → Match words containing the pattern anywhere
    const innerPattern = cleanPattern.slice(1, -1);
    if (!innerPattern) return pattern;
    
    return `.*${innerPattern}.*`;
  } else if (cleanPattern.startsWith('-')) {
    // -CON → .*CON$
    // Words ending with the specified letters
    const endPattern = cleanPattern.slice(1);
    return endPattern ? `.*${endPattern}$` : pattern;
  } else if (cleanPattern.endsWith('-')) {
    // CON- → ^CON.*
    // When pattern starts with specified letters
    const startPattern = cleanPattern.slice(0, -1);
    return startPattern ? `^${startPattern}.*` : pattern;
  }

  return pattern;
};
