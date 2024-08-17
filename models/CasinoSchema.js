require("dotenv").config();
const mongoose = require("mongoose");

const CasinoSchema = mongoose.Schema(
  {
    type: { type: String }, //the type of game played
    wallet: { type: String }, //type local and live
    is_Win: { type: Boolean },
    amount_played: { type: Number }, //contains *pending*, *failed* and *complete*
    payout: { type: Number },
    player: { type: String },
    referral: { type: String },
    chain: { type: String },
    token: { type: String },
    duplicate_id: { type: String },
  },
  { timestamps: true }
);

CasinoSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

CasinoSchema.set("toJSON", {
  virtuals: true,
});

module.exports = mongoose.model("Casino", CasinoSchema);
