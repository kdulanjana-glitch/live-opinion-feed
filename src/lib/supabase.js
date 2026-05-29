import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const SUPABASE_URL = "https://cobmoxjxwapinxcnmwhf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvYm1veGp4d2FwaW54Y25td2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNDM4ODIsImV4cCI6MjA5NTYxOTg4Mn0.2MJPxwghvguAj_breBUcShd5inPELUGNLgq-gPgVTfg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});