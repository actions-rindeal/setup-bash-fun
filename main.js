const crypto = require('crypto')
const fs = require('fs')
const https = require('https')
const os = require('os')
const path = require('path')
const url = require('url')


// Global constants
const SRC_REPO_NAME = 'actions-rindeal/setup-bash-fun'
const SRC_REF_DEFAULT = 'master'
const SRC_BASH_FUN_PATH = 'fun.sh'
const DEST_DEFAULT = `~/${SRC_BASH_FUN_PATH}`


//region /////////////////////  Super Feathertweight `@actions/core` class  /////////////////////////////////////////

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
/**
 * @class Core
 * @description This class provides utility methods for handling environment variables, issuing commands, logging, and managing output groups. It is designed to be used in a Node.js environment.
 * @requires process - A global object used for accessing environment variables, writing to stdout, and setting the exit code of the script.
 * @requires os - Provides operating system-related utility methods and properties.
 * @requires path - Provides utilities for working with file and directory paths.
 * @requires fs - Provides an API for interacting with the file system.
 * @requires crypto - Provides cryptographic functionality.
 */
class Core {
  /**
   * Gets the input value of the given name from the environment variables.
   * @param {string} name - The name of the input to get.
   * @param {boolean} required - Whether the input is required.
   * @returns {string} The input value.
   */
  static getInput(name, required) {
    const val = process.env[`INPUT_${name.replace(/-/g, '_').toUpperCase()}`] || ''
    if (required && !val) { throw new Error(`Input required and not supplied: ${name}`) }
    return val.trim()
  }
  /**
   * Checks if the runner is in debug mode.
   * @returns {boolean} Whether the runner is in debug mode.
   */
  static isDebug() { return process.env['RUNNER_DEBUG'] === '1' }
  /**
   * Issues a debug command.
   * @param {string} message - The debug message.
   */
  static debug(message) { this.#issueCommand('debug', {}, message) }
  /**
   * Sets the action status to failed.
   * @param {string | Error} message - add error issue message
   */
  static setFailed(message) { process.exitCode = 1 ; this.error(message) }
  /**
   * Adds an error issue.
   * @param {string | Error} message - error issue message. Errors will be converted to string via toString()
   * @param {AnnotationProperties} properties - optional properties to add to the annotation.
   */
  static error(message, properties = {}) { this.#issueCommand('error', new AnnotationProperties(properties), message instanceof Error ? message.toString() : message) }
  /**
   * Adds a warning issue.
   * @param {string | Error} message - warning issue message. Errors will be converted to string via toString()
   * @param {AnnotationProperties} properties - optional properties to add to the annotation.
   */
  static warning(message, properties = {}) { this.#issueCommand('warning', new AnnotationProperties(properties), message instanceof Error ? message.toString() : message) }
  /**
   * Adds a notice issue.
   * @param {string | Error} message - notice issue message. Errors will be converted to string via toString()
   * @param {AnnotationProperties} properties - optional properties to add to the annotation.
   */
  static notice(message, properties = {}) { this.#issueCommand('notice', new AnnotationProperties(properties), message instanceof Error ? message.toString() : message) }
  /**
   * Writes info to log with console.log.
   * @param {string} message - info message
   */
  static info(message) { process.stdout.write(message + os.EOL) }
  /**
   * Begins an output group.
   * @param {string} name - The name of the output group
   */
  static startGroup(name) { this.#issueCommand('group', {}, name) }
  /**
   * Ends an output group.
   */
  static endGroup() { this.#issueCommand('endgroup', {}) }
  /**
   * Wrap an asynchronous function call in a group.
   * @param {string} name - The name of the group
   * @param {() => Promise<T>} fn - The function to wrap in the group
   * @returns {Promise<T>}
   */
  static async group(name, fn) { this.startGroup(name) ; try { return await fn() } finally { this.endGroup() } }
  /**
   * Enables or disables the echoing of commands into stdout for the rest of the step.
   * @param {boolean} enabled
   */
  static setCommandEcho(enabled) { this.#issueCommand('echo', {}, enabled ? 'on' : 'off') }
  /**
   * Gets the value of a state set by this action's main execution.
   * @param {string} name - name of the state to get
   * @returns {string}
   */
  static getState(name) { return process.env[`STATE_${name}`] || '' }
  /**
   * Converts the given path to the posix form.
   * @param {string} pth - Path to transform.
   * @returns {string} - Posix path.
   */
  static toPosixPath(pth) { return pth.replace(/[\\]/g, '/') }
  /**
   * Converts the given path to the win32 form.
   * @param {string} pth - Path to transform.
   * @returns {string} - Win32 path.
   */
  static toWin32Path(pth) { return pth.replace(/[/]/g, '\\') }
  /**
   * Converts the given path to a platform-specific path.
   * @param {string} pth - The path to platformize.
   * @returns {string} - The platform-specific path.
   */
  static toPlatformPath(pth) { return pth.replace(/[/\\]/g, path.sep) }
  /**
   * Issues a command.
   * @param {string} cmd - The command to issue.
   * @param {Object} props - The properties of the command.
   * @param {string} msg - The message of the command.
   */
  static #issueCommand(cmd, props, msg) { process.stdout.write(`::${cmd} ${Object.entries(props).map(([k, v]) => `${k}=${this.#escapeProperty(v)}`).join(',')}\n${this.#escapeData(msg)}` + os.EOL) }
  static #escapeData(s) { return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A') }
  static #escapeProperty(s) { return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/:/g, '%3A').replace(/,/g, '%2C') }
  /**
   * Sanitizes an input into a string so it can be passed into issueCommand safely.
   * @param {any} input - input to sanitize into a string
   * @returns {string}
   */
  static #toCommandValue(input) { return input == null ? '' : (typeof input === 'string' || input instanceof String) ? input : JSON.stringify(input) }
  /**
   * Sets the name of the output to set.
   * @param {string} name - name of the output to set
   * @param {any} value - value to store. Non-string values will be converted to a string via JSON.stringify
   */
  static setOutput(name, value) { this.#issueFileCommand('OUTPUT', this.#prepareKeyValueMessage(name, value)) }
  /**
   * Saves state for current action, the state can only be retrieved by this action's post job execution.
   * @param {string} name - name of the state to store
   * @param {any} value - value to store. Non-string values will be converted to a string via JSON.stringify
   */
  static saveState(name, value) { this.#issueFileCommand('STATE', this.#prepareKeyValueMessage(name, value)) }
  /**
   * Issues a command to a file.
   * @param {string} command - The command to issue.
   * @param {string} message - The message of the command.
   * @private
   */
  static #issueFileCommand(command, message) {
    const filePath = process.env[`GITHUB_${command}`]
    if (!filePath) { throw new Error(`Unable to find environment variable for file command ${command}`) }
    if (!fs.existsSync(filePath)) { throw new Error(`Missing file at path: ${filePath}`) }
    fs.appendFileSync(filePath, `${this.#toCommandValue(message)}${os.EOL}`, { encoding: 'utf8' })
  }
  /**
   * Prepares a key-value message for a command.
   * @param {string} key - The key of the message.
   * @param {any} value - The value of the message.
   * @returns {string} The prepared key-value message.
   * @private
   */
  static #prepareKeyValueMessage(key, value) {
    const delimiter = `ghadelimiter_${this.uuidv4()}`
    return `${key}<<${delimiter}${os.EOL}${this.#toCommandValue(value)}${os.EOL}${delimiter}`
  }
  /**
   * Generates a version 4 UUID, a randomly generated UUID, as per RFC 4122.
   * @returns {string} A random UUID string.
   */
  static uuidv4() {
    const bytes = crypto.randomBytes(16)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const p1 = (bytes[0] | bytes[1] << 8 | bytes[2] << 16 | bytes[3] << 24).toString(16)
    const p2 = (bytes[4] | bytes[5] << 8).toString(16)
    const p3 = (bytes[6] | bytes[7] << 8).toString(16)
    const p4 = (bytes[8] | bytes[9] << 8).toString(16)
    const p5 = (bytes[10] | bytes[11] << 8 | bytes[12] << 16 | bytes[13] << 24 | bytes[14] << 32 | bytes[15] << 40).toString(16)
    return `${p1}-${p2}-${p3}-${p4}-${p5}`
  }
}

//endregion /////////////////////  Lightweight portable `@actions/core` class  /////////////////////////////////////////


const core = Core


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
