export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      alphagrams: {
        Row: {
          alphagram: string | null
          lenght: number | null
        }
        Insert: {
          alphagram?: string | null
          lenght?: number | null
        }
        Update: {
          alphagram?: string | null
          lenght?: number | null
        }
        Relationships: []
      }
      cuadernillo: {
        Row: {
          alphagram: string | null
          conj_const: string | null
          is_enclitic: string | null
          kind_id: string | null
          lenght: number | null
          root_word: string | null
          seq: number | null
          word_group: number | null
        }
        Insert: {
          alphagram?: string | null
          conj_const?: string | null
          is_enclitic?: string | null
          kind_id?: string | null
          lenght?: number | null
          root_word?: string | null
          seq?: number | null
          word_group?: number | null
        }
        Update: {
          alphagram?: string | null
          conj_const?: string | null
          is_enclitic?: string | null
          kind_id?: string | null
          lenght?: number | null
          root_word?: string | null
          seq?: number | null
          word_group?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_cuadernillo_alphagrams"
            columns: ["alphagram", "lenght"]
            isOneToOne: false
            referencedRelation: "alphagrams"
            referencedColumns: ["alphagram", "lenght"]
          },
          {
            foreignKeyName: "fk_cuadernillo_words"
            columns: ["root_word", "alphagram", "lenght"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["word", "alphagram", "length"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          user_id: string
          word: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          word: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_examples: {
        Row: {
          approved_by: string | null
          conversation_context: Json
          created_at: string | null
          id: string
          notes: string | null
          original_query: string
          successful_sql: string
        }
        Insert: {
          approved_by?: string | null
          conversation_context: Json
          created_at?: string | null
          id?: string
          notes?: string | null
          original_query: string
          successful_sql: string
        }
        Update: {
          approved_by?: string | null
          conversation_context?: Json
          created_at?: string | null
          id?: string
          notes?: string | null
          original_query?: string
          successful_sql?: string
        }
        Relationships: []
      }
      leaves: {
        Row: {
          leave: string | null
          value: number | null
        }
        Insert: {
          leave?: string | null
          value?: number | null
        }
        Update: {
          leave?: string | null
          value?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      query_feedback: {
        Row: {
          created_at: string
          feedback_type: Database["public"]["Enums"]["feedback_type"]
          id: string
          query_id: string
          user_comment: string | null
          was_helpful: boolean
        }
        Insert: {
          created_at?: string
          feedback_type: Database["public"]["Enums"]["feedback_type"]
          id?: string
          query_id: string
          user_comment?: string | null
          was_helpful: boolean
        }
        Update: {
          created_at?: string
          feedback_type?: Database["public"]["Enums"]["feedback_type"]
          id?: string
          query_id?: string
          user_comment?: string | null
          was_helpful?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "query_feedback_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "query_history"
            referencedColumns: ["id"]
          },
        ]
      }
      query_history: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          natural_query: string
          sql_query: string
          successful: boolean
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          natural_query: string
          sql_query: string
          successful?: boolean
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          natural_query?: string
          sql_query?: string
          successful?: boolean
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          id: string
          price_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end: string
          id?: string
          price_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          id?: string
          price_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trie_cache: {
        Row: {
          checksum: string
          compressed: boolean | null
          created_at: string | null
          id: number
          serialized_trie: string
          total_words: number
        }
        Insert: {
          checksum: string
          compressed?: boolean | null
          created_at?: string | null
          id?: number
          serialized_trie: string
          total_words: number
        }
        Update: {
          checksum?: string
          compressed?: boolean | null
          created_at?: string | null
          id?: number
          serialized_trie?: string
          total_words?: number
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          id: string
          last_challenge_word: string | null
          last_group: number
          last_practice_group: number | null
          last_practice_index: number | null
          last_word_index: number
          preferred_mode: boolean | null
          solved_challenges: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          last_challenge_word?: string | null
          last_group?: number
          last_practice_group?: number | null
          last_practice_index?: number | null
          last_word_index?: number
          preferred_mode?: boolean | null
          solved_challenges?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          last_challenge_word?: string | null
          last_group?: number
          last_practice_group?: number | null
          last_practice_index?: number | null
          last_word_index?: number
          preferred_mode?: boolean | null
          solved_challenges?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          user_id?: string
        }
        Relationships: []
      }
      words: {
        Row: {
          alphagram: string | null
          length: number | null
          word: string | null
        }
        Insert: {
          alphagram?: string | null
          length?: number | null
          word?: string | null
        }
        Update: {
          alphagram?: string | null
          length?: number | null
          word?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_letters: {
        Args: { input_text: string }
        Returns: {
          letter: string
          count: number
        }[]
      }
      custom_sort_chars: {
        Args: { input_str: string }
        Returns: string
      }
      execute_natural_search: {
        Args: { query_text: string }
        Returns: {
          word: string
        }[]
      }
      find_exact_anagrams: {
        Args: { query_text: string }
        Returns: {
          word: string
        }[]
      }
      find_plus_one_letter: {
        Args: { query_text: string }
        Returns: {
          word: string
        }[]
      }
      find_shorter_words: {
        Args: { query_text: string }
        Returns: {
          word: string
        }[]
      }
      find_word_variations: {
        Args: { input_text: string }
        Returns: {
          word: string
          variation_type: string
          wildcards_used: number
          sort_order: number
        }[]
      }
      get_spanish_alphabet: {
        Args: Record<PropertyKey, never>
        Returns: {
          letter: string
        }[]
      }
      get_words_batch: {
        Args: { batch_size: number; last_word?: string }
        Returns: {
          word: string
        }[]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      update_practice_progress: {
        Args: {
          p_user_id: string
          p_last_practice_group: number
          p_last_practice_index: number
        }
        Returns: undefined
      }
    }
    Enums: {
      feedback_type:
        | "too_many_results"
        | "too_few_results"
        | "not_what_expected"
        | "exactly_what_needed"
        | "needs_clarification"
      se_property: "admite la terminación -se"
      sym_property:
        | "sin tratamiento especial"
        | "admite género opuesto"
        | "admite participio femenino"
        | "admite participio masculino plural"
        | "no admite terminación -ad, -ed, -id, respectivamente"
      user_role: "user" | "super_user"
      verb_kind:
        | "Infinitivo de un verbo transitivo"
        | "Infinitivo de un verbo intransitivo"
        | "Infinitivo de un verbo pronominal"
        | "Entrada directa (palabra no verbal)"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      feedback_type: [
        "too_many_results",
        "too_few_results",
        "not_what_expected",
        "exactly_what_needed",
        "needs_clarification",
      ],
      se_property: ["admite la terminación -se"],
      sym_property: [
        "sin tratamiento especial",
        "admite género opuesto",
        "admite participio femenino",
        "admite participio masculino plural",
        "no admite terminación -ad, -ed, -id, respectivamente",
      ],
      user_role: ["user", "super_user"],
      verb_kind: [
        "Infinitivo de un verbo transitivo",
        "Infinitivo de un verbo intransitivo",
        "Infinitivo de un verbo pronominal",
        "Entrada directa (palabra no verbal)",
      ],
    },
  },
} as const
