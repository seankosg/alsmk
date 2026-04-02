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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_name: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_name?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          end_time: string | null
          event_date: string
          event_type: string
          id: string
          recurrence_group_id: string | null
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_date: string
          event_type?: string
          id?: string
          recurrence_group_id?: string | null
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          event_date?: string
          event_type?: string
          id?: string
          recurrence_group_id?: string | null
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          member_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          member_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          type?: string
        }
        Relationships: []
      }
      cpm_activities: {
        Row: {
          created_at: string
          custom_fields: Json | null
          duration: number
          ef: number | null
          es: number | null
          finish_date: string | null
          id: string
          is_critical: boolean
          is_milestone: boolean
          lf: number | null
          ls: number | null
          mpp_task_id: string | null
          mpp_uid: string | null
          name: string
          progress: number | null
          progress_mode: string
          semantic_key: string | null
          start_date: string | null
          tf: number | null
          updated_at: string
          wbs_full: string | null
        }
        Insert: {
          created_at?: string
          custom_fields?: Json | null
          duration?: number
          ef?: number | null
          es?: number | null
          finish_date?: string | null
          id?: string
          is_critical?: boolean
          is_milestone?: boolean
          lf?: number | null
          ls?: number | null
          mpp_task_id?: string | null
          mpp_uid?: string | null
          name: string
          progress?: number | null
          progress_mode?: string
          semantic_key?: string | null
          start_date?: string | null
          tf?: number | null
          updated_at?: string
          wbs_full?: string | null
        }
        Update: {
          created_at?: string
          custom_fields?: Json | null
          duration?: number
          ef?: number | null
          es?: number | null
          finish_date?: string | null
          id?: string
          is_critical?: boolean
          is_milestone?: boolean
          lf?: number | null
          ls?: number | null
          mpp_task_id?: string | null
          mpp_uid?: string | null
          name?: string
          progress?: number | null
          progress_mode?: string
          semantic_key?: string | null
          start_date?: string | null
          tf?: number | null
          updated_at?: string
          wbs_full?: string | null
        }
        Relationships: []
      }
      cpm_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cpm_task_mappings: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cpm_task_mappings_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "cpm_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cpm_task_mappings_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          referenced_task_id: string | null
          sender_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          referenced_task_id?: string | null
          sender_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          referenced_task_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_referenced_task_id_fkey"
            columns: ["referenced_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_threads: {
        Row: {
          author_name: string
          created_at: string
          id: string
          message: string
          task_id: string
        }
        Insert: {
          author_name: string
          created_at?: string
          id?: string
          message: string
          task_id: string
        }
        Update: {
          author_name?: string
          created_at?: string
          id?: string
          message?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_threads_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          duty_title: string | null
          email: string | null
          id: string
          is_pm: boolean
          name: string
          part_id: string | null
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duty_title?: string | null
          email?: string | null
          id?: string
          is_pm?: boolean
          name: string
          part_id?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duty_title?: string | null
          email?: string | null
          id?: string
          is_pm?: boolean
          name?: string
          part_id?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          status: Database["public"]["Enums"]["milestone_status"]
          target_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          target_date: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          target_date?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          recipient_id: string
          sender_id: string | null
          task_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          recipient_id: string
          sender_id?: string | null
          task_id: string
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          recipient_id?: string
          sender_id?: string | null
          task_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          team_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          team_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel_targets: {
        Row: {
          current_headcount: number
          id: string
          part_id: string | null
          target_headcount: number
          team_id: string
        }
        Insert: {
          current_headcount?: number
          id?: string
          part_id?: string | null
          target_headcount?: number
          team_id: string
        }
        Update: {
          current_headcount?: number
          id?: string
          part_id?: string | null
          target_headcount?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personnel_targets_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_targets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      project_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      task_code_sequences: {
        Row: {
          part_code: string
          seq: number
          team_code: string
          yymm: string
        }
        Insert: {
          part_code: string
          seq?: number
          team_code: string
          yymm: string
        }
        Update: {
          part_code?: string
          seq?: number
          team_code?: string
          yymm?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          author_id: string
          created_at: string
          id: string
          message: string
          parent_comment_id: string | null
          task_id: string
          type: string
        }
        Insert: {
          author_id: string
          created_at?: string
          id?: string
          message: string
          parent_comment_id?: string | null
          task_id: string
          type?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          id?: string
          message?: string
          parent_comment_id?: string | null
          task_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          action_plan: string | null
          actual_finish: string | null
          assignee_id: string | null
          category: string | null
          created_at: string
          created_by: string | null
          current_progress: number
          deleted_at: string | null
          deleted_by: string | null
          end_date: string
          id: string
          is_summary: boolean
          issue_description: string | null
          issue_flag: Database["public"]["Enums"]["issue_flag"]
          issue_type: string | null
          milestone_id: string | null
          parent_id: string | null
          part_id: string | null
          start_date: string
          task_code: string | null
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          action_plan?: string | null
          actual_finish?: string | null
          assignee_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          current_progress?: number
          deleted_at?: string | null
          deleted_by?: string | null
          end_date: string
          id?: string
          is_summary?: boolean
          issue_description?: string | null
          issue_flag?: Database["public"]["Enums"]["issue_flag"]
          issue_type?: string | null
          milestone_id?: string | null
          parent_id?: string | null
          part_id?: string | null
          start_date: string
          task_code?: string | null
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          action_plan?: string | null
          actual_finish?: string | null
          assignee_id?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          current_progress?: number
          deleted_at?: string | null
          deleted_by?: string | null
          end_date?: string
          id?: string
          is_summary?: boolean
          issue_description?: string | null
          issue_flag?: Database["public"]["Enums"]["issue_flag"]
          issue_type?: string | null
          milestone_id?: string | null
          parent_id?: string | null
          part_id?: string | null
          start_date?: string
          task_code?: string | null
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          target_headcount: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          target_headcount?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          target_headcount?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_pm: { Args: { _user_id: string }; Returns: boolean }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      upsert_activity_mappings: {
        Args: { _activity_id: string; _task_ids: string[] }
        Returns: undefined
      }
      upsert_task_mappings: {
        Args: { _activity_ids: string[]; _task_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "user" | "guest" | "super_guest"
      issue_flag: "normal" | "warning" | "critical"
      milestone_status: "upcoming" | "in_progress" | "completed" | "delayed"
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
      app_role: ["admin", "manager", "user", "guest", "super_guest"],
      issue_flag: ["normal", "warning", "critical"],
      milestone_status: ["upcoming", "in_progress", "completed", "delayed"],
    },
  },
} as const
