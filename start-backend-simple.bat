@echo off
cd "D:\Nidhi - College\Sem 5\SIH PROJECT\OnShift\apps\backend"
where node
where npm
if exist node_modules (
    echo Node modules found
) else (
    echo Installing dependencies...
    call npm install
)
echo Starting backend server...
call npm run dev