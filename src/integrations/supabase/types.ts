export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      layer_styles: {
        Row: {
          circle_radius: number
          created_at: string
          fill_color: string
          fill_opacity: number
          id: string
          label_config: Json
          layer_id: string
          popup_config: Json
          stroke_color: string
          stroke_width: number
          style_config: Json
          style_mode: string
          updated_at: string
        }
        Insert: {
          circle_radius?: number
          created_at?: string
          fill_color?: string
          fill_opacity?: number
          id?: string
          label_config?: Json
          layer_id: string
          popup_config?: Json
          stroke_color?: string
          stroke_width?: number
          style_config?: Json
          style_mode?: string
          updated_at?: string
        }
        Update: {
          circle_radius?: number
          created_at?: string
          fill_color?: string
          fill_opacity?: number
          id?: string
          label_config?: Json
          layer_id?: string
          popup_config?: Json
          stroke_color?: string
          stroke_width?: number
          style_config?: Json
          style_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "layer_styles_layer_id_fkey"
            columns: ["layer_id"]
            isOneToOne: true
            referencedRelation: "layers"
            referencedColumns: ["id"]
          },
        ]
      }
      layers: {
        Row: {
          bbox: number[] | null
          created_at: string
          feature_count: number
          fields: Json
          geometry_type: Database["public"]["Enums"]["layer_geometry_type"]
          id: string
          name: string
          opacity: number
          project_id: string
          sort_order: number
          source_type: Database["public"]["Enums"]["layer_source_type"]
          source_url: string | null
          storage_path: string | null
          updated_at: string
          visible: boolean
        }
        Insert: {
          bbox?: number[] | null
          created_at?: string
          feature_count?: number
          fields?: Json
          geometry_type?: Database["public"]["Enums"]["layer_geometry_type"]
          id?: string
          name: string
          opacity?: number
          project_id: string
          sort_order?: number
          source_type: Database["public"]["Enums"]["layer_source_type"]
          source_url?: string | null
          storage_path?: string | null
          updated_at?: string
          visible?: boolean
        }
        Update: {
          bbox?: number[] | null
          created_at?: string
          feature_count?: number
          fields?: Json
          geometry_type?: Database["public"]["Enums"]["layer_geometry_type"]
          id?: string
          name?: string
          opacity?: number
          project_id?: string
          sort_order?: number
          source_type?: Database["public"]["Enums"]["layer_source_type"]
          source_url?: string | null
          storage_path?: string | null
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "layers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          basemap: string
          created_at: string
          description: string | null
          id: string
          map_bearing: number
          map_center: number[]
          map_pitch: number
          map_zoom: number
          owner_id: string
          slug: string
          status: Database["public"]["Enums"]["project_status"]
          tags: string[]
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          basemap?: string
          created_at?: string
          description?: string | null
          id?: string
          map_bearing?: number
          map_center?: number[]
          map_pitch?: number
          map_zoom?: number
          owner_id: string
          slug: string
          status?: Database["public"]["Enums"]["project_status"]
          tags?: string[]
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          basemap?: string
          created_at?: string
          description?: string | null
          id?: string
          map_bearing?: number
          map_center?: number[]
          map_pitch?: number
          map_zoom?: number
          owner_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["project_status"]
          tags?: string[]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      layer_geometry_type: "point" | "line" | "polygon" | "mixed"
      layer_source_type: "geojson_file" | "csv_url" | "arcgis_rest"
      project_status: "draft" | "published" | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      layer_geometry_type: ["point", "line", "polygon", "mixed"],
      layer_source_type: ["geojson_file", "csv_url", "arcgis_rest"],
      project_status: ["draft", "published", "archived"],
    },
  },
} as const
