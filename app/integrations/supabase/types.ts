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
      fixtures: {
        Row: {
          id: string
          match_date: string
          status: 'upcoming' | 'in_progress' | 'completed'
          home_team_id: string
          away_team_id: string
          score_home: number | null
          score_away: number | null
          venue: string | null
          competition_id: string | null
          match_phase: string | null
          game_type: string | null
          is_final: boolean | null
          home_potm_player_id: string | null
          away_potm_player_id: string | null
          home_kit_slot: string | null
          away_kit_slot: string | null
          points_for_try: number
          points_for_conversion: number
          points_for_penalty: number
          points_for_drop_goal: number
          game_duration: number | null
        }
        Insert: Partial<Database['public']['Tables']['fixtures']['Row']> & {
          id?: string
          match_date: string
          home_team_id: string
          away_team_id: string
          status: string
        }
        Update: Partial<Database['public']['Tables']['fixtures']['Row']>
      }
      teams: {
        Row: {
          id: string
          name: string
          club_id: string
          primary_color: string | null
          logo_url: string | null
          home_kit_image_url: string | null
          away_kit_image_url: string | null
          is_subscribed: boolean
          age_group: string | null
          contact_email: string | null
        }
        Insert: Partial<Database['public']['Tables']['teams']['Row']> & {
          id?: string
          name: string
          club_id: string
        }
        Update: Partial<Database['public']['Tables']['teams']['Row']>
      }
      clubs: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          home_kit_image_url: string | null
          away_kit_image_url: string | null
        }
        Insert: Partial<Database['public']['Tables']['clubs']['Row']> & {
          id?: string
          name: string
        }
        Update: Partial<Database['public']['Tables']['clubs']['Row']>
      }
      players: {
        Row: {
          id: string
          first_name: string
          last_name: string
          position: string | null
          secondary_position: string | null
          jersey_number: number | null
          photo_url: string | null
          public_profile: boolean
          nationality: string | null
          team_role: string | null
          is_available: boolean | null
        }
        Insert: Partial<Database['public']['Tables']['players']['Row']> & {
          id?: string
          first_name: string
          last_name: string
        }
        Update: Partial<Database['public']['Tables']['players']['Row']>
      }
      match_events: {
        Row: {
          id: string
          fixture_id: string
          event_type: 'try' | 'conversion' | 'penalty' | 'drop_goal' | 'yellow_card' | 'red_card' | 'substitution'
          owning_player_id: string | null
          replaced_by_player_id: string | null
          owning_team_id: string | null
          minute: number | null
          notes: string | null
          status: string | null
        }
        Insert: Partial<Database['public']['Tables']['match_events']['Row']> & {
          id?: string
          fixture_id: string
          event_type: string
        }
        Update: Partial<Database['public']['Tables']['match_events']['Row']>
      }
      fixture_selections: {
        Row: {
          id: string
          fixture_id: string
          player_id: string
          team_id: string
          jersey_number: number | null
          is_substitute: boolean
          is_captain: boolean
        }
        Insert: Partial<Database['public']['Tables']['fixture_selections']['Row']> & {
          id?: string
          fixture_id: string
          player_id: string
          team_id: string
        }
        Update: Partial<Database['public']['Tables']['fixture_selections']['Row']>
      }
      player_team_registrations: {
        Row: {
          player_id: string
          team_id: string
          is_primary: boolean
        }
        Insert: { player_id: string; team_id: string; is_primary?: boolean }
        Update: Partial<Database['public']['Tables']['player_team_registrations']['Row']>
      }
      competitions: {
        Row: {
          id: string
          name: string
          type: string | null
          season_id: string | null
        }
        Insert: Partial<Database['public']['Tables']['competitions']['Row']> & {
          id?: string
          name: string
        }
        Update: Partial<Database['public']['Tables']['competitions']['Row']>
      }
      fan_favourites: {
        Row: {
          id: string
          user_id: string
          entity_type: 'team' | 'player' | 'fixture' | 'competition'
          entity_id: string
        }
        Insert: { id?: string; user_id: string; entity_type: string; entity_id: string }
        Update: Partial<Database['public']['Tables']['fan_favourites']['Row']>
      }
      fan_subscriptions: {
        Row: {
          id: string
          user_id: string
          plan: 'free' | 'pro'
          ads_enabled: boolean
        }
        Insert: { id?: string; user_id: string; plan?: string; ads_enabled?: boolean }
        Update: Partial<Database['public']['Tables']['fan_subscriptions']['Row']>
      }
    }
    Views: {
      public_players: {
        Row: {
          id: string
          first_name: string
          last_name: string
          position: string | null
          secondary_position: string | null
          jersey_number: number | null
          photo_url: string | null
          nationality: string | null
          team_role: string | null
        }
      }
    }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type DefaultSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
  ? (DefaultSchema['Tables'] &
      DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
  ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
  ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
