const {
  getRandomNumber,
  safeRound,
  safeToBigInt,
  minimumBet,
  houseChargePercentage,
  referralCommissionPercentage,
  feeReceiverPercentage,
} = require("../utils/constants");

const { ethers, parseUnits } = require("ethers");

// Simulate blockchain network and wallet
const provider = new ethers.JsonRpcProvider(process.env.PROVIDER); // Replace with your provider
const wallet = new ethers.Wallet(process.env.PRIVATEKEY, provider);

exports.PlaceBet = async (req, res) => {
  try {
    const { gameType, selection, referral, betAmount, feeReceiver } = req.body;
    let user = req.user; // Assuming requireAuth middleware attaches user to req
    let payout;

    const safeBetAmount = parseFloat(betAmount);
    const minimumBetAmount = minimumBet;
    if (safeBetAmount < minimumBetAmount) {
      return res
        .status(400)
        .json({ status: false, message: "Bet amount is below the minimum" });
    }

    if (user.balance < safeBetAmount || user.balance === 0) {
      return res
        .status(400)
        .json({ status: false, message: "Insufficient balance" });
    }

    const houseCharge = (safeBetAmount * houseChargePercentage) / 100;

    user.balance = parseFloat(user.balance) - (safeBetAmount + houseCharge);
    await user.save();

    // Simulate VRF by generating a random number
    const randomNumber = getRandomNumber(100);

    let win = false;
    switch (gameType) {
      case "dice":
        win = randomNumber < selection;
        const multiplier = 98 / (selection - 1);
        payout = betAmount * multiplier;
        break;
      case "flip":
        win = selection === randomNumber % 2;
        payout = betAmount * 2;
        break;
      case "slot":
        win = selection === randomNumber % 3;
        payout = betAmount * 3;
        break;
      case "rockPaperScissors": {
        const options = ["rock", "paper", "scissors"];
        const randomChoice =
          options[Math.floor(Math.random() * options.length)];

        // Determine the game result: win, lose, or tie
        if (selection === randomChoice) {
          win = null; // It's a tie
        } else if (
          (selection === "rock" && randomChoice === "scissors") ||
          (selection === "scissors" && randomChoice === "paper") ||
          (selection === "paper" && randomChoice === "rock")
        ) {
          win = true; // User wins
          payout = betAmount * 2; // Example payout for winning, can adjust as needed
        } else {
          win = false; // User loses
        }

        // If the result is a tie, refund the bet amount
        if (win === null) {
          user.balance += safeBetAmount;
          await user.save();
          return res.status(200).json({
            status: true,
            result: randomChoice,
            win: null,
            message: "It's a tie!",
            user: {
              username: user.username,
              balance: user.balance,
            },
          });
        }

        break;
      }
      case "dicetwo":
        // Simulate the winning and losing logic for dicetwo
        const winProbability = 50; // Retrieve from the game settings
        const randomFraction = randomNumber / 100; // Simulating a fraction between 0 and 1

        let result;
        if (randomFraction < winProbability) {
          result = selection; // User wins if the random fraction is less than winProbability
        } else {
          // Select a random number between 1 and 6 that is not the user's choice
          do {
            result = Math.floor(Math.random() * 6) + 1;
          } while (result === selection);
        }

        win = result === selection;
        payout = win ? betAmount * 6 : 0; // User wins 6x the bet amount if they win
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
      // Transfer to house (fee taker)
      amountWon =
        payout -
        safeRound(feeReceiverAmount - referralCommission) -
        houseCharge;

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

      // Update user's balance with winnings
      const updateBalance = parseFloat(user.balance) + amountWon;
      user.balance = updateBalance;
      await user.save();
    } else {
      payout = 0;
      const feeAmount = safeRound(
        (safeBetAmount * feeReceiverPercentage) / 100
      );
      if (feeReceiver) {
        // Implement your transfer logic here
        console.log(`Transferring ${feeAmount} to feeReceiver: ${feeReceiver}`);
      }
    }

    res.status(200).json({
      status: true,
      win,
      payout,
      user: {
        username: user.username,
        balance: user.balance,
      },
    });
  } catch (error) {
    console.error("Error in place-bet route:", error);

    // Attempt to refund user
    let user;
    try {
      user = req.user;
      const refundAmount = req.body.betAmount;
      user.balance = user.balance + refundAmount;
      await user.save();
    } catch (refundError) {
      console.error("Error while attempting refund:", refundError);
    }

    res.status(500).json({
      status: false,
      user: {
        username: user.username,
        balance: user.balance,
      },
      message: "Internal server error",
    });
  }
};
