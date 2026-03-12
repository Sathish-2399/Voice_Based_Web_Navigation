const natural = require("natural");
const fs = require("fs");

const classifier = new natural.BayesClassifier();

// Navigation commands
classifier.addDocument("open google", "NAVIGATE");
classifier.addDocument("go to google", "NAVIGATE");
classifier.addDocument("navigate to google", "NAVIGATE");
classifier.addDocument("show google page", "NAVIGATE");

classifier.addDocument("open problems", "NAVIGATE");
classifier.addDocument("go to problems", "NAVIGATE");
classifier.addDocument("show problems page", "NAVIGATE");

// Click commands
classifier.addDocument("click login", "CLICK");
classifier.addDocument("press login button", "CLICK");
classifier.addDocument("click submit", "CLICK");

// Form filling commands
classifier.addDocument("enter name", "FILL_FIELD");
classifier.addDocument("fill name field", "FILL_FIELD");
classifier.addDocument("type name", "FILL_FIELD");

// Train the classifier
classifier.train();

// Save trained model
classifier.save("model.json", function(err, classifier) {
    if (err) {
        console.log("Error saving model:", err);
    } else {
        console.log("Model trained and saved as model.json");
    }
});