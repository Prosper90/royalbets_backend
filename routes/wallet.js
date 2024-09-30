const { requireAuth } = require("../utils/authmiddleware");

const express = require("express");
const router = express.Router();
const walletController = require("../controllers/wallet.controller");

router.post("/deposit", requireAuth, walletController.Deposit);
router.post("/withdraw", requireAuth, walletController.Withdrawal);

module.exports = router;
