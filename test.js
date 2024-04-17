const bcrypt = require("bcrypt");


(async function() {
  console.log("opening")
  const salt = await bcrypt.genSalt();
  const hashedpassword = await bcrypt.hash('11111111', salt);
  console.log(hashedpassword);
})();

