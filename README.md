# Concentrate School Portal

See `PLANNING.md` for the team task split.

## Screenshots

**Login**

<img width="700" alt="Login page" src="https://github.com/user-attachments/assets/ac001698-5714-4118-9dfa-df76c031c076" />

**Admin**

<table>
  <tr>
    <td align="center" width="50%">
      <img width="100%" alt="Admin — user management" src="https://github.com/user-attachments/assets/d8ec1b1c-39bb-4f04-ae45-8fbe039f9b7a" /><br/>
      <sub><b>User management</b></sub>
    </td>
    <td align="center" width="50%">
      <img width="100%" alt="Admin — teacher groups" src="https://github.com/user-attachments/assets/d0a12c3f-4eef-4f64-a86c-366b16b6f1b8" /><br/>
      <sub><b>Teacher groups</b></sub>
    </td>
  </tr>
</table>

**Teacher**

<table>
  <tr>
    <td align="center" width="33%">
      <img width="100%" alt="Teacher — class dashboard" src="https://github.com/user-attachments/assets/6312371b-0572-433c-92ac-f3adb261c4c6" /><br/>
      <sub><b>Class dashboard</b></sub>
    </td>
    <td align="center" width="33%">
      <img width="100%" alt="Teacher — class detail and roster" src="https://github.com/user-attachments/assets/91b00444-9b1f-497d-b199-306eed704fbe" /><br/>
      <sub><b>Class detail &amp; roster</b></sub>
    </td>
    <td align="center" width="33%">
      <img width="100%" alt="Teacher — grading a submission" src="https://github.com/user-attachments/assets/ad5c5900-2318-41b7-9085-8f1d7eee3e64" /><br/>
      <sub><b>Grading a submission</b></sub>
    </td>
  </tr>
</table>

**Student**

<table>
  <tr>
    <td align="center" width="25%">
      <img width="100%" alt="Student — my classes" src="https://github.com/user-attachments/assets/44026d3d-f746-474f-899d-d2ce8b395968" /><br/>
      <sub><b>My classes</b></sub>
    </td>
    <td align="center" width="25%">
      <img width="100%" alt="Student — assignments" src="https://github.com/user-attachments/assets/8dda497a-8f2a-43e0-a387-54628593c6e4" /><br/>
      <sub><b>Assignments</b></sub>
    </td>
    <td align="center" width="25%">
      <img width="100%" alt="Student — assignment detail" src="https://github.com/user-attachments/assets/5b1d65f5-a951-4a42-9748-7fe38494ae8b" /><br/>
      <sub><b>Assignment detail</b></sub>
    </td>
    <td align="center" width="25%">
      <img width="100%" alt="Student — submissions and grades" src="https://github.com/user-attachments/assets/9523cc54-06a6-46dc-a659-ab9d73276127" /><br/>
      <sub><b>Submissions &amp; grades</b></sub>
    </td>
  </tr>
</table>

**Chatbot** (extra credit)

<table>
  <tr>
    <td align="center" width="33%">
      <img width="100%" alt="Chatbot widget closed" src="https://github.com/user-attachments/assets/b58eaf04-05b9-4578-bd69-4970ac5c516f" /><br/>
      <sub><b>Chat widget</b></sub>
    </td>
    <td align="center" width="33%">
      <img width="100%" alt="Chatbot answering a teacher question" src="https://github.com/user-attachments/assets/c73394ec-de55-4d69-9d8d-e9b6083fd932" /><br/>
      <sub><b>Teacher context</b></sub>
    </td>
    <td align="center" width="33%">
      <img width="100%" alt="Chatbot answering a student question" src="https://github.com/user-attachments/assets/11e9ab88-05c7-46f5-baf6-ecf289d7b6c1" /><br/>
      <sub><b>Student context</b></sub>
    </td>
  </tr>
</table>

## Local development

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis
npm run migrate --workspace=apps/api
npm run seed --workspace=apps/api
npm run dev
```

`npm run dev` runs both workspaces in parallel: the API on
`http://localhost:4000` (health check: `GET /health`) and the web app on
`http://localhost:3000`. Run `npm run dev --workspace=apps/api` or
`--workspace=apps/web` instead if you only need one of them.

Seeded accounts (password `password123` for all): `admin@example.com`,
`teacher@example.com`, `teacher2@example.com`, `student@example.com`,
`student2@example.com`, `student3@example.com`.

## Tests

```bash
npm run migrate --workspace=apps/api   # against a disposable/test DATABASE_URL
npm run seed --workspace=apps/api
npm run test        # both workspaces
npm run coverage     # both workspaces, fails below 100%
```

## End-to-end tests

```bash
docker compose up -d postgres redis
npx playwright install chromium   # first run only
npm run test:e2e
```

Playwright's `globalSetup` migrates + reseeds the database and boots both
dev servers automatically — no need to start them manually first.
