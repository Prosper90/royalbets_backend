const express = require("express");

const { requireAuth } = require("../utils/authmiddleware");
const router = express.Router();
const betController = require("../controllers/bet.controller");

router.post("/place_bet", requireAuth, betController.PlaceBet);

module.exports = router;
