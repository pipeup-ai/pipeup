# Pipeup's shell link for Windows: the live link between a page and an agent on this computer, with nothing but
# what Windows comes with (PowerShell 5.1 or later). It runs beside whatever already shows the page (a localhost
# preview, or the file itself) and never changes the page. Everything stays on this computer.
#
#   powershell -ExecutionPolicy Bypass -File pipeup-link.ps1 <page.html>            start the link (Ctrl-C stops it)
#   powershell -ExecutionPolicy Bypass -File pipeup-link.ps1 comments <page.html>   print the open comments as Markdown
#   ... | powershell -ExecutionPolicy Bypass -File pipeup-link.ps1 reply <page.html>  leave a pipeup-replies block for the page
#
# Files next to the page, all named after it (lisbon.html -> lisbon.*): lisbon.link.js (where the link is; removed when
# it stops), lisbon.comments.json (the comments the page shared) and lisbon.replies.js (the agent's replies).
param([Parameter(Position = 0)][string]$First, [Parameter(Position = 1)][string]$Second)
$ErrorActionPreference = "Stop"

function Fail([string]$Words, [int]$Code = 1) { [Console]::Error.WriteLine("pipeup-link: $Words"); exit $Code }
function Say([string]$Words) { [Console]::Error.WriteLine($Words) }

function Resolve-Page([string]$Path) {
  if (-not $Path -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) { Fail "there is no file $Path" 2 }
  return (Resolve-Path -LiteralPath $Path).ProviderPath
}

function Stem([string]$Page) { return [IO.Path]::Combine([IO.Path]::GetDirectoryName($Page), [IO.Path]::GetFileNameWithoutExtension($Page)) }

$Utf8 = New-Object Text.UTF8Encoding($false)

function Session-Of([string]$Json) {
  if (-not (Test-Path -LiteralPath $Json)) { return "" }
  $m = [regex]::Match([IO.File]::ReadAllText($Json, $Utf8), '"session":"([A-Za-z0-9_-]{16,})"')
  if ($m.Success) { return $m.Groups[1].Value } else { return "" }
}

function Do-Comments([string]$Path) {
  $json = (Stem (Resolve-Page $Path)) + ".comments.json"
  if (-not (Test-Path -LiteralPath $json)) { Fail "no comments yet: start the link, and ask the person to switch on Share with my agent" }
  $data = [IO.File]::ReadAllText($json, $Utf8) | ConvertFrom-Json
  [Console]::Out.WriteLine($data.open.markdown)
}

function Do-Reply([string]$Path) {
  $page = Resolve-Page $Path
  $base = Stem $page
  $text = [Console]::In.ReadToEnd() -replace "`r`n", "`n"
  $text = $text.TrimEnd("`n")
  if ($text -notmatch "pipeup-replies") { Fail "stdin has no ``````pipeup-replies block" 2 }
  $key = Session-Of "$base.comments.json"
  $tag = ""
  if ($key) {
    $hmac = New-Object Security.Cryptography.HMACSHA256 (, $Utf8.GetBytes($key))
    $tag = -join ($hmac.ComputeHash($Utf8.GetBytes($text)) | ForEach-Object { $_.ToString("x2") })
  }
  $esc = $text.Replace("\", "\\").Replace('"', '\"').Replace("`r", "\r").Replace("`n", "\n")
  $line = "(globalThis.pipeupReplies ||= []).push({ format: `"pipeup-replies-block`", v: 1, text: `"$esc`", tag: `"$tag`" });`n"
  [IO.File]::AppendAllText("$base.replies.js", $line, $Utf8)
  $n = ([regex]::Matches($text, '(?m)^[ \t]*thread[ \t]*:')).Count
  $replies = if ($n -eq 1) { "1 reply" } else { "$n replies" }
  $name = [IO.Path]::GetFileName("$base.replies.js")
  if ($tag) { Say "Wrote $replies to $name, tagged for this session: the page adds them by itself while sharing stays on." }
  else { Say "Wrote $replies to $name. They aren't tagged (sharing isn't on), so the page asks the person before adding them." }
}

function Is-LocalOrigin([string]$Origin) {
  return $Origin -eq "null" -or $Origin -match '^http://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$'
}

function Do-Link([string]$Path) {
  $page = Resolve-Page $Path
  $base = Stem $page
  $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 0)
  $listener.Start()
  $port = $listener.LocalEndpoint.Port
  $bytes = New-Object byte[] 18
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secret = [Convert]::ToBase64String($bytes).Replace("+", "-").Replace("/", "_").TrimEnd("=")
  $linkFile = "$base.link.js"
  [IO.File]::WriteAllText($linkFile, "(globalThis.pipeupLink ||= []).push({ format: `"pipeup-link`", v: 1, url: `"http://127.0.0.1:$port/$secret`" });`n", $Utf8)
  Say "Pipeup's link for $([IO.Path]::GetFileName($page)), on this computer only (127.0.0.1:$port)."
  Say "Wrote $([IO.Path]::GetFileName($linkFile)) next to the page. Within a few seconds the page's menu offers"
  Say "Share with my agent. Once the person switches it on, the comments arrive in"
  Say "$([IO.Path]::GetFileName($base)).comments.json. Stop with Ctrl-C; that also removes $([IO.Path]::GetFileName($linkFile))."
  try {
    while ($true) {
      $client = $listener.AcceptTcpClient()
      try {
        $stream = $client.GetStream()
        $stream.ReadTimeout = 5000
        # The request line and headers, byte by byte up to the blank line, so the body is left for its own read.
        $head = New-Object Collections.Generic.List[byte]
        while ($true) {
          $b = $stream.ReadByte()
          if ($b -lt 0) { break }
          $head.Add([byte]$b)
          $c = $head.Count
          if ($c -ge 4 -and $head[$c - 4] -eq 13 -and $head[$c - 3] -eq 10 -and $head[$c - 2] -eq 13 -and $head[$c - 1] -eq 10) { break }
          if ($c -gt 16384) { break }
        }
        $lines = $Utf8.GetString($head.ToArray()) -split "`r`n"
        $parts = $lines[0] -split " "
        $method = $parts[0]; $target = if ($parts.Length -gt 1) { $parts[1] } else { "" }
        $hostName = ""; $origin = ""; $len = 0
        foreach ($l in $lines[1..($lines.Length - 1)]) {
          if ($l -match '^(?i)host:\s*(.*)$') { $hostName = $Matches[1] }
          elseif ($l -match '^(?i)origin:\s*(.*)$') { $origin = $Matches[1] }
          elseif ($l -match '^(?i)content-length:\s*(\d+)$') { $len = [int64]$Matches[1] }
        }
        $allow = ""
        if (Is-LocalOrigin $origin) { $allow = "Access-Control-Allow-Origin: $origin`r`nVary: Origin`r`n" }
        if ($hostName -ne "127.0.0.1:$port" -or -not $allow) { $status = "403 Forbidden" }
        elseif ($method -ne "POST" -or $target -ne "/$secret/comments") { $status = "404 Not Found" }
        elseif ($len -gt 8388608) { $status = "413 Content Too Large" }
        else {
          $body = New-Object byte[] $len
          $got = 0
          while ($got -lt $len) {
            $r = $stream.Read($body, $got, $len - $got)
            if ($r -le 0) { break }
            $got += $r
          }
          $json = "$base.comments.json"
          [IO.File]::WriteAllBytes("$json.tmp", $body)
          Move-Item -LiteralPath "$json.tmp" -Destination $json -Force
          $status = "204 No Content"
        }
        $reply = $Utf8.GetBytes("HTTP/1.1 $status`r`n$($allow)Cache-Control: no-store`r`nContent-Length: 0`r`nConnection: close`r`n`r`n")
        $stream.Write($reply, 0, $reply.Length)
      } catch {
        # One bad request never stops the link.
      } finally {
        $client.Close()
      }
    }
  } finally {
    $listener.Stop()
    Remove-Item -LiteralPath $linkFile -ErrorAction SilentlyContinue
  }
}

switch ($First) {
  "comments" { Do-Comments $Second }
  "reply" { Do-Reply $Second }
  { -not $_ -or $_ -eq "-h" -or $_ -eq "--help" } { Fail "usage: pipeup-link.ps1 [comments|reply] <page.html>" 2 }
  default { Do-Link $First }
}
