const https = require('https')
const fs = require('fs')
const url = require('url')
const os = require('os')
const path = require('path')


// Global constants
const SRC_REPO_NAME = 'actions-rindeal/setup-bash-fun'
const SRC_REF_DEFAULT = 'master'
const SRC_BASH_FUN_PATH = 'fun.sh'
const DEST_DEFAULT = `~/${SRC_BASH_FUN_PATH}`


// Define the functions from actions/core here

/**
 * @class
 * @classdesc This class represents the properties of an annotation.
 * @property {?string} title - A title for the annotation.
 * @property {?string} file - The path of the file for which the annotation should be created.
 * @property {?number} startLine - The start line for the annotation.
 * @property {?number} endLine - The end line for the annotation. Defaults to `startLine` when `startLine` is provided.
 * @property {?number} startColumn - The start column for the annotation. Cannot be sent when `startLine` and `endLine` are different values.
 * @property {?number} endColumn - The end column for the annotation. Cannot be sent when `startLine` and `endLine` are different values. Defaults to `startColumn` when `startColumn` is provided.
 */
class AnnotationProperties {
  /**
   * @constructor
   * @param {Object} props - The properties of the annotation.
   */
  constructor(props) {
    this.title = props.title
    this.file = props.file
    this.startLine = props.startLine
    this.endLine = props.endLine
    this.startColumn = props.startColumn
    this.endColumn = props.endColumn
  }
}

class core {
  /**
   * @method
   * @description This method gets the input value of the given name from the environment variables.
   * @param {string} name - The name of the input to get.
   * @param {boolean} required - Whether the input is required.
   * @returns {string} The input value.
   */
  static getInput(name, required) {
    const val = process.env[`INPUT_${name.replace(/-/g, '_').toUpperCase()}`] || ''
    if (required && !val) {
      throw new Error(`Input required and not supplied: ${name}`)
    }
    return val.trim()
  }

  /**
   * @method
   * @description This method checks if the runner is in debug mode.
   * @returns {boolean} Whether the runner is in debug mode.
   */
  static isDebug() {
    return process.env['RUNNER_DEBUG'] === '1'
  }

  /**
   * @method
   * @description This method issues a debug command.
   * @param {string} message - The debug message.
   */
  static debug(message) {
    this.#issueCommand('debug', {}, message)
  }

  /**
   * @method
   * @description This method sets the process exit code to 1 and issues an error command.
   * @param {string|Error} message - The error message.
   */
  static setFailed(message) {
    process.exitCode = 1
    this.#issueCommand('error', {}, message instanceof Error ? message.toString() : message)
  }

  /**
   * @method
   * @description This method sets an output for the action.
   * @param {string} name - The name of the output.
   * @param {string} value - The value of the output.
   */
  static setOutput(name, value) {
    process.stdout.write(`::set-output name=${name}::${this.#escape(value)}\n`)
  }

  /**
   * @method
   * @description This method issues a command.
   * @param {string} command - The command to issue.
   * @param {Object} properties - The properties of the command.
   * @param {string} message - The message of the command.
   */
  static #issueCommand(command, properties, message) {
    const cmdStr = `::${command} ${Object.entries(properties).map(([key, val]) => `${key}=${this.#escapeProperty(val)}`).join(',')}\n${this.#escapeData(message)}`
    process.stdout.write(cmdStr + os.EOL)
  }

  /**
   * @method
   * @description This method escapes data for a command.
   * @param {string} s - The data to escape.
   * @returns {string} The escaped data.
   */
  static #escapeData(s) {
    return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
  }

  /**
   * @method
   * @description This method escapes a property for a command.
   * @param {string} s - The property to escape.
   * @returns {string} The escaped property.
   */
  static #escapeProperty(s) {
    return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/:/g, '%3A').replace(/,/g, '%2C')
  }
}





function run() {
  try {
    let ref = core.getInput('ref') || SRC_REF_DEFAULT
    let dest = getInput('dest') || DEST_DEFAULT

    // Validate and set default values for inputs
    if (!/^[a-zA-Z0-9_.-]*$/.test(ref)) {
      core.setFailed('Invalid ref input. It must conform to GitHub\'s git reference syntax.')
      return
    }

    const downloadUrl = `https://raw.githubusercontent.com/${SRC_REPO_NAME}/${ref}/${SRC_BASH_FUN_PATH}`

    dest = path.resolve(dest.startsWith('~') ? os.homedir() + dest.slice(1) : dest)

    if (fs.existsSync(dest)) {
      core.setFailed('Destination file already exists.')
      return
    }

    // Download the file
    const file = fs.createWriteStream(dest)
    https.get(downloadUrl, function(response) {
      response.pipe(file)
      file.on('finish', function() {
        file.close(() => {
          core.setOutput('message', `File downloaded successfully to ${dest}`)
        })
      })
    }).on('error', function(err) {
      fs.unlink(dest)
      core.setFailed(`Failed to download file: ${err.message}`)
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
