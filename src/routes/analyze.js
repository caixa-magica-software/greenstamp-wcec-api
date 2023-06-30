const axios = require('axios')
const router = require('express').Router()
const multer = require('multer')
const fs = require('fs');
const https = require('https');
const path = require('path')

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
    if(req.file != null) {
      try{
        execute(req.file.destination, req.file.path, appName, packageName, version, url, metadata, tests)
      } catch(error){
        console.log(error)
      }
      res.status(200).send()
    } else {
      downloadApk(url)
        .then(result => {
          console.log("result.resultsPath: " + result.resultsPath)
          console.log("result.apkPath: " + result.apkPath)
          try{
            execute(result.resultsPath, result.apkPath, appName, packageName, version, url, metadata, tests)
          } catch(error){
            console.log(error)
          }
          res.status(200).send()
        })
        .catch(error => {
          console.log("downloadApk error: " + error)
          res.status(500).json({ error: error });
        })
    }    
  }
})

const downloadApk = (url) => {
  return new Promise((resolve, reject) => {
    const ts = Date.now()
    const resultsDir = process.env.UPLOADS_HOME || "./data/uploads"
    const resultsPath = `${resultsDir}/${ts}`

    fs.mkdirSync(resultsPath, { recursive: true })
    const fileName = `${ts}.apk`
    const output = fs.createWriteStream(`${resultsPath}/${fileName}`)

    console.log("resultsDir: " + resultsDir);
    console.log("resultsPath: " + resultsPath);
    console.log("fileName: " + fileName);

    console.log("Going to download from:", url)
    console.log("Going to download on:", `${resultsPath}/${fileName}`)
    https.get(url, (res) => {
      console.log('apk download status code:', res.statusCode);
      if(res.statusCode != 200){
        reject({ code: res.statusCode, message: "Error during download" });
        remove(resultsPath)
      } else {
        console.log("Download OK statusCode:", res.statusCode)
      }
      res.pipe(output);
      resolve({ resultsPath: resultsPath, apkPath: `${resultsPath}/${fileName}`})
    }).on('error', (error) => {
      console.log("Error during downlad:", error)
      reject(error)
    });
  })
}

const remove = (resultsPath) => {
  console.log("remove tests for: " + resultsPath)
  // delete directory recursively
  fs.rm(resultsPath, { recursive: true }, err => {
    if (err) {
      throw err
    }

    console.log(`${resultsPath} is deleted!`)
  })
}

const execute = (resultsPath, apkPath, appName, packageName, version, url, metadata, tests) => {
  console.log("Executing tests for:", apkPath)
  const resultsEndpoint = process.env.DELIVER_RESULTS_ENDPOINT || "http://localhost:3000/api/result"
  doTests(resultsPath, apkPath, tests)
    .then(async results => {
      const testResponse = {
        appName: appName,
        packageName: packageName,
        version: version,
        timestamp: Date.now(),
        results: results
      }
      console.log("Sending test response...", testResponse)
      try{
        await axios.put(resultsEndpoint, testResponse)
      } catch(error){
        console.log(error);
      }
     
    }).catch(error => console.log("ERROR:", error))
}

const doTests = (resultsPath, apkPath, tests) => {
  return new Promise((resolve, reject) => {
    const pipePath = "/hostpipe"
    
    console.log("doTests resultsPath:" + resultsPath)
    console.log("doTests apkPath:" + apkPath)
    const fileName = path.basename(resultsPath)
    console.log("fileName:" + fileName)
    const outputPath = "/test/" + fileName + ".txt"
    console.log(outputPath)
    
    const commandToRun = "docker run -d --name " + fileName + " -v /data/greenstamp/analyzer-wcec-api/" + fileName + ":/apks --rm wcec-ubi /bin/bash /apks/"+ fileName + ".apk"+ " 2>&1 | tee /data/greenstamp/wcec/" + fileName + ".txt"
    console.log(commandToRun)

    console.log("tests: " + tests)
    console.log("delete previous output")
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)

    console.log("writing to pipe...")
    const wstream = fs.createWriteStream(pipePath)
    wstream.write(commandToRun)
    wstream.close()

    console.log("waiting for test output ...") //there are better ways to do that than setInterval
    let timeout = 3600000 //stop waiting after 1 hour (something might be wrong)
    const timeoutStart = Date.now()
    

    async function waitForVariableChange() {
      var value;
      return new Promise((resolve, reject) => {
          const myLoop = setInterval(function () {
            if (Date.now() - timeoutStart > timeout) {
                clearInterval(myLoop)
                console.log("timed out")
                rounded = 0
                reject(new Error('Something is not right!'));
            } else {
                //if output.txt exists, read it
                console.log("Check if results file exist: " + outputPath)
                if (fs.existsSync(outputPath)) {
                  console.log("Waiting for test finish")
                  var data = fs.readFileSync(outputPath).toString()
                  if(data.indexOf('Done clean script') >= 0){
                    console.log("Test Finished")
                    console.log(Date.now() - timeoutStart / ( 60 * 1000 )) // Test time in minutes
      
                    const pattern = /\d+\.\d+/g; // Matches all occurrences of "number.number"
      
                    let match;
                    const matches = [];

                    while ((match = pattern.exec(data)) !== null) {
                      matches.push(match[0]);
                      console.log(match[0])
                    }

                    if (matches.length > 0) {
                      console.log("Found matches length: " + matches.length);
                      const floatValue = parseFloat(matches[matches.length-1]);
                      value = Math.round(floatValue);
                      console.log("value:" + value);
                      resolve(value);
                    } else {
                      console.log('No matches found');
                      reject(new Error('Something is not right!'));
                    }

                    clearInterval(myLoop)
                    
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath) //delete the output file
                  }
                }
            }
        }, 5000);
      });
    }

    waitForVariableChange()
    .then((result) => {
      console.log("result: " + result);
      const testResults = tests.map(test => {
        return {
          name: test.name,
          parameters: test.parameters,
          result: result,
          unit: "detections"
        }
      })
      remove(resultsPath)
      resolve(testResults)
    }).catch(error => reject(new Error('Something is not right!')));
  })
}

module.exports = router
