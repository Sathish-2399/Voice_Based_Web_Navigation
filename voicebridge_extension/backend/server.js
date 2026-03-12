const express = require("express");
const cors = require("cors");

const natural = require("natural");

let classifier;

natural.BayesClassifier.load("model.json", null, function(err, loadedClassifier) {
    if (err) {
        console.log("Error loading model:", err);
    } else {
        classifier = loadedClassifier;
        console.log("NLP model loaded");
    }
});

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-type"],
  }),
);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("VoiceBridge Backend is running");
});

app.post("/process", (req, res) => {

  const userText = req.body.message.toLowerCase();

  console.log("User:", userText);

  const intent = classifier.classify(userText);

  console.log("Detected intent:", intent);

  if(intent === "NAVIGATE"){

      if(userText.includes("google")){
          return res.json({
              action:"NAVIGATE",
              page:"https://www.google.com"
          });
      }

      if(userText.includes("problem")){
          return res.json({
              action:"NAVIGATE",
              page:"https://leetcode.com/problemset/"
          });
      }

  }

  if(intent === "CLICK"){
      return res.json({
          action:"CLICK_BUTTON",
          selector:"button"
      });
  }

  if(intent === "FILL_FIELD"){
      return res.json({
          action:"FILL_FIELD",
          field:"name",
          value:"Sathish"
      });
  }

  res.json({action:"UNKNOWN"});

});

// app.post("/process", (req, res) => {
//   const userText = req.body.message.toLowerCase();

//   console.log("Received:", userText);

//   if (userText.includes("google")) {
//     return res.json({
//       action: "NAVIGATE",
//       page: "https://www.google.com",
//     });
//   }

//   if (userText.includes("problem") || userText.includes("பிராப்ளம்")) {
//     return res.json({
//       action: "NAVIGATE",
//       page: "https://leetcode.com/problemset/",
//     });
//   }

//   if (userText.includes("name")) {
//     return res.json({
//       action: "FILL_FIELD",
//       field: "name",
//       value: "Sathish",
//     });
//   }

//   if (userText.includes("click")) {
//     return res.json({
//       action: "CLICK_BUTTON",
//       selector: "button",
//     });
//   }

//   return res.json({ action: "UNKNOWN" });
// });

app.listen(5000, () => {
  console.log("🚀 Backend running on http://localhost:5000");
});
