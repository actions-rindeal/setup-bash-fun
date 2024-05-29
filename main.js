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
    if (!Object.keys(props).length)
      return
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
   * Gets the input value of the given name from the environment variables.
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
   * Checks if the runner is in debug mode.
   * @returns {boolean} Whether the runner is in debug mode.
   */
  static isDebug() {
    return process.env['RUNNER_DEBUG'] === '1'
  }

  /**
   * Issues a debug command.
   * @param {string} message - The debug message.
   */
  static debug(message) {
    this.#issueCommand('debug', {}, message)
  }

  /**
   * Sets the action status to failed.
   * @param {string | Error} message - add error issue message
   */
  static setFailed(message) {
    process.exitCode = 1
    this.error(message)
  }

  /**
   * Adds an error issue.
   * @param {string | Error} message - error issue message. Errors will be converted to string via toString()
   * @param {AnnotationProperties} properties - optional properties to add to the annotation.
   */
  static error(message, properties = {}) {
    this.#issueCommand('error', new AnnotationProperties(properties), message instanceof Error ? message.toString() : message)
  }

  /**
   * Adds a warning issue.
   * @param {string | Error} message - warning issue message. Errors will be converted to string via toString()
   * @param {AnnotationProperties} properties - optional properties to add to the annotation.
   */
  static warning(message, properties = {}) {
    this.#issueCommand('warning', new AnnotationProperties(properties), message instanceof Error ? message.toString() : message)
  }

  /**
   * Adds a notice issue.
   * @param {string | Error} message - notice issue message. Errors will be converted to string via toString()
   * @param {AnnotationProperties} properties - optional properties to add to the annotation.
   */
  static notice(message, properties = {}) {
    this.#issueCommand('notice', new AnnotationProperties(properties), message instanceof Error ? message.toString() : message)
  }

  /**
   * Writes info to log with console.log.
   * @param {string} message - info message
   */
  static info(message) {
    process.stdout.write(message + os.EOL)
  }

  /**
   * Begins an output group.
   * @param {string} name - The name of the output group
   */
  static startGroup(name) {
    this.#issueCommand('group', {}, name)
  }

  /**
   * Ends an output group.
   */
  static endGroup() {
    this.#issueCommand('endgroup', {})
  }

  /**
   * Wrap an asynchronous function call in a group.
   * @param {string} name - The name of the group
   * @param {() => Promise<T>} fn - The function to wrap in the group
   * @returns {Promise<T>}
   */
  static async group(name, fn) {
    this.startGroup(name)
    let result
    try {
      result = await fn()
    } finally {
      this.endGroup()
    }
    return result
  }

  /**
   * Enables or disables the echoing of commands into stdout for the rest of the step.
   * @param {boolean} enabled
   */
  static setCommandEcho(enabled) {
    this.#issueCommand('echo', {}, enabled ? 'on' : 'off')
  }
  
  /**
   * Gets the value of a state set by this action's main execution.
   * @param {string} name - name of the state to get
   * @returns {string}
   */
  static getState(name) {
    return process.env[`STATE_${name}`] || ''
  }

  /**
   * Converts the given path to the posix form.
   * @param {string} pth - Path to transform.
   * @returns {string} - Posix path.
   */
  static toPosixPath(pth) {
    return pth.replace(/[\\]/g, '/')
  }

  /**
   * Converts the given path to the win32 form.
   * @param {string} pth - Path to transform.
   * @returns {string} - Win32 path.
   */
  static toWin32Path(pth) {
    return pth.replace(/[/]/g, '\\')
  }

  /**
   * Converts the given path to a platform-specific path.
   * @param {string} pth - The path to platformize.
   * @returns {string} - The platform-specific path.
   */
  static toPlatformPath(pth) {
    return pth.replace(/[/\\]/g, path.sep)
  }

  /**
   * Issues a command.
   * @param {string} command - The command to issue.
   * @param {Object} properties - The properties of the command.
   * @param {string} message - The message of the command.
   */
  static #issueCommand(command, properties, message) {
    const cmdStr = `::${command} ${Object.entries(properties).map(([key, val]) => `${key}=${this.#escapeProperty(val)}`).join(',')}\n${this.#escapeData(message)}`
    process.stdout.write(cmdStr + os.EOL)
  }

  /**
   * Escapes data for a command.
   * @param {string} s - The data to escape.
   * @returns {string} The escaped data.
   */
  static #escapeData(s) {
    return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
  }

  /**
   * Escapes a property for a command.
   * @param {string} s - The property to escape.
   * @returns {string} The escaped property.
   */
  static #escapeProperty(s) {
    return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/:/g, '%3A').replace(/,/g, '%2C')
  }

  /**
   * Sanitizes an input into a string so it can be passed into issueCommand safely.
   * @param {any} input - input to sanitize into a string
   * @returns {string}
   */
  static #toCommandValue(input) {
    if (input === null || input === undefined) {
      return ''
    } else if (typeof input === 'string' || input instanceof String) {
      return input
    }
    return JSON.stringify(input)
  }

  /**
   * Sets the name of the output to set.
   * @param {string} name - name of the output to set
   * @param {any} value - value to store. Non-string values will be converted to a string via JSON.stringify
   */
  static setOutput(name, value) {
    const filePath = process.env['GITHUB_OUTPUT']
    if (!filePath) {
      throw new Error('File path for setOutput not provided')
    }
    this.#issueFileCommand('OUTPUT', this.#prepareKeyValueMessage(name, value))
  }

  /**
   * Saves state for current action, the state can only be retrieved by this action's post job execution.
   * @param {string} name - name of the state to store
   * @param {any} value - value to store. Non-string values will be converted to a string via JSON.stringify
   */
  static saveState(name, value) {
    const filePath = process.env['GITHUB_STATE']
    if (!filePath) {
      throw new Error('File path for saveState not provided')
    }
    this.#issueFileCommand('STATE', this.#prepareKeyValueMessage(name, value))
  }

  static #issueFileCommand(command, message) {
    const filePath = process.env[`GITHUB_${command}`]
    if (!filePath) {
      throw new Error(`Unable to find environment variable for file command ${command}`)
    }
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing file at path: ${filePath}`)
    }
    fs.appendFileSync(filePath, `${this.#toCommandValue(message)}${os.EOL}`, { encoding: 'utf8' })
  }

  static #prepareKeyValueMessage(key, value) {
    const delimiter = `ghadelimiter_${uuidv4()}`
    return `${key}<<${delimiter}${os.EOL}${this.#toCommandValue(value)}${os.EOL}${delimiter}`
  }
}


function run() {
  try {
    let ref = core.getInput('ref') || SRC_REF_DEFAULT
    let dest = core.getInput('dest') || DEST_DEFAULT

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
