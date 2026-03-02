# CDU Onex Dashboard - Setup Guide

This tool automates the entry of internal marks into the Chaitanya Onex portal.

## 🚀 Pre-requisites (Must do first)
Before running the dashboard, you MUST install **Node.js**:
1. Go to [https://nodejs.org/](https://nodejs.org/)
2. Download and install the **LTS** version (Recommended for most users).

## 💻 How to Run
Once Node.js is installed:
- **Windows:** Double-click `START_WINDOWS.bat`
- **Mac:** Double-click `START_MAC.command`

The first time you run it, it will take 2-3 minutes to download the necessary browser drivers. After that, it will automatically open your Chrome browser to `http://localhost:3001`.

## 📖 How to Use
1. **Enter Credentials**: Enter your Chaitanya portal Username and Password at the top right.
2. **Setup Context**: Check the bars on the left (Program Type, Course, Subject, etc.) to make sure they match exactly what you want to fill.
3. **Load Sheet**: Click **Load Sheet** and select your CSV file. 
4. **Sync Marks**: Click **Sync Marks**. 
5. **Manual Save**: The robot will type the marks for you. Once finished, the dashboard will tell you to **manually click "Save" and "OK"** on the portal browser window.
6. **Export**: Once you click OK on the portal, you can click **Export** on the dashboard to download the updated CSV with the "YES" statuses.

## ⚠️ Important Notes
- Keep the terminal window open while using the app.
- Do not close the Chrome window that opens until the robot finishes typing and you have clicked Save.
- Use the **Clear** button (Red Trash Icon) before uploading a brand new subject's sheet.
