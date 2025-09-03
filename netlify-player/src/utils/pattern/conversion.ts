
/**
 * Converts a pattern into a RegExp object
 * Handles special pattern formats
 */
export const convertPatternToRegex = (pattern: string): RegExp => {
  // Check if the pattern is already a regex-formatted pattern
  // (has explicit anchors or .* patterns from translateHyphenPattern)
  const isProcessedPattern = pattern.includes('.*') || 
                             pattern.startsWith('^') ||
                             pattern.endsWith('$');
  
  // If already translated, don't modify further
  if (isProcessedPattern) {
    // Ensure the pattern has proper anchors for exact matching
    let finalPattern = pattern;
    
    // Make sure we have a proper start anchor if needed
    if (!finalPattern.startsWith('^')) {
      finalPattern = '^' + finalPattern;
    }
    
    // Make sure we have a proper end anchor if needed
    if (!finalPattern.endsWith('$')) {
      finalPattern = finalPattern + '$';
    }
    
    return new RegExp(finalPattern, 'i');
  }
  
  // For simple patterns, add ^ and $ to match the entire word
  return new RegExp(`^${pattern}$`, 'i');
};
