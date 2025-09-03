import React, { useState } from 'react';
import { calculateWordScore } from '@/utils/scrabbleScore';
import { calculateLeave, getLeaveValue } from '@/utils/leavesData';

export const DebugEquity: React.FC = () => {
  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const log = (message: string) => {
    setResults(prev => [...prev, message]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const testHerron = async () => {
    clearResults();
    setIsLoading(true);
    
    log('=== Testing HErrON from HSERON? ===');
    
    const rack = 'HSERON?';
    const word = 'HErrON';
    const searchTerm = 'HSERON?';
    
    log(`Input: rack="${rack}", word="${word}", searchTerm="${searchTerm}"`);
    
    try {
      // 1. Calculate word score
      const wordScore = calculateWordScore(word, searchTerm);
      log(`✅ Word Score: ${wordScore} ${wordScore === 7 ? '(CORRECT)' : '(EXPECTED 7)'}`);
      
      // 2. Calculate leave
      const leave = calculateLeave(rack, word.toUpperCase(), searchTerm);
      log(`✅ Leave: "${leave}" ${leave === 'RS' ? '(CORRECT)' : '(EXPECTED RS)'}`);
      
      // 3. Get leave value from Supabase
      const leaveValue = await getLeaveValue(leave);
      log(`✅ Leave Value: ${leaveValue} ${leaveValue ? '(FOUND)' : '(NOT FOUND)'}`);
      
      // 4. Calculate equity
      const equity = wordScore + (leaveValue || 0);
      log(`✅ Equity: ${equity} (${wordScore} + ${leaveValue})`);
      
      log(`🎯 Expected: ~13.90, Got: ${equity} ${Math.abs(equity - 13.90) < 1 ? '✅ CORRECT!' : '❌ WRONG!'}`);
      
    } catch (error) {
      log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    setIsLoading(false);
  };

  const testManualValues = async () => {
    clearResults();
    setIsLoading(true);
    
    log('=== Manual Verification ===');
    
    try {
      // Test que RS vale ~6.9
      const rsValue = await getLeaveValue('RS');
      log(`RS value: ${rsValue}`);
      
      // Test que S vale algo
      const sValue = await getLeaveValue('S');
      log(`S value: ${sValue}`);
      
      // Test si existe ?RS o ?S
      const wildcardRsValue = await getLeaveValue('?RS');
      log(`?RS value: ${wildcardRsValue}`);
      
      const wildcardSValue = await getLeaveValue('?S');
      log(`?S value: ${wildcardSValue}`);
      
    } catch (error) {
      log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    setIsLoading(false);
  };

  return (
    <div className="p-4 bg-gray-100 border rounded-lg mb-4">
      <h3 className="font-bold text-lg mb-3">🐛 Debug Equity Calculator</h3>
      
      <div className="flex gap-2 mb-4">
        <button 
          onClick={testHerron}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Test HErrON
        </button>
        <button 
          onClick={testManualValues}
          disabled={isLoading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          Test Leave Values
        </button>
        <button 
          onClick={clearResults}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Clear
        </button>
      </div>
      
      {isLoading && <div className="text-blue-600">🔄 Testing...</div>}
      
      <div className="bg-black text-green-400 p-3 rounded font-mono text-sm max-h-64 overflow-y-auto">
        {results.length === 0 && <div className="text-gray-500">Click a button to start testing...</div>}
        {results.map((result, index) => (
          <div key={index}>{result}</div>
        ))}
      </div>
    </div>
  );
};