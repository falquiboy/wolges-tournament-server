import { useState, useEffect } from 'react';

export type TrainingMode = 'superuser' | 'production';

interface TrainingSession {
  sessionId: string;
  userId: string;
  mode: TrainingMode;
  queries: any[];
  corrections: any[];
  rulesCreated: any[];
  startedAt: string;
}

interface TrainingUser {
  id: string;
  email: string;
  role: 'admin' | 'trainer' | 'user';
  permissions: string[];
}

export const useTrainingMode = () => {
  const [mode, setMode] = useState<TrainingMode>('production');
  const [user, setUser] = useState<TrainingUser | null>(null);
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Simular autenticación (después implementar con Supabase Auth)
  const authenticate = (email: string, password: string): boolean => {
    // Lista de superusers autorizados
    const superUsers = [
      'alfredo.falconer@gmail.com',
      'admin@maslexico.app',
      'trainer@maslexico.app'
    ];

    if (superUsers.includes(email) && password === 'scrabble2025') {
      const newUser: TrainingUser = {
        id: email,
        email,
        role: email.includes('admin') ? 'admin' : 'trainer',
        permissions: ['train', 'create_rules', 'view_debug', 'modify_patterns']
      };
      
      setUser(newUser);
      setIsAuthenticated(true);
      
      // Iniciar sesión de superuser automáticamente
      const newSession: TrainingSession = {
        sessionId: `session_${Date.now()}`,
        userId: email,
        mode: 'superuser',
        queries: [],
        corrections: [],
        rulesCreated: [],
        startedAt: new Date().toISOString()
      };

      setSession(newSession);
      setMode('superuser');
      
      // Guardar en localStorage para persistencia
      localStorage.setItem('training_session', JSON.stringify(newSession));
      localStorage.setItem('training_mode', 'superuser');
      
      return true;
    }
    
    return false;
  };

  const startTrainingSession = (mode: TrainingMode) => {
    if (!user) return null;

    const newSession: TrainingSession = {
      sessionId: `session_${Date.now()}`,
      userId: user.id,
      mode,
      queries: [],
      corrections: [],
      rulesCreated: [],
      startedAt: new Date().toISOString()
    };

    setSession(newSession);
    setMode(mode);
    
    // Guardar en localStorage para persistencia
    localStorage.setItem('training_session', JSON.stringify(newSession));
    localStorage.setItem('training_mode', mode);
    
    return newSession;
  };

  const endTrainingSession = () => {
    setSession(null);
    setMode('production');
    localStorage.removeItem('training_session');
    localStorage.removeItem('training_mode');
  };

  const addQueryToSession = (query: string, response: any) => {
    if (!session) return;

    const updatedSession = {
      ...session,
      queries: [...session.queries, { query, response, timestamp: new Date().toISOString() }]
    };

    setSession(updatedSession);
    localStorage.setItem('training_session', JSON.stringify(updatedSession));
  };

  const addCorrectionToSession = (originalResponse: any, correctedResponse: any, feedback: string) => {
    if (!session) return;

    const correction = {
      originalResponse,
      correctedResponse,
      feedback,
      timestamp: new Date().toISOString()
    };

    const updatedSession = {
      ...session,
      corrections: [...session.corrections, correction]
    };

    setSession(updatedSession);
    localStorage.setItem('training_session', JSON.stringify(updatedSession));
  };

  const canAccessFeature = (feature: string): boolean => {
    if (!user || !isAuthenticated) return false;
    
    if (mode === 'production') {
      // En modo producción, solo funcionalidades básicas
      return ['query', 'view_results'].includes(feature);
    }
    
    if (mode === 'superuser') {
      // En modo superuser, verificar permisos
      return user.permissions.includes(feature) || user.role === 'admin';
    }
    
    return false;
  };

  // Recuperar sesión al cargar
  useEffect(() => {
    const savedSession = localStorage.getItem('training_session');
    const savedMode = localStorage.getItem('training_mode') as TrainingMode;
    
    if (savedSession && savedMode) {
      try {
        const parsedSession = JSON.parse(savedSession);
        setSession(parsedSession);
        setMode(savedMode);
        
        // Simular usuario autenticado si hay sesión guardada
        setUser({
          id: parsedSession.userId,
          email: parsedSession.userId,
          role: 'trainer',
          permissions: ['train', 'create_rules', 'view_debug']
        });
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error recovering training session:', error);
        localStorage.removeItem('training_session');
        localStorage.removeItem('training_mode');
      }
    }
  }, []);

  return {
    mode,
    user,
    session,
    isAuthenticated,
    authenticate,
    startTrainingSession,
    endTrainingSession,
    addQueryToSession,
    addCorrectionToSession,
    canAccessFeature,
    setMode
  };
};