import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ibqvkeyzvtssndngyjbn.supabase.co'
const supabaseAnonKey = 'sb_publishable_TWczpAsGFmF3DT6LhQnwpA_BesHHnCZ'

// ВАЖЛИВО: слово 'export' має бути тут обов'язково!
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

'sb_publishable_TWczpAsGFmF3DT6LhQnwpA_BesHHnCZ'