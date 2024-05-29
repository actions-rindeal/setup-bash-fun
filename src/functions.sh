#!/bin/bash

## Usage:
##     set-failed "No 'repo' input provided."
##     set-failed "Invalid 'repo' input." "Check 'repo' format: '%s'" "${REPO}"
set-failed() { printf "::error title=$1::${2-$1}\n" "${@:2}" ; exit 123 ; }
