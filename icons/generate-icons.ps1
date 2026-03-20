Add-Type -AssemblyName System.Drawing

$canvasSize = 1024
$glyph = [string][char]0x6574
$fontSize = 540
$fontCandidates = @(
  'Noto Sans JP Black',
  'Yu Gothic UI Semibold',
  'BIZ UDPGothic',
  'Meiryo'
)

$backgroundLight = [System.Drawing.ColorTranslator]::FromHtml('#8CC9C2')
$backgroundMid = [System.Drawing.ColorTranslator]::FromHtml('#6F9FC5')
$backgroundDark = [System.Drawing.ColorTranslator]::FromHtml('#4169AC')
$textColor = [System.Drawing.ColorTranslator]::FromHtml('#FFFFFF')

$outputDir = $PSScriptRoot

function Get-InstalledFontName {
  param(
    [string[]]$Candidates
  )

  $installed = (New-Object System.Drawing.Text.InstalledFontCollection).Families |
    Select-Object -ExpandProperty Name

  foreach ($candidate in $Candidates) {
    if ($installed -contains $candidate) {
      return $candidate
    }
  }

  return 'Meiryo'
}

function New-AppIconBitmap {
  param(
    [string]$FontName
  )

  $bitmap = New-Object System.Drawing.Bitmap $canvasSize, $canvasSize
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

  $rect = New-Object System.Drawing.Rectangle 0, 0, $canvasSize, $canvasSize
  $backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $backgroundLight, $backgroundDark, 45)
  $colorBlend = New-Object System.Drawing.Drawing2D.ColorBlend 3
  $colorBlend.Colors = [System.Drawing.Color[]]@($backgroundLight, $backgroundMid, $backgroundDark)
  $colorBlend.Positions = [single[]]@(0.0, 0.4, 1.0)
  $backgroundBrush.InterpolationColors = $colorBlend
  $textBrush = New-Object System.Drawing.SolidBrush($textColor)
  $stringFormat = New-Object System.Drawing.StringFormat([System.Drawing.StringFormat]::GenericDefault)
  $fontFamily = New-Object System.Drawing.FontFamily($FontName)
  $fontStyle = [System.Drawing.FontStyle]::Regular
  $textPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $textPath.AddString($glyph, $fontFamily, [int]$fontStyle, [single]$fontSize, (New-Object System.Drawing.Point 0, 0), $stringFormat)
  $bounds = $textPath.GetBounds()
  $offsetX = (($canvasSize - $bounds.Width) / 2) - $bounds.X
  $offsetY = (($canvasSize - $bounds.Height) / 2) - $bounds.Y - 4
  $matrix = New-Object System.Drawing.Drawing2D.Matrix
  $matrix.Translate($offsetX, $offsetY)
  $textPath.Transform($matrix)

  $graphics.FillRectangle($backgroundBrush, $rect)
  $graphics.FillPath($textBrush, $textPath)

  $backgroundBrush.Dispose()
  $textBrush.Dispose()
  $matrix.Dispose()
  $textPath.Dispose()
  $fontFamily.Dispose()
  $stringFormat.Dispose()
  $graphics.Dispose()

  return $bitmap
}

function Save-ScaledIcon {
  param(
    [System.Drawing.Image]$SourceImage,
    [int]$Size,
    [string]$OutputPath
  )

  $scaled = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($scaled)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.DrawImage($SourceImage, 0, 0, $Size, $Size)
  $scaled.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $scaled.Dispose()
}

$fontName = Get-InstalledFontName -Candidates $fontCandidates
$masterIcon = New-AppIconBitmap -FontName $fontName

try {
  Save-ScaledIcon -SourceImage $masterIcon -Size 512 -OutputPath (Join-Path $outputDir 'icon-512.png')
  Save-ScaledIcon -SourceImage $masterIcon -Size 192 -OutputPath (Join-Path $outputDir 'icon-192.png')
  Save-ScaledIcon -SourceImage $masterIcon -Size 180 -OutputPath (Join-Path $outputDir 'apple-touch-icon.png')
  Write-Output ("Generated icons with font: {0}" -f $fontName)
} finally {
  $masterIcon.Dispose()
}
