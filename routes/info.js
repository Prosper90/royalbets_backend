const { requireAuth } = require("../utils/authmiddleware");

const express = require("express");
const router = express.Router();
const infoController = require("../controllers/info.controller");

//checks
router.get(
  "/verify_address/:address/:chain/:asset",
  requireAuth,
  infoController.VerifyAddress
);

router.get("/check_user/:address", infoController.CheckUserAddress);
router.get("/check_username/:username", infoController.CheckUsername);

//get game data
router.get("/recent_plays_win", infoController.RecentPlaysWin);
router.get("/leader_board", infoController.Leaderboard);
router.get("/recent_plays", infoController.RecentPlay);

//add game play data
router.post("/game_played", requireAuth, infoController.EnterGamePlayed);

module.exports = router;
