import 'react-native-get-random-values';
import 'react-native-get-random-values';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
    // PKCE so OAuth returns ?code=… (which _layout.tsx exchanges) instead of an
    // #access_token fragment that native can't auto-consume.
    flowType: "pkce",
  },
});

export function subscribeToTable(channelName, table, events, callback) {
  const channel = supabase.channel(channelName);
  const eventList = Array.isArray(events) ? events : [events];
  eventList.forEach((event) => {
    channel.on("postgres_changes", { event, schema: "public", table }, callback);
  });
  channel.subscribe();
  return channel;
}