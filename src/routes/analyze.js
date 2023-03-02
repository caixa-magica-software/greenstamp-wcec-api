const axios = require('axios')
const router = require('express').Router()
const multer = require('multer')
const { exec } = require("child_process");
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    fs.mkdirSync('/data/uploads', { recursive: true })
    cb(null, '/data/uploads')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
const upload = multer({storage: storage})

router.post('/', upload.single("binary"), (req, res) => {
  console.log("Processing tests for", req.file.filename)
  console.log("Parameters received:", req.body.app)
  const app = JSON.parse(req.body.app)
  const { appName, packageName, version, url, metadata, tests } = app
  if(appName == null || appName == "") res.send(400).send({ message: "appName name cannot be null or empty" });
  else if(packageName == null || packageName == "") res.send(400).send({ message: "packageName name cannot be null or empty" });
  else if(version != null && version == "") res.send(400).send({ message: "version name cannot be null or empty" });
  else if(url != null && url == "" && req.file == null) res.send(400).send({ message: "url and binary cannot be null or empty" });
  else if(metadata != null && metadata == "") res.send(400).send({ message: "metadata name cannot be null or empty" });
  else if(tests != null && tests.length == 0) res.send(400).send({ message: "tests name cannot be null or empty" });
  else {
    execute(req.file.filename, appName, packageName, version, url, metadata, tests)
    res.status(200).send()
  }
})

const execute = (apkFileName, appName, packageName, version, url, metadata, tests) => {
  doTests(apkFileName, tests)
    .then(results => {
      axios.put(process.env.DELIVER_RESULTS_ENDPOINT || "http://localhost:3000/api/result", {
        appName: appName,
        packageName: packageName,
        version: version,
        timestamp: Date.now(),
        results: results
      })
    })
    .catch(error => console.log("ERROR:", error))
}

const doTests = (apkFileName, tests) => {
  return new Promise((resolve, reject) => {
    exec(`java -jar /data/kadabra/kadabra.jar /data/kadabra/main.js -p /data/uploads/${apkFileName} -WC -APF package! -o output -s -X -C`, (error, stdout, stderr) => {
      fs.readFile('results.json', (err, data) => {
        if (err) reject(err);
        let results = JSON.parse(data);
        const testResults = Object.keys(results.detectors).map((detector) => ({
          testName: detector,
          testResult: results.detectors[detector].length,
          unit: "warnings"
        }))
        console.log("Results for:", apkFileName)
        console.log(testResults)
        // This analyzer does not support arguments to define which analyzers should be used dynamically
        console.log("After filtering")
        const testNames = tests.map(test => test.name)
        const filteredTests = testResults.filter((testResult) => testNames.indexOf(testResult.testName))
        console.log("Filtered test results:", filteredTests)
        resolve(filteredTests)
      })
    })
  })
}

module.exports = router