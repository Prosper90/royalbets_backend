require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
const Casino = require("./models/CasinoSchema");
const http = require("http");
const { requireAuth } = require("./utils/authmiddleware");
const Transaction = require("./models/Transaction");
const User = require("./models/User");
const jwt = require("jsonwebtoken");
const CoinpaymentsIPNError = require("coinpayments-ipn/lib/error");
const { verify } = require("coinpayments-ipn");

const { ethers, parseUnits } = require("ethers");

// Simulate blockchain network and wallet
const provider = new ethers.JsonRpcProvider(process.env.PROVIDER); // Replace with your provider
const wallet = new ethers.Wallet(process.env.PRIVATEKEY, provider);

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

//check registered username
app.get("/check_username/:username", async (req, res) => {
  try {
    const { username } = req.params;
    // Check if user exists
    let user = await User.findOne({ username: username.toLowerCase() });
    if (user) {
      return res.status(401).json({ status: false, data: false });
    }

    res.status(200).json({ status: true, data: true });
  } catch (error) {
    console.log(error, "catching thingses");
    res.status(400).json({ status: false, message: "something went wrong" });
  }
});

//check if user has registered
app.get("/check_user/:address", async (req, res) => {
  try {
    const { address } = req.params;
    // Check if user exists
    let user = await User.findOne({ address: address.toLowerCase() });
    if (!user) {
      return res.status(401).json({ status: false, data: false });
    }

    res.status(200).json({ status: true, data: true });
  } catch (error) {
    res.status(400).json({ status: false, message: "something went wrong" });
  }
});

app.get("/recent_plays", async (req, res) => {
  try {
    const findRecent = await Casino.find({}).sort({ createdAt: -1 }).limit(7);

    res
      .status(200)
      .json({ status: true, data: findRecent, message: "Welcome to the API" });
  } catch (error) {
    res.status(400).json({ status: false, message: "something went wrong" });
  }
});

app.post("/game_played", async (req, res) => {
  try {
    const {
      type,
      wallet,
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
      wallet: wallet,
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

//connect like login give them jwt session
app.post("/account_signin_signup", async (req, res) => {
  try {
    const { address, username } = req.body;

    if (!address) {
      return res.status(400).json({ error: "Missing required field" });
    }

    // Check if user exists
    let user = await User.findOne({ address: address.toLowerCase() });

    if (!user) {
      // Create new user if not found
      user = new User({
        address: address.toLowerCase(),
        username: username,
        balance: 0, // Set initial balance
      });
      await user.save();
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id, address: user.address },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      message: user.username
        ? "User signed in successfully"
        : "New user created successfully",
      token,
      user: {
        username: user.username,
        balance: user.balance,
      },
    });
  } catch (error) {
    console.error("Error in account_signin_signup:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//verify address
app.get(
  "/verify_address/:address/:chain/:asset",
  requireAuth,
  async (req, res, next) => {
    try {
      const { address, chain, asset } = req.params;

      if (!address || !chain) {
        return res
          .status(400)
          .json({ error: "Address and chain type are required" });
      }

      let isValid = false;
      let message = "";

      switch (chain.toLowerCase()) {
        case "btc":
          isValid = WAValidator.validate(address, "BTC");
          message = isValid ? "Valid BTC address" : "Invalid BTC address";
          break;

        case "sol":
          isValid = WAValidator.validate(address, "SOL");
          message = isValid ? "Valid SOL address" : "Invalid SOL address";
          break;

        case "evm":
          isValid = isValidEVMAddress(address);
          message = isValid ? "Valid EVM address" : "Invalid EVM address";
          break;

        case "tron":
          isValid = isValidTronAddress(address);
          message = isValid ? "Valid TRON address" : "Invalid TRON address";
          break;

        default:
          return res.status(400).json({ error: "Unsupported chain type" });
      }

      if (!isValid) {
        return res
          .status(401)
          .json({ status: false, message: "Address not correct" });
      }

      const apiUrl = `https://min-api.cryptocompare.com/data/price?fsym=${asset}&tsyms=USD`;
      const headers = {
        "Content-Type": "application/json",
      };
      const response = await makecall(apiUrl, {}, headers, "get", next);

      if (response.Response === "Error") {
        throw new Error(response.Message);
      }

      const data = response.USD;

      res.status(200).json({ status: true, data: isValid, price: data });
    } catch (error) {
      console.error("Error in verify_address route:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

//deposit
app.post("/deposit", requireAuth, async (req, res) => {
  try {
    const { asset, current_price } = req.body;
    if (!asset) {
      return res
        .status(401)
        .json({ status: false, message: "asset body is required" });
    }
    const getAddress = await generateDepositAddressCoinPayment(asset);

    const tx = await new Transaction({
      txtype: "deposit",
      asset: asset,
      amount: 0,
      current_price: current_price,
      status: "pending",
      address_from: "",
      address_to: getAddress?.address,
      owner: req.user._id,
    });

    await tx.save();

    res
      .status(200)
      .json({ status: true, type: asset, address: getAddress?.address });
  } catch (error) {
    console.log(error, "in error");
    res.status(500).json({ status: false, message: "500 error" });
  }
});

//withdraw
app.post("/withdraw", requireAuth, async (req, res) => {
  try {
    const { asset, address, amount, convert_price } = req.body;
    if (!asset || !address || amount) {
      return res
        .status(401)
        .json({ status: false, message: "req body is required" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res
        .status(401)
        .json({ status: false, message: "Account doesnt exist" });
    }

    if (amount * convert_price > user.balance) {
      return res
        .status(401)
        .json({ status: false, message: "Insufficient funds" });
    }

    await TransferCryptoCoinPayment(asset, address, amount);

    const tx = await new Transaction({
      txtype: "withdrawal",
      asset: asset,
      amount: amount,
      current_price: convert_price,
      status: "pending",
      address_from: "",
      address_to: address,
      owner: req.user._id,
    });

    await tx.save();

    res.status(200).json({ status: true, message: "withdrawal successfull" });
  } catch (error) {
    res.status(500).json({ status: false, message: "500 error" });
  }
});

//Play games
app.post("/place_bet", requireAuth, async (req, res) => {
  try {
    const { gameType, selection, payout, referral, betAmount, feeReceiver } =
      req.body;
    let user = req.user; // Assuming requireAuth middleware attaches user to req

    const safeBetAmount = safeRound(betAmount);
    const minimumBetAmount = safeRound(minimumBet);

    if (safeBetAmount < minimumBetAmount) {
      return res
        .status(400)
        .json({ status: false, message: "Bet amount is below the minimum" });
    }

    if (user.balance < safeBetAmount) {
      return res
        .status(400)
        .json({ status: false, message: "Insufficient balance" });
    }

    // Deduct bet amount from user's balance
    user.balance = safeRound(parseFloat(user.balance) - safeBetAmount);
    await user.save();

    // user = await User.findOneAndUpdate(
    //   { _id: req.user._id },
    //   { $inc: { balance: -(safeBetAmount * 100) } },
    //   { new: true }
    // );
    const houseCharge = safeRound(
      (safeBetAmount * houseChargePercentage) / 100
    );

    // Simulate VRF by generating a random number
    const randomNumber = getRandomNumber(100);

    let win = false;
    switch (gameType) {
      case "dice":
        win = selection === (randomNumber % 6) + 1;
        break;
      case "flip":
        win = selection === randomNumber % 2;
        break;
      case "slot":
        win = selection === randomNumber % 3;
        break;
      default:
        return res
          .status(400)
          .json({ status: false, message: "Invalid game type" });
    }

    let amountWon = 0;
    if (win) {
      const referralCommission = safeRound(
        (payout * referralCommissionPercentage) / 100
      );
      const feeReceiverAmount = safeRound(
        (payout * feeReceiverPercentage) / 100
      );
      amountWon = safeRound(payout - feeReceiverAmount - referralCommission);

      // Simulate transfers
      if (referral !== "0x0000000000000000000000000000000000000000") {
        // Implement your transfer logic here
        console.log(
          `Transferring ${referralCommission} to referral: ${referral}`
        );

        const valTr = safeToBigInt(referralCommission);
        await wallet.sendTransaction({
          to: referral,
          value: valTr,
        });
      }
      if (feeReceiver !== "0x0000000000000000000000000000000000000000") {
        // Implement your transfer logic here
        console.log(
          `Transferring ${feeReceiverAmount} to feeReceiver: ${feeReceiver}`
        );
        const valTr = safeToBigInt(feeReceiverAmount);

        await wallet.sendTransaction({
          to: feeReceiver,
          value: valTr,
        });
      }
      // Transfer to house (fee taker)
      console.log(`Transferring ${houseCharge} to house`);

      // Update user's balance with winnings
      const updateBalance = safeRound(user.balance) + amountWon;
      console.log(updateBalance, "checking update balanced");
      // user.balance = updateBalance;
      // await user.save();
      // user = await User.findOneAndUpdate(
      //   { _id: req.user._id },
      //   { $inc: { balance: updateBalance * 100 } },
      //   { new: true }
      // );
      user.balance = updateBalance;
      await user.save();
    } else {
      const feeAmount = safeRound(
        (safeBetAmount * feeReceiverPercentage) / 100
      );
      if (feeReceiver) {
        // Implement your transfer logic here
        console.log(`Transferring ${feeAmount} to feeReceiver: ${feeReceiver}`);
      }
    }

    // console.log(
    //   "amountwon",
    //   amountWon,
    //   "amount played",
    //   betAmount,
    //   "payout",
    //   payout,
    //   "balance",
    //   user.balance,
    //   "type of balance",
    //   typeof user.balance,
    //   "calc",
    //   safeRound(parseFloat(user.balance) + amountWon)
    // );
    res.status(200).json({
      status: true,
      win,
      user: {
        username: user.username,
        balance: user.balance,
      },
    });
  } catch (error) {
    console.error("Error in place-bet route:", error);

    // Attempt to refund user
    try {
      const user = req.user;
      const refundAmount = safeRound(req.body.betAmount);
      user.balance = safeRound(user.balance + refundAmount);
      await user.save();
      console.log(`Refunded ${refundAmount} to user ${user.id}`);
    } catch (refundError) {
      console.error("Error while attempting refund:", refundError);
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

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

      console.log(pendingDeposit, "checking the pending deposit");

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
      const amountToRecieveInDollars =
        req.body.fiat_amount * pendingDeposit.current_price;

      console.log(amountToRecieveInDollars, "Amount to recieve in dollars");

      // update transaction and transfer funds to the required user
      await Transaction.findOneAndUpdate(
        { _id: pendingDeposit._id },
        { $set: { status: "success", amount: amountToRecieveInDollars } },
        { new: true }
      );

      //credit user
      // await User.findOneAndUpdate(
      //   { _id: pendingDeposit.owner },
      //   {
      //     $inc: { balance: amountToRecieveInDollars }, // increment the balance
      //   },
      //   { new: true }
      // );

      let user = await User.findById({ _id: pendingDeposit.owner });

      console.log(user, "user checking if its correct");
      const updateBalance = safeRound(user.balance) + amountToRecieveInDollars;
      // console.log(updateBalance, "checking update balanced");
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

      console.log(pendingWithdrawal, "checking for pending withdrawal");
      if (pendingWithdrawal && req.body.status !== 100) {
        throw new Error("Deposit not complete");
      }

      //Convert amount to Dollar
      const amountToDeductInDollars =
        req.body.fiat_amount * pendingWithdrawal.current_price;

      console.log(amountToDeductInDollars, "amount to deduct");
      // update transaction and transfer funds to the required user
      await Transaction.findOneAndUpdate(
        { _id: pendingWithdrawal._id },
        { $set: { status: "success", amount: amountToDeductInDollars } },
        { new: true }
      );

      //credit user
      // await User.findOneAndUpdate(
      //   { _id: pendingWithdrawal.owner },
      //   {
      //     $inc: { balance: amountToDeductInDollars }, // increment the balance
      //   },
      //   { new: true }
      // );
      let user = await User.findById({ _id: pendingDeposit.owner });

      console.log(user, "checking if the user is correct");
      const updateBalance = safeRound(
        parseFloat(user.balance) - amountToDeductInDollars
      );
      // console.log(updateBalance, "checking update balanced");
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
