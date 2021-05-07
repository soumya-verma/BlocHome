// "ejs": "^2.5.7",
// "express": "^4.15.4",
// "web3": "^1.3.5"

// var express = require("express");
var path = require("path");
// var Web3 = require("web3");

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
// const _ = require("lodash");
const bcrypt = require("bcryptjs");
const { check, validationResult } = require("express-validator");
var multer = require("multer");
var fs = require("fs");

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.set("view engine", "ejs");

app.use(express.static(path.join(__dirname, "public")));

const id = process.env.ID;
const pass = process.env.PASS;

// mongodb://localhost:27017

mongoose.connect(
  "mongodb+srv://" +
    id +
    ":" +
    pass +
    "@cluster0.81eob.mongodb.net/blochome?retryWrites=true&w=majority",
  { useNewUrlParser: true, useUnifiedTopology: true },
  (err) => {
    console.log("Database connected");
  }
);

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
});

User = mongoose.model("user", UserSchema);

const PropertySchema = new mongoose.Schema({
  owner: {
    type: String,
    required: true,
  },
  ownername: {
    type: String,
    required: true,
  },
  owneraddress: {
    type: String,
    required: true,
  },
  price: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  image: {
    data: Buffer,
    contentType: String,
  },
});

Property = mongoose.model("property", PropertySchema);

var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads");
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "-" + Date.now());
  },
});

var upload = multer({ storage: storage });

var currentUser = "";
var currentUserName = "";

// ******************************************************************************

app.get("/", function (req, res) {
  Property.find({}, function (err, founditems) {
    if (!err) {
      res.render("main", { items: founditems });
    } else {
      console.log(err);
    }
  });
});

app.get("/sell", function (req, res) {
  Property.find({ owner: currentUser }, function (err, founditems) {
    if (!err) {
      res.render("seller", {
        items: founditems,
      });
    } else {
      console.log(err);
    }
  });
});

app.get("/admin", function (req, res) {
  res.render("admin");
});

app.get("/signup", function (req, res) {
  res.render("signup");
});

app.get("/login", function (req, res) {
  if (currentUser == "") res.render("login");
  else res.render("logout", { user: currentUserName });
});

app.get("/search", function (req, res) {
  res.redirect("/");
});

app.post("/logout", function (req, res) {
  currentUser = "";
  currentUserName = "";
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email: email });

    // check if user exists
    if (!user) {
      return res.status(400).json({ errors: [{ msg: "Invalid Credentials" }] });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ errors: [{ msg: "Invalid Credentials" }] });
    }

    currentUser = email;
    User.findOne({ email: email }, function (err, founditem) {
      currentUserName = founditem.name;
    });

    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

app.post(
  "/signup",
  [
    check("name", "Enter a name").not().isEmpty(),
    check("email", "Enter a valid email").isEmail(),
    check("password", "Password should contain atleast 6 characters").isLength({
      min: 6,
    }),
    check("address", "Enter a valid address")
      .not()
      .isEmpty()
      .matches(/0[xX][0-9a-fA-F]+/),
  ],
  async (req, res) => {
    // check errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(req.body);
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, address } = req.body;

    try {
      let user = await User.findOne({ email: email });

      // check if user exists
      if (user) {
        return res
          .status(400)
          .json({ errors: [{ msg: "User already exists" }] });
      }
      user = new User({
        name: name,
        email: email,
        password: password,
        address: address,
      });

      // encrypt password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
      await user.save();
      res.redirect("/login");
    } catch (err) {
      console.log(err);
      res.status(500).send("Server Error");
    }
  }
);

app.post("/sell", upload.single("image"), async (req, res) => {
  const { price, location, owneraddress, image } = req.body;

  console.log(req.body);
  try {
    prop = new Property({
      owner: currentUser,
      ownername: currentUserName,
      price: price,
      location: location,
      owneraddress: owneraddress,
      image: {
        data: fs.readFileSync(
          path.join(__dirname + "/uploads/" + req.file.filename)
        ),
        contentType: "image/jpg",
      },
    });

    Property.create(prop, (err, item) => {
      if (err) {
        console.log(err);
      } else {
        // item.save();
        res.redirect("/sell");
      }
    });

    // await prop.save();
    // res.redirect("/sell");
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

app.post("/search", function (req, res) {
  var x = req.body.search;
  Property.find(
    {
      $or: [
        { ownername: new RegExp(".*" + x + "*.", "i") },
        { location: new RegExp(".*" + x + "*.", "i") },
      ],
    },
    function (err, founditems) {
      if (!err) {
        res.render("main", { items: founditems });
      } else {
        console.log(err);
      }
    }
  );
});

app.post("/remove", function (req, res) {
  var remprop = req.body.removeprop;
  Property.findOneAndDelete({ _id: remprop }, function (err) {
    if (!err) {
      console.log("Successfuly deleted list");
      res.redirect("/sell");
    }
  });
});

app.post("/buy", function (req, res) {
  var buyprop = req.body.buyprop;
  console.log("hello");
});

let port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Blockchain up at http://localhost:" + port);
});
