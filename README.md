# Goblins Auto-Grader

Quick start:

1. cp .env.local.example .env.local and set OPENAI_API_KEY + Supabase keys
2. npm install
3. npm run dev

Vision extraction uses OpenAI (model: gpt-4o-mini). Set `USE_LLM=true` to enable; otherwise the API abstains and the UI prompts a rewrite or typed fallback.
