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
      botellones: {
        Row: {
          cliente_id: string | null
          codigo: string
          created_at: string | null
          estado: string | null
          fecha_creacion: string | null
          id: string
        }
        Insert: {
          cliente_id?: string | null
          codigo?: string
          created_at?: string | null
          estado?: string | null
          fecha_creacion?: string | null
          id?: string
        }
        Update: {
          cliente_id?: string | null
          codigo?: string
          created_at?: string | null
          estado?: string | null
          fecha_creacion?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "botellones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          cedula: string | null
          codigo: string
          contacto_preferido: string | null
          created_at: string | null
          dias_preferidos: string | null
          fecha_registro: string | null
          horario_preferido: string | null
          id: string
          negocio: string | null
          nombre: string
          observaciones: string | null
          telefono_1: string | null
          telefono_2: string | null
          tipo_cliente: string | null
          whatsapp: string | null
        }
        Insert: {
          cedula?: string | null
          codigo?: string
          contacto_preferido?: string | null
          created_at?: string | null
          dias_preferidos?: string | null
          fecha_registro?: string | null
          horario_preferido?: string | null
          id?: string
          negocio?: string | null
          nombre: string
          observaciones?: string | null
          telefono_1?: string | null
          telefono_2?: string | null
          tipo_cliente?: string | null
          whatsapp?: string | null
        }
        Update: {
          cedula?: string | null
          codigo?: string
          contacto_preferido?: string | null
          created_at?: string | null
          dias_preferidos?: string | null
          fecha_registro?: string | null
          horario_preferido?: string | null
          id?: string
          negocio?: string | null
          nombre?: string
          observaciones?: string | null
          telefono_1?: string | null
          telefono_2?: string | null
          tipo_cliente?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      configuracion: {
        Row: {
          direccion: string | null
          email: string | null
          id: number
          logo_url: string | null
          nombre_negocio: string
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          direccion?: string | null
          email?: string | null
          id?: number
          logo_url?: string | null
          nombre_negocio: string
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          direccion?: string | null
          email?: string | null
          id?: number
          logo_url?: string | null
          nombre_negocio?: string
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      direcciones: {
        Row: {
          avenida: string | null
          calle: string | null
          ciudad: string | null
          cliente_id: string
          created_at: string | null
          estado: string | null
          gps_origen: string | null
          id: string
          latitud: number | null
          link_mapa: string | null
          longitud: number | null
          referencia: string | null
          sector: string | null
          urbanizacion: string | null
        }
        Insert: {
          avenida?: string | null
          calle?: string | null
          ciudad?: string | null
          cliente_id: string
          created_at?: string | null
          estado?: string | null
          gps_origen?: string | null
          id?: string
          latitud?: number | null
          link_mapa?: string | null
          longitud?: number | null
          referencia?: string | null
          sector?: string | null
          urbanizacion?: string | null
        }
        Update: {
          avenida?: string | null
          calle?: string | null
          ciudad?: string | null
          cliente_id?: string
          created_at?: string | null
          estado?: string | null
          gps_origen?: string | null
          id?: string
          latitud?: number | null
          link_mapa?: string | null
          longitud?: number | null
          referencia?: string | null
          sector?: string | null
          urbanizacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direcciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      fotos_clientes: {
        Row: {
          cliente_id: string
          created_at: string | null
          descripcion: string | null
          id: string
          ruta_storage: string
          tipo: string
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          descripcion?: string | null
          id?: string
          ruta_storage: string
          tipo: string
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          descripcion?: string | null
          id?: string
          ruta_storage?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fotos_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          botellon_id: string | null
          cliente_id: string | null
          creada_en: string | null
          id: string
          leida: boolean | null
          mensaje: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          botellon_id?: string | null
          cliente_id?: string | null
          creada_en?: string | null
          id?: string
          leida?: boolean | null
          mensaje?: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Update: {
          botellon_id?: string | null
          cliente_id?: string | null
          creada_en?: string | null
          id?: string
          leida?: boolean | null
          mensaje?: string | null
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_botellon_id_fkey"
            columns: ["botellon_id"]
            isOneToOne: false
            referencedRelation: "botellones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificaciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          created_at: string | null
          id: string
          nombre: string
          telefono: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          nombre: string
          telefono?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
        }
        Relationships: []
      }
      premios: {
        Row: {
          cliente_id: string
          created_at: string | null
          entregado_por: string | null
          estado: string | null
          fecha_alcanzado: string
          id: string
          nivel_recargas: number
          observaciones: string | null
          tipo_premio: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          entregado_por?: string | null
          estado?: string | null
          fecha_alcanzado?: string
          id?: string
          nivel_recargas: number
          observaciones?: string | null
          tipo_premio?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          entregado_por?: string | null
          estado?: string | null
          fecha_alcanzado?: string
          id?: string
          nivel_recargas?: number
          observaciones?: string | null
          tipo_premio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "premios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      recargas: {
        Row: {
          botellon_id: string
          cliente_id: string
          created_at: string | null
          fecha: string
          hora: string
          id: string
          numero_registro: string
          observaciones: string | null
          realizada_por: string
        }
        Insert: {
          botellon_id: string
          cliente_id: string
          created_at?: string | null
          fecha?: string
          hora?: string
          id?: string
          numero_registro: string
          observaciones?: string | null
          realizada_por: string
        }
        Update: {
          botellon_id?: string
          cliente_id?: string
          created_at?: string | null
          fecha?: string
          hora?: string
          id?: string
          numero_registro?: string
          observaciones?: string | null
          realizada_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "recargas_botellon_id_fkey"
            columns: ["botellon_id"]
            isOneToOne: false
            referencedRelation: "botellones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recargas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
