const { isValidEVMAddress, isValidTronAddress } = require("../utils/constants");
const { makecall } = require("../utils/makeRequest");
const WAValidator = require("multicoin-address-validator"); // You'll need to install this package

const GamePlays = require("../models/GamePlay");
const User = require("../models/User");

exports.VerifyAddress = async (req, res, next) => {
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
};

exports.RecentPlaysWin = async (req, res) => {
  try {
    const findRecentWin = await GamePlays.find({ is_Win: true })
      .sort({ createdAt: -1 })
      .limit(7);

    res.status(200).json({
      status: true,
      data: findRecentWin,
    });
  } catch (error) {
    res.status(400).json({ status: false, message: "something went wrong" });
  }
};

exports.RecentPlay = async (req, res) => {
  try {
    const findRecent = await GamePlays.find({}).sort({ createdAt: -1 });

    res.status(200).json({ status: true, data: findRecent });
  } catch (error) {
    res.status(400).json({ status: false, message: "something went wrong" });
  }
};

exports.Leaderboard = async (req, res) => {
  try {
    const leaderboard = await GamePlays.aggregate([
      // {
      //   $match: {
      //     is_Win: true, // Only consider winning games
      //   },
      // },
      {
        $addFields: {
          convertedPayout: {
            $cond: {
              if: { $eq: ["$chain", "wallet"] },
              then: "$payout",
              else: { $multiply: ["$payout", "$token_price_convt"] },
            },
          },
          convertedAmountPlayed: {
            $cond: {
              if: { $eq: ["$chain", "wallet"] },
              then: "$amount_played",
              else: { $multiply: ["$amount_played", "$token_price_convt"] },
            },
          },
        },
      },
      {
        $group: {
          _id: "$player",
          totalWinnings: { $sum: "$convertedPayout" },
          totalAmountPlayed: { $sum: "$convertedAmountPlayed" },
          gamesPlayed: { $sum: 1 },
        },
      },
      {
        $project: {
          player: "$_id",
          totalWinnings: 1,
          totalAmountPlayed: 1,
          gamesPlayed: 1,
          _id: 0,
        },
      },
      {
        $sort: { totalWinnings: 1 },
      },
      {
        $limit: 6,
      },
    ]);

    res.status(200).json({
      status: true,
      data: leaderboard,
      message: "Leaderboard retrieved successfully",
    });
  } catch (error) {
    res.status(400).json({ status: false, message: "something went wrong" });
  }
};

exports.CheckUserAddress = async (req, res) => {
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
};

exports.CheckUsername = async (req, res) => {
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
};

exports.EnterGamePlayed = async (req, res) => {
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
      token_price_convt,
      duplicate_id,
    } = req.body;

    // console.log(req.body, "check 1");

    const findDuplicate = await GamePlays.findOne({
      duplicate_id: duplicate_id,
    });
    if (findDuplicate) {
      return res
        .status(201)
        .json({ status: false, message: "duplaicate data" });
    }
    // console.log("check 2");

    let playedGame = new GamePlays({
      type: type,
      wallet: wallet,
      is_Win: is_win,
      amount_played: amount_played,
      payout: payout,
      player: player,
      referral: referral,
      chain: chain,
      token: token,
      token_price_convt: token_price_convt,
      duplicate_id: duplicate_id,
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
};
