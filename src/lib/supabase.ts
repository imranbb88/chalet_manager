import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kgjyvmrovbbmmsygdzeg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtnanl2bXJvdmJibW1zeWdkemVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxOTg2NTQsImV4cCI6MjA1NDc3NDY1NH0.i4vK-dTB873ZNkGKsZHGUo7KB4526UDJoaB3dfQ-fbk';

export const supabase = createClient(supabaseUrl, supabaseKey); 