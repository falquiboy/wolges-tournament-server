import React, { useEffect, useState } from 'react';
import { useTrainingMode } from '../hooks/useTrainingMode';
import { RuleEngine, TrainingRule, QueryResponse, RuleContext } from '../utils/RuleEngine';

interface ProductionFilterProps {
  response: QueryResponse;
  onFilteredResponse: (filteredResponse: QueryResponse) => void;
  rules?: TrainingRule[];
}

export const ProductionFilter: React.FC<ProductionFilterProps> = ({
  response,
  onFilteredResponse,
  rules = []
}) => {
  const { mode, user } = useTrainingMode();
  const [ruleEngine] = useState(() => new RuleEngine(rules));
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (rules.length > 0) {
      ruleEngine.updateRules(rules);
    }
  }, [rules, ruleEngine]);

  useEffect(() => {
    filterResponse();
  }, [response, mode]);

  const filterResponse = async () => {
    if (!response) return;

    setIsProcessing(true);

    try {
      // Crear contexto para las reglas
      const context: RuleContext = {
        mode,
        user_id: user?.id,
        result_count: response.results?.length || 0,
        query_type: determineQueryType(response),
        has_sql: !!response.sql_query,
        has_debug: !!response.debug_info
      };

      // Aplicar reglas
      const filteredResponse = ruleEngine.applyRules(response, context);

      // Aplicar filtros adicionales específicos del modo producción
      if (mode === 'production') {
        const productionFilteredResponse = applyProductionSpecificFilters(filteredResponse);
        onFilteredResponse(productionFilteredResponse);
      } else {
        onFilteredResponse(filteredResponse);
      }

    } catch (error) {
      console.error('Error filtering response:', error);
      // En caso de error, devolver respuesta original pero sin datos sensibles
      const safeResponse = sanitizeResponse(response);
      onFilteredResponse(safeResponse);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Determina el tipo de consulta basado en la respuesta
   */
  const determineQueryType = (response: QueryResponse): string => {
    if (response.sql_query) {
      if (response.sql_query.includes('lexicon_indexes')) return 'conjugation';
      if (response.sql_query.includes('senses')) return 'definition';
      if (response.sql_query.includes('COUNT')) return 'count';
    }
    return 'general';
  };

  /**
   * Aplica filtros específicos para modo producción
   */
  const applyProductionSpecificFilters = (response: QueryResponse): QueryResponse => {
    const filtered = { ...response };

    // Remover información de debug y SQL
    delete filtered.sql_query;
    delete filtered.debug_info;
    delete filtered.applied_rules;
    delete filtered.rule_engine_debug;

    // Limitar número de resultados si es muy alto
    if (filtered.results && filtered.results.length > 100) {
      filtered.results = filtered.results.slice(0, 100);
      filtered.message = filtered.message 
        ? `${filtered.message} (Mostrando primeros 100 resultados)`
        : 'Mostrando primeros 100 resultados';
    }

    // Limpiar metadatos innecesarios
    if (filtered.metadata) {
      filtered.metadata = {
        total_results: filtered.metadata.total_results,
        query_time: filtered.metadata.query_time
      };
    }

    // Agregar watermark de producción
    filtered.mode = 'production';
    filtered.filtered_at = new Date().toISOString();

    return filtered;
  };

  /**
   * Sanitiza la respuesta removiendo información sensible
   */
  const sanitizeResponse = (response: QueryResponse): QueryResponse => {
    return {
      query: response.query,
      results: response.results || [],
      message: 'Respuesta procesada en modo seguro',
      error: 'Error en filtrado - respuesta sanitizada'
    };
  };

  // Este componente no renderiza nada visible, solo procesa
  return null;
};

/**
 * Hook personalizado para usar el filtro de producción
 */
export const useProductionFilter = (rules: TrainingRule[] = []) => {
  const { mode } = useTrainingMode();
  const [ruleEngine] = useState(() => new RuleEngine(rules));

  const filterResponse = (response: QueryResponse, additionalContext?: Partial<RuleContext>): QueryResponse => {
    const context: RuleContext = {
      mode,
      result_count: response.results?.length || 0,
      has_sql: !!response.sql_query,
      has_debug: !!response.debug_info,
      ...additionalContext
    };

    return ruleEngine.applyRules(response, context);
  };

  const validateQuery = (query: string, additionalContext?: Partial<RuleContext>): { allowed: boolean; reason?: string } => {
    const context: RuleContext = {
      mode,
      result_count: 0,
      has_sql: false,
      has_debug: false,
      ...additionalContext
    };

    return ruleEngine.validateQuery(query, context);
  };

  return {
    filterResponse,
    validateQuery,
    updateRules: (newRules: TrainingRule[]) => ruleEngine.updateRules(newRules),
    getStats: () => ruleEngine.getStats()
  };
};