const axios = require('axios')
const router = require('express').Router()

router.post('/', (req, res) => {
  console.log(req.body)
  const { appName, packageName, version, url, metadata, tests } = req.body
  setTimeout(() => {
    axios.post(process.env.DELIVER_RESULTS_ENDPOINT, {
      appName: appName,
      packageName: packageName,
      version: version,
      timestamp: Date.now(),
      results: doTests(tests)
    })
  }, 1 * 1000)
  res.status(200).send()
})

const doTests = (tests) => {
  return tests.map(test => ({
    name: test.name,
    parameters: test.parameters,
    result: Math.floor(Math.random() * (100 - 10 + 1) + 10),
    unit: "Wh"
  }))
}

module.exports = router