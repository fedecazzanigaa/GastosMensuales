// Configuración de Supabase
const SUPABASE_URL = 'https://kgoupyevvazwfkrvekfu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtnb3VweWV2dmF6d2ZrcnZla2Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDA4NjQsImV4cCI6MjA5NDI3Njg2NH0.kOPjymydE1ezGxMEIKhwhbIQmnxG5felXiURhaIyk6E';

// Inicialización de Supabase
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
