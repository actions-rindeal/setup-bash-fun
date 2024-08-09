#!/bin/bash

## Usage:
##     setFailedAndExit  "No 'repo' input provided."
##     setFailedAndExit  "Invalid 'repo' input."  "Check 'repo' format: '%s'" "${REPO}"
core:setFailedAndExit() { printf "::error title=$1::${2-$1}\n" "${@:3}" ; exit 1 ; }
