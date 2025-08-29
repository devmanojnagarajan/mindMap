const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');

const app = express();
const port = 3000;

app.use(bodyParser.json());

// TODO: Replace with your Google API credentials
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID';
const GOOGLE_CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const GOOGLE_REDIRECT_URL = 'http://localhost:3000/oauth2callback';

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URL
);

app.get('/auth', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });

  res.redirect(url);
});

app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // TODO: Store the tokens in a session or database

    res.redirect('/');
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.status(500).send('Error getting tokens');
  }
});

app.post('/save', async (req, res) => {
  // TODO: Implement Google Drive save logic
  setTimeout(() => {
    res.status(200).send({ message: 'File saved successfully!' });
  }, 1500);
});

app.get('/load', async (req, res) => {
  // TODO: Implement Google Drive load logic
  setTimeout(() => {
    res.status(200).send({ mapData: { nodes: [], connections: [] } });
  }, 1500);
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
