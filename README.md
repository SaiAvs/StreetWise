# StreetWise
A responsive civic issue reporting and tracking prototype for citizens and municipal authorities.

## Features
- Citizen, authority and admin authentication
- Complaint reporting and tracking
- Status workflow and timeline
- Authority complaint updates
- Notifications
- Analytics API
- JSON demo persistence with no MongoDB requirement
- Deployment-friendly structure

## Run locally
```bash
npm install
npm run install:all
npm run seed
npm run dev
```
Open http://localhost:5173.

Demo accounts:
- Citizen: citizen@streetwise.demo / Password123!
- Authority: authority@streetwise.demo / Password123!
- Admin: admin@streetwise.demo / Password123!

Do not upload node_modules or .env. Hosting services install packages from package.json. For deployment, set VITE_API_URL in the frontend and PORT/JWT_SECRET in the backend. JSON storage is suitable for a prototype; use a managed database for production persistence.
