require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const auth = require("./routes/auth");
const bet = require("./routes/bet");
const info = require("./routes/info");
const walletsroute = require("./routes/wallet");

const Transaction = require("./models/Transaction");
const User = require("./models/User");
const CoinpaymentsIPNError = require("coinpayments-ipn/lib/error");
const { verify } = require("coinpayments-ipn");

const { ethers, parseUnits } = require("ethers");

// Simulate blockchain network and wallet
const provider = new ethers.JsonRpcProvider(process.env.PROVIDER); // Replace with your provider
// const wallet = new ethers.Wallet(process.env.PRIVATEKEY, provider);

const {
  generateDepositAddressCoinPayment,
  TransferCryptoCoinPayment,
  isValidEVMAddress,
  isValidTronAddress,
  minimumBet,
  houseChargePercentage,
  referralCommissionPercentage,
  feeReceiverPercentage,
  getRandomNumber,
  safeRound,
  safeToBigInt,
} = require("./utils/constants");
const WAValidator = require("multicoin-address-validator"); // You'll need to install this package
const { makecall } = require("./utils/makeRequest");
const { throws } = require("assert");

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

app.use("/auth", auth);
app.use("/bet", bet);
app.use("/info", info);
app.use("/info", info);
app.use("/info", info);
app.use("/info", info);
app.use("/info", info);
app.use("/info", info);
app.use("/info", info);
app.use("/wallet", walletsroute);
app.use("/wallet", walletsroute);

//Webhook
app.post("/handle_webhook", async (req, res) => {
  try {
    if (
      !req.get(`HMAC`) ||
      !req.body ||
      !req.body.ipn_mode ||
      req.body.ipn_mode !== `hmac` ||
      process.env.COINPAYMENT_API_MERCHANT_ID !== req.body.merchant
    ) {
      throw new Error(`Invalid request`);
    }

    console.log(req.body, "I am checking if I recieved the wehook");
    let isValid;

    try {
      isValid = verify(
        req.get(`HMAC`),
        process.env.COINPAYMENT_API__IPN_SECRET,
        req.body
      );
    } catch (verifyError) {
      if (verifyError instanceof CoinpaymentsIPNError) {
        throw new Error(`IPN Verification failed: ${verifyError.message}`);
      }
      throw verifyError; // Re-throw if it's not a CoinpaymentsIPNError
    }

    let message;
    if (req.body.ipn_type === "deposit") {
      const pendingDeposit = await Transaction.findOne({
        txtype: "deposit",
        address_to: req.body.address,
      });

      // console.log(pendingDeposit, "checking the pending deposit");

      if (pendingDeposit && req.body.status !== "100") {
        throw new Error("This deposit has not been completed");
      }

      if (
        req.body.status === "100" &&
        pendingDeposit.status === "success" &&
        pendingDeposit.address_to === req.body.address
      ) {
        throw new Error("This deposit has already been completed");
      }

      //Convert amount to Dollar
      const amountToRecieveInDollars = req.body.fiat_amount;

      // console.log(amountToRecieveInDollars, "Amount to recieve in dollars");

      // update transaction and transfer funds to the required user
      await Transaction.findOneAndUpdate(
        { _id: pendingDeposit._id },
        { $set: { status: "success", amount: amountToRecieveInDollars } },
        { new: true }
      );

      let user = await User.findById({ _id: pendingDeposit.owner });

      const updateBalance = safeRound(user.balance) + amountToRecieveInDollars;
      user.balance = updateBalance;
      await user.save();

      io.emit(`DepositSuccess${pendingDeposit.address_to}`, {
        status: "success",
        userBalance: user.balance,
      });
      message = "Crypto deposit caught and updated";
    } else if (req.body.ipn_type === "withdrawal") {
      const pendingWithdrawal = await Transaction.findOne({
        txtype: "withdraw",
        address_to: req.body.address,
      });

      if (pendingWithdrawal && req.body.status !== 100) {
        throw new Error("withdrawal not complete");
      }

      //Convert amount to Dollar
      const amountToDeductInDollars = req.body.fiat_amount;

      // update transaction and transfer funds to the required user
      await Transaction.findOneAndUpdate(
        { _id: pendingWithdrawal._id },
        { $set: { status: "success", amount: amountToDeductInDollars } },
        { new: true }
      );

      let user = await User.findById({ _id: pendingDeposit.owner });

      const updateBalance = safeRound(
        parseFloat(user.balance) - amountToDeductInDollars
      );
      user.balance = updateBalance;
      await user.save();

      io.emit(`WithdrawalSuccess${pendingWithdrawal.address_to}`, {
        status: "success",
        userBalance: user.balance,
      });
      message = "Crypto Withdrawal caught and updated";
    }

    res.status(200).json({
      status: true,
      message: message,
    });
  } catch (error) {
    console.log(error, "error in, error out");
    res.status(500).json({ error: "Internal server error jjsks" });
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
