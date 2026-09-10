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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          event_id: string | null
          id: string
          read_at: string | null
          report_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          read_at?: string | null
          report_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          read_at?: string | null
          report_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "pet_report_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "pet_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          photo_path: string | null
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
          photo_path?: string | null
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
          photo_path?: string | null
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
      organization_poster_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event: string
          id: string
          organization_id: string
          poster_id: string | null
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event: string
          id?: string
          organization_id: string
          poster_id?: string | null
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event?: string
          id?: string
          organization_id?: string
          poster_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_poster_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_poster_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_poster_events_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "organization_posters"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_posters: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          description: string | null
          expires_at: string | null
          id: string
          image_path: string
          organization_id: string
          rejection_reason: string | null
          status: string
          submitted_at: string | null
          target_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          expires_at?: string | null
          id?: string
          image_path: string
          organization_id: string
          rejection_reason?: string | null
          status?: string
          submitted_at?: string | null
          target_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          image_path?: string
          organization_id?: string
          rejection_reason?: string | null
          status?: string
          submitted_at?: string | null
          target_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_posters_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_posters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_posters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_profiles: {
        Row: {
          address: string | null
          approval_status: string
          category: string
          city: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          email: string | null
          extra_info: string | null
          hours: Json
          id: string
          is_active: boolean
          kind: string
          lat: number | null
          lng: number | null
          logo_path: string | null
          logo_url: string | null
          map_url: string | null
          name: string
          name_norm: string | null
          neighborhood: string | null
          owner_id: string
          phone: string | null
          rejection_reason: string | null
          services: string[]
          slug: string
          social: Json
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          approval_status?: string
          category?: string
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          extra_info?: string | null
          hours?: Json
          id?: string
          is_active?: boolean
          kind: string
          lat?: number | null
          lng?: number | null
          logo_path?: string | null
          logo_url?: string | null
          map_url?: string | null
          name: string
          name_norm?: string | null
          neighborhood?: string | null
          owner_id: string
          phone?: string | null
          rejection_reason?: string | null
          services?: string[]
          slug: string
          social?: Json
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          approval_status?: string
          category?: string
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          extra_info?: string | null
          hours?: Json
          id?: string
          is_active?: boolean
          kind?: string
          lat?: number | null
          lng?: number | null
          logo_path?: string | null
          logo_url?: string | null
          map_url?: string | null
          name?: string
          name_norm?: string | null
          neighborhood?: string | null
          owner_id?: string
          phone?: string | null
          rejection_reason?: string | null
          services?: string[]
          slug?: string
          social?: Json
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
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
          {
            foreignKeyName: "organization_profiles_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_services: {
        Row: {
          created_at: string
          organization_id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          service_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_report_events: {
        Row: {
          acknowledged_at: string | null
          city: string
          created_at: string
          description: string | null
          finder_contact: string | null
          finder_name: string | null
          happened_at_approx: string | null
          happened_on: string | null
          id: string
          neighborhood: string
          org_declined_at: string | null
          org_received_at: string | null
          org_received_note: string | null
          owner_id: string
          pet_condition: string | null
          pet_id: string
          photo_path: string | null
          report_id: string
          selected_org_at: string | null
          selected_org_id: string | null
          type: string
        }
        Insert: {
          acknowledged_at?: string | null
          city: string
          created_at?: string
          description?: string | null
          finder_contact?: string | null
          finder_name?: string | null
          happened_at_approx?: string | null
          happened_on?: string | null
          id?: string
          neighborhood: string
          org_declined_at?: string | null
          org_received_at?: string | null
          org_received_note?: string | null
          owner_id: string
          pet_condition?: string | null
          pet_id: string
          photo_path?: string | null
          report_id: string
          selected_org_at?: string | null
          selected_org_id?: string | null
          type: string
        }
        Update: {
          acknowledged_at?: string | null
          city?: string
          created_at?: string
          description?: string | null
          finder_contact?: string | null
          finder_name?: string | null
          happened_at_approx?: string | null
          happened_on?: string | null
          id?: string
          neighborhood?: string
          org_declined_at?: string | null
          org_received_at?: string | null
          org_received_note?: string | null
          owner_id?: string
          pet_condition?: string | null
          pet_id?: string
          photo_path?: string | null
          report_id?: string
          selected_org_at?: string | null
          selected_org_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_report_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_report_events_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_report_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "pet_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_report_events_selected_org_id_fkey"
            columns: ["selected_org_id"]
            isOneToOne: false
            referencedRelation: "organization_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_reports: {
        Row: {
          city: string
          closed_at: string | null
          created_at: string
          details: string | null
          id: string
          kind: string
          neighborhood: string
          owner_id: string
          pet_id: string
          stage: string
          status: string
        }
        Insert: {
          city: string
          closed_at?: string | null
          created_at?: string
          details?: string | null
          id?: string
          kind?: string
          neighborhood: string
          owner_id: string
          pet_id: string
          stage?: string
          status?: string
        }
        Update: {
          city?: string
          closed_at?: string | null
          created_at?: string
          details?: string | null
          id?: string
          kind?: string
          neighborhood?: string
          owner_id?: string
          pet_id?: string
          stage?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_reports_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pet_reports_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
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
          is_admin: boolean
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
          is_admin?: boolean
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
          is_admin?: boolean
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["account_role"]
          updated_at?: string
        }
        Relationships: []
      }
      service_catalog: {
        Row: {
          created_at: string
          icon: string
          id: string
          kind: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon: string
          id?: string
          kind: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          kind?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _expire_stale_posters: { Args: { p_org_id?: string }; Returns: number }
      _poster_caller_org: {
        Args: never
        Returns: {
          org_id: string
          org_kind: string
          org_role: string
        }[]
      }
      account_role_for_email: { Args: { p_email: string }; Returns: string }
      admin_counts: {
        Args: never
        Returns: {
          active_reports: number
          pending_orgs: number
          pets: number
          users: number
        }[]
      }
      admin_get_user: {
        Args: { p_user_id: string }
        Returns: {
          active_reports_count: number
          confirmed_at: string
          created_at: string
          display_name: string
          email: string
          first_name: string
          id: string
          is_admin: boolean
          last_name: string
          org_approval_status: string
          org_id: string
          org_is_active: boolean
          org_kind: string
          org_name: string
          pets_count: number
          phone: string
          role: string
        }[]
      }
      admin_list_organizations: {
        Args: never
        Returns: {
          address: string
          approval_status: string
          category: string
          city: string
          created_at: string
          description: string
          email: string
          id: string
          is_active: boolean
          kind: string
          lat: number
          lng: number
          name: string
          neighborhood: string
          owner_display_name: string
          owner_email: string
          owner_id: string
          phone: string
          rejection_reason: string
          slug: string
          status: string
          verified_at: string
          whatsapp: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          confirmed_at: string
          created_at: string
          display_name: string
          email: string
          first_name: string
          id: string
          is_admin: boolean
          last_name: string
          pets_count: number
          phone: string
          role: string
        }[]
      }
      can_read_report_evidence: {
        Args: { object_name: string }
        Returns: boolean
      }
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
          lost_city: string
          lost_details: string
          lost_neighborhood: string
          name: string
          photo_path: string
          public_id: string
          report_id: string
          report_stage: string
          reported_at: string
          sex: string
          species: string
          species_other: string
          status: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_public_pet_photo: { Args: { object_name: string }; Returns: boolean }
      list_help_organizations: {
        Args: { p_city?: string }
        Returns: {
          address: string
          category: string
          city: string
          description: string
          hours: Json
          id: string
          kind: string
          lat: number
          lng: number
          map_url: string
          name: string
          neighborhood: string
          phone: string
          whatsapp: string
        }[]
      }
      list_map_organizations: {
        Args: never
        Returns: {
          address: string
          category: string
          city: string
          description: string
          hours: Json
          id: string
          kind: string
          lat: number
          lng: number
          logo_path: string
          logo_url: string
          map_url: string
          name: string
          neighborhood: string
          phone: string
          services: Json
          whatsapp: string
        }[]
      }
      list_org_delivery_events: {
        Args: never
        Returns: {
          city: string
          description: string
          id: string
          neighborhood: string
          org_declined_at: string
          org_received_at: string
          pet_breed: string
          pet_condition: string
          pet_id: string
          pet_name: string
          pet_photo_path: string
          pet_species: string
          pet_species_other: string
          report_id: string
          selected_org_at: string
          type: string
        }[]
      }
      list_public_adoption_pets: {
        Args: never
        Returns: {
          age_unit: string
          age_value: number
          breed: string
          color_primary: string
          color_secondary: string
          color_tertiary: string
          description: string
          listed_at: string
          name: string
          photo_path: string
          public_id: string
          sex: string
          species: string
          species_other: string
        }[]
      }
      list_public_lost_pets: {
        Args: never
        Returns: {
          age_unit: string
          age_value: number
          breed: string
          city: string
          color_primary: string
          color_secondary: string
          color_tertiary: string
          details: string
          name: string
          neighborhood: string
          photo_path: string
          public_id: string
          report_id: string
          reported_at: string
          sex: string
          species: string
          species_other: string
        }[]
      }
      list_public_org_pets: {
        Args: never
        Returns: {
          age: string
          breed: string
          created_at: string
          id: string
          name: string
          needs_home: boolean
          needs_sponsor: boolean
          org_city: string
          org_id: string
          org_kind: string
          org_logo_path: string
          org_logo_url: string
          org_name: string
          org_neighborhood: string
          org_whatsapp: string
          photo_path: string
          public_id: string
          sex: string
          species: string
          species_other: string
          status: string
        }[]
      }
      list_public_posters: {
        Args: never
        Returns: {
          description: string
          id: string
          image_path: string
          org_kind: string
          org_name: string
          organization_id: string
          target_url: string
          title: string
        }[]
      }
      list_public_reunions: {
        Args: never
        Returns: {
          city: string
          closed_at: string
          neighborhood: string
          report_id: string
          species: string
          species_other: string
        }[]
      }
      org_confirm_pet_receipt: {
        Args: { p_event_id: string; p_note?: string; p_received: boolean }
        Returns: undefined
      }
      org_name_available: {
        Args: { p_kind: string; p_name: string }
        Returns: boolean
      }
      poster_admin_list: {
        Args: never
        Returns: {
          approved_at: string
          created_at: string
          description: string
          expires_at: string
          id: string
          image_path: string
          is_live: boolean
          org_category: string
          org_kind: string
          org_name: string
          organization_id: string
          owner_email: string
          rejection_reason: string
          status: string
          submitted_at: string
          target_url: string
          title: string
        }[]
      }
      poster_admin_review: {
        Args: { p_action: string; p_id: string; p_reason?: string }
        Returns: undefined
      }
      poster_delete: { Args: { p_id: string }; Returns: undefined }
      poster_my_quota: {
        Args: never
        Returns: {
          approved_last_7d: number
          has_live: boolean
          has_pending: boolean
          next_slot_at: string
          weekly_limit: number
        }[]
      }
      poster_object_is_public: {
        Args: { object_name: string }
        Returns: boolean
      }
      poster_submit: { Args: { p_id: string }; Returns: undefined }
      poster_upsert: {
        Args: {
          p_description?: string
          p_id: string
          p_image_path: string
          p_target_url?: string
          p_title?: string
        }
        Returns: string
      }
      public_landing_stats: {
        Args: never
        Returns: {
          partner_orgs: number
          pets_for_adoption: number
          pets_lost_now: number
          pets_registered: number
          reunions: number
        }[]
      }
      register_org_profile: {
        Args: { p_kind: string; p_name: string; p_slug: string }
        Returns: string
      }
      report_accepts_evidence: {
        Args: { object_name: string }
        Returns: boolean
      }
      set_org_active: {
        Args: { p_active: boolean; p_org_id: string }
        Returns: undefined
      }
      set_org_approval: {
        Args: { p_org_id: string; p_reason?: string; p_status: string }
        Returns: undefined
      }
      set_pet_status: {
        Args: {
          p_city?: string
          p_details?: string
          p_neighborhood?: string
          p_pet_id: string
          p_status: string
        }
        Returns: undefined
      }
      set_user_admin: {
        Args: { p_make_admin: boolean; p_user_id: string }
        Returns: undefined
      }
      submit_report_event: {
        Args: {
          p_city: string
          p_description?: string
          p_finder_contact?: string
          p_finder_name?: string
          p_happened_at_approx?: string
          p_happened_on?: string
          p_neighborhood: string
          p_pet_condition?: string
          p_photo_path?: string
          p_public_id: string
          p_selected_org_id?: string
          p_type: string
        }
        Returns: string
      }
    }
    Enums: {
      account_role: "usuario" | "fundacion" | "veterinaria" | "aliado"
      pet_status: "at_home" | "lost" | "found" | "for_adoption"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_role: ["usuario", "fundacion", "veterinaria", "aliado"],
      pet_status: ["at_home", "lost", "found", "for_adoption"],
    },
  },
} as const
