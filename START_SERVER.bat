@echo off
echo ===============================================
echo  GMB BOOST PRO - BACKEND SERVER  
echo ===============================================
echo.
echo Starting server with Supabase + Firebase...
echo.

cd /d "%~dp0server"
node server.js

pause

