@echo off
chcp 65001 >nul
title Vazifedar - GitHub'a gonder
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo Git bulunamadi. https://git-scm.com/download/win adresinden kurup tekrar dene.
  pause
  exit /b 1
)

rem --- Kimlik (yalnizca ilk seferde sorulur) ---
git config user.name >nul 2>nul || goto :kimlik
goto :repo
:kimlik
set /p GADI=GitHub kullanici adin: 
set /p GMAIL=GitHub e-postan: 
git config --global user.name "%GADI%"
git config --global user.email "%GMAIL%"

:repo
if exist ".git" goto :gonder
echo Ilk kurulum: klasor GitHub'daki Vazifedar deposuna baglaniyor...
git init -q
git remote add origin https://github.com/MFatihDogan27/Vazifedar.git
git fetch -q origin
git rev-parse --verify -q origin/main >nul && goto :ana_main
git rev-parse --verify -q origin/master >nul && goto :ana_master
git checkout -q -b main
goto :gonder
:ana_main
git checkout -q -b main
git reset -q origin/main
goto :gonder
:ana_master
git checkout -q -b master
git reset -q origin/master

:gonder
for /f %%b in ('git branch --show-current') do set DAL=%%b
git add -A
git diff --cached --quiet
if not errorlevel 1 goto :yolla
echo.
echo Gonderilecek degisiklikler:
git status --short
echo.
set "MESAJ="
set /p MESAJ=Ne degisti? (bos birakirsan tarih yazilir): 
if not defined MESAJ set "MESAJ=Guncelleme %date% %time:~0,5%"
set "MESAJ=%MESAJ:"=%"
git commit -q -m "%MESAJ%"

:yolla
rem GitHub girisi tarayici penceresiyle yapilsin (Git Credential Manager)
git credential-manager --version >nul 2>nul && git config credential.helper manager
git pull -q --rebase origin %DAL% 2>nul
git push -u origin %DAL%
if errorlevel 1 (
  echo.
  echo Gonderim basarisiz oldu. Yukaridaki hata mesajini Claude'a yapistir.
  echo Kullanici adi / sifre sorduysa: GitHub artik sifre kabul etmiyor,
  echo Git for Windows'u https://git-scm.com/download/win adresinden yeniden kur.
  pause
  exit /b 1
)
echo.
echo Tamam, GitHub'a gonderildi.
pause
