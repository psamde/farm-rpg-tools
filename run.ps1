# Prefer an installed Python; otherwise use Codex's bundled runtime on this PC.
$farmPythonCommand = Get-Command python -ErrorAction SilentlyContinue
$farmBundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$farmVenvPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (Test-Path -LiteralPath $farmVenvPython) {
    $farmPythonExe = $farmVenvPython
} elseif (Test-Path -LiteralPath $farmBundledPython) {
    $farmPythonExe = $farmBundledPython
} elseif ($farmPythonCommand) {
    $farmPythonExe = $farmPythonCommand.Source
} else {
    throw 'Install Python 3.10 or newer and add it to PATH.'
}
Push-Location $PSScriptRoot
try {
    & $farmPythonExe (Join-Path $PSScriptRoot 'farmdata.py') @args
    $farmExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $farmExitCode
