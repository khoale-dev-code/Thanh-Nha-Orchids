# V22 LAN printer bridge: authenticated Supabase polling, then ESC/POS raster to local ZyWell.
# Run on a Windows computer on the same LAN as the printer. Does not expose an HTTP port.
param(
  [string]$ProjectRoot='D:\freetime\vuon-lan-thanh-nha',
  [string]$PrinterIp='192.168.1.222',
  [int]$Port=9100,
  [int]$PollSeconds=4,
  [switch]$Once
)
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Drawing
function Die([string]$Text){throw ('TN LIVE PRINT V22: '+$Text)}
function Get-EnvVar([string]$File,[string]$Key){
  foreach($Line in [System.IO.File]::ReadAllLines($File)){
    if($Line -match ('^\s*'+[regex]::Escape($Key)+'\s*=\s*(.*)\s*$')){
      $Value=$Matches[1].Trim()
      if($Value.Length -gt 1 -and (($Value.StartsWith('"') -and $Value.EndsWith('"')) -or ($Value.StartsWith("'") -and $Value.EndsWith("'")))){ $Value=$Value.Substring(1,$Value.Length-2) }
      return $Value
    }
  }
  return ''
}
$EnvFile=Join-Path $ProjectRoot '.env.local'
if(-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)){Die ('Cannot find '+$EnvFile)}
$Url=(Get-EnvVar $EnvFile 'NEXT_PUBLIC_SUPABASE_URL').TrimEnd('/')
$Anon=Get-EnvVar $EnvFile 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
if(-not $Url.StartsWith('https://') -or -not $Anon){Die 'Invalid NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'}
if($Port -lt 1 -or $Port -gt 65535 -or $PollSeconds -lt 2){Die 'Invalid port or polling interval'}
$script:AccessToken='';$script:RefreshToken='';$script:ExpiresAt=[DateTime]::MinValue
function Save-Tokens($Response){
  $script:AccessToken=[string]$Response.access_token
  $script:RefreshToken=[string]$Response.refresh_token
  $Seconds=[int]$Response.expires_in
  if($Seconds -lt 120){$Seconds=300}
  $script:ExpiresAt=[DateTime]::UtcNow.AddSeconds($Seconds-70)
  if(-not $script:AccessToken){Die 'Supabase did not return an access token'}
}
function Login {
  Write-Host 'Login with your Thanh Nha Supabase Auth account. Credentials stay in this process.'
  $Email=Read-Host 'Email'
  $Secure=Read-Host 'Password' -AsSecureString
  $Ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try {$Password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($Ptr)}
  finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Ptr)}
  try {
    $Body=@{email=$Email;password=$Password} | ConvertTo-Json -Compress
    $Result=Invoke-RestMethod -Method Post -Uri ($Url+'/auth/v1/token?grant_type=password') -Headers @{apikey=$Anon} -ContentType 'application/json' -Body $Body -TimeoutSec 15
    Save-Tokens $Result
  }finally {$Password=$null;$Body=$null}
  Write-Host 'Authenticated. Only staff-authorized print jobs can be claimed.' -ForegroundColor Green
}
function Refresh-Login {
  if([DateTime]::UtcNow -lt $script:ExpiresAt){return}
  $Body=@{refresh_token=$script:RefreshToken} | ConvertTo-Json -Compress
  $Result=Invoke-RestMethod -Method Post -Uri ($Url+'/auth/v1/token?grant_type=refresh_token') -Headers @{apikey=$Anon} -ContentType 'application/json' -Body $Body -TimeoutSec 15
  Save-Tokens $Result
}
function Rpc([string]$Name,[hashtable]$Payload){
  Refresh-Login
  $Headers=@{apikey=$Anon;Authorization=('Bearer '+$script:AccessToken)}
  $Body=$Payload|ConvertTo-Json -Compress -Depth 6
  return Invoke-RestMethod -Method Post -Uri ($Url+'/rest/v1/rpc/'+$Name) -Headers $Headers -ContentType 'application/json' -Body $Body -TimeoutSec 20
}
function Draw-Line($Graphics,[ref]$Position,[string]$Text,[float]$FontPx,[bool]$Bold){
  if([string]::IsNullOrWhiteSpace($Text)){return}
  $Style=if($Bold){[System.Drawing.FontStyle]::Bold}else{[System.Drawing.FontStyle]::Regular}
  $Font=[System.Drawing.Font]::new('Arial',$FontPx,$Style,[System.Drawing.GraphicsUnit]::Pixel)
  $Format=[System.Drawing.StringFormat]::new()
  $Format.Alignment=[System.Drawing.StringAlignment]::Center
  $Format.Trimming=[System.Drawing.StringTrimming]::Word
  try {
    $Bounds=[System.Drawing.SizeF]::new([float]532,[float]850)
    $Size=$Graphics.MeasureString($Text,$Font,$Bounds,$Format)
    $Height=[int][Math]::Ceiling($Size.Height)+5
    if(($Position.Value+$Height) -gt 1500){throw 'Note is too long for the thermal print canvas'}
    $Rect=[System.Drawing.RectangleF]::new([float]22,[float]$Position.Value,[float]532,[float]$Height)
    $Graphics.DrawString($Text,$Font,[System.Drawing.Brushes]::Black,$Rect,$Format)
    $Position.Value=$Position.Value+$Height+2
  }finally{$Font.Dispose();$Format.Dispose()}
}
function Draw-Rule($Graphics,[ref]$Position){
  $P=[System.Drawing.Pen]::new([System.Drawing.Color]::Black,2)
  $P.DashStyle=[System.Drawing.Drawing2D.DashStyle]::Dash
  try{$Graphics.DrawLine($P,18,$Position.Value,558,$Position.Value)}finally{$P.Dispose()}
  $Position.Value=$Position.Value+18
}
function Send-LiveNote($Job){
  $Width=576;$HeightMax=1550
  $Bmp=[System.Drawing.Bitmap]::new($Width,$HeightMax,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $Graphics=[System.Drawing.Graphics]::FromImage($Bmp)
  try {
    $Graphics.Clear([System.Drawing.Color]::White)
    $Graphics.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $Graphics.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $Y=26
    Draw-Line $Graphics ([ref]$Y) 'VUON LAN THANH NHA' 26 $true
    Draw-Line $Graphics ([ref]$Y) 'NOTE LIVESTREAM' 23 $true
    Draw-Rule $Graphics ([ref]$Y)
    Draw-Line $Graphics ([ref]$Y) ([string]$Job.note_code) 33 $true
    Draw-Line $Graphics ([ref]$Y) ([string]$Job.customer_name) 46 $true
    if($Job.customer_phone){Draw-Line $Graphics ([ref]$Y) ([string]$Job.customer_phone) 36 $true}
    if($Job.account_name){Draw-Line $Graphics ([ref]$Y) ('@ '+[string]$Job.account_name) 28 $true}
    Draw-Line $Graphics ([ref]$Y) ('NGUON: '+[string]$Job.platform) 23 $false
    if($Job.item_summary){Draw-Rule $Graphics ([ref]$Y);Draw-Line $Graphics ([ref]$Y) ('HANG: '+[string]$Job.item_summary) 26 $true;Draw-Line $Graphics ([ref]$Y) ('SO LUONG: '+[string]$Job.quantity) 24 $true}
    if($Job.packing_note){Draw-Line $Graphics ([ref]$Y) ('GHI CHU: '+[string]$Job.packing_note) 23 $false}
    Draw-Rule $Graphics ([ref]$Y)
    Draw-Line $Graphics ([ref]$Y) ('IN LUC: '+(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')) 24 $false
    Draw-Line $Graphics ([ref]$Y) 'PHIEU TAM - CHUA CHOT DON' 19 $true
    $UsedHeight=[int][Math]::Min($HeightMax,([int][Math]::Ceiling($Y/8.0)*8)+38)
    $Client=[Net.Sockets.TcpClient]::new()
    try {
      $Ar=$Client.BeginConnect($PrinterIp,$Port,$null,$null)
      if(-not $Ar.AsyncWaitHandle.WaitOne(4500)){throw 'Printer TCP connection timed out'}
      $Client.EndConnect($Ar)
      $Stream=$Client.GetStream();$Stream.WriteTimeout=12000
      $Init=[byte[]](27,64);$Stream.Write($Init,0,$Init.Length)
      # Draw as monochrome image GS v 0, in 128-row bands for wide ESCPOS compatibility.
      $Rect=[System.Drawing.Rectangle]::new(0,0,$Width,$UsedHeight)
      $Bits=$Bmp.LockBits($Rect,[System.Drawing.Imaging.ImageLockMode]::ReadOnly,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      try {
        $Stride=[Math]::Abs($Bits.Stride)
        $Pixels=[byte[]]::new($Stride*$UsedHeight)
        [Runtime.InteropServices.Marshal]::Copy($Bits.Scan0,$Pixels,0,$Pixels.Length)
        $RowBytes=72
        for($Start=0;$Start -lt $UsedHeight;$Start+=128){
          $Band=[Math]::Min(128,$UsedHeight-$Start)
          $Packet=[byte[]]::new(8+($RowBytes*$Band))
          $Packet[0]=29;$Packet[1]=118;$Packet[2]=48;$Packet[3]=0
          $Packet[4]=[byte]($RowBytes -band 255);$Packet[5]=[byte]([int]($RowBytes/256))
          $Packet[6]=[byte]($Band -band 255);$Packet[7]=[byte]([int]($Band/256))
          for($R=0;$R -lt $Band;$R++){
            $YRow=$Start+$R
            for($X=0;$X -lt $Width;$X++){
              $PixelIndex=$YRow*$Stride+$X*4
              if($Pixels[$PixelIndex+2] -lt 150){
                $TargetIndex=8+$R*$RowBytes+[int][Math]::Floor($X/8)
                $Packet[$TargetIndex]=[byte]($Packet[$TargetIndex] -bor (128 -shr ($X%8)))
              }
            }
          }
          $Stream.Write($Packet,0,$Packet.Length)
        }
      } finally {$Bmp.UnlockBits($Bits)}
      $Tail=[byte[]](10,10,10,29,86,0)
      $Stream.Write($Tail,0,$Tail.Length)
      $Stream.Flush()
    } finally {$Client.Close()}
  } finally {$Graphics.Dispose();$Bmp.Dispose()}
}
Write-Host '=== THANH NHA LIVE NOTE PRINT BRIDGE V22 ==='
Write-Host ('Printer: '+$PrinterIp+':'+$Port+' | interval: '+$PollSeconds+'s')
Write-Host 'The bridge sends print bytes to your local LAN printer. Leave this window running.'
Write-Host 'Do not share this terminal session; it handles customer data and a user access token.'
Login
while($true){
  try{
    $Raw=Rpc 'family_claim_live_note_job' @{}
    if($null -ne $Raw){
      $Item=@($Raw)|Select-Object -First 1
      if($Item -and $Item.job_id){
        Write-Host ('[JOB] '+$Item.note_code)
        try {
          Send-LiveNote $Item
          Rpc 'family_finish_live_note_job' @{p_job_id=[string]$Item.job_id;p_success=$true;p_error=''} | Out-Null
          Write-Host '[SENT] Print bytes sent to LAN printer.' -ForegroundColor Green
        }catch{
          $Failure='Print transmission failed; check the paper and printer before retrying.'
          try{Rpc 'family_finish_live_note_job' @{p_job_id=[string]$Item.job_id;p_success=$false;p_error=$Failure} | Out-Null}catch{Write-Warning 'Could not update job state; check Supabase.'}
          Write-Warning $Failure
        }
      }
    }
  }catch{Write-Warning 'Cannot poll Supabase. Confirm credentials, migration 007 and Internet connectivity.'}
  if($Once){break}
  Start-Sleep -Seconds $PollSeconds
}
