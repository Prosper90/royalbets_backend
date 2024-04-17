require("dotenv").config();
const express = require("express");
// const transaction = require("./routes/transaction");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
// const Notification = require("./models/Notifications");
const Casino = require("./models/CasinoSchema");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.urlencoded({ extended: true }));

//parse application/json
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

app.get("/recent_plays", async (req, res, next) => {
  try {
    const findRecent = await Casino.find({}).sort({ createdAt: -1 }).limit(7);

    res
      .status(200)
      .json({ status: true, data: findRecent, message: "Welcome to the API" });
  } catch (error) {
    res.status(400).json({ status: false, message: "something went wrong" });
  }
});

app.post("/game_played", async (req, res, next) => {
  try {
    console.log(req.body, "interested");
    const {
      type,
      is_win,
      amount_played,
      payout,
      player,
      referral,
      chain,
      token,
      duplicate_id,
    } = req.body;

    const findDuplicate = await Casino.findOne({ duplicate_id: duplicate_id });
    if (findDuplicate) {
      return res
        .status(201)
        .json({ status: false, message: "duplaicate data" });
    }

    let playedGame = new Casino({
      type: type,
      is_Win: is_win,
      amount_played: amount_played,
      payout: payout,
      player: player,
      referral: referral,
      chain: chain,
      token: token,
    });
    playedGame = await playedGame.save();
    if (playedGame)
      return res.status(201).json({
        status: true,
        data: playedGame,
        message: "data entered successfully",
      });
  } catch (error) {
    console.log(error);
  }
});

//ini my database
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: "RoyalBet",
  })
  .then(() => {
    console.log("Database Connection is ready...");
  })
  .catch((err) => {
    console.log(err);
  });

server.listen(8000, function () {
  console.log(`App is Listening http://localhost:8000`);
});
