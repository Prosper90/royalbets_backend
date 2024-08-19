const crypto = require("crypto");
const { ethers } = require("ethers");
const Coinpayments = require("coinpayments");

const generateDepositAddressCoinPayment = async (asset) => {
  const coinpaymentsCredentials = {
    key: process.env.COINPAYMENT_API_KEY,
    secret: process.env.COINPAYMENT_API_SECRET,
  };
  const client = new Coinpayments(coinpaymentsCredentials);

  const coinpaymentsCreateTransactionOpts = {
    currency: asset,
    label: "",
  };
  const response = await client.getCallbackAddress(
    coinpaymentsCreateTransactionOpts
  );
  // console.log(response, 'omo me eeeeeeh');

  if (!response) {
    throw new Error("Failed to generate address");
  }

  return response;
};

const TransferCryptoCoinPayment = async (asset, address_to, amount) => {
  const coinpaymentsCredentials = {
    key: process.env.COINPAYMENT_API_KEY,
    secret: process.env.COINPAYMENT_API_SECRET,
  };
  const client = new Coinpayments(coinpaymentsCredentials);

  const options = {
    amount: amount,
    address: address_to,
    add_tx_fee: true,
    currency: asset,
    currency2: "USD",
    auto_confirm: 1,
  };

  const response = await client.createWithdrawal(options);

  return response;
};

// Helper function to validate EVM addresses
const isValidEVMAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Helper function to validate Tron addresses
const isValidTronAddress = (address) => {
  return /^T[A-Za-z1-9]{33}$/.test(address);
};

// Constants
const minimumBet = 0.2;
const houseChargePercentage = 2;
const referralCommissionPercentage = 2;
const feeReceiverPercentage = 2;

// Helper function to generate random number
const getRandomNumber = (max) => {
  return crypto.randomInt(0, max);
};

// Helper function to safely convert and round numbers
const safeRound = (number) => Math.round(Number(number));

const safeToBigInt = (number, decimals = 18) => {
  try {
    // Convert the number to a string with fixed decimal places
    const numberString = Number(number).toFixed(decimals);

    // Use ethers.utils.parseUnits to convert to BigInt with proper decimal handling
    return ethers.utils.parseUnits(numberString, decimals);
  } catch (error) {
    console.error("Error converting to BigInt:", error);
    return BigInt(0); // Return 0 as BigInt if conversion fails
  }
};

module.exports = {
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
};
