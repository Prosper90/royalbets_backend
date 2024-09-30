const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

router.post("/account_signin_signup", authController.Authsign);

module.exports = router;
