/* eslint-disable no-unused-vars */
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const app = express();
const querystring = require("querystring"); //for url
const cors = require("cors");
const cookieParser = require("cookie-parser");
app.use(cookieParser()); // express kann nun mit cookies umgehen
app.use(express.static(__dirname + "/public")); // serve static files in public
app.use(cors({ origin: "http://localhost:4200", credentials: true })); // enable cors
//-------------// später origin = domain //---------------//

const axios = require("axios"); // for easier api requests
//---------RANDOM STRING FOR STATE-------------------------------
const generateRandomString = function (length) {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};
//------------STATE KEY FOR COOKIE---------------------------
const stateKey = "spotify_auth";
//-----------ENV VARIABLES-----------------------------
const PORT = process.env.PORT;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

//------------LOG----------------------------
console.log(
  "Port: ",
  PORT,
  "client: ",
  CLIENT_ID,
  "secret: ",
  CLIENT_SECRET,
  "redirect: ",
  REDIRECT_URI
);
//----------PATHES---------------------------------
app.get("/", (req, res) => {
  res.send("This is my spotify API");
});
//--------------SPOTIFY LOGIN----------------------
app.get("/auth", (req, res) => {
  res.redirect(`http://localhost:${PORT}/login`);
});

app.get("/login", (req, res) => {
  let scope = "user-read-private user-read-email";
  let state = generateRandomString(16);
  res.cookie(stateKey, state);

  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: CLIENT_ID,
        scope: scope,
        redirect_uri: REDIRECT_URI,
        state: state,
      })
  );
  //->>> redirects to redirect_uri /callback -> erhalten code aus query param für token
});

//-----------CALLBACK FUNCTION TO GET ACCESS TOKEN AND DATA-----
app.get("/callback", (req, res) => {
  const code = req.query.code || null; // code für access token aus der neuen url
  //---------GET TOKEN-----------------
  axios({
    method: "POST",
    url: "https://accounts.spotify.com/api/token",
    data: querystring.stringify({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: REDIRECT_URI,
    }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
    },
  })
    .then((response) => {
      if (response.status == 200) {
        console.log(response.data);
        //------------GET SINGLE TOKENS-------
        const { access_token, refresh_token, expires_in } = response.data;
        const redirectUrl = "http://localhost:4200";

        res.cookie("access_token", access_token, {
          httpOnly: true,
          // secure: true, //  für lokale Entwicklung über HTTP
          maxAge: expires_in * 1000,
        });

        res.cookie("refresh_token", refresh_token, {
          httpOnly: true,
          // secure: true, // für lokale Entwicklung über HTTP
          maxAge: expires_in * 1000,
        });
        res.redirect(redirectUrl);
      } else res.send(response);
    })
    .catch((error) => res.send(error));
});

app.get("/user-profile", (req, res) => {
  const accessToken = req.cookies.access_token;
  if (!accessToken) {
    return res
      .status(401)
      .send("Zugriff verweigert: Kein Access Token gefunden.");
  }

  axios
    .get("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    .then((response) => {
      res.send(response.data);
    })
    .catch((error) => {
      res.status(500).send("Fehler bei der Anfrage an Spotify");
    });
});
app.listen(PORT, console.log(`APP GESTARTET AUF PORT ${PORT}`));
