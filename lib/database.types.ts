
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "birthday_redemptions": {
                  Row: {
                    "birthday_year": number,"created_at": string,"created_by": string | null,"customer_id": string,"id": string,"percent": number,"source": Database["public"]['Enums']["check_in_source"]
                  }
                  ComputedFields: never
                  Insert: {
                    "birthday_year": number,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"id"?: string,"percent": number,"source": Database["public"]['Enums']["check_in_source"]
                  }
                  Update: {
                    "birthday_year"?: number,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"id"?: string,"percent"?: number,"source"?: Database["public"]['Enums']["check_in_source"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "birthday_redemptions_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"check_ins": {
                  Row: {
                    "created_at": string,"created_by": string | null,"customer_id": string,"id": string,"points_awarded": number,"source": Database["public"]['Enums']["check_in_source"],"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"customer_id": string,"id"?: string,"points_awarded": number,"source": Database["public"]['Enums']["check_in_source"],"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"id"?: string,"points_awarded"?: number,"source"?: Database["public"]['Enums']["check_in_source"],"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "check_ins_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "birthday_day": number | null,"birthday_month": number | null,"created_at": string,"first_name": string,"id": string,"last_name": string | null,"last_visit_at": string | null,"lifetime_points": number,"notes": string | null,"phone": string,"points_balance": number,"sms_opt_in": boolean,"updated_at": string,"visit_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "birthday_day"?: number | null,"birthday_month"?: number | null,"created_at"?: string,"first_name": string,"id"?: string,"last_name"?: string | null,"last_visit_at"?: string | null,"lifetime_points"?: number,"notes"?: string | null,"phone": string,"points_balance"?: number,"sms_opt_in"?: boolean,"updated_at"?: string,"visit_count"?: number
                  }
                  Update: {
                    "birthday_day"?: number | null,"birthday_month"?: number | null,"created_at"?: string,"first_name"?: string,"id"?: string,"last_name"?: string | null,"last_visit_at"?: string | null,"lifetime_points"?: number,"notes"?: string | null,"phone"?: string,"points_balance"?: number,"sms_opt_in"?: boolean,"updated_at"?: string,"visit_count"?: number
                  }
                  Relationships: [
                    
                  ]
                },"kiosk_devices": {
                  Row: {
                    "created_at": string,"id": string,"last_seen_at": string | null,"name": string,"paired_by": string | null,"revoked_at": string | null,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_seen_at"?: string | null,"name": string,"paired_by"?: string | null,"revoked_at"?: string | null,"token_hash": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_seen_at"?: string | null,"name"?: string,"paired_by"?: string | null,"revoked_at"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    
                  ]
                },"point_transactions": {
                  Row: {
                    "balance_after": number,"check_in_id": string | null,"created_at": string,"created_by": string | null,"customer_id": string,"delta": number,"id": string,"note": string | null,"promotion_id": string | null,"reason": Database["public"]['Enums']["point_reason"],"seq": number
                  }
                  ComputedFields: never
                  Insert: {
                    "balance_after": number,"check_in_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id": string,"delta": number,"id"?: string,"note"?: string | null,"promotion_id"?: string | null,"reason": Database["public"]['Enums']["point_reason"],"seq"?: never
                  }
                  Update: {
                    "balance_after"?: number,"check_in_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"delta"?: number,"id"?: string,"note"?: string | null,"promotion_id"?: string | null,"reason"?: Database["public"]['Enums']["point_reason"],"seq"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "point_transactions_check_in_id_fkey"
      columns: ["check_in_id"]
isOneToOne: false
      referencedRelation: "check_ins"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "point_transactions_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "point_transactions_promotion_id_fkey"
      columns: ["promotion_id"]
isOneToOne: false
      referencedRelation: "promotions"
      referencedColumns: ["id"]
    }
                  ]
                },"promotions": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"points_cost": number,"title": string,"type": Database["public"]['Enums']["promotion_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"points_cost": number,"title": string,"type"?: Database["public"]['Enums']["promotion_type"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"points_cost"?: number,"title"?: string,"type"?: Database["public"]['Enums']["promotion_type"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"settings": {
                  Row: {
                    "birthday_discount_enabled": boolean,"birthday_discount_percent": number,"birthday_window_days": number,"checkin_cooldown_hours": number,"id": boolean,"kiosk_idle_seconds": number,"points_per_visit": number,"signup_bonus": number,"tier_regular_visits": number,"tier_vip_visits": number,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "birthday_discount_enabled"?: boolean,"birthday_discount_percent"?: number,"birthday_window_days"?: number,"checkin_cooldown_hours"?: number,"id"?: boolean,"kiosk_idle_seconds"?: number,"points_per_visit"?: number,"signup_bonus"?: number,"tier_regular_visits"?: number,"tier_vip_visits"?: number,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "birthday_discount_enabled"?: boolean,"birthday_discount_percent"?: number,"birthday_window_days"?: number,"checkin_cooldown_hours"?: number,"id"?: boolean,"kiosk_idle_seconds"?: number,"points_per_visit"?: number,"signup_bonus"?: number,"tier_regular_visits"?: number,"tier_vip_visits"?: number,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"staff": {
                  Row: {
                    "created_at": string,"display_name": string,"role": Database["public"]['Enums']["staff_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"role"?: Database["public"]['Enums']["staff_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"role"?: Database["public"]['Enums']["staff_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "_award_check_in":
{ Args: { "p_actor": string,"p_customer_id": string,"p_source": Database["public"]['Enums']["check_in_source"] }; Returns: Json
                           },
"_birthday_status":
{ Args: { "p_customer_id": string }; Returns: Json
                           },
"_checked_in_recently":
{ Args: { "p_customer_id": string }; Returns: boolean
                           },
"_post_points":
{ Args: { "p_actor"?: string,"p_check_in_id"?: string,"p_customer_id": string,"p_delta": number,"p_note"?: string,"p_promotion_id"?: string,"p_reason": Database["public"]['Enums']["point_reason"] }; Returns: number
                           },
"_redeem_birthday":
{ Args: { "p_actor": string,"p_customer_id": string,"p_source": Database["public"]['Enums']["check_in_source"] }; Returns: Json
                           },
"adjust_points":
{ Args: { "p_customer_id": string,"p_delta": number,"p_note": string }; Returns: number
                           },
"admin_check_in":
{ Args: { "p_customer_id": string }; Returns: Json
                           },
"assert_staff":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"birthday_status":
{ Args: { "p_customer_id": string }; Returns: Json
                           },
"is_owner":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"kiosk_check_in":
{ Args: { "p_birthday_day"?: number,"p_birthday_month"?: number,"p_first_name"?: string,"p_last_name"?: string,"p_phone": string,"p_sms_opt_in"?: boolean }; Returns: Json
                           },
"kiosk_redeem":
{ Args: { "p_phone": string,"p_promotion_id": string }; Returns: Json
                           },
"kiosk_redeem_birthday":
{ Args: { "p_phone": string }; Returns: Json
                           },
"redeem_birthday":
{ Args: { "p_customer_id": string }; Returns: Json
                           },
"redeem_reward":
{ Args: { "p_customer_id": string,"p_promotion_id": string }; Returns: number
                           },
"shop_day_start":
{ Args: { "p_days_ago"?: number }; Returns: string
                           },
"void_check_in":
{ Args: { "p_check_in_id": string }; Returns: number
                           }
          }
          Enums: {
            "check_in_source": "kiosk"|"admin","point_reason": "check_in"|"signup_bonus"|"redeem"|"adjust"|"void","promotion_type": "reward","staff_role": "owner"|"staff"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "check_in_source": ["kiosk", "admin"],"point_reason": ["check_in", "signup_bonus", "redeem", "adjust", "void"],"promotion_type": ["reward"],"staff_role": ["owner", "staff"]
          }
        }
} as const
