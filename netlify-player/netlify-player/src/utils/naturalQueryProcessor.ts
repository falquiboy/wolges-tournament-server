
// Utility functions specific to natural language query processing
export const processNaturalQuery = (input: string): {
  processedQuery: string,
  hasSeparateLetters: {
    ch?: boolean,
    separateL?: boolean
  }
} => {
  if (!input) return { processedQuery: '', hasSeparateLetters: {} };
  
  let result = input.toUpperCase();
  
  // Detect if C and H are meant to be separate letters
  const hasSeparateCH = /\bC\s*(?:Y|CON|,)\s*H\b/g.test(result);
  
  // Detect when user refers to separate L letters vs the LL digraph
  // "2 eles", "dos eles", "dos letras l" should be treated as separate L's
  // "elle", "doble ele", "LL" should be treated as the digraph
  const hasSeparateL = /\b(?:2|DOS)\s+(?:ELES|LETRAS?\s+L)\b/g.test(result) ||
                      /\bDOS\s+L\b/g.test(result) ||
                      /\bL\s+Y\s+(?:OTRA\s+)?L\b/g.test(result);

  // Handle L/LL explicit references carefully
  if (!hasSeparateL) {
    // Only convert "ele/eles" to "L" if we're NOT dealing with separate L's
    result = result
      .replace(/\b(ELE|ELES)\b/g, 'L')
      .replace(/\b(ELLE|ELLES|DOBLE\s+ELE)\b/g, 'LL');
  } else {
    // When dealing with separate L's, don't process "eles" as single L
    result = result
      .replace(/\b(ELLE|ELLES|DOBLE\s+ELE)\b/g, 'LL') // Still handle LL digraph
      .replace(/\b(?:2|DOS)\s+(?:ELES|LETRAS?\s+L)\b/g, '2 L') // Normalize to "2 L"
      .replace(/\bDOS\s+L\b/g, '2 L');
  }
  
  // Special handling for Ñ during accent removal
  result = result.replace(/Ñ/g, '#');
  result = result
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC');
  result = result.replace(/#/g, 'Ñ');
  
  return {
    processedQuery: result,
    hasSeparateLetters: {
      ch: hasSeparateCH,
      separateL: hasSeparateL
    }
  };
};
