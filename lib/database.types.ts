
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
                },"check_in_services": {
                  Row: {
                    "category_name": string,"check_in_id": string,"name": string,"position": number,"service_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category_name": string,"check_in_id": string,"name": string,"position": number,"service_id"?: string | null
                  }
                  Update: {
                    "category_name"?: string,"check_in_id"?: string,"name"?: string,"position"?: number,"service_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "check_in_services_check_in_id_fkey"
      columns: ["check_in_id"]
isOneToOne: false
      referencedRelation: "check_ins"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "check_in_services_service_id_fkey"
      columns: ["service_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id"]
    }
                  ]
                },"check_ins": {
                  Row: {
                    "created_at": string,"created_by": string | null,"customer_id": string,"id": string,"points_awarded": number,"source": Database["public"]['Enums']["check_in_source"],"technician_id": string | null,"technician_name": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"customer_id": string,"id"?: string,"points_awarded": number,"source": Database["public"]['Enums']["check_in_source"],"technician_id"?: string | null,"technician_name"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"customer_id"?: string,"id"?: string,"points_awarded"?: number,"source"?: Database["public"]['Enums']["check_in_source"],"technician_id"?: string | null,"technician_name"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "check_ins_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "check_ins_technician_id_fkey"
      columns: ["technician_id"]
isOneToOne: false
      referencedRelation: "technicians"
      referencedColumns: ["id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "birthday_day": number | null,"birthday_month": number | null,"created_at": string,"first_name": string,"id": string,"last_name": string | null,"last_visit_at": string | null,"lifetime_points": number,"notes": string | null,"phone": string,"points_balance": number,"updated_at": string,"visit_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "birthday_day"?: number | null,"birthday_month"?: number | null,"created_at"?: string,"first_name": string,"id"?: string,"last_name"?: string | null,"last_visit_at"?: string | null,"lifetime_points"?: number,"notes"?: string | null,"phone": string,"points_balance"?: number,"updated_at"?: string,"visit_count"?: number
                  }
                  Update: {
                    "birthday_day"?: number | null,"birthday_month"?: number | null,"created_at"?: string,"first_name"?: string,"id"?: string,"last_name"?: string | null,"last_visit_at"?: string | null,"lifetime_points"?: number,"notes"?: string | null,"phone"?: string,"points_balance"?: number,"updated_at"?: string,"visit_count"?: number
                  }
                  Relationships: [
                    
                  ]
                },"gift_voucher_transactions": {
                  Row: {
                    "balance_after_cents": number,"created_at": string,"created_by": string | null,"customer_id": string | null,"delta_cents": number,"gift_voucher_id": string,"id": string,"kind": Database["public"]['Enums']["gift_voucher_entry"],"note": string | null,"seq": number,"undoes": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "balance_after_cents": number,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"delta_cents": number,"gift_voucher_id": string,"id"?: string,"kind": Database["public"]['Enums']["gift_voucher_entry"],"note"?: string | null,"seq"?: never,"undoes"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "balance_after_cents"?: number,"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"delta_cents"?: number,"gift_voucher_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["gift_voucher_entry"],"note"?: string | null,"seq"?: never,"undoes"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "gift_voucher_transactions_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gift_voucher_transactions_gift_voucher_id_fkey"
      columns: ["gift_voucher_id"]
isOneToOne: false
      referencedRelation: "gift_vouchers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gift_voucher_transactions_undoes_fkey"
      columns: ["undoes"]
isOneToOne: false
      referencedRelation: "gift_voucher_transactions"
      referencedColumns: ["id"]
    }
                  ]
                },"gift_vouchers": {
                  Row: {
                    "amount_cents": number,"balance_cents": number,"code": string,"created_at": string,"customer_id": string | null,"expires_on": string,"id": string,"notes": string | null,"sold_by": string | null,"sold_on": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_cents": number,"balance_cents": number,"code": string,"created_at"?: string,"customer_id"?: string | null,"expires_on": string,"id"?: string,"notes"?: string | null,"sold_by"?: string | null,"sold_on": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"balance_cents"?: number,"code"?: string,"created_at"?: string,"customer_id"?: string | null,"expires_on"?: string,"id"?: string,"notes"?: string | null,"sold_by"?: string | null,"sold_on"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gift_vouchers_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    }
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
                },"service_categories": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"services": {
                  Row: {
                    "category_id": string,"created_at": string,"id": string,"is_active": boolean,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "service_categories"
      referencedColumns: ["id"]
    }
                  ]
                },"settings": {
                  Row: {
                    "birthday_discount_enabled": boolean,"birthday_discount_percent": number,"birthday_window_days": number,"code_prefix": string,"id": boolean,"kiosk_idle_seconds": number,"tier_regular_points": number,"tier_vip_points": number,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "birthday_discount_enabled"?: boolean,"birthday_discount_percent"?: number,"birthday_window_days"?: number,"code_prefix"?: string,"id"?: boolean,"kiosk_idle_seconds"?: number,"tier_regular_points"?: number,"tier_vip_points"?: number,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "birthday_discount_enabled"?: boolean,"birthday_discount_percent"?: number,"birthday_window_days"?: number,"code_prefix"?: string,"id"?: boolean,"kiosk_idle_seconds"?: number,"tier_regular_points"?: number,"tier_vip_points"?: number,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"staff": {
                  Row: {
                    "created_at": string,"display_name": string,"removed_at": string | null,"role": Database["public"]['Enums']["staff_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"removed_at"?: string | null,"role"?: Database["public"]['Enums']["staff_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"removed_at"?: string | null,"role"?: Database["public"]['Enums']["staff_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"technicians": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "gift_voucher_totals": {
                  Row: {
                    "active_count": number | null,"outstanding_cents": number | null,"total_count": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
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
"_discount_used_today":
{ Args: { "p_customer_id": string }; Returns: boolean
                           },
"_luhn_check_digit":
{ Args: { "p_digits": string }; Returns: number
                           },
"_new_gift_voucher_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"_post_gift_voucher":
{ Args: { "p_customer_id"?: string,"p_delta_cents": number,"p_gift_voucher_id": string,"p_kind": Database["public"]['Enums']["gift_voucher_entry"],"p_note"?: string,"p_undoes"?: string }; Returns: number
                           },
"_post_points":
{ Args: { "p_actor"?: string,"p_check_in_id"?: string,"p_customer_id": string,"p_delta": number,"p_note"?: string,"p_promotion_id"?: string,"p_reason": Database["public"]['Enums']["point_reason"] }; Returns: number
                           },
"_redeem_birthday":
{ Args: { "p_actor": string,"p_customer_id": string,"p_source": Database["public"]['Enums']["check_in_source"] }; Returns: Json
                           },
"_shop_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"adjust_gift_voucher":
{ Args: { "p_delta_cents": number,"p_gift_voucher_id": string,"p_note": string }; Returns: number
                           },
"adjust_points":
{ Args: { "p_customer_id": string,"p_delta": number,"p_note": string }; Returns: number
                           },
"assert_signed_in":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"assert_staff":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"birthday_status":
{ Args: { "p_customer_id": string }; Returns: Json
                           },
"check_gift_voucher":
{ Args: { "p_code": string }; Returns: Json
                           },
"check_in_totals":
{ Args: { "p_since": string,"p_source"?: Database["public"]['Enums']["check_in_source"] }; Returns: Json
                           },
"generate_gift_voucher_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_owner":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"kiosk_check_in":
{ Args: { "p_birthday_day"?: number,"p_birthday_month"?: number,"p_first_name"?: string,"p_last_name"?: string,"p_phone": string,"p_service_ids"?: (string)[],"p_technician_id"?: string }; Returns: Json
                           },
"kiosk_lookup":
{ Args: { "p_phone": string }; Returns: Json
                           },
"kiosk_redeem":
{ Args: { "p_phone": string,"p_promotion_id": string }; Returns: Json
                           },
"kiosk_redeem_birthday":
{ Args: { "p_phone": string }; Returns: Json
                           },
"kiosk_today":
{ Args: { "p_customer_id": string }; Returns: Json
                           },
"normalize_voucher_code":
{ Args: { "p_code": string }; Returns: string
                           },
"redeem_birthday":
{ Args: { "p_customer_id": string }; Returns: Json
                           },
"redeem_reward":
{ Args: { "p_customer_id": string,"p_promotion_id": string }; Returns: number
                           },
"sell_gift_voucher":
{ Args: { "p_amount_cents": number,"p_code"?: string,"p_customer_id"?: string,"p_expires_on"?: string,"p_notes"?: string }; Returns: Json
                           },
"shop_day_start":
{ Args: { "p_days_ago"?: number }; Returns: string
                           },
"spend_gift_voucher":
{ Args: { "p_amount_cents": number,"p_code": string,"p_customer_id"?: string,"p_note"?: string }; Returns: Json
                           },
"top_services":
{ Args: { "p_limit"?: number,"p_since": string }; Returns: {
              "category_name": string,"name": string,"uses": number
            }[]
                           }
          }
          Enums: {
            "check_in_source": "kiosk"|"admin","gift_voucher_entry": "sale"|"spend"|"undo"|"adjust","point_reason": "check_in"|"signup_bonus"|"redeem"|"adjust"|"void","promotion_type": "reward","staff_role": "admin"|"staff"
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
            "check_in_source": ["kiosk", "admin"],"gift_voucher_entry": ["sale", "spend", "undo", "adjust"],"point_reason": ["check_in", "signup_bonus", "redeem", "adjust", "void"],"promotion_type": ["reward"],"staff_role": ["admin", "staff"]
          }
        }
} as const
