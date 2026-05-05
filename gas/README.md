# Deploying the GAS Script

1. Go to https://script.google.com → New project
2. Paste the contents of Code.gs into the editor
3. Replace SPREADSHEET_ID with your Google Sheet's ID
   (found in the sheet URL: .../spreadsheets/d/<ID>/edit)
4. Click Deploy → New deployment
5. Type: Web app
6. Execute as: Me
7. Who has access: Anyone
8. Click Deploy, copy the URL
9. Paste the URL into xpp/.env as VITE_GAS_URL
