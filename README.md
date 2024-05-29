# bash-fun-setup
Sets up a library of helper functions in a specified file to be sourced in your steps later

```sh
wget -O ~/fun.sh https://raw.githubusercontent.com/actions-rindeal/setup-bash-fun/master/fun.sh
```

```yaml
jobs:
  JOB_NAME:
    name: "JOB'S PRETTY NAME"

    runs-on: ubuntu-latest
    
    defaults:
      run:
        # -o noclobber: prevent existing regular files from being overwritten by redirection of output
        # -o noexec: This option will not execute commands; it’s useful for checking a script for syntax errors.
        # -o verbose -o xtrace
        shell: bash --noprofile --norc -o errexit -o pipefail -o nounset {0}

    steps:
    - run: |
      wget -O ~/fun.sh https://raw.githubusercontent.com/actions-rindeal/setup-bash-fun/master/fun.sh
      source ~/fun.sh
      # have fun with BASH

    - run: |
      source ~/fun.sh
      # ...
```
