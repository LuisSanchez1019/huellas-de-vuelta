// Generado con el MCP de Supabase (generate_typescript_types). Regenerar tras
// cada cambio de esquema. No editar a mano.

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      organization_pets: {
        Row: {
          age: string | null
          breed: string | null
          created_at: string
          id: string
          intake_date: string | null
          name: string
          needs_home: boolean
          needs_sponsor: boolean
          org_id: string
          org_kind: string
          photo_url: string | null
          public_id: string
          sex: string
          species: string
          species_other: string | null
          status: string
          updated_at: string
        }
        Insert: {
          age?: string | null
          breed?: string | null
          created_at?: string
          id?: string
          intake_date?: string | null
          name: string
          needs_home?: boolean
          needs_sponsor?: boolean
          org_id: string
          org_kind: string
          photo_url?: string | null
          public_id?: string
          sex?: string
          species: string
          species_other?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          age?: string | null
          breed?: string | null
          created_at?: string
          id?: string
          intake_date?: string | null
          name?: string
          needs_home?: boolean
          needs_sponsor?: boolean
          org_id?: string
          org_kind?: string
          photo_url?: string | null
          public_id?: string
          sex?: string
          species?: string
          species_other?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_pets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_profiles: {
        Row: {
          address: string | null
          city: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          email: string | null
          extra_info: string | null
          hours: Json
          id: string
          kind: string
          lat: number | null
          lng: number | null
          logo_url: string | null
          map_url: string | null
          name: string
          owner_id: string
          phone: string | null
          services: string[]
          slug: string
          social: Json
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          extra_info?: string | null
          hours?: Json
          id?: string
          kind: string
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          map_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          services?: string[]
          slug: string
          social?: Json
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          extra_info?: string | null
          hours?: Json
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          map_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          services?: string[]
          slug?: string
          social?: Json
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_profiles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          age_unit: string | null
          age_value: number | null
          breed: string | null
          color: string | null
          color_primary: string | null
          color_secondary: string | null
          color_tertiary: string | null
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          name: string
          owner_id: string
          photo_path: string | null
          public_id: string
          sex: string | null
          species: string
          species_other: string | null
          status: Database["public"]["Enums"]["pet_status"]
          updated_at: string
        }
        Insert: {
          age_unit?: string | null
          age_value?: number | null
          breed?: string | null
          color?: string | null
          color_primary?: string | null
          color_secondary?: string | null
          color_tertiary?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name: string
          owner_id: string
          photo_path?: string | null
          public_id?: string
          sex?: string | null
          species: string
          species_other?: string | null
          status?: Database["public"]["Enums"]["pet_status"]
          updated_at?: string
        }
        Update: {
          age_unit?: string | null
          age_value?: number | null
          breed?: string | null
          color?: string | null
          color_primary?: string | null
          color_secondary?: string | null
          color_tertiary?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          owner_id?: string
          photo_path?: string | null
          public_id?: string
          sex?: string | null
          species?: string
          species_other?: string | null
          status?: Database["public"]["Enums"]["pet_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["account_role"]
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["account_role"]
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["account_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gen_pet_public_id: { Args: never; Returns: string }
      get_public_pet: {
        Args: { p_public_id: string }
        Returns: {
          age_unit: string
          age_value: number
          breed: string
          color_primary: string
          color_secondary: string
          color_tertiary: string
          description: string
          name: string
          photo_path: string
          public_id: string
          sex: string
          species: string
          species_other: string
          status: string
        }[]
      }
    }
    Enums: {
      account_role: "usuario" | "fundacion" | "veterinaria"
      pet_status: "at_home" | "lost" | "found" | "for_adoption"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
