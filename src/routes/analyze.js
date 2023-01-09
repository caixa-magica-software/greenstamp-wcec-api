const axios = require('axios')
const router = require('express').Router()

router.post('/', (req, res) => {
  const { appName, packageName, version, url, metadata, tests } = req.body
  if(appName == null || appName == "") res.send(400).send({ message: "appName name cannot be null or empty" });
  else if(packageName == null || packageName == "") res.send(400).send({ message: "packageName name cannot be null or empty" });
  else if(version != null && version == "") res.send(400).send({ message: "version name cannot be null or empty" });
  else if(url != null && url == "") res.send(400).send({ message: "url name cannot be null or empty" });
  else if(metadata != null && metadata == "") res.send(400).send({ message: "metadata name cannot be null or empty" });
  else if(tests != null && tests.length == 0) res.send(400).send({ message: "tests name cannot be null or empty" });
  else {
    setTimeout(() => execute(req.body), 10 * 1000)
    res.status(200).send()
  }
})

const execute = (body) => {
  axios.post(process.env.DELIVER_RESULTS_ENDPOINT, {
    appName: body.appName,
    packageName: body.packageName,
    version: body.version,
    timestamp: Date.now(),
    results: doTests(body.tests)
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