const crypto = require('crypto')
const fs = require('fs')
const https = require('https')
const os = require('os')
const path = require('path')
const url = require('url')


// Global constants
const SRC_REPO_NAME = 'actions-rindeal/bash-fun'
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
class AnnotationProperties { constructor({ title, file, startLine, endLine, startColumn, endColumn } = {}) { Object.assign(this, { title, file, startLine, endLine, startColumn, endColumn }) } }
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
   * Gets the trimmed values of a multiline input.
   * @param {string} name - The name of the input to get.
   * @param {boolean} required - If true, the input is required.
   * @returns {string[]} The trimmed input values.
   */
  static getMultilineInput(name, required) {
    if (required && !getInput(name)) { throw new Error(`Input "${name}" is required.`) }
    return getInput(name).split('\n').filter(x => x).map(input => input.trim())
  }
  /**
   * Gets the boolean input value according to the YAML 1.2 "core schema" specification.
   * Always trims the input value and converts it to lowercase for comparison.
   * @param {string} name - The name of the input to get.
   * @param {boolean} required - If true, the input is required.
   * @returns {boolean} The boolean value of the input.
   * @throws {TypeError} If input is not a valid boolean value.
   * @throws {Error} If input is required but not provided.
   */
  static getBooleanInput(name, required) {
    const val = getInput(name).trim().toLowerCase()
    if (required && val === '') { throw new Error(`Input "${name}" is required.`) }
    if (val === 'true') return true
    if (val === 'false') return false
    throw new TypeError(`Input "${name}" is not a valid boolean. Expected "true" or "false".`)
  }
  /**
   * Sets env variable for this action and future actions in the job
   * @param {string} name - the name of the variable to set
   * @param {Any} val - the value of the variable. Non-string values will be converted to a string via JSON.stringify
   */
  static exportVariable(name, val) {
    process.env[name] = toCommandValue(val)
    return issueFileCommand('ENV', prepareKeyValueMessage(name, val))
  }
  /**
   * Masks a secret in logs.
   * @param {string} secret - The secret to mask.
   */
  static setSecret(secret) { issueCommand('add-mask', {}, secret) }
  /**
   * Adds a path to the PATH environment variable.
   * @param {string} inputPath - The path to add.
   */
  static addPath(inputPath) { issueFileCommand('PATH', inputPath) ; process.env.PATH = `${inputPath}${path.delimiter}${process.env.PATH}` }
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
   * Writes info to log with console.log.
   * @param {string} message - info message
   */
  static info(message) { process.stdout.write(message + os.EOL) }
  /**
   * Adds a notice issue.
   * @param {string | Error} message - notice issue message. Errors will be converted to string via toString()
   * @param {AnnotationProperties} properties - optional properties to add to the annotation.
   */
  static notice(message, properties = {}) { this.#issueCommand('notice', new AnnotationProperties(properties), message instanceof Error ? message.toString() : message) }
  /**
   * Adds a warning issue.
   * @param {string | Error} message - warning issue message. Errors will be converted to string via toString()
   * @param {AnnotationProperties} properties - optional properties to add to the annotation.
   */
  static warning(message, properties = {}) { this.#issueCommand('warning', new AnnotationProperties(properties), message instanceof Error ? message.toString() : message) }
  /**
   * Adds an error issue.
   * @param {string | Error} message - error issue message. Errors will be converted to string via toString()
   * @param {AnnotationProperties} properties - optional properties to add to the annotation.
   */
  static error(message, properties = {}) { this.#issueCommand('error', new AnnotationProperties(properties), message instanceof Error ? message.toString() : message) }
  /**
   * Sets the action status to failed.
   * @param {string | Error} message - add error issue message
   */
  static setFailed(message) { process.exitCode = 1 ; this.error(message) }
  /**
   * Begins an output group.
   * @param {string} name - The name of the output group
   */
  static startGroup(name) { this.#issueCommand('group', {}, name) }
  /**
   * Wrap an asynchronous function call in a group.
   * @param {string} name - The name of the group
   * @param {() => Promise<T>} fn - The function to wrap in the group
   * @returns {Promise<T>}
   */
  static async group(name, fn) { this.startGroup(name) ; try { return await fn() } finally { this.endGroup() } }
  /**
   * Ends an output group.
   */
  static endGroup() { this.#issueCommand('endgroup', {}) }
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
   * Saves state for current action, the state can only be retrieved by this action's post job execution.
   * @param {string} name - name of the state to store
   * @param {any} value - value to store. Non-string values will be converted to a string via JSON.stringify
   */
  static saveState(name, value) { this.#issueFileCommand('STATE', this.#prepareKeyValueMessage(name, value)) }
  /**
   * Sets the name of the output to set.
   * @param {string} name - name of the output to set
   * @param {any} value - value to store. Non-string values will be converted to a string via JSON.stringify
   */
  static setOutput(name, value) { this.#issueFileCommand('OUTPUT', this.#prepareKeyValueMessage(name, value)) }
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
  static #issueCommand(command = 'missing.command', properties = {}, message = '') {
    const propStr = Object.entries(properties)
      .filter(([key, val]) => val)
      .map(([key, val]) => `${key}=${this.#escapeProperty(val)}`)
      .join(',')
    const cmdStr = `::${command} ${propStr}::${this.#escapeData(message)}`
    process.stdout.write(cmdStr + os.EOL)
  }
  static #escapeData(s) { return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A') }
  static #escapeProperty(s) { return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/:/g, '%3A').replace(/,/g, '%2C') }
  static #toCommandValue(input) { return input == null ? '' : (typeof input === 'string' || input instanceof String) ? input : JSON.stringify(input) }
  static #issueFileCommand(command, message) {
    const filePath = process.env[`GITHUB_${command}`]
    if (!filePath) { throw new Error(`Unable to find environment variable for file command ${command}`) }
    if (!fs.existsSync(filePath)) { throw new Error(`Missing file at path: ${filePath}`) }
    fs.appendFileSync(filePath, `${this.#toCommandValue(message)}${os.EOL}`, { encoding: 'utf8' })
  }
  static #prepareKeyValueMessage(key, value) {
    const delimiter = `ghadelimiter_${this.uuidv4()}`
    return `${key}<<${delimiter}${os.EOL}${this.#toCommandValue(value)}${os.EOL}${delimiter}`
  }
}

//endregion /////////////////////  Lightweight portable `@actions/core` class  /////////////////////////////////////////


const core = Core


function main() {
  try {
    core.debug('Starting the run function');
    let ref = core.getInput('ref') || SRC_REF_DEFAULT;
    core.debug(`Reference: ${ref}`);
    let dest = core.getInput('dest') || DEST_DEFAULT;
    core.debug(`Destination: ${dest}`);

    // Validate and set default values for inputs
    if (!/^[a-zA-Z0-9_.-]*$/.test(ref)) {
      core.setFailed('Invalid ref input. It must conform to GitHub\'s git reference syntax.');
      return;
    }

    const downloadUrl = `https://github.com/${SRC_REPO_NAME}/raw/${ref}/${SRC_BASH_FUN_PATH}`;
    core.debug(`Download URL: ${downloadUrl}`);

    dest = path.resolve(dest.startsWith('~') ? os.homedir() + dest.slice(1) : dest);
    core.debug(`Resolved destination: ${dest}`);

    if (fs.existsSync(dest)) {
      core.setFailed('Destination file already exists.');
      return;
    }

    // Download the file
    const file = fs.createWriteStream(dest);
    https.get(downloadUrl, function(response) {
      response.pipe(file);
      file.on('finish', function() {
        file.close(() => {
          core.setOutput('message', `BASH Fun! downloaded successfully to '${dest}'`);
          core.debug('File downloaded successfully');
        });
      });
    }).on('error', function(err) {
      fs.unlink(dest);
      core.setFailed(`Failed to download file: ${err.message}`);
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}


main()
