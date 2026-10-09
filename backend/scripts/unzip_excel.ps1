Add-Type -AssemblyName System.IO.Compression.FileSystem
$sourceZip = "d:\Aplikasi\JigFixtures\NEW MAPPING EUY.xlsx"
$destination = "d:\Aplikasi\JigFixtures\backend\extracted_xlsx"
if (Test-Path $destination) {
    Remove-Item -Path $destination -Recurse -Force
}
[System.IO.Compression.ZipFile]::ExtractToDirectory($sourceZip, $destination)
Write-Output "Successfully extracted to $destination"
