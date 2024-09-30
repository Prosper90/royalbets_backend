const User = require("../models/User");
const jwt = require("jsonwebtoken");

exports.Authsign = async (req, res) => {
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
};
