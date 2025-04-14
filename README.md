
# appyChap Backend

En enkel Express-backend som tar emot kontaktformulär och skickar mejl via Nodemailer och Gmail SMTP.

## Miljövariabler

Skapa en `.env`-fil med följande innehåll (se `.env.example`):

```
EMAIL_USER=dinadress@gmail.com
EMAIL_PASS=ditt_applösenord
```

## Starta lokalt

```bash
npm install
npm start
```

## Deploy till Railway

1. Skapa ett nytt projekt på https://railway.app
2. Ladda upp alla filer
3. Lägg till miljövariablerna i Railway's gränssnitt
4. Kör!

Frontend skickar `POST` till `/contact` med `name`, `email`, `message` som JSON.
# appybackend
