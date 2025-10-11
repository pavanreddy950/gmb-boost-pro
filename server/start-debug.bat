@echo off
cd /d %~dp0
echo Starting server...
node server.js > start-log.txt 2>&1



