const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { generateDepositAddressCoinPayment } = require("../utils/constants");

//deposit
exports.Deposit = async (req, res) => {
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
};

//withdraw
exports.Withdrawal = async (req, res) => {
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
};
