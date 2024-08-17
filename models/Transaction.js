require("dotenv").config();
const mongoose = require("mongoose");

const TransactionSchema = mongoose.Schema(
  {
    txtype: { type: String }, //the type of game played
    asset: { type: String },
    amount: { type: Number },
    current_price: { type: Number },
    status: { type: String }, //contains *pending*, *failed* and *complete*
    address_from: { type: String },
    address_to: { type: String },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

TransactionSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

TransactionSchema.set("toJSON", {
  virtuals: true,
});

module.exports = mongoose.model("Transaction", TransactionSchema);
