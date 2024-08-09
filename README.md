setup-bash-fun!
================

Sets up a library of helper functions in a specified file to be sourced in your steps later

How to Run
--------------

### The Easisest Way

```yaml
jobs:
  'my-job':
    runs-on: ubuntu-latest
    defaults:
      run:
        shell: bash --noprofile --norc -o errexit -o pipefail -o nounset -c "source ~/fun.sh;  set +o verbose +o xtrace  ; source '{0}'"
    steps:
      - uses: 'actions-rindeal/setup-bash-fun@master'
      - run: |
        # now you can already use functions from the BASH Fun library
```

### Semi-manual Way

```yaml
jobs:
  'my-job':
    runs-on: ubuntu-latest
    defaults:
      run:
        # -o verbose -o xtrace
        shell: bash --noprofile --norc -o errexit -o pipefail -o nounset {0}
    steps:
      - uses: 'actions-rindeal/setup-bash-fun@master'
      - run: |
        # source on demand only
        source ~/fun.sh
        # ...
```

### Manual Way

Download the library yourself:

```sh
wget -O ~/fun.sh https://github.com/actions-rindeal/bash-fun/raw/master/fun.sh
```

And use it however you want

```yaml
jobs:
  'my-job':
    name: "JOB'S PRETTY NAME"
    runs-on: ubuntu-latest
    defaults:
      run:
        # -o noclobber: prevent existing regular files from being overwritten by redirection of output
        # -o noexec: This option will not execute commands; it’s useful for checking a script for syntax errors.
        # -o verbose -o xtrace
        shell: bash --noprofile --norc -o errexit -o pipefail -o nounset {0}
    steps:
      - run: wget -O ~/fun.sh https://github.com/actions-rindeal/bash-fun/raw/master/fun.sh
      - run: |
        source ~/fun.sh
        # have fun with BASH
  
      - run: |
        source ~/fun.sh
        # ...
```
