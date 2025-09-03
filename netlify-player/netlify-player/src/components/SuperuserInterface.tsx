import React, { useState, useEffect } from 'react';
import { useTrainingMode } from '../hooks/useTrainingMode';
import { RuleEngine, TrainingRule, QueryResponse, RuleContext } from '../utils/RuleEngine';

interface SuperuserInterfaceProps {
  currentResponse?: QueryResponse;
  onCreateRule?: (rule: Partial<TrainingRule>) => void;
  onCorrectResponse?: (correction: any) => void;
}

export const SuperuserInterface: React.FC<SuperuserInterfaceProps> = ({
  currentResponse,
  onCreateRule,
  onCorrectResponse
}) => {
  const { mode, user, session, canAccessFeature, addCorrectionToSession } = useTrainingMode();
  const [activeTab, setActiveTab] = useState<'debug' | 'rules' | 'patterns' | 'logs'>('debug');
  const [newRule, setNewRule] = useState<Partial<TrainingRule>>({
    rule_name: '',
    condition_pattern: '',
    action_type: 'filter',
    parameters: {},
    confidence: 0.8
  });
  const [feedback, setFeedback] = useState('');
  const [correctedResponse, setCorrectedResponse] = useState('');

  // Solo mostrar si el usuario tiene permisos de superuser
  if (mode !== 'superuser' || !canAccessFeature('train')) {
    return null;
  }

  const handleCreateRule = () => {
    if (!newRule.rule_name || !newRule.condition_pattern) {
      alert('Por favor completa nombre y condición de la regla');
      return;
    }

    const rule: Partial<TrainingRule> = {
      ...newRule,
      rule_id: `rule_${Date.now()}`,
      creator: user?.email || 'unknown',
      active: true
    };

    onCreateRule?.(rule);
    
    // Limpiar formulario
    setNewRule({
      rule_name: '',
      condition_pattern: '',
      action_type: 'filter',
      parameters: {},
      confidence: 0.8
    });
  };

  const handleCorrectResponse = () => {
    if (!currentResponse || !correctedResponse.trim()) {
      alert('Por favor proporciona una corrección');
      return;
    }

    const correction = {
      originalResponse: currentResponse,
      correctedResponse: correctedResponse,
      feedback: feedback,
      timestamp: new Date().toISOString()
    };

    addCorrectionToSession(currentResponse, correctedResponse, feedback);
    onCorrectResponse?.(correction);
    
    // Limpiar formulario
    setCorrectedResponse('');
    setFeedback('');
  };

  return (
    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-yellow-800">
          🔧 Modo Entrenamiento - Superuser
        </h3>
        <div className="text-sm text-yellow-700">
          Usuario: {user?.email} | Sesión: {session?.sessionId?.slice(-8)}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-4">
        {[
          { id: 'debug', label: 'Debug', icon: '🐛' },
          { id: 'rules', label: 'Reglas', icon: '⚙️' },
          { id: 'patterns', label: 'Patrones', icon: '🧩' },
          { id: 'logs', label: 'Logs', icon: '📝' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-yellow-200 text-yellow-800'
                : 'bg-white text-yellow-600 hover:bg-yellow-100'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Debug Tab */}
      {activeTab === 'debug' && currentResponse && (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-yellow-800 mb-2">Información de Debug</h4>
            <div className="bg-white p-3 rounded border text-xs">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify({
                  sql_query: currentResponse.sql_query,
                  debug_info: currentResponse.debug_info,
                  applied_rules: currentResponse.applied_rules,
                  rule_engine_debug: currentResponse.rule_engine_debug,
                  result_count: currentResponse.results?.length || 0
                }, null, 2)}
              </pre>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-yellow-800 mb-2">Corregir Respuesta</h4>
            <textarea
              value={correctedResponse}
              onChange={(e) => setCorrectedResponse(e.target.value)}
              placeholder="Escribe la respuesta corregida..."
              className="w-full h-24 p-2 border rounded text-sm"
            />
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Feedback sobre por qué se corrigió..."
              className="w-full h-16 p-2 border rounded text-sm mt-2"
            />
            <button
              onClick={handleCorrectResponse}
              className="mt-2 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              💾 Guardar Corrección
            </button>
          </div>
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-yellow-800 mb-2">Crear Nueva Regla</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-yellow-700">Nombre</label>
                <input
                  type="text"
                  value={newRule.rule_name}
                  onChange={(e) => setNewRule(prev => ({ ...prev, rule_name: e.target.value }))}
                  className="w-full p-2 border rounded text-sm"
                  placeholder="ej: Limitar resultados largos"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-yellow-700">Tipo de Acción</label>
                <select
                  value={newRule.action_type}
                  onChange={(e) => setNewRule(prev => ({ ...prev, action_type: e.target.value as any }))}
                  className="w-full p-2 border rounded text-sm"
                >
                  <option value="filter">Filtrar</option>
                  <option value="transform">Transformar</option>
                  <option value="allow">Permitir</option>
                  <option value="deny">Denegar</option>
                </select>
              </div>
            </div>
            
            <div className="mt-3">
              <label className="block text-sm font-medium text-yellow-700">Condición</label>
              <input
                type="text"
                value={newRule.condition_pattern}
                onChange={(e) => setNewRule(prev => ({ ...prev, condition_pattern: e.target.value }))}
                className="w-full p-2 border rounded text-sm"
                placeholder="ej: mode=production AND result_count&gt;50"
              />
              <div className="text-xs text-yellow-600 mt-1">
                Ejemplos: "mode=production", "result_count&gt;100", "mode=production AND has_sql"
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-yellow-700">Confianza (0-1)</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={newRule.confidence}
                onChange={(e) => setNewRule(prev => ({ ...prev, confidence: parseFloat(e.target.value) }))}
                className="w-32 p-2 border rounded text-sm"
              />
            </div>

            <button
              onClick={handleCreateRule}
              className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              ➕ Crear Regla
            </button>
          </div>
        </div>
      )}

      {/* Patterns Tab */}
      {activeTab === 'patterns' && (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-yellow-800 mb-2">Patrones de Entrenamiento</h4>
            <div className="bg-white p-3 rounded border text-sm">
              <p className="text-yellow-700">
                Esta sección mostrará los patrones aprendidos del agente.
                Por implementar: cargar patrones desde Supabase y permitir edición.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-yellow-800 mb-2">Logs de Sesión</h4>
            <div className="bg-white p-3 rounded border text-sm">
              <div className="space-y-2">
                <div><strong>Consultas:</strong> {session?.queries?.length || 0}</div>
                <div><strong>Correcciones:</strong> {session?.corrections?.length || 0}</div>
                <div><strong>Reglas creadas:</strong> {session?.rulesCreated?.length || 0}</div>
                <div><strong>Iniciada:</strong> {session?.startedAt ? new Date(session.startedAt).toLocaleString() : 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t border-yellow-200">
        <div className="flex space-x-2 text-sm">
          <button className="px-3 py-1 bg-yellow-200 text-yellow-800 rounded hover:bg-yellow-300">
            📊 Exportar Sesión
          </button>
          <button className="px-3 py-1 bg-yellow-200 text-yellow-800 rounded hover:bg-yellow-300">
            🔄 Resetear Patrones
          </button>
          <button className="px-3 py-1 bg-yellow-200 text-yellow-800 rounded hover:bg-yellow-300">
            📈 Ver Estadísticas
          </button>
        </div>
      </div>
    </div>
  );
};