/* eslint-disable no-unused-vars */

const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const app = express();
const querystring = require("querystring"); //for url
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { google } = require("googleapis");

//-----------------------
app.use(cookieParser()); // express kann nun mit cookies umgehen
app.use(express.static(__dirname + "/public")); // serve static files in public
app.use(cors({ origin: "https://spotibuddy.vercel.app", credentials: true })); // enable cors
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
//---------------VARIABLES-----------------------------
let tracks = [];
//-----------ENV VARIABLES-----------------------------
const PORT = process.env.PORT;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const YT_CLIENT_ID = process.env.YT_CLIENT_ID;
const YT_CLIENT_SECRET = process.env.YT_CLIENT_SECRET;
const YT_REDIRECT_URI = process.env.YT_REDIRECT_URI;

//----------PATHES---------------------------------
app.get("/", (req, res) => {
  res.send("This is my spotify API");
});
//--------------SPOTIFY LOGIN----------------------
app.get("/auth", (req, res) => {
  res.redirect(`https://spotibuddy.onrender.com/login`);
});

app.get("/login", (req, res) => {
  let scope =
    "user-read-private user-read-email playlist-read-private playlist-read-collaborative";
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
        const redirectUrl = "https://spotibuddy.vercel.app/playlist?log=1";

        res.cookie("access_token", access_token, {
          httpOnly: true,
          secure: true,
          maxAge: expires_in * 1000,
          sameSite: "None",
        });

        res.cookie("refresh_token", refresh_token, {
          httpOnly: true,
          secure: true,
          maxAge: expires_in * 1000,
          sameSite: "None",
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

app.get("/user-playlists", (req, res) => {
  const accessToken = req.cookies.access_token;
  if (!accessToken) {
    return res
      .status(401)
      .send("Zugriff verweigert: Kein Access Token gefunden.");
  }

  axios
    .get("https://api.spotify.com/v1/me/playlists?offset=0&limit=50", {
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

app.get("/load-more-playlists", (req, res) => {
  const offset = req.query.offset || 0;
  const accessToken = req.cookies.access_token;
  if (!accessToken) {
    return res
      .status(401)
      .send("Zugriff verweigert: Kein Access Token gefunden.");
  }

  axios
    .get(`https://api.spotify.com/v1/me/playlists?offset=${offset}&limit=50`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    .then((response) => {
      res.send(response.data);
    })
    .catch((error) => {
      res
        .status(500)
        .send(error.message || "Fehler bei der Anfrage an Spotify");
    });
});

app.get("/playlist-tracks", async (req, res) => {
  const id = req.query.id;
  const accessToken = req.cookies.access_token;
  let url = `https://api.spotify.com/v1/playlists/${id}/tracks`;
  tracks = [];
  try {
    while (url) {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      modifiedTracks = response.data.items.map((obj) => {
        return {
          id: obj.track.id,
          artists: obj.track.artists.map((artist) => {
            return artist.name;
          }),
          name: obj.track.name,
          duration: obj.track.duration_ms,
        };
      });

      tracks.push(...modifiedTracks);

      // Setzt die URL auf die nächste Seite, falls vorhanden
      url = response.data.next;
    }
    res.send(tracks);
  } catch (error) {
    res.status(500).send(error.message || "Fehler bei der Anfrage an Spotify");
  }
});

//--------------GOOGLE---------------

const oauth2Client = new google.auth.OAuth2(
  YT_CLIENT_ID,
  YT_CLIENT_SECRET,
  YT_REDIRECT_URI
);

const scopes = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtubepartner",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

const googleURL = oauth2Client.generateAuthUrl({
  // 'online' (default) or 'offline' (gets refresh_token)
  access_type: "offline",
  scope: scopes,
});

app.get("/google-auth", (req, res) => {
  res.redirect(googleURL);
});

app.get("/google/callback", async (req, res) => {
  //Limit für Suchanfragen( wg. Kontingente)
  let queryLimit = 20;
  let queryCount = 0;
  try {
    const code = req.query.code;

    // Tokens erhalten und setzen
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // YouTube API Client initialisieren
    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });

    // Playlist erstellen
    const playlist = await youtube.playlists.insert({
      part: "snippet,status",
      requestBody: {
        snippet: {
          title: "spotify-converter" + " " + generateRandomString(10),
          description: "konvertierte Playlist von Spotify-Converter",
        },
        status: {
          privacyStatus: "private", // Kann 'public', 'private' oder 'unlisted' sein
        },
      },
    });

    //suchen von Tracks auf youtube -> ID
    for (let i = 0; i < tracks.length && queryCount <= queryLimit; i++) {
      const search = tracks[i].name + " " + tracks[i].artists[0];

      const searchResponse = await youtube.search.list({
        part: "snippet",
        q: search,
        maxResults: 1,
      });

      if (searchResponse.data.items.length > 0) {
        const videoId = searchResponse.data.items[0].id.videoId;

        // Video zur Playlist hinzufügen
        await youtube.playlistItems.insert({
          part: "snippet",
          requestBody: {
            snippet: {
              playlistId: playlist.data.id,
              resourceId: {
                kind: "youtube#video",
                videoId: videoId,
              },
            },
          },
        });
      }
      queryCount++;
    }

    res.redirect("https://spotibuddy.vercel.app/playlist/confirm");
  } catch (error) {
    // Fehlerbehandlung
    console.error("Fehler beim Erstellen der Playlist:", error);
    res.status(500).send("Fehler beim Erstellen der Playlist");
  }
});

app.listen(PORT, console.log(`APP GESTARTET AUF PORT ${PORT}`));
