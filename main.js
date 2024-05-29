const https = require('https')
const fs = require('fs')
const url = require('url')
const os = require('os')
const path = require('path')


// Global constants
const REPO_NAME = 'actions-rindeal/setup-bash-fun'
const DEFAULT_REF = 'master'
const SRC_BASH_FUN_PATH = 'fun.sh'
const DEFAULT_DEST = `~/${SRC_BASH_FUN_PATH}`


// Define the functions from actions/core here
function getInput(name, required) {
  const val = process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] || ''
  if (required && !val) {
    throw new Error(`Input required and not supplied: ${name}`)
  }
  return val.trim()
}

function setFailed(message) {
  process.exitCode = 1
  issueCommand('error', {}, message instanceof Error ? message.toString() : message)
}

// TODO this re-implementation is wrong, look at the reference implementation and fix it
function setOutput(name, value) {
  process.stdout.write(`::set-output name=${name}::${value}\n`)
}

function issueCommand(command, properties, message) {
  const cmdStr = `::${command} ${Object.entries(properties).map(([key, val]) => `${key}=${escapeProperty(val)}`).join(',')}\n${escapeData(message)}`
  process.stdout.write(cmdStr + os.EOL)
}

function escapeData(s) {
  return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
}

function escapeProperty(s) {
  return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/:/g, '%3A').replace(/,/g, '%2C')
}


function run() {
  try {
    let ref = getInput('ref') || DEFAULT_REF
    let dest = getInput('dest') || DEFAULT_DEST

    // Validate and set default values for inputs
    if (!/^[a-zA-Z0-9_.-]*$/.test(ref)) {
      setFailed('Invalid ref input. It must conform to GitHub\'s git reference syntax.')
      return
    }

    const downloadUrl = `https://raw.githubusercontent.com/${REPO_NAME}/${ref}/${FILE_NAME}`

    dest = path.resolve(dest.startsWith('~') ? os.homedir() + dest.slice(1) : dest)

    if (fs.existsSync(dest)) {
      setFailed('Destination file already exists.')
      return
    }

    // Download the file
    const file = fs.createWriteStream(dest)
    https.get(downloadUrl, function(response) {
      response.pipe(file)
      file.on('finish', function() {
        file.close(() => {
          setOutput('message', `File downloaded successfully to ${dest}`)
        })
      })
    }).on('error', function(err) {
      fs.unlink(dest)
      setFailed(`Failed to download file: ${err.message}`)
    })
  } catch (error) {
    setFailed(error.message)
  }
}

run()
