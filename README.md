# IDRMS — Intelligent Disaster Resilience Management System

A web-based disaster resilience and coordination project. The application uses a Node.js/Express backend and a browser-based frontend. It can use local JSON storage by default and optionally connect to Supabase when credentials are configured.

## Requirements
- Node.js (LTS recommended) and npm

## Setup
1. Clone or download this repository.
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env`.
4. Set a strong, private `JWT_SECRET`. Add optional OpenWeather/Supabase credentials only if you have them. Never commit `.env`.
5. Start the application: `npm start`
6. Open `http://localhost:3000` in your browser.

## Configuration
See `.env.example` for supported environment variables. Supabase settings are optional; without them the backend uses its local JSON fallback.

## Security and repository notes
- `.env` and runtime uploads are excluded from this repository package.
- Do not commit API keys, passwords, service-role keys, personal data, or private user uploads.
- This repository contains source code and a sample configuration template, not production credentials.
