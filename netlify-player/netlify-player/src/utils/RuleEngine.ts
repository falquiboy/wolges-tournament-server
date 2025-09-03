import { TrainingMode } from '../hooks/useTrainingMode';

export interface TrainingRule {
  rule_id: string;
  rule_name: string;
  condition_pattern: string;
  action_type: 'allow' | 'filter' | 'transform' | 'deny';
  parameters: Record<string, any>;
  active: boolean;
  creator: string;
  confidence: number;
}

export interface QueryResponse {
  query: string;
  results: any[];
  sql_query?: string;
  debug_info?: any;
  metadata?: any;
  [key: string]: any;
}

export interface RuleContext {
  mode: TrainingMode;
  user_id?: string;
  result_count: number;
  query_type?: string;
  has_sql?: boolean;
  has_debug?: boolean;
}

export class RuleEngine {
  private rules: TrainingRule[] = [];

  constructor(rules: TrainingRule[] = []) {
    this.rules = rules.filter(rule => rule.active);
  }

  /**
   * Actualiza las reglas del motor
   */
  updateRules(rules: TrainingRule[]): void {
    this.rules = rules.filter(rule => rule.active);
  }

  /**
   * Aplica todas las reglas aplicables a una respuesta
   */
  applyRules(response: QueryResponse, context: RuleContext): QueryResponse {
    let processedResponse = { ...response };
    let appliedRules: string[] = [];

    // Evaluar reglas en orden de prioridad
    const applicableRules = this.getApplicableRules(context);

    for (const rule of applicableRules) {
      try {
        const result = this.applyRule(rule, processedResponse, context);
        
        if (result.applied) {
          processedResponse = result.response;
          appliedRules.push(rule.rule_id);
          
          // Si la regla es 'deny', detener procesamiento
          if (rule.action_type === 'deny') {
            break;
          }
        }
      } catch (error) {
        console.error(`Error applying rule ${rule.rule_id}:`, error);
      }
    }

    // Agregar metadata sobre reglas aplicadas si estamos en modo superuser
    if (context.mode === 'superuser') {
      processedResponse.applied_rules = appliedRules;
      processedResponse.rule_engine_debug = {
        total_rules: this.rules.length,
        applicable_rules: applicableRules.length,
        applied_count: appliedRules.length
      };
    }

    return processedResponse;
  }

  /**
   * Determina qué reglas aplican para el contexto dado
   */
  private getApplicableRules(context: RuleContext): TrainingRule[] {
    return this.rules.filter(rule => this.evaluateCondition(rule.condition_pattern, context));
  }

  /**
   * Evalúa si una condición se cumple para el contexto
   */
  private evaluateCondition(condition: string, context: RuleContext): boolean {
    try {
      // Parsear condiciones simples como "mode=production" o "mode=production AND result_count>100"
      const conditions = condition.split(/\s+AND\s+/i);
      
      return conditions.every(cond => {
        const trimmed = cond.trim();
        
        // Condiciones de igualdad
        if (trimmed.includes('=')) {
          const [key, value] = trimmed.split('=').map(s => s.trim());
          return this.getContextValue(context, key) === value;
        }
        
        // Condiciones de comparación numérica
        if (trimmed.includes('>')) {
          const [key, value] = trimmed.split('>').map(s => s.trim());
          const contextValue = this.getContextValue(context, key);
          return typeof contextValue === 'number' && contextValue > parseInt(value);
        }
        
        if (trimmed.includes('<')) {
          const [key, value] = trimmed.split('<').map(s => s.trim());
          const contextValue = this.getContextValue(context, key);
          return typeof contextValue === 'number' && contextValue < parseInt(value);
        }
        
        // Condiciones booleanas
        if (trimmed.startsWith('has_')) {
          return !!this.getContextValue(context, trimmed);
        }
        
        return false;
      });
    } catch (error) {
      console.error('Error evaluating condition:', condition, error);
      return false;
    }
  }

  /**
   * Obtiene un valor del contexto por clave
   */
  private getContextValue(context: RuleContext, key: string): any {
    switch (key) {
      case 'mode': return context.mode;
      case 'user_id': return context.user_id;
      case 'result_count': return context.result_count;
      case 'query_type': return context.query_type;
      case 'has_sql': return context.has_sql;
      case 'has_debug': return context.has_debug;
      default: return undefined;
    }
  }

  /**
   * Aplica una regla específica a la respuesta
   */
  private applyRule(rule: TrainingRule, response: QueryResponse, context: RuleContext): { applied: boolean; response: QueryResponse } {
    const newResponse = { ...response };

    switch (rule.action_type) {
      case 'allow':
        // No hacer nada, permitir tal como está
        return { applied: true, response: newResponse };

      case 'filter':
        // Remover campos especificados
        const fieldsToRemove = rule.parameters.remove_fields || [];
        fieldsToRemove.forEach((field: string) => {
          delete newResponse[field];
        });
        return { applied: true, response: newResponse };

      case 'transform':
        // Aplicar transformaciones
        if (rule.parameters.max_results && newResponse.results) {
          const maxResults = rule.parameters.max_results;
          if (newResponse.results.length > maxResults) {
            newResponse.results = newResponse.results.slice(0, maxResults);
            
            if (rule.parameters.add_message) {
              newResponse.message = rule.parameters.add_message;
            }
          }
        }
        return { applied: true, response: newResponse };

      case 'deny':
        // Reemplazar con mensaje de denegación
        return { 
          applied: true, 
          response: {
            query: response.query,
            results: [],
            message: rule.parameters.deny_message || 'Consulta no permitida en este modo',
            denied: true,
            rule_applied: rule.rule_id
          }
        };

      default:
        return { applied: false, response: newResponse };
    }
  }

  /**
   * Valida si una consulta está permitida antes de procesarla
   */
  validateQuery(query: string, context: RuleContext): { allowed: boolean; reason?: string } {
    const denyRules = this.rules.filter(rule => 
      rule.active && 
      rule.action_type === 'deny' && 
      this.evaluateCondition(rule.condition_pattern, context)
    );

    if (denyRules.length > 0) {
      return {
        allowed: false,
        reason: denyRules[0].parameters.deny_message || 'Consulta no permitida'
      };
    }

    return { allowed: true };
  }

  /**
   * Obtiene estadísticas del motor de reglas
   */
  getStats(): any {
    return {
      total_rules: this.rules.length,
      rules_by_type: this.rules.reduce((acc, rule) => {
        acc[rule.action_type] = (acc[rule.action_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      average_confidence: this.rules.length > 0 
        ? this.rules.reduce((sum, rule) => sum + rule.confidence, 0) / this.rules.length 
        : 0
    };
  }
}