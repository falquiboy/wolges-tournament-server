import React, { useState, useEffect } from 'react';
import { useTrainingMode } from '../hooks/useTrainingMode';
import { SuperuserInterface } from './SuperuserInterface';
import { useProductionFilter } from './ProductionFilter';
import { TrainingRule, QueryResponse } from '../utils/RuleEngine';

// Mock rules para demostración
const mockRules: TrainingRule[] = [
  {
    rule_id: 'limit_results_production',
    rule_name: 'Limitar resultados en producción',
    condition_pattern: 'mode=production AND result_count>50',
    action_type: 'transform',
    parameters: { max_results: 50, add_message: 'Mostrando primeros 50 resultados' },
    active: true,
    creator: 'system',
    confidence: 0.9
  },
  {
    rule_id: 'hide_sql_production',
    rule_name: 'Ocultar SQL en modo producción',
    condition_pattern: 'mode=production',
    action_type: 'filter',
    parameters: { remove_fields: ['sql_query', 'debug_info'] },
    active: true,
    creator: 'system',
    confidence: 1.0
  },
  {
    rule_id: 'allow_all_superuser',
    rule_name: 'Permitir todo en modo superuser',
    condition_pattern: 'mode=superuser',
    action_type: 'allow',
    parameters: {},
    active: true,
    creator: 'system',
    confidence: 1.0
  }
];

// Mock response para demostración
const mockResponse: QueryResponse = {
  query: 'palabras que contengan "mol"',
  results: Array.from({ length: 75 }, (_, i) => ({
    id: i + 1,
    word: `palabra_${i + 1}`,
    definition: `Definición de la palabra ${i + 1}`,
    pos: i % 3 === 0 ? 'sustantivo' : i % 3 === 1 ? 'verbo' : 'adjetivo'
  })),
  sql_query: 'SELECT * FROM lexicon_indexes WHERE non_diac_word LIKE "%mol%" LIMIT 100',
  debug_info: {
    execution_time: '45ms',
    index_used: 'idx_non_diac_word',
    query_plan: 'IndexScan using idx_non_diac_word'
  },
  metadata: {
    total_results: 75,
    query_time: 45
  }
};

export const TrainingSystemDemo: React.FC = () => {
  const { 
    mode, 
    user, 
    session, 
    isAuthenticated, 
    authenticate, 
    startTrainingSession, 
    endTrainingSession,
    canAccessFeature 
  } = useTrainingMode();

  const { filterResponse, validateQuery, getStats } = useProductionFilter(mockRules);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentResponse, setCurrentResponse] = useState<QueryResponse | null>(null);
  const [filteredResponse, setFilteredResponse] = useState<QueryResponse | null>(null);
  const [testQuery, setTestQuery] = useState('palabras que contengan "mol"');

  useEffect(() => {
    if (mockResponse) {
      const filtered = filterResponse(mockResponse);
      setCurrentResponse(mockResponse);
      setFilteredResponse(filtered);
    }
  }, [mode, filterResponse]);

  const handleLogin = () => {
    const success = authenticate(email, password);
    if (success) {
      // Ya no necesitamos startTrainingSession porque authenticate lo hace automáticamente
      alert('Autenticación exitosa! Modo superuser activado.');
    } else {
      alert('Credenciales incorrectas');
    }
  };

  const handleLogout = () => {
    endTrainingSession();
    setCurrentResponse(null);
    setFilteredResponse(null);
  };

  const handleTestQuery = () => {
    const validation = validateQuery(testQuery);
    if (!validation.allowed) {
      alert(`Consulta no permitida: ${validation.reason}`);
      return;
    }

    // Simular procesamiento de consulta
    const testResponse: QueryResponse = {
      ...mockResponse,
      query: testQuery
    };

    const filtered = filterResponse(testResponse);
    setCurrentResponse(testResponse);
    setFilteredResponse(filtered);
  };

  const engineStats = getStats();

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
        <h2 className="text-2xl font-bold text-blue-800 mb-4">
          🧪 Demo del Sistema de Entrenamiento Dual
        </h2>
        
        {!isAuthenticated ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-blue-700">Autenticación</h3>
            <div className="grid grid-cols-3 gap-4 max-w-2xl">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="p-2 border rounded"
              />
              <input
                type="password"
                placeholder="Password (scrabble2025)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="p-2 border rounded"
              />
              <button
                onClick={handleLogin}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                🔑 Login
              </button>
            </div>
            <div className="text-sm text-blue-600">
              <p><strong>Emails de prueba:</strong> alfredo.falconer@gmail.com, admin@maslexico.app, trainer@maslexico.app</p>
              <p><strong>Password:</strong> scrabble2025</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-blue-700">
                  Sistema Activo - Modo: <span className="font-bold">{mode}</span>
                </h3>
                <p className="text-blue-600">Usuario: {user?.email} | Rol: {user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        )}
      </div>

      {isAuthenticated && (
        <>
          {/* Test Query Section */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">🔍 Probar Consulta</h3>
            <div className="flex space-x-2">
              <input
                type="text"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder="Ingresa una consulta de prueba..."
                className="flex-1 p-2 border rounded"
              />
              <button
                onClick={handleTestQuery}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                🚀 Probar
              </button>
            </div>
          </div>

          {/* Rule Engine Stats */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-purple-800 mb-3">📊 Estadísticas del Motor de Reglas</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-white p-3 rounded">
                <div className="font-semibold text-purple-700">Total Reglas</div>
                <div className="text-2xl font-bold text-purple-900">{engineStats.total_rules}</div>
              </div>
              <div className="bg-white p-3 rounded">
                <div className="font-semibold text-purple-700">Confianza Promedio</div>
                <div className="text-2xl font-bold text-purple-900">{engineStats.average_confidence.toFixed(2)}</div>
              </div>
              <div className="bg-white p-3 rounded">
                <div className="font-semibold text-purple-700">Reglas por Tipo</div>
                <div className="text-sm">
                  {Object.entries(engineStats.rules_by_type).map(([type, count]) => (
                    <div key={type}>{type}: {count}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Response Comparison */}
          {currentResponse && filteredResponse && (
            <div className="grid grid-cols-2 gap-6">
              {/* Original Response */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-red-800 mb-3">📄 Respuesta Original</h3>
                <div className="space-y-2 text-sm">
                  <div><strong>Consulta:</strong> {currentResponse.query}</div>
                  <div><strong>Resultados:</strong> {currentResponse.results?.length || 0}</div>
                  <div><strong>SQL:</strong> {currentResponse.sql_query ? '✅ Visible' : '❌ No disponible'}</div>
                  <div><strong>Debug:</strong> {currentResponse.debug_info ? '✅ Disponible' : '❌ No disponible'}</div>
                  {mode === 'superuser' && (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-semibold">Ver detalles técnicos</summary>
                      <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-32">
                        {JSON.stringify(currentResponse, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>

              {/* Filtered Response */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-800 mb-3">✅ Respuesta Filtrada ({mode})</h3>
                <div className="space-y-2 text-sm">
                  <div><strong>Consulta:</strong> {filteredResponse.query}</div>
                  <div><strong>Resultados:</strong> {filteredResponse.results?.length || 0}</div>
                  <div><strong>SQL:</strong> {filteredResponse.sql_query ? '✅ Visible' : '❌ Filtrado'}</div>
                  <div><strong>Debug:</strong> {filteredResponse.debug_info ? '✅ Disponible' : '❌ Filtrado'}</div>
                  {filteredResponse.message && (
                    <div className="p-2 bg-yellow-100 rounded text-yellow-800">
                      <strong>Mensaje:</strong> {filteredResponse.message}
                    </div>
                  )}
                  {filteredResponse.applied_rules && (
                    <div className="p-2 bg-blue-100 rounded text-blue-800">
                      <strong>Reglas aplicadas:</strong> {filteredResponse.applied_rules.join(', ')}
                    </div>
                  )}
                  <details className="mt-2">
                    <summary className="cursor-pointer font-semibold">Ver respuesta filtrada</summary>
                    <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-32">
                      {JSON.stringify(filteredResponse, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            </div>
          )}

          {/* Superuser Interface */}
          <SuperuserInterface 
            currentResponse={currentResponse || undefined}
            onCreateRule={(rule) => {
              console.log('Nueva regla creada:', rule);
              alert(`Regla "${rule.rule_name}" creada exitosamente!`);
            }}
            onCorrectResponse={(correction) => {
              console.log('Corrección enviada:', correction);
              alert('Corrección guardada en la sesión de entrenamiento');
            }}
          />
        </>
      )}
    </div>
  );
};