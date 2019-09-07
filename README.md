# Sublime Merge for VSCode

Sublime Merge integration for Visual Studio Code

## Features

This extension enables the following commands, available from the
command palette when in a workspace with a Git repository:

- `Open repository in Sublime Merge`: Opens the current workspace in Sublime Merge
- `Blame in Sublime Merge`: Opens the **Blame** view in Sublime Merge
- `File history in Sublime Merge`: Shows the **history** (log) of the current file in Sublime Merge
- `Line history in Sublime Merge`: Shows the history of the **selected line(s)** in Sublime Merge
- `Show my commits in Sublime Merge`: Show commits from the **current Git user** in Sublime Merge

Contextual menu items for the editor are also provided and dependent on whether a selection is present or not.

## Requirements

Make sure that `git` and the `smerge` commands are available within your PATH.

## Known Issues / TODO

- The extension hasn't been tested on Windows yet
- Tests are not present

This is my first VSCode extension, therefore any constructive feedback is very welcome.

## Release Notes

See the [Changelog](CHANGELOG.md)

## Special Thanks

I've been able to start working on this extension thanks to the personal development time kindly allowed
by my current employer, [Altmetric](https://www.altmetric.com/jobs/).
