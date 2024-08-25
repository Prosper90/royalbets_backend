require("dotenv").config();
const mongoose = require("mongoose");

const RecentSchema = mongoose.Schema(
  {
    type: { type: String }, //the type of game played
    wallet: { type: String }, //type local and live
    is_Win: { type: Boolean },
    amount_played: { type: Number }, //contains *pending*, *failed* and *complete*
    payout: { type: Number },
    player: { type: String },
    referral: { type: String },
    chain: { type: String },
    duplicate_id: { type: String },
  },
  { timestamps: true }
);

RecentSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

RecentSchema.set("toJSON", {
  virtuals: true,
});

module.exports = mongoose.model("Recent", RecentSchema);
