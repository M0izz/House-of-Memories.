export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      memory_spaces: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          name?: string;
          created_at?: string;
          created_by: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          created_by?: string;
        };
      };
      space_members: {
        Row: {
          space_id: string;
          user_id: string;
          role: "creator" | "member";
          joined_at: string;
        };
        Insert: {
          space_id: string;
          user_id: string;
          role?: "creator" | "member";
          joined_at?: string;
        };
        Update: {
          space_id?: string;
          user_id?: string;
          role?: "creator" | "member";
          joined_at?: string;
        };
      };
      albums: {
        Row: {
          id: string;
          space_id: string;
          title: string;
          description: string | null;
          cover_memory_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          title: string;
          description?: string | null;
          cover_memory_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          title?: string;
          description?: string | null;
          cover_memory_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      memories: {
        Row: {
          id: string;
          space_id: string;
          album_id: string | null;
          created_by: string;
          title: string | null;
          caption: string | null;
          captured_at: string | null;
          is_favorite: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          album_id?: string | null;
          created_by: string;
          title?: string | null;
          caption?: string | null;
          captured_at?: string | null;
          is_favorite?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          album_id?: string | null;
          created_by?: string;
          title?: string | null;
          caption?: string | null;
          captured_at?: string | null;
          is_favorite?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      memory_media: {
        Row: {
          id: string;
          memory_id: string;
          storage_path: string;
          bucket: string;
          thumbnail_path: string | null;
          media_type: "image" | "video" | "audio";
          mime_type: string;
          file_size: number;
          width: number | null;
          height: number | null;
          duration_seconds: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          memory_id: string;
          storage_path: string;
          bucket?: string;
          thumbnail_path?: string | null;
          media_type: "image" | "video" | "audio";
          mime_type: string;
          file_size: number;
          width?: number | null;
          height?: number | null;
          duration_seconds?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          memory_id?: string;
          storage_path?: string;
          bucket?: string;
          thumbnail_path?: string | null;
          media_type?: "image" | "video" | "audio";
          mime_type?: string;
          file_size?: number;
          width?: number | null;
          height?: number | null;
          duration_seconds?: number | null;
          created_at?: string;
        };
      };
      tags: {
        Row: {
          id: string;
          space_id: string;
          name: string;
          color: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          space_id: string;
          name: string;
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          space_id?: string;
          name?: string;
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
      };
      memory_tags: {
        Row: {
          memory_id: string;
          tag_id: string;
        };
        Insert: {
          memory_id: string;
          tag_id: string;
        };
        Update: {
          memory_id?: string;
          tag_id?: string;
        };
      };
      timeline_events: {
        Row: {
          id: string;
          space_id: string;
          title: string;
          description: string | null;
          event_date: string;
          cover_memory_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          title: string;
          description?: string | null;
          event_date: string;
          cover_memory_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          title?: string;
          description?: string | null;
          event_date?: string;
          cover_memory_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      memory_locations: {
        Row: {
          id: string;
          memory_id: string;
          place_name: string;
          latitude: number;
          longitude: number;
          date_visited: string | null;
        };
        Insert: {
          id?: string;
          memory_id: string;
          place_name: string;
          latitude: number;
          longitude: number;
          date_visited?: string | null;
        };
        Update: {
          id?: string;
          memory_id?: string;
          place_name?: string;
          latitude?: number;
          longitude?: number;
          date_visited?: string | null;
        };
      };
      letters: {
        Row: {
          id: string;
          space_id: string;
          created_by: string;
          title: string;
          content: string;
          unlock_at: string | null;
          is_locked: boolean;
          envelope_color: string | null;
          editable_by_recipient: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          created_by: string;
          title: string;
          content: string;
          unlock_at?: string | null;
          is_locked?: boolean;
          envelope_color?: string | null;
          editable_by_recipient?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          created_by?: string;
          title?: string;
          content?: string;
          unlock_at?: string | null;
          is_locked?: boolean;
          envelope_color?: string | null;
          editable_by_recipient?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      letter_media: {
        Row: {
          id: string;
          letter_id: string;
          storage_path: string;
          media_type: string;
          mime_type: string;
          file_size: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          letter_id: string;
          storage_path: string;
          media_type: string;
          mime_type: string;
          file_size: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          letter_id?: string;
          storage_path?: string;
          media_type?: string;
          mime_type?: string;
          file_size?: number;
          created_at?: string;
        };
      };
      special_dates: {
        Row: {
          id: string;
          space_id: string;
          title: string;
          event_date: string;
          recurrence: "none" | "yearly" | "monthly";
          icon: string | null;
          description: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          title: string;
          event_date: string;
          recurrence?: "none" | "yearly" | "monthly";
          icon?: string | null;
          description?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          title?: string;
          event_date?: string;
          recurrence?: "none" | "yearly" | "monthly";
          icon?: string | null;
          description?: string | null;
          created_by?: string;
          created_at?: string;
        };
      };
      birthday_experiences: {
        Row: {
          id: string;
          space_id: string;
          title: string;
          config: Json;
          is_published: boolean;
          preview_token: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          title?: string;
          config?: Json;
          is_published?: boolean;
          preview_token?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          title?: string;
          config?: Json;
          is_published?: boolean;
          preview_token?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_preferences: {
        Row: {
          user_id: string;
          theme: "cream" | "dark" | "system";
          sound_enabled: boolean;
          volume: number;
          mute: boolean;
          reduced_motion: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          theme?: "cream" | "dark" | "system";
          sound_enabled?: boolean;
          volume?: number;
          mute?: boolean;
          reduced_motion?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          theme?: "cream" | "dark" | "system";
          sound_enabled?: boolean;
          volume?: number;
          mute?: boolean;
          reduced_motion?: boolean;
          updated_at?: string;
        };
      };
      memory_views: {
        Row: {
          id: string;
          memory_id: string;
          user_id: string;
          viewed_at: string;
        };
        Insert: {
          id?: string;
          memory_id: string;
          user_id: string;
          viewed_at?: string;
        };
        Update: {
          id?: string;
          memory_id?: string;
          user_id?: string;
          viewed_at?: string;
        };
      };
    };
  };
};

export type MemoryWithMedia = Database["public"]["Tables"]["memories"]["Row"] & {
  memory_media: Database["public"]["Tables"]["memory_media"]["Row"][];
  tags?: { id: string; name: string; color: string | null }[];
  album?: { id: string; title: string } | null;
  signedUrl?: string;
};
