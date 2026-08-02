# QuizPortal_Auto_Certificate_Generation

## PostgreSQL VPS Setup

The app now stores quizzes, submissions, certificate templates, and admin configuration in PostgreSQL. Browser storage is used only for short-lived login session data.

### Environment variables

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/certificate
PORT=3001
ADMIN_USER=admin
ADMIN_PASS=change-this-basic-auth-password
DB_SSL=false
```

Use `DB_SSL=true` only when your PostgreSQL provider requires SSL.

### Run on the VPS

```bash
npm install
npm run build
npm run server
```

On startup, `server.js` creates the required PostgreSQL tables automatically:

- `quizzes`
- `submissions`
- `cert_templates`
- `admin_config`

If `data/db.json` exists, its legacy data is imported into PostgreSQL when the matching tables are empty.

### Database GUI

Open `/admin-ui` on your deployed server. It is protected by `ADMIN_USER` and `ADMIN_PASS`, and destructive database actions also ask for the app admin password.
