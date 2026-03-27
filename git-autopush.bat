@echo off
cd /d "c:\Users\hp\Desktop\New folder\New folder"
git add .
git diff --cached --quiet && git diff --quiet || git commit -m "Auto backup %date% %time%"
git push origin master
