const axios = require('axios')
const router = require('express').Router()
const multer = require('multer')
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const resultsDir = process.env.UPLOADS_HOME || "./data/uploads"
    const resultsPath = `${resultsDir}/${Date.now()}`
    console.log("Upload on", resultsPath)
    fs.mkdirSync(resultsPath, { recursive: true })
    cb(null, resultsPath)
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

const upload = multer({storage: storage})

router.post('/', upload.single("binary"), (req, res) => {
  console.log("Analyzing file:", req.file)
  const app = JSON.parse(req.body.app)
  const { appName, packageName, version, tests } = app
  const { url, metadata } = app.data

  console.log("Parameters received:", appName)
  console.log("Parameters received:", tests)

  if(appName == null || appName == "") res.send(400).send({ message: "appName name cannot be null or empty" });
  else if(packageName == null || packageName == "") res.send(400).send({ message: "packageName name cannot be null or empty" });
  else if(version != null && version == "") res.send(400).send({ message: "version name cannot be null or empty" });
  else if(url != null && url == "") res.send(400).send({ message: "url name cannot be null or empty" });
  else if(metadata != null && metadata == "") res.send(400).send({ message: "metadata name cannot be null or empty" });
  else if(tests != null && tests.length == 0) res.send(400).send({ message: "tests name cannot be null or empty" });
  else {
    setTimeout(() => execute(appName, packageName, version, tests), 1 * 1000)
    res.status(200).send()
  }
})

const execute = async (appName, packageName, version, tests) => {
  const resultsEndpoint = process.env.DELIVER_RESULTS_ENDPOINT || "http://localhost:3000/api/result"
  console.log("Responde to server");
  axios.put(resultsEndpoint, {
    appName: appName,
    packageName: packageName,
    version: version,
    timestamp: Date.now(),
    results: await doTests(tests)
  })
  .catch(error => console.log("Error:", error))
  console.log("Responded to server");
}

const doTests = async (tests) => {

  const pipePath = "/hostpipe"
  const outputPath = "/test/output.txt"
  const commandToRun = "docker run -it -v /home/campos/git/greenstamp/apk:/apks --rm wcec /bin/bash /apks/rtp_new.apk 2>&1 | tee /data/greenstamp/wcec/output.txt"

  console.log("delete previous output")
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)

  console.log("writing to pipe...")
  const wstream = fs.createWriteStream(pipePath)
  wstream.write(commandToRun)
  wstream.close()

  console.log("waiting for output.txt...") //there are better ways to do that than setInterval
  let timeout = 3600000 //stop waiting after 1 hour (something might be wrong)
  const timeoutStart = Date.now()
  

  function waitForVariableChange(variable) {
    return new Promise((resolve) => {
        const myLoop = setInterval(function () {
          if (Date.now() - timeoutStart > timeout) {
              clearInterval(myLoop)
              console.log("timed out")
              rounded = 0
              resolve(variable.value);
          } else {
              //if output.txt exists, read it
              console.log("output.txt exists? ")
              if (fs.existsSync(outputPath)) {
                console.log("output.txt Finished??")
                var data = fs.readFileSync(outputPath).toString()
                if(data.indexOf('Finished') >= 0){
                  console.log("###################### Finished ########################")
                  console.log(Date.now() - timeoutStart / ( 60 * 1000 )) // Test time in minutes
    
                  const pattern = /\d+\.\d+/g; // Matches all occurrences of "number.number"
    
                  const matches = [...data.matchAll(pattern)];
                  if (matches.length > 0) {
                    console.log('Found matches:');
                    matches.forEach((match) => console.log(match[0]));
                    const floatValue = parseFloat(matches[matches.length-1]);
                    variable.value = Math.round(floatValue);
                    console.log("value:" + variable.value);
                    resolve(variable.value);
                  } else {
                    console.log('No matches found');
                  }
    
    
                clearInterval(myLoop)
                
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath) //delete the output file
    
                }
              }
          }
      }, 5000);
    });
  }

  const variable = {
    hasChanged: false,
    value: 0,
  };

  async function myFunction() {
    console.log('Waiting for variable change...');
    await waitForVariableChange(variable);
    console.log('Variable has changed:', variable.value);
  }
  
  await myFunction();

  console.log("###################### Return: " + variable.value + "########################")
  return tests.map(test => ({
    name: test.name,
    parameters: test.parameters,
    result: variable.value,
    unit: "Wh"
  }))
}

module.exports = router
