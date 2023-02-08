const axios = require('axios')
const router = require('express').Router()
const multer = require('multer')
const upload = multer({ storage: multer.memoryStorage() })

router.post('/', upload.single("binary"), (req, res) => {
  const app = JSON.parse(req.body.app)
  const { appName, packageName, version, url, metadata, tests } = app
  if(appName == null || appName == "") res.send(400).send({ message: "appName name cannot be null or empty" });
  else if(packageName == null || packageName == "") res.send(400).send({ message: "packageName name cannot be null or empty" });
  else if(version != null && version == "") res.send(400).send({ message: "version name cannot be null or empty" });
  else if(url != null && url == "" && req.file == null) res.send(400).send({ message: "url and binary cannot be null or empty" });
  else if(metadata != null && metadata == "") res.send(400).send({ message: "metadata name cannot be null or empty" });
  else if(tests != null && tests.length == 0) res.send(400).send({ message: "tests name cannot be null or empty" });
  else {
    setTimeout(() => execute(appName, packageName, version, url, metadata, tests), 10 * 1000)
    res.status(200).send()
  }
})

const execute = (appName, packageName, version, url, metadata, tests ) => {
  axios.put(process.env.DELIVER_RESULTS_ENDPOINT, {
    appName: appName,
    packageName: packageName,
    version: version,
    timestamp: Date.now(),
    results: doTests(tests)
  })
}

const doTests = (tests) => {
  return tests.map(test => ({
    name: test.name,
    parameters: test.parameters,
    result: Math.floor(Math.random() * (100 - 10 + 1) + 10),
    unit: "Wh"
  }))
}

module.exports = router