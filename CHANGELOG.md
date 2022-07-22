# Change Log

## [1.3.3] - 2022-07-22
- Security fixes

## [1.3.2] - 2021-10-01
- Security fixes

## [1.3.1] - 2021-02-11
- Fix an issue on Windows where an incorrect file path was given to Sublime Merge
when opening the current file (file / line history, etc.)

## [1.3.0] - 2020-11-27
- Added configuration setting that allows to specify the path of the "smerge" executable

## [1.2.0] - 2020-09-04
- Added configuration setting to also display the branch name in the status bar item
- Allow to open Sublime Merge with no files open if the project root folder has a GIT repository

## [1.1.0] - 2020-08-07

- Added support for nested repositories; now the extension works also when a GIT repository
is not opened as the root folder of a project or workspace
- Fix: the extension should no longer trigger a "Command '...' resulted in an error" message
when trying to run one of the commands from a folder without a GIT repository

## [1.0.0] - 2020-06-13

- Added configuration settings to customise contextual menu items visibility

## [0.1.0] - 2019-12-01

- Added status bar item
- Added configuration setting to disable status bar item
- Added `.editorconfig`
- Added debug output panel (disabled by default)

## [0.0.2] - 2019-09-09

- Fixed wrong relative path when opening file/line history with multiple workspaces opened

## [0.0.1] - 2019-09-07

- Initial release
