require("dotenv").config();
const mongoose = require("mongoose");

const UserSchema = mongoose.Schema(
  {
    username: { type: String }, //the type of game played
    balance: {
      type: Number,
      get: (v) => (v / 100).toFixed(2),
      set: (v) => v * 100,
    },
    address: { type: String }, //contains *pending*, *failed* and *complete*
  },
  { timestamps: true }
);

UserSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

UserSchema.set("toJSON", {
  virtuals: true,
});

module.exports = mongoose.model("User", UserSchema);
